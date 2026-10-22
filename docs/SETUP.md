# Agent team setup

Five Claude Code sessions work on Roundtrip, each in its own tab: **director**, **data**, **shell**, **trip** and **ai**. Each owns specific files (see the ownership map in `CLAUDE.md`). You build by going to the agent that owns an area and asking it to do the work, and the agents message each other when their changes affect someone else.

## Steps

1. **Check your version.** Run `claude --version`. On native Windows you need v2.1.234 or later for sessions to message each other. Update the VS Code extension too.
2. **Run everything natively.** Sessions inside WSL 2 can't message native Windows sessions. Keep all five on native Windows.
3. **Move the role files into place.** Claude can't write into `.claude/` on your computer, so the five role files are in `docs/agents/`. In PowerShell at the repo root:
   ```
   New-Item -ItemType Directory -Force .claude\agents | Out-Null
   Move-Item docs\agents\*.md .claude\agents\
   Remove-Item docs\agents
   ```
   Check that `.claude\agents` now has `director.md`, `data.md`, `shell.md`, `trip.md` and `ai.md`.
4. **Open the repo.** Open `G:\Projects\LondonTrip` in VS Code. The setup files are already in your working tree on `main`, uncommitted. The director commits them to a new `operator-build` branch as its first task, together with `docs/BUILD-PLAN.md` and `docs/LAUNCH-EXPLAINED.md`. If you have other uncommitted work of your own, commit or stash it before the agents start.
5. **Open five tabs in this order:** director, data, shell, trip, ai. In each new Claude Code tab:
   - type `/rename <name>` (for example `/rename director`), then
   - paste that agent's opening message from `docs/PROMPTS.md`.
6. **Check they can reach each other.** In the director tab, run `/list-agents` (or `/peers`). data, shell, trip and ai should all appear.
7. **Work through `docs/PROMPTS.md`**, starting with Phase 0. Wait for the director's setup commit before the others start editing.

## Permission modes

Messages between sessions get held for approval when one session bypasses permission prompts and another doesn't. The VS Code extension can't show that approval dialog, so a held message is dropped after about five minutes.

- Keep every tab in a prompting mode: default, acceptEdits or auto all mix fine.
- Never put just one tab in bypassPermissions. Either all of them or none.

## Terminal alternative

The VS Code extension can't start a session as a specific agent, so the opening message tells each tab which role file to follow. A terminal session started with `--agent` applies the role file as its system prompt for the whole session. In separate PowerShell tabs, all native:

```
claude --agent director --name director
claude --agent data --name data
claude --agent shell --name shell
claude --agent trip --name trip
claude --agent ai --name ai
```

Resume one later with `claude --agent data --resume data`. You can still paste the opening message as the first prompt.

The role files don't set a `tools` allowlist on purpose. On Windows the shell tool may be PowerShell or Bash depending on your setup, and an allowlist that misses it, or misses the messaging tools, would break a terminal session. File ownership is enforced by the instructions in `CLAUDE.md` and each role file.

## Messaging

- To message another agent, type `@` and pick its name from the list, for example "tell @trip the session API is live on dev".
- An idle session picks up a message as a new turn. A busy one reads it between tool calls.
- Incoming messages show as a dim one-line preview. Press Ctrl+O to read the full text.
- A message from another session can't approve a permission prompt or change `CLAUDE.md` or settings. Each session still asks you before anything risky.
- Leave `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` off. This setup uses separate named sessions, not agent teams.

## Day to day

- Start the day in the director tab: "What's next today?" It reads `docs/ROADMAP.md` and gives you prompts for each agent.
- Something broken? Ask the director which agent owns it, or go straight to the owner if you know.
- Only you merge to `main`, because that deploys production. Only you run SQL in Supabase: on `roundtrip-dev` first, then prod after a backup.

## Official docs

Check these when something about sessions or messaging doesn't behave as described here:

- Cross-session messaging: https://code.claude.com/docs/en/cross-session-messaging
- Subagents and role files: https://code.claude.com/docs/en/sub-agents
