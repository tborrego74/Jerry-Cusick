// Counts anonymous site events for the admin page: a visit, a calculator start, a calculator hand-off.
const { bump, body, sameSite, looksAutomated, overLimit } = require('./_lib');
const ALLOWED = new Set(['visit', 'calc_start', 'calc_send']);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const e = String(body(req).e || '');
  if (!ALLOWED.has(e) || !sameSite(req) || looksAutomated(req)) return res.status(204).end();
  try {
    if (!(await overLimit(req, 't', 60, 600))) await bump(req, [e]);
  } catch (err) { console.error('track failed:', err.message); }
  return res.status(204).end();
};
