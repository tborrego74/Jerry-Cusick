-- Anonymous site counters for jerrycusick.com. Run once in the Supabase SQL editor.
-- Holds daily totals only: visits, page views, rough location, traffic source, device type, calculator use, leads. No names, numbers or IP addresses.

create table if not exists jc_counts (
  day  date    not null,
  kind text    not null,          -- event, page, place, source or device
  key  text    not null,          -- e.g. visit, /va-home-loans-colorado/, Aurora, CO, Google, Phone
  n    integer not null default 0,
  primary key (day, kind, key)
);

-- Short-lived abuse throttle. Keys are one-way hashes and expire within minutes.
create table if not exists jc_limits (
  k          text primary key,
  n          integer     not null,
  expires_at timestamptz not null
);

-- Row level security with no policies: only the server-side key can read or write.
alter table jc_counts enable row level security;
alter table jc_limits enable row level security;

create or replace function jc_bump(p_day date, p_kinds text[], p_keys text[]) returns void
language sql as $$
  insert into jc_counts (day, kind, key, n)
    select p_day, k, v, 1 from unnest(p_kinds, p_keys) as t(k, v)
    on conflict (day, kind, key) do update set n = jc_counts.n + 1;
$$;

create or replace function jc_limit(p_key text, p_window integer) returns integer
language plpgsql as $$
declare c integer;
begin
  delete from jc_limits where expires_at < now();
  insert into jc_limits (k, n, expires_at) values (p_key, 1, now() + make_interval(secs => p_window))
    on conflict (k) do update set n = jc_limits.n + 1
    returning n into c;
  return c;
end $$;

revoke all on function jc_bump(date, text[], text[]) from public, anon, authenticated;
revoke all on function jc_limit(text, integer) from public, anon, authenticated;
grant execute on function jc_bump(date, text[], text[]) to service_role;
grant execute on function jc_limit(text, integer) to service_role;
