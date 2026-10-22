# Roundtrip build plan: operator test

Written 23 Oct 2026. Build freezes **Sun 1 Nov**, outreach starts **Mon 2 Nov**, decision day is **Sun 10 Jan 2027**.

## Decisions

- **Goal.** A real test with real users. Not a portfolio-only finish, not a business yet.
- **First users.** Small, Instagram-run trip operators in Delhi NCR running fixed-departure weekend and New Year trips (Kasol, Tosh, Jibhi, Rishikesh and similar) with 15 to 25 travellers who mostly don't know each other. Friend-group trips keep working exactly as now.
- **Distribution.** PWA only. Travellers join from a link in the operator's WhatsApp group and never have to install anything. No native app in this round.
- **Order.** Build first, then outreach with a working product and a demo link. Grok handles outreach drafting, Claude Code handles the build.
- **Cut.** Outfits tab and virtual try-on are removed, and stored face and outfit photos are deleted.
- **Budget.** Hidden on trips where members can't edit (operator trips). Friend trips keep it.
- **Not in this build:** the sync rebuild (expenses as separate rows), multi-currency expenses, native apps, any friends or discovery feature.

## Build list

Work top to bottom. Items 1 and 2 come first because everything else sits on them. Every migration runs on `roundtrip-dev` first, then prod after a fresh backup. Never re-run `schema.sql`.

### 0. Safety

- Tag the current `main` as `pre-operator-build` (this is also the restore point for Outfits).
- Message the friend group: open the app once while online so offline outboxes flush. Warn them that outfit photos will be deleted in a week and they can export a backup first (Settings, backup).

### 1. Organiser and member roles (migration `008_roles.sql`)

Today `trips` doesn't record a creator, `trip_members` has no role, and the `trip_kv` policies let any member write or delete any row in the trip, including other members' personal rows (migration 006 notes this too).

Schema (sketch, finalise in Claude Code):

```sql
alter table public.trips add column if not exists members_can_edit boolean not null default true;
alter table public.trips add column if not exists created_by uuid;

alter table public.trip_members add column if not exists role text not null default 'member'
  check (role in ('organiser', 'member'));

-- Existing trips never recorded a creator, so everyone on them keeps full rights.
-- created_by is null only on pre-008 trips, so this is safe to re-run.
update public.trip_members set role = 'organiser'
where trip_id in (select id from public.trips where created_by is null);

-- Members must not be able to promote themselves.
revoke update on public.trip_members from authenticated;
grant update (name, color) on public.trip_members to authenticated;

create or replace function public.can_edit_shared(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from trip_members m join trips tr on tr.id = m.trip_id
    where m.trip_id = t and m.user_id = auth.uid()
      and (m.role = 'organiser' or tr.members_can_edit)
  );
$$;
```

- `trip_kv` insert, update and delete policies become: shared rows (`owner = '__shared__'`) need `can_edit_shared(trip_id)`; personal rows need `owner = auth.uid()::text` plus membership. Select stays as is.
- `create_trip_with_code` sets `created_by = auth.uid()` and inserts the creator with `role = 'organiser'`.
- New organiser-only RPCs: `set_members_can_edit(trip, bool)` and `set_member_role(trip, user, role)`. The second one refuses to demote the last organiser.
- `trip-docs` storage insert and delete policies add `can_edit_shared`. Read stays member-only.
- Run `supabase/AUDIT.sql` on dev afterwards and update its expectations for the new policies.

Client:
- Session exposes my role and the trip's `members_can_edit`. Hide every edit control on shared data when I can't edit.
- Trip settings (organiser only): "Members can edit" switch, member list with "Make co-organiser".
- **Weather cache goes local-only.** `weather.js:152` writes the forecast to the shared `trip-weather` key from every device. Under the new policy that fails on every member's phone and shows "Sync failed". Keep it in IndexedDB only.
- Grep every `saveKey(` call that writes a shared key and confirm each one is reachable only when I can edit.

