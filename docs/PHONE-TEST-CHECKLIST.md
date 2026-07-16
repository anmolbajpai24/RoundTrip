# Pre-trip phone test checklist

Run this on your **actual phone** (installed PWA, not a browser tab) with a
second device ("phone B") joining by code. Do a full pass after deploying
Waves 1–2, and once more the week before departure.

## Setup
- [ ] Open the deployed URL on phone A → install to home screen (Add to Home Screen)
- [ ] App opens standalone (no browser chrome), icon + name look right
- [ ] Dark mode: switch OS theme → app follows (and the in-app Auto/Light/Dark toggle works)

## Create & join
- [ ] Phone A: create a new test trip via the wizard (with 2+ destinations)
- [ ] AI step: "Draft my itinerary" shows a spinner and returns a plan (or a clear error)
- [ ] Phone B: join with the code → sees the trip within seconds
- [ ] Phone B joins *while* A is still mid-wizard → sees the neutral "Setting up this trip…" screen, then the trip appears on its own
- [ ] A wrong code shows a friendly error, not a crash

## Security spot-check (SQL editor, once)
- [ ] Run `supabase/AUDIT.sql` → `trips_select` shows `is_trip_member(id)`, all 4 RPCs exist
- [ ] `/api/itinerary` with no auth header → 401; 11th AI call same day → friendly "used today's suggestions" message

## Outfits & photos
- [ ] Phone A: add an outfit photo → appears in the closet, and on phone B within seconds
- [ ] Airplane mode on A → own closet photos still render
- [ ] Phone B: open the gallery, swipe through A's outfits → then airplane mode → those photos still render
- [ ] Swipe deck: vertical page scroll doesn't fight horizontal swipes
- [ ] Delete an outfit → gone on both phones; its file is gone from Storage (dashboard → outfit-photos)
- [ ] Offline: adding a photo shows a clear "needs a connection" message (not a silent failure)

## Offline outbox
- [ ] Airplane mode → tick packing items, add an expense → header shows "↺ n to sync"
- [ ] Reconnect → chip clears on its own; changes appear on phone B
- [ ] Force-close the app while offline with pending changes → reopen → chip still shows them → reconnect → they sync

## Back button (Android especially)
- [ ] Open outfit editor → hardware Back closes the editor, app stays open
- [ ] Open the gallery → Back closes the gallery
- [ ] Open trip settings / profile / account sheet → Back closes each
- [ ] Switch tabs a few times → Back walks back through them → one more Back exits the app
- [ ] Refresh (pull down / reopen) on the Budget tab → still on Budget
- [ ] iOS: edge-swipe back behaves sanely (closes overlay or leaves app, no blank screens)

## Dialogs & feedback
- [ ] Delete an outfit / document / trip → themed confirm sheet (not a browser popup), correct in dark mode
- [ ] Failed action (e.g. delete trip while offline) → toast appears above the tab bar

## Budget, packing, bookings, docs
- [ ] Add expense on A → appears on B; split math looks right
- [ ] Packing: tick items on both phones — no clobbering
- [ ] Upload a document (image + PDF) on A → B can open both; image preview closes with Back
- [ ] Map view: tooltips show place names as plain text

## Trip lifecycle (use a throwaway trip!)
- [ ] Leave trip on phone B → trip gone from B's list, intact on A
- [ ] Delete the test trip on A → gone everywhere; Storage folders (trip-docs + outfit-photos) empty for that trip id
