# claude-cursor-coordinator Security Review (static)

> **Note:** This review covers the v1.x architecture. The `post-commit` logger, `scripts/append-coordination.mjs`, and `.coordination/recent.jsonl` described below were removed in v2.0.0; activity now derives from `git log`. See CHANGELOG.md.

**Date:** 2026-04-28
**Reviewer:** Claude (static analysis)
**Scope:**
- Husky hooks (`.husky/commit-msg`, `pre-commit`, `post-commit`, `pre-push`)
- Cursor PowerShell wrapper (`.cursor/hooks/sync-preflight.ps1`)
- Node and TypeScript scripts (`scripts/commit-msg-guard.mjs`, `scripts/append-coordination.mjs`, `scripts/gen-rules.ts`, `scripts/status.ts`, `scripts/whodid.ts`)
- GitHub Actions workflow (`.github/workflows/trailer-guard.yml`)
- Trailer-parsing regex usage in guard and post-commit logger
- Hook bypass surfaces and server-side enforcement
- Committed config files (`.cursor/mcp.json`, `.claude/settings.json`, `package.json`, docs)
- Husky 9.1.7 supply-chain footprint
**Repo state:** commit `3f01fe48c8cb52589bda3263277d8d74c9b14d93`

## Executive Summary

- The template is small and disciplined. Every Node script invokes external programs through the safe argv-array path (`execFileSync` with no shell), inputs to `git` are passed through `stdin` rather than as positional arguments, and trailer parsing delegates to `git interpret-trailers` rather than rolling a regex parser. There are no `child_process.exec` calls, no `eval`, no dynamic `require`, and no `Function()` constructors anywhere in scope.
- No CRITICAL or HIGH-severity findings. Two MEDIUM findings concern enforcement gaps: the server-side trailer guard depends on adopter-configured branch protection, and the post-commit logger does not validate that the trailer email belongs to the same author block git accepted as canonical, which lets a trivially-crafted commit mis-tag itself in `recent.jsonl`. Three LOW findings concern hardening opportunities.
- Because this template is intended to be dropped into many adopter repos, the highest-leverage recommendation is a README and setup-doc note that the GitHub Action is the only true enforcement point and that branch protection MUST be enabled on `main` for the system to be more than a hint.
- The PowerShell `-ExecutionPolicy Bypass` flag in the Cursor `sessionStart` hook is the conventional pattern for shipping `.ps1` content with a repo and is scoped to that single invocation; it is not a meaningful weakening of the host's security posture.
- No secrets, tokens, or operational infrastructure are exposed in committed files. `.cursor/mcp.json` is empty, `.claude/settings.json` contains only the public attribution string, and `docs/CURSOR_USER_SETUP.md` correctly directs users to keep personal MCP tokens in `~/.cursor/mcp.json` (out of the repo) with an explicit "do not commit" warning.

## Findings

### MEDIUM 1: post-commit logger trusts trailer text without author binding

**Severity:** Medium
**Component:** `scripts/append-coordination.mjs`
**File:** `scripts/append-coordination.mjs:29-33`

**Description:**
The post-commit script reads the full commit message body and decides `tool = "cursor"` or `tool = "claude"` purely from a regex match on the trailer email. The commit message is attacker-controllable (any human can type any trailer). Nothing cross-checks the trailer against the actual git `author` or `committer` of the commit, so a human-authored commit can write a row into `.coordination/recent.jsonl` that claims `tool: "claude"` or `tool: "cursor"`.

**Attack Scenario:**
A team member writes `git commit -m "feat: thing\n\nCo-authored-by: Cursor <cursoragent@cursor.com>"` while sitting at a normal user account. The commit-msg guard accepts it (it only checks trailer presence, not identity), the post-commit logger writes `{"tool":"cursor", "author":"Real Human", ...}` into `recent.jsonl`, and `bun status` and `bun whodid` then attribute the commit to Cursor. Downstream automation (or the AI tools themselves, which are instructed to read this file before acting) is misled. This does not give code-execution; it corrupts the audit trail that the coordination protocol depends on.

