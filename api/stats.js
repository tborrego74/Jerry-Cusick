// Numbers for the admin page. Password protected. Returns counts only.
const { storeReady, db, day, overLimit, safeEqual, header } = require('./_lib');
const FIELDS = ['visit', 'view', 'calc_start', 'calc_send', 'lead', 'lead_calc'];

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
    const rows = await db('jc_counts?select=day,kind,key,n&day=gte.' + uniq[0] + '&limit=20000');
    const byDay = {};
    const breakdowns = { page: [], source: [], device: [], place: [] };
    for (const r of rows || []) {
      if (r.kind === 'event') (byDay[r.day] = byDay[r.day] || {})[r.key] = r.n;
      else if (breakdowns[r.kind]) breakdowns[r.kind].push([r.day, r.key, r.n]);
    }
    const daily = uniq.map((d) => {
      const row = { date: d };
      for (const f of FIELDS) row[f] = Number((byDay[d] || {})[f] || 0);
      return row;
    });
    return res.status(200).json({ ok: true, today: day(), daily, breakdowns });
  } catch (err) {
    console.error('stats failed:', err.message);
    return res.status(502).json({ ok: false, reason: 'store' });
  }
};
