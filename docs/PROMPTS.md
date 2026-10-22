# Prompts

Owner: @director. Paste these into each agent's tab in the order given. Run `/rename <name>` in a tab before pasting its opening message, so other sessions can reach it by name.

## Opening messages

Open the tabs in this order: director, data, shell, trip, ai.

**director**
```
You are the director agent. Follow .claude/agents/director.md for your role and owned paths, and read CLAUDE.md and docs/BUILD-PLAN.md. Before changing anything, read the files you own and tell me their current state in a few lines. Then do your Phase 0 tasks from docs/ROADMAP.md.
```

**data**
```
You are the data agent. Follow .claude/agents/data.md for your role and owned paths, and read CLAUDE.md. Before changing anything, read the code in the paths you own and tell me its current state in a few lines. Then do your Phase 0 tasks from docs/ROADMAP.md.
```

**shell**
```
You are the shell agent. Follow .claude/agents/shell.md for your role and owned paths, and read CLAUDE.md. Before changing anything, read the code in the paths you own and tell me its current state in a few lines. Then do your Phase 0 tasks from docs/ROADMAP.md.
```

**trip**
```
You are the trip agent. Follow .claude/agents/trip.md for your role and owned paths, and read CLAUDE.md. Before changing anything, read the code in the paths you own and tell me its current state in a few lines. Then do your Phase 0 tasks from docs/ROADMAP.md.
```

**ai**
```
You are the ai agent. Follow .claude/agents/ai.md for your role and owned paths, and read CLAUDE.md. Before changing anything, read the code in the paths you own and tell me its current state in a few lines. Then do your Phase 0 tasks from docs/ROADMAP.md.
```

## Phase 0 prompts (Fri 23 Oct)

Send in this order. Wait for the director's commit before the others start editing.

1. **director**
```
Phase 0. Tag the current main as pre-operator-build. Create and switch to a branch called operator-build. Stage only the setup files (CLAUDE.md, .claude/agents/, docs/ROADMAP.md, docs/PROMPTS.md, docs/SETUP.md, docs/BUILD-PLAN.md, docs/LAUNCH-EXPLAINED.md) and commit them with the message "Agent team setup and operator build plan". No Co-Authored-By or any Claude attribution. Show me git status and git log --oneline -3, then push the branch and the tag. Then wait for the other agents' state reports and note them in docs/ROADMAP.md.
```

2. **data**
```
Phase 0. Report the current state of your paths to @director. Then decide the exact names and shapes for the role and session API in BUILD-PLAN item 1 (role on the session and members, canEditShared, setMembersCanEdit, setMemberRole, the join call the link gate should use, duplicateTrip) and send them to @trip and @shell. Don't write the migration yet.
```

3. **shell**
```
Phase 0. Report the current state of your paths to @director, including the main JS chunk size from npm run build. Then send @trip the planned joinLink.js helpers (parseJoinPath, joinUrl) and where JoinLinkGate should mount in App.jsx. Don't build yet.
```

4. **trip**
```
Phase 0. Report the current state of your paths to @director. List every control that edits shared data (by file and line) so we know what role gating has to cover, and confirm you have @data's API names and @shell's join-link plan. Don't build yet.
```

5. **ai**
```
Phase 0. Report the current state of your paths to @director. Send @trip the planned importItinerary signature and error codes. Don't build yet.
```

## Phase 1 prompts (Sat 24 to Tue 27 Oct)

1. **data**
```
Phase 1. Write supabase/migrations/008_roles.sql from BUILD-PLAN item 1, implement the session API you announced, make the weather cache local-only, and write the RLS test script in supabase/tests/. Tell me exactly what to paste into the roundtrip-dev SQL editor and what I should see. After I've run it, run the RLS test against dev and report the result to @director. Tell @trip and @shell when the API is live on dev.
```

2. **shell**
```
Phase 1. Build src/lib/joinLink.js, JoinLinkGate.jsx, the Open Graph tags in index.html, the service-worker fallback for /j/* and /demo, and InstallHint.jsx rendered from main.jsx. Remove the OutfitsTab import from harness.jsx and tell @trip when it's gone. Widen the Vitest include to api/**/*.test.js for @ai. Tell @trip where to mount JoinLinkGate. Verify with two browsers against roundtrip-dev.
```

3. **trip**
```
Phase 1. Do BUILD-PLAN items 1 (UI side), 3 and 4 from your role file: role gating, the Members can edit switch and co-organiser control in TripSettings, mount JoinLinkGate where @shell says and use joinUrl() in share text, remove Outfits once @shell confirms the harness import is gone, and hide Budget when members can't edit. Tell @data and @ai when Outfits is removed. Test as organiser and member in two browsers against roundtrip-dev.
```

4. **ai**
```
Phase 1. Move the JWT check and daily cap from api/itinerary.js into api/_lib/ with behaviour unchanged, add tests in api/__tests__/ once @shell has widened the Vitest include, and make api/tryon.js return 410 Gone. After @trip confirms Outfits is removed, delete src/lib/tryon.js and ask @shell whether @gradio/client can be removed.
```

5. **data** (after trip removes Outfits)
```
Phase 1. Outfits is gone from the UI. Remove loadClosetsAll and outfit handling from storage.js and session.js, delete foldClosetRows.test.js, and write supabase/migrations/009_purge_outfits.sql with a note on emptying the outfit-photos bucket. Don't ask me to run it yet; it runs on prod on Sun 1 Nov.
```

6. **director** (when all five are reported done)
```
Check Phase 1 against its "How to check" in docs/ROADMAP.md. Ask each agent for evidence where you need it, confirm with git log --name-only that each agent only touched its own paths, and mark what passes. Then write the Phase 2 prompts into docs/PROMPTS.md.
```