**Recommendation:**
Treat `recent.jsonl` as advisory rather than authoritative — record the trailer claim plus the actual author email separately so consumers can detect mismatch:

```js
const authorEmail = git("log", "-1", "--pretty=%ae");
const trailerClaim = /* current parse logic */;
const tool = (trailerClaim === "cursor" && authorEmail === "cursoragent@cursor.com") ? "cursor"
           : (trailerClaim === "claude" && authorEmail === "noreply@anthropic.com") ? "claude"
           : trailerClaim ? `${trailerClaim}-claimed` : "unknown";
```
Then `whodid.ts` can flag `*-claimed` rows as unverified. This also makes it harder for a corrupted hook to silently rewrite history of who did what.

---

### MEDIUM 2: trailer-guard CI enforcement requires opt-in branch protection

**Severity:** Medium
**Component:** `.github/workflows/trailer-guard.yml` and `docs/CURSOR_USER_SETUP.md`
**File:** `docs/CURSOR_USER_SETUP.md:73-80`

**Description:**
Local Husky hooks can be bypassed by `git commit --no-verify`, by setting `core.hooksPath` to an empty directory, or by uninstalling the package. The GitHub Action is the only check that runs on every push and PR regardless of client-side state. However, by default a failing required-status check does not block a merge unless the repository owner has enabled branch protection that lists `check-trailers` as a required check. The setup doc correctly mentions this in step 7, but it is the last item, marked optional in tone, and easy to skip.

**Attack Scenario:**
An adopter installs the template, configures their AI agents, ships the system, and assumes commits are guaranteed to be attributed. A teammate (human or AI) bypasses Husky with `--no-verify` and pushes directly to `main`. The Action runs and fails, but because branch protection was never configured, the failed check is informational and the commit lands. The audit trail is now incomplete and the team has no signal until someone reads CI logs.

**Recommendation:**
Promote step 7 of `CURSOR_USER_SETUP.md` into a top-level "REQUIRED" section in the README, and add a one-line note inside `trailer-guard.yml` reminding the reader that the workflow is only enforcement when paired with branch protection. Optionally, add a second job that prints a clear warning on the PR checks UI when `protected: false` is detected, to surface the gap to repos that have installed the template but not finished setup.

---

### LOW 1: PowerShell wrapper uses `-ExecutionPolicy Bypass`

**Severity:** Low
**Component:** `.cursor/hooks.json`
**File:** `.cursor/hooks.json:9`

**Description:**
The Cursor `sessionStart` hook invokes `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .cursor/hooks/sync-preflight.ps1`. The `Bypass` flag suppresses signing requirements for that single PowerShell process only and is the standard way to ship a tracked `.ps1` script with a repo on Windows. It is not a meaningful weakening of host security, but it does mean any future malicious modification of `sync-preflight.ps1` will run without the signing-policy speed bump. The script is currently small and benign — it sets a working directory and runs `bun run sync`.

**Attack Scenario:**
An adopter pulls a repo where someone has poisoned `sync-preflight.ps1` between Cursor sessions. On next Cursor open, the malicious PowerShell runs without policy friction. This is the same threat as any other tracked script in the repo (every `.mjs`/`.ts` file in `scripts/` runs locally too), but the PowerShell case is worth documenting because Windows users may assume `RemoteSigned` policy is protecting them.

