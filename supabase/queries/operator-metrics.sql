-- Operator test metrics (BUILD-PLAN "Measuring"). Read-only: SELECTs only.
-- Run in the Supabase SQL editor on PROD (that's where operators' trips are).
-- Needs migration 008, which added trips.created_by.
--
-- Activation for a trip = members_joined / expected headcount from the
-- tracking sheet. "Created without you" means created_by is the operator's
-- user id, not yours. Match created_by against the "organiser's user id"
-- column in the sheet.

-- 1) Trips created since outreach began, per creator, with member counts.
select t.created_by,
       c.value->>'title'  as title,
       t.code,
       t.created_at::date as created,
       c.value->>'startDate' as trip_starts,
       t.members_can_edit,
       count(m.user_id)   as members_joined
from public.trips t
left join public.trip_kv c
  on c.trip_id = t.id and c.owner = '__shared__' and c.key = 'trip-config'
left join public.trip_members m on m.trip_id = t.id
where t.created_at >= '2026-11-02'
group by t.created_by, c.value, t.code, t.created_at, t.members_can_edit
order by t.created_by, t.created_at;

-- 2) One row per creator: how many trips, how many people joined them, and
--    how many trips were runs again (same title more than once).
select t.created_by,
       count(distinct t.id)                        as trips,
       count(m.user_id)                            as members_joined,
       count(distinct t.id)
         - count(distinct coalesce(c.value->>'title', t.id::text)) as repeat_runs,
       min(t.created_at)::date                     as first_trip,
       max(t.created_at)::date                     as latest_trip
from public.trips t
left join public.trip_kv c
  on c.trip_id = t.id and c.owner = '__shared__' and c.key = 'trip-config'
left join public.trip_members m on m.trip_id = t.id
where t.created_at >= '2026-11-02'
group by t.created_by
order by trips desc, members_joined desc;
