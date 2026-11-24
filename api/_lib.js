// Shared helpers for the site's serverless functions.
// Storage is a small Supabase table reached over REST. Nothing personal is stored:
// only daily counters and rough visitor locations. Lead details pass through to the CRM and are never kept here.
const crypto = require('crypto');

const DB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const DB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function storeReady() { return Boolean(DB_URL && DB_KEY); }

// Talks to Supabase over its REST API with the server-only key. Tables and functions are in supabase/setup.sql.
async function db(path, body) {
  if (!storeReady()) return null;
  const r = await fetch(DB_URL + '/rest/v1/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { apikey: DB_KEY, Authorization: 'Bearer ' + DB_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error('store ' + r.status);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
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
  const salt = process.env.ADMIN_PASSWORD || DB_KEY || 'jc';
  return crypto.createHash('sha256').update(salt + '|' + ip).digest('hex').slice(0, 24);
}

// Returns true when this visitor is over the limit for the window.
async function overLimit(req, bucket, max, windowSeconds) {
  if (!storeReady()) return false;
  const count = await db('rpc/jc_limit', { p_key: bucket + ':' + visitorKey(req), p_window: windowSeconds });
  return Number(count) > max;
}

// items: [[kind, key], ...] where kind is event, page, place, source or device. Adds one to each for today.
async function bump(items) {
  if (!storeReady() || !items.length) return;
  await db('rpc/jc_bump', { p_day: day(), p_kinds: items.map((i) => i[0]), p_keys: items.map((i) => String(i[1]).slice(0, 90)) });
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

module.exports = { storeReady, db, day, place, bump, body, sameSite, looksAutomated, overLimit, safeEqual, header };