Done when: on dev, a member on a members-can't-edit trip gets an RLS error when trying (from the console) to upsert a shared row and another member's personal row; the member UI shows no edit controls; a member's phone shows no sync errors after a day of normal use; existing friend trips behave exactly as before.

### 2. Join links

- `app.roundtrip.one/j/ABC123` opens the trip directly. `vercel.json` already rewrites everything to `index.html`, so this is client-side routing in `App.jsx`. Check the PWA service worker's navigation fallback also serves `/j/*` offline.
- Flow: skip Onboarding, ask only for a name (prefilled if a profile exists), call `join_trip_with_code`, land on today's day (or day 1 if the trip hasn't started), then replace the URL with `/`. Already a member: go straight in. Bad code: a plain message plus the type-a-code fallback.
- Share text in `TripWizard.jsx` and anywhere else the code is shared includes the full URL. The code becomes the fallback.
- Static OG tags in `index.html` (title, description, `og.png`) so the link unfurls cleanly in WhatsApp.
- Show the Add to Home Screen hint only from the second visit.

Done when: on a phone that has never opened the app, tapping the link in WhatsApp gets to the itinerary in under 20 seconds with no onboarding screens.

### 3. Cut Outfits and try-on

- `FEATURES.tryOn` is already `false` in `src/appConfig.js`, so try-on is hidden. Remove the Outfits tab from `TABS` in `App.jsx` and delete its files (`OutfitsTab.jsx`, `OutfitGallery.jsx`, `OutfitImage.jsx`, `closet.js`, `outfitPhotos.js`, `src/lib/tryon.js`), and make `api/tryon.js` return 410. The `pre-operator-build` tag keeps the old code.
- Keep the per-day weather advice on the itinerary. `outfitAdvisor.js` is deterministic from weather and doesn't read the closet.
- On Sun 1 Nov, a week after the heads-up, delete everything in the `outfit-photos` bucket and the `tryon-base-photo`, `outfit:*`, `outfit-item:*` and `outfit-days` rows in `trip_kv`. Do it on prod right after a backup run.
- Remove outfits and try-on from the README and the landing page.

Done when: no screen shows outfits, and the bucket and those rows are empty.

### 4. Hide Budget on operator trips

- Budget tab hidden for everyone when `members_can_edit` is false.

### 5. Organiser packing list

- Members' lists are already seeded from `config.packingTemplate` (`App.jsx:32`); the wizard hardcodes `GENERIC_PACKING`. Let the organiser edit the template (categories and items) in trip settings.
- Known limit for now: members only get the template when they join, so the organiser should set it before sharing the link. Say so in the settings screen.

### 6. Paste your itinerary

- New endpoint next to `api/itinerary.js`, reusing its auth check, daily cap and Gemini setup. Input: pasted text (cap around 6,000 characters), start date, end date. Output: the same `ai` shape `buildTripConfig` already accepts, `{ days: [{ date, city, plan }], legs }`. Use Gemini's JSON response schema rather than parsing free text, and clamp lengths the way `MAX_PLAN` does.
- Build `legs` from the returned cities the same way the existing AI suggest step does.
- Wizard gets a third option, "Paste your itinerary", next to the AI suggestion and manual entry.
- Eval set: save 10 real itineraries from operator websites as private test fixtures, plus a script that runs them and checks the day count matches, every day has a city, every plan is non-empty, and dates sit in range.

Done when: at least 8 of the 10 fixtures import with the right number of days and readable plans without manual edits.

### 7. Run a trip again

- On the trips home, an organiser can "Run again" with a new start date. That creates a new trip and code and copies the trip config with every date shifted, shared day notes re-keyed to the new dates, the packing template, and the bookings checklist with done flags reset. It does not copy members, expenses, documents or anyone's personal data.
- Dates are keyed by ISO string in several places. Write one pure `shiftTrip(config, kv, newStart)` with Vitest coverage, and find every date-keyed value before writing it.

Done when: running a 3-day trip again for next weekend gives the same itinerary on the new dates, a fresh code, and only the organiser as a member.

### 8. Pinned trip info (only if time)

