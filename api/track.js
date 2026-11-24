// Counts anonymous site events for the dashboard: page views, visits (with rough source, device and location),
// calculator starts and calculator hand-offs. Totals only.
const { bump, body, sameSite, looksAutomated, overLimit, place, header } = require('./_lib');

function page(p) {
  p = String(p || '/').toLowerCase().split(/[?#]/)[0];
  if (!/^\/[a-z0-9\-\/]{0,90}$/.test(p)) return null;
  if (p.length > 1 && !p.endsWith('/')) p += '/';
  return p;
}

function source(req, ref, utm) {
  const tag = String(utm || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30);
  let h = String(ref || '').toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9.-]/g, '').slice(0, 60);
  if (h === header(req, 'host').replace(/^www\./, '')) h = '';
  const s = tag || h;
  if (!s) return 'Direct or typed in';
  if (/google/.test(s)) return 'Google';
  if (/bing|msn/.test(s)) return 'Bing';
  if (/duckduckgo/.test(s)) return 'DuckDuckGo';
  if (/yahoo/.test(s)) return 'Yahoo';
  if (/facebook|fb\.|^fb$|fbclid/.test(s)) return 'Facebook';
  if (/instagram|^ig$/.test(s)) return 'Instagram';
  if (/linkedin|lnkd/.test(s)) return 'LinkedIn';
  if (/chatgpt|openai|perplexity|claude|copilot|gemini/.test(s)) return 'AI assistants';
  if (/zillow|realtor|redfin/.test(s)) return 'Real estate sites';
  if (/nextdoor/.test(s)) return 'Nextdoor';
  if (/yelp/.test(s)) return 'Yelp';
  return s;
}

function device(req) {
  const ua = header(req, 'user-agent');
  if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) return 'Tablet';
  if (/mobi|iphone|android/i.test(ua)) return 'Phone';
  return 'Computer';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const b = body(req);
  const e = String(b.e || '');
  if (!sameSite(req) || looksAutomated(req)) return res.status(204).end();
  let items = null;
  if (e === 'calc_start' || e === 'calc_send') items = [['event', e]];
  else if (e === 'view') {
    const p = page(b.p);
    if (p && !p.startsWith('/admin')) {
      items = [['event', 'view'], ['page', p]];
      if (Number(b.v) === 1) items.push(['event', 'visit'], ['place', place(req)], ['source', source(req, b.r, b.s)], ['device', device(req)]);
    }
  }
  if (!items) return res.status(204).end();
  try {
    if (!(await overLimit(req, 't', 120, 600))) await bump(items);
  } catch (err) { console.error('track failed:', err.message); }
  return res.status(204).end();
};
