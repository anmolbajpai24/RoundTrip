-- Per-user daily quota for the AI endpoints. Serverless functions are
-- stateless and Vercel KV is a paid add-on, so the counter lives in Postgres.
-- A trip_kv counter would be client-forgeable (any member can write any kv
-- row); this table has RLS enabled with NO policies, so only the SECURITY
-- DEFINER function below can touch it.

create table if not exists public.ai_usage (
  user_id uuid not null,
  day     date not null,
  count   int  not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;

-- Atomically increments today's counter for the caller and returns the new
-- count. The API compares the result against its cap (AI_DAILY_CAP, def. 10).
create or replace function public.consume_ai_credit()
returns int language plpgsql security definer set search_path = public as $fn$
declare n int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.ai_usage (user_id, day, count)
    values (auth.uid(), (now() at time zone 'utc')::date, 1)
    on conflict (user_id, day) do update set count = ai_usage.count + 1
    returning count into n;
  return n;
end $fn$;

revoke execute on function public.consume_ai_credit() from public, anon;
grant execute on function public.consume_ai_credit() to authenticated;
