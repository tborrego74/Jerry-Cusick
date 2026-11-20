// Shared helpers for the site's serverless functions.
// Storage is Upstash Redis over REST (added from the Vercel Marketplace). Nothing personal is stored:
// only daily counters and rough visitor locations. Lead details pass through to the CRM and are never kept here.
const crypto = require('crypto');

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const KEEP_SECONDS = 400 * 86400;

function storeReady() { return Boolean(KV_URL && KV_TOKEN); }

async function redis(commands) {
  if (!storeReady()) return null;
  const r = await fetch(KV_URL.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error('store ' + r.status);
  return (await r.json()).map((x) => x.result);
}

// Calendar day in Jerry's time zone, e.g. 2026-11-20.
function day(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver' }).format(d || new Date());
}

function header(req, name) {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v || '';
}

// City and state for US visitors, nothing finer. Comes from Vercel's edge, not from the browser.
function place(req) {
  const country = header(req, 'x-vercel-ip-country');
  if (!country) return 'Unknown';
  if (country !== 'US') return 'Outside the US';
  let city = header(req, 'x-vercel-ip-city');
  try { city = decodeURIComponent(city); } catch (e) { /* keep raw */ }
  const region = header(req, 'x-vercel-ip-country-region');
  city = city.replace(/[^\p{L}\p{N} .'-]/gu, '').slice(0, 40);
  if (city && region) return city + ', ' + region;
  return region || 'United States';
}

// One-way, salted, short-lived fingerprint used only to slow down abuse. The raw IP is never stored.
function visitorKey(req) {
  const ip = (header(req, 'x-forwarded-for').split(',')[0] || header(req, 'x-real-ip') || 'unknown').trim();
  const salt = process.env.ADMIN_PASSWORD || KV_TOKEN || 'jc';
  return crypto.createHash('sha256').update(salt + '|' + ip).digest('hex').slice(0, 24);
}

// Returns true when this visitor is over the limit for the window.
async function overLimit(req, bucket, max, windowSeconds) {
  if (!storeReady()) return false;
  const key = 'jc:rl:' + bucket + ':' + visitorKey(req);
  const [count] = await redis([['INCR', key], ['EXPIRE', key, windowSeconds, 'NX']]);
  return Number(count) > max;
}

async function bump(req, events) {
  if (!storeReady()) return;
  const d = day();
  const cmds = [];
  for (const e of events) cmds.push(['HINCRBY', 'jc:d:' + d, e, 1]);
  cmds.push(['EXPIRE', 'jc:d:' + d, KEEP_SECONDS]);
  if (events.includes('visit')) {
    cmds.push(['HINCRBY', 'jc:g:' + d, place(req), 1], ['EXPIRE', 'jc:g:' + d, KEEP_SECONDS]);
  }
  await redis(cmds);
}

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b && typeof b === 'object' ? b : {};
}

function sameSite(req) {
  const origin = header(req, 'origin');
  if (!origin) return true; // same-origin form posts and beacons may omit it
  try { return new URL(origin).host === header(req, 'host'); } catch (e) { return false; }
}

const BOT = /bot|crawl|spider|slurp|preview|monitor|headless|lighthouse|pingdom|uptime|curl|wget|python|scrapy|facebookexternalhit|whatsapp|gptbot|claudebot|perplexity/i;
function looksAutomated(req) { const ua = header(req, 'user-agent'); return !ua || BOT.test(ua); }

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = { storeReady, redis, day, place, bump, body, sameSite, looksAutomated, overLimit, safeEqual, header };
