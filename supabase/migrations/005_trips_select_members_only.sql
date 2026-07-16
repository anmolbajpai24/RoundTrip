-- Stage 2 of the public hardening (001 shipped it commented out; this makes
-- it a real migration). Closes: any signed-in user — and sign-in is anonymous,
-- so effectively anyone — can SELECT every trip's id and join code, then join
-- any trip via join_trip_with_code.
--
-- ORDER MATTERS: deploy the frontend that has no direct-table fallbacks
-- (session.js createTripDirect / join fallback removed) BEFORE running this.
-- Create/join already go through the SECURITY DEFINER RPCs from 001, and
-- listMyTrips only selects trips the user is a member of, so nothing else
-- depends on the open policy.

drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips
  for select to authenticated using (public.is_trip_member(id));
