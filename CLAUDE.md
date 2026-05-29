# AGENTS.md

This is the canonical hand-edited rules file for both Cursor and Claude Code (and any other AI builder following the [agents.md](https://agents.md/) standard).

CLAUDE.md, .cursorrules, and .cursor/rules/*.mdc are GENERATED from this file by `bun gen:rules` (runs in pre-commit hook). Edit AGENTS.md, never the generated outputs.

---

## Project context

Replace this section with a one-paragraph description of your project: what it does, who it serves, what stack it uses.

Example: "FlipTheCrate is a music sample licensing marketplace built with Laravel 13 + Inertia + React 19 + Bun, deployed to Forge + DigitalOcean."

## General coding standards

Replace these with your project's standards:

- Use descriptive names for variables and methods
- Match existing code style and patterns in sibling files
- Don't change dependencies without approval
- Test every change

## Canonical examples

When writing a new component or pattern, copy from a reference. See `docs/CANONICAL_EXAMPLES.md` for the full list.

<!-- @scope: coordination -->
## Coordination protocol (Claude + Cursor)

This repo has TWO AI builders working on it: Claude (via Claude Code CLI) and Cursor (via Agent / Cloud Agents). Follow this protocol on every task.

### Before any task

1. Read `.coordination/HANDOFF.md` for explicit "don't touch X" notes
2. Run `bun status` or `bun whodid` to see recent per-tool activity (derived from git log — there is no tracked log file)
3. If writing a new component, read `docs/CANONICAL_EXAMPLES.md` first

### Branch lane defaults

- Cursor: commit to `main` for small fixes (single-file, typo, formatting, sub-50-line tweaks)
- Claude: feature branch + PR for everything else (multi-file, new features, refactors, schema changes)
- Override allowed but explicit ("Cursor, do this on a branch")

### Attribution (mandatory)

Every commit must end with a `Co-authored-by:` trailer whose email matches an agent in `coordinator.config.json` (the single source of truth). The defaults:
- `Co-authored-by: Cursor <cursoragent@cursor.com>` (Cursor adds automatically; Settings > Agents > Attribution)
- `Co-authored-by: Claude <noreply@anthropic.com>` (Claude Code via `.claude/settings.json`)

Add more agents (Codex, Gemini, etc.) by editing `coordinator.config.json` — the `commit-msg` hook, the `trailer-guard` GitHub Action, and the generated `.gitmessage` all read from it. The trailer key is matched case-insensitively. Husky `commit-msg` rejects unknown commits locally; the `trailer-guard` Action enforces server-side.

### Mid-session AGENTS.md edits

If you edit `AGENTS.md` and don't immediately commit, run `bun gen:rules` so generated outputs (CLAUDE.md, .cursorrules, .cursor/rules/*.mdc) stay in sync.

### Aaron's morning command

```
bun status
```

One screen: branch + uncommitted state + recent commits per tool + open PRs.
<!-- @endscope -->

<!-- @scope: react -->
## React / TypeScript conventions

Replace this with your React-specific conventions. Examples:

- Use functional components with hooks
- Prefer composition over inheritance
- Keep components under 200 lines
- Co-locate tests with components
<!-- @endscope -->

<!-- @scope: php -->
## PHP / Laravel conventions

Replace this with your PHP-specific conventions. Examples:

- `declare(strict_types=1);` in all files
- Form requests for validation, not inline
- Services own side effects in `DB::transaction`
- Thin controllers
<!-- @endscope -->

<!--
  Add more @scope blocks as needed. Configure each scope's globs and priority in
  coordinator.config.json under "scopes". Scopes with no config entry get sensible defaults.
-->
