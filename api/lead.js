// Receives a lead from the site and hands it straight to Jerry's CRM (GoHighLevel inbound webhook) and, when set up, emails it to him through Resend.
// Lead details are forwarded, never stored or logged here.
const { bump, body, sameSite, overLimit } = require('./_lib');

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, reason: 'method' });
  if (!sameSite(req)) return res.status(403).json({ ok: false, reason: 'origin' });

  const b = body(req);
  if (clean(b.company, 100)) return res.status(200).json({ ok: true }); // hidden field only bots fill in

  const name = clean(b.name, 80);
  let digits = clean(b.phone, 40).replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') digits = digits.slice(1);
  if (name.length < 2 || digits.length !== 10) return res.status(400).json({ ok: false, reason: 'invalid' });

  try {
    if (await overLimit(req, 'l', 4, 600)) return res.status(429).json({ ok: false, reason: 'slow_down' });
  } catch (err) { console.error('limit check failed:', err.message); }

  const hook = process.env.GHL_WEBHOOK_URL;
  const mailKey = process.env.RESEND_API_KEY, mailTo = process.env.LEAD_EMAIL_TO, mailFrom = process.env.LEAD_EMAIL_FROM;
  const mailReady = !!(mailKey && mailTo && mailFrom);
  if (!hook && !mailReady) return res.status(503).json({ ok: false, reason: 'not_configured' });

  const fromCalc = b.source === 'calculator';
  const parts = name.split(/\s+/);
  const lead = {
    full_name: name,
    first_name: parts[0],
    last_name: parts.slice(1).join(' '),
    phone: '+1' + digits,
    journey_stage: clean(b.stage, 60),
    best_time: clean(b.time, 40),
    calculator_summary: fromCalc ? clean(b.calc, 600) : '',
    lead_source: fromCalc ? 'Website calculator' : 'Website form',
    consent_to_contact: true,
    consent_text: 'Agreed on the website to be called or texted by Jerry Cusick about this request.',
    page: clean(b.page, 200),
    submitted_at: new Date().toISOString(),
  };

  // Two independent paths: the CRM and a plain email to Jerry. The lead counts as delivered if either one lands.
  const toCrm = async () => {
    const r = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) });
    if (!r.ok) throw new Error('crm ' + r.status);
  };
  const toEmail = async () => {
    const text = [
      'Name: ' + lead.full_name,
      'Phone: ' + lead.phone,
      'Where they are: ' + (lead.journey_stage || 'not given'),
      'Best time: ' + (lead.best_time || 'not given'),
      'Came from: ' + lead.lead_source,
      lead.calculator_summary ? 'Calculator: ' + lead.calculator_summary : '',
      'Page: ' + lead.page,
      'Sent: ' + lead.submitted_at,
      '',
      lead.consent_text,
    ].filter((l, i, all) => l || all[i - 1]).join('\n');
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + mailKey },
      body: JSON.stringify({ from: mailFrom, to: mailTo.split(',').map((x) => x.trim()).filter(Boolean), subject: 'New website lead: ' + lead.full_name, text }),
    });
    if (!r.ok) throw new Error('email ' + r.status);
  };
  const results = await Promise.allSettled([hook ? toCrm() : Promise.reject(new Error('crm off')), mailReady ? toEmail() : Promise.reject(new Error('email off'))]);
  results.forEach((x) => { if (x.status === 'rejected' && !/ off$/.test(x.reason.message)) console.error('lead forward failed:', x.reason.message); }); // status only, never the lead
  if (!results.some((x) => x.status === 'fulfilled')) return res.status(502).json({ ok: false, reason: 'delivery' });

  try { await bump(fromCalc ? [['event', 'lead'], ['event', 'lead_calc']] : [['event', 'lead']]); } catch (err) { console.error('count failed:', err.message); }
  return res.status(200).json({ ok: true });
};
