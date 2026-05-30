# Changelog

## 2.0.0 — 2026-05-29

### Breaking
- Introduces required `coordinator.config.json` (single source for agent identities + scope globs). Hooks fall back to built-in Claude+Cursor defaults if absent, but adopters should add it.

### Added
- `npx claude-cursor-coordinator init` one-command, cross-platform install.
- N-agent support: add Codex/Gemini/Aider/etc. by editing one config file.
- `CI` workflow asserting no generated-file drift.

### Changed
- Per-tool activity now derives from `git log` (no tracked `recent.jsonl`, no merge conflicts, no dirty tree).
- Trailer matching is now case-insensitive on the `Co-authored-by` key (accepts `Co-Authored-By:`).

### Removed
- `.husky/post-commit` hook and `scripts/append-coordination.mjs`.
- Tracked `.coordination/recent.jsonl` (now gitignored).

### Migration from 1.x
1. Run `npx claude-cursor-coordinator init` in your repo (or copy `coordinator.config.json` from this template).
2. `git rm --cached .coordination/recent.jsonl` and add it to `.gitignore`.
3. Delete `.husky/post-commit`. Run `bun gen:rules`.
