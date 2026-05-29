# Coordination index

Before starting any task, read in this order:

1. `HANDOFF.md` - explicit "don't touch X" sticky notes (entries auto-expire after 24h via date prefix)
2. Run `bun status` or `bun whodid` to see recent per-tool activity (derived from `git log` — there is no tracked log file)
3. `docs/CANONICAL_EXAMPLES.md` if writing a new component (copy-this-file pointer)

After committing your work:
1. If you're holding files until you push: add an entry to `HANDOFF.md`

Coordination files in this directory:
- `HANDOFF.md` - sticky "don't touch" notes between agents
- `coordinator.config.json` (repo root) - single source of truth for agents + email scopes
