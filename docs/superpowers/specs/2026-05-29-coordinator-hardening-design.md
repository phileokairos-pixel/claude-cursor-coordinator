# Coordinator Hardening — v2.0.0 Design

**Date:** 2026-05-29
**Status:** Approved (brainstorm), pending implementation plan
**Repo:** `claude-cursor-coordinator` (public template, currently v1.0.0)

## Problem

The tool's thesis is "single source of truth, drift is structurally impossible." Its own internals violate that thesis, and one core mechanism manufactures the exact conflicts it exists to prevent.

1. **Agent identity is hardcoded in 3+ places.** The accepted trailer emails (`noreply@anthropic.com`, `cursoragent@cursor.com`) are duplicated across `scripts/commit-msg-guard.mjs`, `scripts/append-coordination.mjs`, `.github/workflows/trailer-guard.yml`, and listed again in `.gitmessage` and the `AGENTS.md` attribution section — in two regex dialects (JS + grep). Adding an agent means editing 3–5 files by hand.
2. **`recent.jsonl` is a conflict + dirty-tree generator.** `.husky/post-commit` appends a line to a **tracked** file on every commit, so (a) concurrent branches conflict on it, and (b) it appends *after* the commit lands, leaving the working tree perpetually dirty with an uncommitted log line — the #1 coordination hazard.
3. **Scope→glob map is hardcoded in the engine.** `gen-rules.ts` holds the scope config, while the README says "don't edit `scripts/*.ts`." To add a Python/Go scope you must edit the file you're told not to touch.
4. **Install is bash-only.** The `cp -r .../{...}` brace-expansion command fails on Windows PowerShell — ironic for a Windows-safety-focused tool.
5. **The template doesn't dogfood drift prevention in CI.** Only `trailer-guard.yml` runs; the project's own test suite and a regen-drift check do not.

## Goals

- One source of truth for agent identities **and** scope globs.
- Zero self-inflicted merge conflicts; never leave the tree dirty.
- N-agent ready (Codex, Gemini, Aider, Copilot) via config, not code edits.
- One-command, cross-platform install.
- CI that proves the drift-prevention claim every PR.
- Ship as a clean, documented breaking release.

## Decisions (locked during brainstorm)

| # | Decision | Choice |
|---|----------|--------|
| 1 | `recent.jsonl` fix | **Derive from git log** (delete tracked file + hook; rewrite status/whodid) |
| 2 | Config home | **Single `coordinator.config.json`** holding agents + scopes |
| 3 | Installer | **`npx claude-cursor-coordinator init`** CLI + `bin` (publish to npm) |
| 4 | Release | **Build AND publish** v2.0.0 (verify npm auth first; fall back to handing the publish command to the user) |

## Design

### 1. `coordinator.config.json` — single source of truth

```json
{
  "$schema": "./scripts/config.schema.json",
  "agents": {
    "claude": { "email": "noreply@anthropic.com", "label": "Claude" },
    "cursor": { "email": "cursoragent@cursor.com", "label": "Cursor" }
  },
  "scopes": {
    "php":          { "globs": ["**/*.php"],            "priority": 100, "description": "PHP / Laravel conventions" },
    "react":        { "globs": ["**/*.tsx", "**/*.ts"], "priority": 200, "description": "React / TypeScript conventions" },
    "coordination": { "alwaysApply": true,              "priority": 300, "description": "Coordination protocol" }
  }
}
```

A small shared loader (`scripts/lib/config.mjs` + a `.ts` re-export) reads and validates this file. It is the only place identities and scopes live.

### 2. Everything derives from the config

- **`commit-msg-guard.mjs`** builds its accepted-email set from `config.agents`. Unknown/missing config → **fail-safe default** to the two built-in agents and still reject unsigned commits (never fail open).
- **`trailer-guard.yml`** reads the same emails via `jq` (already available on `ubuntu-latest`) so local and server enforcement share one list.
- **`.gitmessage`** and the **`AGENTS.md` attribution block** are *generated* by `gen:rules` from `config.agents`, removing the 4th/5th hardcoded copies.
- **`gen-rules.ts`** reads `config.scopes` instead of its hardcoded `scopeGlobs` map.

### 3. N-agent support

