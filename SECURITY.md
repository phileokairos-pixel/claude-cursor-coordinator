# Security

## Reporting a vulnerability

If you find a security issue in this template, please **don't open a public issue**.

Email: aaronzendejas01@gmail.com

Include:
- A description of the issue
- Steps to reproduce
- Why you think it's a security problem (not just a bug)

I'll acknowledge within 72 hours and try to fix within 14 days for valid reports.

## What's in scope

- The Husky hook scripts (`scripts/*.mjs`, `scripts/*.ts`)
- The GitHub Action workflow (`.github/workflows/trailer-guard.yml`)
- The Cursor and Claude Code config files this template ships
- The `gen-rules.ts` generator and how it processes `AGENTS.md`

## What's out of scope

- Vulnerabilities in upstream dependencies (Husky, Bun, Node, gitleaks) — report those upstream
- Vulnerabilities in Cursor or Claude Code themselves — report to Cursor or Anthropic
- Issues with how YOU configure the template in YOUR repo — those are your responsibility

## Notes on secret handling

This template never asks you to commit secrets. The `.cursor/mcp.json` example in `docs/CURSOR_USER_SETUP.md` explicitly tells contributors to keep API tokens in their **user-level** `~/.cursor/mcp.json`, not the **repo-level** `.cursor/mcp.json`.

If you find that the template is encouraging users to commit secrets in any way, that's a security issue. Report it.

## The PocketOS lesson

This template exists partly because Cursor's agent wiped a production database in 9 seconds after finding a Railway API token in an unrelated file. If you find a way for either AI to access secrets it shouldn't, please report it.