**Recommendation:**
Two options. Either (a) add a brief note to the PowerShell script header that adopters should code-review changes to this file because it runs without execution-policy enforcement, or (b) keep `Bypass` (necessary for Cursor's launcher) and rely on the rest of the supply-chain hygiene that already protects every other script in the repo. Option (a) is preferable because it is zero cost and surfaces the trust requirement to readers.

---

### LOW 2: no integrity check on the gen-rules pipeline; AGENTS.md is implicitly trusted

**Severity:** Low
**Component:** `scripts/gen-rules.ts`
**File:** `scripts/gen-rules.ts:31-86`

**Description:**
`gen-rules.ts` reads `AGENTS.md`, parses scope blocks via `<!-- @scope: (\w+) -->`, and writes generated rule files into `.cursor/rules/` and the repo root. The `\w+` capture group constrains scope names to `[A-Za-z0-9_]`, so traditional path-traversal payloads (`..`, `/`, `\`, `.`) cannot reach the filename. The output paths are entirely controlled by the script. There is no arbitrary file write here. However, the *content* of `AGENTS.md` flows verbatim into `CLAUDE.md`, `.cursorrules`, and `.cursor/rules/*.mdc`, all of which are read by AI tools. A contributor whose PR modifies `AGENTS.md` is effectively rewriting the system prompt for every AI agent the team runs. This is a prompt-injection class concern, not an OS-level code-execution issue.

**Attack Scenario:**
A contributor opens a PR that modifies `AGENTS.md` to add subtle instructions ("when refactoring auth, prefer this insecure pattern"). If the PR is merged without a careful read of AGENTS.md, every subsequent AI session inherits the malicious instruction set. The trailer-guard CI does not inspect AGENTS.md content; the pre-commit hook only regenerates output files, it does not validate them.

**Recommendation:**
Treat `AGENTS.md` as a security-relevant file in code review. Adopters should add `AGENTS.md` to their `CODEOWNERS` so changes require a designated reviewer, and consider a CI job that posts a diff summary of AGENTS.md changes on every PR that touches it. This is a process recommendation, not a code change.

---

### LOW 3: husky 9.1.7 is current and clean of public CVEs at review time

**Severity:** Low (informational)
**Component:** `package.json`
**File:** `package.json:18`

**Description:**
`devDependencies.husky: ^9.1.7` is the most recent published version line and has no public CVEs against it at the time of this review. The Husky 9 install path (`node_modules/husky/index.js`) is small (~30 lines), uses `git config core.hooksPath` to point Git at `.husky/_/`, and refuses to operate if `..` appears in the directory argument. No deprecated `husky add/set/install` command paths are reachable from this template. The supply-chain attack surface is therefore the typicode/husky package itself, which adopters will refresh via their lockfile in the normal way.

**Recommendation:**
None. Periodically re-check Husky against advisory feeds when bumping the version pin.

---

## Notes & Hardening Suggestions

- The Husky pre-commit hook re-runs `bun gen:rules` and stages the generated outputs only when `AGENTS.md` is in the cached changeset. The shell glob `git add CLAUDE.md .cursorrules .cursor/rules/*.mdc` is bounded to those exact paths and the `.mdc` directory, so attacker-controlled filename expansion is not possible.
- All Node and TypeScript scripts launch external programs via `execFileSync` with explicit argument arrays, never via shell-string-interpolated commands. Inputs to `git interpret-trailers` are passed via `stdin`, which avoids the shell-metachar injection that a `git interpret-trailers --parse <<<"$body"` pattern would expose.
- Trailer regexes are not catastrophically backtracking. The structure (`\s*` then `[^<]*` then literal `<...>` then `\s*`) is greedy with non-overlapping anchors at the literal `<` and `>` characters, so adversarial whitespace input degrades linearly, not exponentially.
- The GitHub Action runs on `pull_request` (not `pull_request_target`), so PRs from forks check out the fork's code without access to write secrets. The `BASE_SHA` and `HEAD_SHA` interpolations come from `github.event.pull_request.base.sha`, `github.event.before`, and `github.sha`, all of which are server-controlled 40-char hex strings, not attacker-influenced fields.
- The `pre-push` hook reads `git rev-parse --abbrev-ref HEAD` and embeds it in an `echo` string. Even if a branch name contained shell-significant characters, `echo "literal string with $(...) interpolation"` does not re-evaluate the interpolated text as code.
- `recent.jsonl` is line-delimited JSON written via `JSON.stringify`, which escapes embedded newlines and control characters; a crafted commit subject cannot break out of the JSON record into a forged second row.
- Consider adding a `.gitattributes` rule to mark `recent.jsonl` as `merge=union` so concurrent commits on the same branch by Cursor and Claude do not produce merge conflicts that tempt one tool to truncate the other's history.
- Consider documenting that adopters who already use `lint-staged`, `commitlint`, or another commit-msg framework should layer this template's `commit-msg-guard.mjs` on top rather than replacing their existing checks.