Because identity is config-driven, adding an agent (e.g. `"codex": { "email": "codex@openai.com", "label": "Codex" }`) is a one-line edit; both enforcement points and all generated artifacts update on next `gen:rules`. This is a headline feature for an AGENTS.md-standard tool.

### 4. Remove `recent.jsonl`; derive activity from git log

- **Delete** `.husky/post-commit` and `scripts/append-coordination.mjs`.
- **Rewrite** `scripts/status.ts` and `scripts/whodid.ts` to read `git log --format=%H%x00%an%x00%aI%x00%s%x00%b` and classify each commit's tool by matching trailer email against `config.agents` (reusing the shared loader). `whodid` filters by `--since="7 days ago"`; `status` shows last N per tool.
- **Untrack + gitignore** `.coordination/recent.jsonl`.
- Outcome: no tracked log, no merge conflicts, no dirty tree. The audit data already lives in git history.

### 5. `npx claude-cursor-coordinator init`

- Add `"bin": { "claude-cursor-coordinator": "scripts/cli/init.mjs" }` to `package.json`.
- `init.mjs` (Node, cross-platform) copies hooks/scripts/config/docs into the target repo, writes a starter `coordinator.config.json` if absent, then runs `gen:rules` and `test`. Idempotent; refuses to clobber an existing config without `--force`.
- README install section rewritten around the one-liner; manual-copy retained as a documented fallback with both POSIX and PowerShell snippets.

### 6. CI dogfooding — `.github/workflows/ci.yml`

Runs on PR + push to `main`: install Bun, `bun test`, then `bun gen:rules` and `git diff --exit-code CLAUDE.md .cursorrules .cursor/rules/ .gitmessage AGENTS.md` to assert generated outputs match committed state (drift = red build).

### 7. Release & safety

- Bump to **2.0.0** (breaking: config file introduced). Add `CHANGELOG.md` with a `## 2.0.0` section and a **Migration from 1.x** subsection (run `init`, or hand-create `coordinator.config.json`).
- **Fail-safe invariant:** a missing or malformed `coordinator.config.json` must cause hooks to fall back to the built-in two-agent defaults and continue rejecting unsigned commits. A broken config must never allow an unsigned commit through.
- Publish: verify `npm whoami` succeeds and the package name is owned/available; then `npm publish --access public`. If not authenticated, deliver publish-ready and hand the exact command to the user.

### 8. Testing (must pass, not "should work")

- `commit-msg-guard.test.mjs`: config-driven acceptance, N-agent (Codex), and missing/malformed-config fail-safe.
- `gen-rules.test.ts`: scopes sourced from config; generated `.gitmessage` and attribution block match config.
- New `status`/`whodid` tests: git-log parsing + tool classification on a temp fixture repo.
- New `init` CLI test: copies expected files, creates config, is idempotent.
- Run full suite green + the regen-drift check locally before claiming done.

### 9. Docs sync

Update README ("What it does", "What ships", ASCII flow diagram — remove the post-commit→jsonl path, "Customization", install), `AGENTS.md`, and `docs/CURSOR_USER_SETUP.md`. Regenerate all outputs in lockstep.

## Constraints / notes

- This repo enforces its own protocol: every commit must carry `Co-authored-by: Claude <noreply@anthropic.com>`, and editing `AGENTS.md` triggers `gen:rules` in pre-commit. We dogfood it.
- `bun` must be available locally to run hooks/tests.

## Out of scope

- The shared-working-tree branch-switch hazard (documented note only; not solvable in a hook).
- Stronger-than-opt-in gitleaks default (left as-is).

## File change summary

| Action | Path |
|--------|------|
| Add | `coordinator.config.json`, `scripts/config.schema.json`, `scripts/lib/config.mjs`, `scripts/cli/init.mjs`, `.github/workflows/ci.yml`, `CHANGELOG.md` |
| Rewrite | `scripts/status.ts`, `scripts/whodid.ts`, `scripts/commit-msg-guard.mjs`, `scripts/gen-rules.ts`, `.github/workflows/trailer-guard.yml` |
| Generate-from-config | `.gitmessage`, `AGENTS.md` attribution block |
| Delete | `.husky/post-commit`, `scripts/append-coordination.mjs` |
| Untrack/ignore | `.coordination/recent.jsonl` |
| Update | `package.json` (bin, version 2.0.0), `README.md`, `AGENTS.md`, `docs/CURSOR_USER_SETUP.md`, tests |
