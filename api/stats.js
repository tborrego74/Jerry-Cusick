// Numbers for the admin page. Password protected. Returns counts only.
const { storeReady, redis, day, overLimit, safeEqual, header } = require('./_lib');
const FIELDS = ['visit', 'calc_start', 'calc_send', 'lead', 'lead_calc'];

function toObject(v) {
  if (!v) return {};
  if (!Array.isArray(v)) return v;
  const o = {};
  for (let i = 0; i < v.length; i += 2) o[v[i]] = v[i + 1];
  return o;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !storeReady()) return res.status(503).json({ ok: false, reason: 'not_configured' });

  try {
    if (await overLimit(req, 'a', 20, 900)) return res.status(429).json({ ok: false, reason: 'slow_down' });
  } catch (err) { console.error('limit check failed:', err.message); }
  if (!safeEqual(header(req, 'x-admin-key'), password)) return res.status(401).json({ ok: false, reason: 'password' });

  const DAYS = 84; // twelve weeks
  const days = [];
  for (let i = DAYS - 1; i >= 0; i--) days.push(day(new Date(Date.now() - i * 86400000)));
  const uniq = [...new Set(days)];
  try {
    const out = await redis([...uniq.map((d) => ['HGETALL', 'jc:d:' + d]), ...uniq.slice(-30).map((d) => ['HGETALL', 'jc:g:' + d])]);
    const daily = uniq.map((d, i) => {
      const h = toObject(out[i]);
      const row = { date: d };
      for (const f of FIELDS) row[f] = Number(h[f] || 0);
      return row;
    });
    const places = {};
    out.slice(uniq.length).forEach((h) => {
      const o = toObject(h);
      for (const k in o) places[k] = (places[k] || 0) + Number(o[k]);
    });
    const locations = Object.entries(places).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([place, visits]) => ({ place, visits }));
    return res.status(200).json({ ok: true, today: day(), daily, locations });
  } catch (err) {
    console.error('stats failed:', err.message);
    return res.status(502).json({ ok: false, reason: 'store' });
  }
};
