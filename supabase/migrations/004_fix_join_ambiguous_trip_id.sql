-- Fix: joining a trip failed with "column reference trip_id is ambiguous".
-- ADDITIVE — safe to run on the live database (just replaces the function).
--
-- Cause: join_trip_with_code RETURNS TABLE (trip_id uuid, ...), which creates a
-- PL/pgSQL OUT variable named trip_id. Inside the function, the
-- `on conflict (trip_id, user_id)` inference clause then couldn't tell whether
-- trip_id meant that OUT variable or the trip_members.trip_id column.
--
-- The `#variable_conflict use_column` directive resolves such clashes in favour
-- of the table column, which is what the ON CONFLICT target needs.

create or replace function public.join_trip_with_code(p_code text, p_name text, p_color text)
returns table (trip_id uuid, trip_code text)
language plpgsql security definer set search_path = public as $fn$
#variable_conflict use_column
declare t public.trips%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into t from public.trips where code = upper(trim(p_code));
  if not found then return; end if;
  insert into public.trip_members (trip_id, user_id, name, color)
    values (t.id, auth.uid(), p_name, p_color)
    on conflict (trip_id, user_id) do update set name = excluded.name, color = excluded.color;
  return query select t.id, t.code;
end $fn$;

revoke execute on function public.join_trip_with_code(text, text, text) from public, anon;
grant execute on function public.join_trip_with_code(text, text, text) to authenticated;