- Organiser-editable fields on the trip config: pickup point (text plus optional maps link), pickup time, trip lead name and phone (`tel:` link), emergency contact. Shown at the top of the itinerary for everyone.

### 9. Demo trip

- A static, bundled "Kasol weekend" trip (Delhi pickup, Kasol, Tosh, Chalal, 3 days) at `app.roundtrip.one/demo`, rendered read-only with no Supabase calls. The `harness.jsx` approach already renders tabs from fixture data. A banner at the top links to "Start your own trip".
- It's static on purpose: a real shared demo trip would collect hundreds of random members and their names.

Done when: it opens in under 3 seconds on mobile data with no sign-in.

### 10. Landing and launch leftovers

- Rewrite the landing page for organisers: the share link, itinerary, packing list, pickup info and running a trip again. Main call to action is "See a demo trip", linking to `/demo`. Keep "No account needed".
- Screenshots from the demo trip via Playwright (`LAUNCH-REMAINING.md` item 4).
- Phone smoke test (`LAUNCH-REMAINING.md` item 5), plus: the join link on iOS Safari and Android Chrome; a member on a members-can't-edit trip; and which browser WhatsApp opens links in on each platform. If it opens an in-app browser with its own storage, reopening the trip later from Safari or Chrome creates a second anonymous member. Check the member list for duplicates and handle it if it happens.

## Schedule

| Days | Work |
|---|---|
| Fri 23 to Sun 25 Oct | 0, 1 (migration on dev, client gating, weather fix) |
| Mon 26 to Tue 27 Oct | 2, 3, 4 |
| Wed 28 to Thu 29 Oct | 6, 7 |
| Fri 30 Oct | 5, 9 |
| Sat 31 Oct | 10, then 8 if there's time |
| Sun 1 Nov | Backup, prod migration, deploy, phone smoke test. Freeze. |

This is roughly 25 to 30 hours. If you're behind on Thu 29 Oct, drop 8 first, then 5. Don't drop 1, 2, 6, 7 or 9.

## Outreach (from Mon 2 Nov)

- List 20 to 30 small operators running Himachal and Uttarakhand weekend and New Year departures from Delhi. Skip the big ones like WanderOn. Contact the founder or a trip lead, one or two people per operator.
- Each message covers what it does for their trip's WhatsApp group in a line, the demo link, an offer to set up their next departure in Roundtrip for them, and a short call as the next step.
- Track in a sheet: operator, contact, date sent, reply, call date, trip date, trip code, expected headcount, organiser's user id.
- One follow-up after 3 days.
- Ask each operator to link Google or email on their organiser phone, so their trips stay under one account across devices. Otherwise a new phone looks like a new operator in the numbers.

## Measuring

```sql
-- Trips created since outreach began, per creator, with member counts.
select t.created_by,
       c.value->>'title' as title,
       t.code,
       t.created_at::date as created,
       count(m.user_id) as members_joined
from public.trips t
left join public.trip_kv c
  on c.trip_id = t.id and c.owner = '__shared__' and c.key = 'trip-config'
left join public.trip_members m on m.trip_id = t.id
where t.created_at >= '2026-11-02'
group by t.created_by, c.value, t.code, t.created_at
order by t.created_by, t.created_at;
```

Activation for a trip is `members_joined` divided by the expected headcount from the tracking sheet. "Created without you" means `created_by` is the operator's id, not yours.

## Kill criteria (locked 23 Oct)

- **Sun 15 Nov:** at least 3 operators have agreed to run a real trip on Roundtrip. If it's 0 or 1 out of 20 to 30, operators aren't the wedge: stop building features, then either try cold friend groups for two weeks or wrap up.
- **Sun 10 Jan:** at least 2 operators have run 3 or more trips each, at least one of them created by the operator without you, and on those trips at least half the travellers joined.
- **Both pass:** keep going. January's work is whatever operators asked for most (likely the expense rebuild).
- **Either fails:** stop. Write a short case study (what was built, who it was tested with, the numbers, what was cut and why) and put it on anmolbajpai.com.

These numbers don't change after today.
