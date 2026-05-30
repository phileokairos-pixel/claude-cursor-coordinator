# Coordinator Hardening v2.0.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make claude-cursor-coordinator practice its own single-source thesis: one config file drives agent identity + scope globs, activity derives from git log (no tracked log, no conflicts), N-agent ready, one-command npx install, CI proves no drift. Ship as v2.0.0.

**Architecture:** Introduce `coordinator.config.json` as the single source of truth, read by a shared loader (`scripts/lib/config.mjs`) that fails *safe* to built-in defaults. All enforcement (commit-msg guard, CI), generation (gen-rules → `.gitmessage` + AGENTS.md attribution + `.cursor/rules`), and reporting (status, whodid) consume the loader. Delete the post-commit hook and tracked `recent.jsonl`; derive per-tool activity from `git log` trailers on demand.

**Tech Stack:** Bun + Node, Husky 9, TypeScript/ESM, `git interpret-trailers`, GitHub Actions, `jq` (CI only).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `coordinator.config.json` (new) | Single source: `agents` (key→{email,label}) + `scopes` (key→{globs?,priority,alwaysApply?,description}) |
| `scripts/config.schema.json` (new) | JSON Schema for editor validation + `init` |
| `scripts/lib/config.mjs` (new) | Loader: `loadConfig`, `agentEmails`, `toolForEmail`; fail-safe defaults; never throws, never fails open |
| `scripts/commit-msg-guard.mjs` (rewrite) | Validate trailer against loader emails; case-insensitive key |
| `scripts/gen-rules.ts` (rewrite) | Read scopes from loader; generate `.gitmessage` + AGENTS.md attribution block + `.cursor/rules/*.mdc` |
| `scripts/status.ts` (rewrite) | Derive recent activity from `git log` trailers |
| `scripts/whodid.ts` (rewrite) | Derive 7-day per-tool counts from `git log` trailers |
| `scripts/cli/init.mjs` (new) | `npx claude-cursor-coordinator init`: copy files, seed config, run gen+test |
| `.github/workflows/trailer-guard.yml` (rewrite) | Read emails from config via `jq`; case-insensitive key |
| `.github/workflows/ci.yml` (new) | `bun test` + regen-drift assertion |
| `.husky/post-commit` (delete) | — |
| `scripts/append-coordination.mjs` (delete) | — |
| `.gitignore` (modify) | ignore `.coordination/recent.jsonl` |
| `package.json` (modify) | add `bin`, bump to 2.0.0, update `test` glob |
| `CHANGELOG.md` (new) | 2.0.0 notes + migration |
| `README.md`, `AGENTS.md`, `docs/CURSOR_USER_SETUP.md` (modify) | Docs sync |

**Test command convention (existing):** `.mjs` tests run under `node --test`; `.ts` tests run under `bun test`. Keep that split.

---

## Task 1: Shared config loader with fail-safe defaults

**Files:**
- Create: `scripts/lib/config.mjs`
- Test: `scripts/tests/config.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// scripts/tests/config.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, agentEmails, toolForEmail, DEFAULT_AGENTS } from "../lib/config.mjs";

function tmp(contents) {
  const dir = mkdtempSync(join(tmpdir(), "ccc-"));
  if (contents !== undefined) writeFileSync(join(dir, "coordinator.config.json"), contents);
  return dir;
}

test("missing config falls back to default agents (fail-safe, not fail-open)", () => {
  const dir = tmp(undefined);
  const cfg = loadConfig(dir);
  assert.deepEqual(cfg.agents, DEFAULT_AGENTS);
  assert.ok(agentEmails(cfg).includes("noreply@anthropic.com"));
  assert.ok(agentEmails(cfg).length >= 2);
  rmSync(dir, { recursive: true, force: true });
});

test("malformed JSON falls back to defaults and never throws", () => {
  const dir = tmp("{ not json ");
  const cfg = loadConfig(dir);
  assert.ok(agentEmails(cfg).length >= 2);
  rmSync(dir, { recursive: true, force: true });
});

test("config with empty agents object falls back (never fail-open)", () => {
  const dir = tmp(JSON.stringify({ agents: {} }));
  const cfg = loadConfig(dir);
  assert.ok(agentEmails(cfg).length >= 2);
  rmSync(dir, { recursive: true, force: true });
});

test("valid config is read and supports a third agent", () => {
  const dir = tmp(JSON.stringify({
    agents: {
      claude: { email: "noreply@anthropic.com", label: "Claude" },
      cursor: { email: "cursoragent@cursor.com", label: "Cursor" },
      codex:  { email: "codex@openai.com", label: "Codex" },
    },
  }));
  const cfg = loadConfig(dir);
  assert.equal(toolForEmail(cfg, "codex@openai.com"), "codex");
  assert.equal(toolForEmail(cfg, "unknown@x.com"), "unknown");
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/tests/config.test.mjs`
Expected: FAIL — `Cannot find module '../lib/config.mjs'`

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/lib/config.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_AGENTS = {
  claude: { email: "noreply@anthropic.com", label: "Claude" },
  cursor: { email: "cursoragent@cursor.com", label: "Cursor" },
};

export const DEFAULT_SCOPES = {
  coordination: { alwaysApply: true, priority: 300, description: "Coordination protocol for Claude+Cursor" },
};

function isNonEmptyAgents(agents) {
  return agents && typeof agents === "object" && Object.keys(agents).length > 0
    && Object.values(agents).every(a => a && typeof a.email === "string" && a.email.includes("@"));
}

export function loadConfig(cwd = process.cwd()) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(join(cwd, "coordinator.config.json"), "utf8"));
  } catch {
    return { agents: DEFAULT_AGENTS, scopes: DEFAULT_SCOPES, _source: "default" };
  }
  const agents = isNonEmptyAgents(raw.agents) ? raw.agents : DEFAULT_AGENTS;
  const scopes = (raw.scopes && typeof raw.scopes === "object") ? raw.scopes : DEFAULT_SCOPES;
  if (agents === DEFAULT_AGENTS && raw.agents !== undefined) {
    console.error("WARNING: coordinator.config.json has invalid 'agents'; using built-in defaults.");
  }
  return { agents, scopes, _source: "file" };
}

export function agentEmails(config) {
  return Object.values(config.agents).map(a => a.email);
}

export function toolForEmail(config, email) {
  const match = Object.entries(config.agents).find(([, a]) => a.email.toLowerCase() === String(email).toLowerCase());
  return match ? match[0] : "unknown";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/tests/config.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/config.mjs scripts/tests/config.test.mjs
git commit -m "feat: add fail-safe config loader

Co-authored-by: Claude <noreply@anthropic.com>"
```

---

## Task 2: Seed config file + JSON schema

**Files:**
- Create: `coordinator.config.json`
- Create: `scripts/config.schema.json`

- [ ] **Step 1: Write `coordinator.config.json`**

```json
{
  "$schema": "./scripts/config.schema.json",
  "agents": {
    "claude": { "email": "noreply@anthropic.com", "label": "Claude" },
    "cursor": { "email": "cursoragent@cursor.com", "label": "Cursor" }
  },
  "scopes": {
    "php":          { "globs": ["**/*.php"],            "priority": 100, "description": "PHP / Laravel conventions" },
    "react":        { "globs": ["**/*.tsx", "**/*.ts"], "priority": 200, "description": "React / TypeScript / TSX conventions" },
    "coordination": { "alwaysApply": true,              "priority": 300, "description": "Coordination protocol for Claude+Cursor" }
  }
}
```

- [ ] **Step 2: Write `scripts/config.schema.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Coordinator config",
  "type": "object",
  "required": ["agents"],
  "properties": {
    "agents": {
      "type": "object",
      "minProperties": 1,
      "additionalProperties": {
        "type": "object",
        "required": ["email"],
        "properties": {
          "email": { "type": "string", "format": "email" },
          "label": { "type": "string" }
        }
      }
    },
    "scopes": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "globs": { "type": "array", "items": { "type": "string" } },
          "priority": { "type": "integer" },
          "alwaysApply": { "type": "boolean" },
          "description": { "type": "string" }
        }
      }
    }
  }
}
```

- [ ] **Step 3: Verify loader reads the real file**

Run: `node -e "import('./scripts/lib/config.mjs').then(m => console.log(m.agentEmails(m.loadConfig())))"`
Expected: `[ 'noreply@anthropic.com', 'cursoragent@cursor.com' ]`

- [ ] **Step 4: Commit**

```bash
git add coordinator.config.json scripts/config.schema.json
git commit -m "feat: add coordinator.config.json single source of truth

Co-authored-by: Claude <noreply@anthropic.com>"
```

---

## Task 3: Rewrite commit-msg guard onto loader + case-insensitive key

**Files:**
- Modify: `scripts/commit-msg-guard.mjs`
- Test: `scripts/tests/commit-msg-guard.test.mjs` (extend existing)

- [ ] **Step 1: Add failing tests for config-driven + case-insensitive + N-agent**

Append to `scripts/tests/commit-msg-guard.test.mjs` (mirror the existing harness that writes a temp message file and runs the guard; reuse its helper). Add:

```js
test("accepts Co-Authored-By with capitalized key (case-insensitive)", () => {
  const code = runGuard("docs: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n");
  assert.equal(code, 0);
});

test("accepts a third agent present in config (codex)", () => {
  // writes a temp coordinator.config.json including codex into the guard's cwd
  const code = runGuardWithConfig(
    "feat: y\n\nCo-authored-by: Codex <codex@openai.com>\n",
    { agents: { codex: { email: "codex@openai.com", label: "Codex" } } }
  );
  assert.equal(code, 0);
});

test("rejects when no known trailer present", () => {
  const code = runGuard("docs: x\n\nCo-authored-by: Nobody <nobody@example.com>\n");
  assert.equal(code, 1);
});
```

> Implementation note for the test helper: `runGuardWithConfig` writes `coordinator.config.json` to a temp dir, writes the message to a file there, and runs `node <abs path>/scripts/commit-msg-guard.mjs <msgfile>` with `cwd` set to the temp dir. `runGuard` is the no-extra-config variant (relies on built-in defaults).

- [ ] **Step 2: Run tests to verify the case-insensitive + codex ones fail**

Run: `node --test scripts/tests/commit-msg-guard.test.mjs`
Expected: FAIL on the capitalized-key test and the codex test.

- [ ] **Step 3: Rewrite the guard**

```js
// scripts/commit-msg-guard.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import { loadConfig, agentEmails } from "./lib/config.mjs";

const msgPath = process.argv[2];
const body = readFileSync(msgPath, "utf8").trim();
const subject = body.split("\n", 1)[0];

if (/^(Merge |Revert )/.test(subject)) {
  process.exit(0);
}

let trailers;
try {
  trailers = execFileSync("git", ["interpret-trailers", "--parse"], { input: body, encoding: "utf8" });
} catch {
  trailers = "";
}

const emails = agentEmails(loadConfig());
// key matched case-insensitively (git treats trailer keys case-insensitively); email matched exactly.
const ok = emails.some(email => {
  const re = new RegExp(`^Co-authored-by:\\s*[^<]*<${email.replace(/[.+]/g, "\\$&")}>\\s*$`, "im");
  return re.test(trailers);
});

if (!ok) {
  const lines = Object.values(loadConfig().agents).map(a => `  Co-authored-by: ${a.label ?? "Agent"} <${a.email}>`);
  console.error("");
  console.error("ERROR: Commit message must include an attribution trailer.");
  console.error("");
  console.error("Add a blank line and one of:");
  console.error(lines.join("\n"));
  console.error("");
  console.error("See .gitmessage or coordinator.config.json.");
  process.exit(1);
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test scripts/tests/commit-msg-guard.test.mjs`
Expected: PASS (all, including the two previously-failing)

- [ ] **Step 5: Commit**

```bash
git add scripts/commit-msg-guard.mjs scripts/tests/commit-msg-guard.test.mjs
git commit -m "fix: drive commit-msg guard from config, case-insensitive trailer key

Co-authored-by: Claude <noreply@anthropic.com>"
```

---

## Task 4: gen-rules reads scopes from config + generates .gitmessage and attribution

**Files:**
- Modify: `scripts/gen-rules.ts`
- Test: `scripts/tests/gen-rules.test.ts` (extend existing)

- [ ] **Step 1: Add failing tests**

Append to `scripts/tests/gen-rules.test.ts`:

```ts
test("generates .gitmessage from config agents", () => {
  // run gen-rules in a temp dir containing AGENTS.md + coordinator.config.json
  const dir = setupTempProject({ agents: { claude: { email: "noreply@anthropic.com", label: "Claude" }, cursor: { email: "cursoragent@cursor.com", label: "Cursor" } } });
  runGenRules(dir);
  const gitmessage = readFileSync(join(dir, ".gitmessage"), "utf8");
  expect(gitmessage).toContain("Co-authored-by: Claude <noreply@anthropic.com>");
  expect(gitmessage).toContain("Co-authored-by: Cursor <cursoragent@cursor.com>");
});

test("scope mdc globs come from config, not hardcoded map", () => {
  const dir = setupTempProject({
    agents: { claude: { email: "noreply@anthropic.com" } },
    scopes: { go: { globs: ["**/*.go"], priority: 150, description: "Go conventions" } },
  }, "<!-- @scope: go -->\nUse gofmt.\n<!-- @endscope -->\n");
  runGenRules(dir);
  const mdc = readFileSync(join(dir, ".cursor/rules/150-go.mdc"), "utf8");
  expect(mdc).toContain('- "**/*.go"');
  expect(mdc).toContain("Go conventions");
});
```

> Helper note: `setupTempProject(config, extraAgentsMd?)` writes `AGENTS.md` (with optional scoped block) + `coordinator.config.json` to a temp dir; `runGenRules(dir)` runs `bun scripts/gen-rules.ts` with `cwd: dir`.

- [ ] **Step 2: Run to verify fail**

Run: `bun test scripts/tests/gen-rules.test.ts`
Expected: FAIL — `.gitmessage` not generated; `150-go.mdc` missing.

- [ ] **Step 3: Modify `gen-rules.ts`**

Replace the hardcoded `scopeGlobs` map (lines ~54-60) with a config read, and add `.gitmessage` + attribution generation. Key changes:

```ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { loadConfig } from "./lib/config.mjs";

// ...existing parseScopedSections / buildCanonical / buildMdc unchanged...

function buildGitmessage(agents: Record<string, { email: string; label?: string }>): string {
  const lines = Object.values(agents).map(a => `# Co-authored-by: ${a.label ?? "Agent"} <${a.email}>`);
  return [
    "",
    "# <type>: <subject>   (feat|fix|docs|refactor|test|chore)",
    "#",
    "# Add ONE attribution trailer below (uncomment the one that applies):",
    ...lines,
    "",
  ].join("\n");
}

function main() {
  const source = readFileSync("AGENTS.md", "utf8");
  const { canonical, scoped } = parseScopedSections(source);
  const config = loadConfig();

  writeFileSync("CLAUDE.md", source);
  writeFileSync(".cursorrules", buildCanonical(canonical, scoped));
  writeFileSync(".gitmessage", buildGitmessage(config.agents));

  mkdirSync(".cursor/rules", { recursive: true });
  writeFileSync(".cursor/rules/000-canonical.mdc",
    buildMdc(`description: Canonical agent rules from AGENTS.md\nalwaysApply: true`, canonical));

  for (const section of scoped) {
    const cfg = config.scopes[section.scope] ?? { description: `${section.scope} scope`, alwaysApply: false, priority: 999 };
    const priority = cfg.priority ?? 999;
    const filename = `${String(priority).padStart(3, "0")}-${section.scope}.mdc`;
    const lines = [`description: ${cfg.description ?? section.scope}`];
    if (cfg.globs) { lines.push("globs:"); for (const g of cfg.globs) lines.push(`  - "${g}"`); }
    lines.push(`alwaysApply: ${cfg.alwaysApply ?? false}`);
    writeFileSync(`.cursor/rules/${filename}`, buildMdc(lines.join("\n"), section.content));
  }

  console.log("Generated: CLAUDE.md, .cursorrules, .gitmessage, .cursor/rules/*.mdc from AGENTS.md + coordinator.config.json");
}

main();
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test scripts/tests/gen-rules.test.ts`
Expected: PASS

- [ ] **Step 5: Regenerate real outputs and commit**

```bash
bun gen:rules
git add scripts/gen-rules.ts scripts/tests/gen-rules.test.ts .gitmessage CLAUDE.md .cursorrules .cursor/rules/
git commit -m "feat: gen-rules sources scopes + .gitmessage from config

Co-authored-by: Claude <noreply@anthropic.com>"
```

---

## Task 5: Derive activity from git log — shared parser

**Files:**
- Create: `scripts/lib/activity.mjs`
- Test: `scripts/tests/activity.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// scripts/tests/activity.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recentActivity } from "../lib/activity.mjs";

function repoWithCommits() {
  const dir = mkdtempSync(join(tmpdir(), "ccc-act-"));
  const sh = (c) => execSync(c, { cwd: dir, stdio: "pipe" });
  sh("git init -q");
  sh('git config user.email a@b.c'); sh('git config user.name A');
  writeFileSync(join(dir, "coordinator.config.json"), JSON.stringify({
    agents: { claude: { email: "noreply@anthropic.com" }, cursor: { email: "cursoragent@cursor.com" } },
  }));
  writeFileSync(join(dir, "f1"), "1");
  sh("git add -A");
  sh('git commit -q -m "feat: one\n\nCo-authored-by: Claude <noreply@anthropic.com>"');
  writeFileSync(join(dir, "f2"), "2");
  sh("git add -A");
  sh('git commit -q -m "fix: two\n\nCo-authored-by: Cursor <cursoragent@cursor.com>"');
  return dir;
}

test("classifies commits by trailer email", () => {
  const dir = repoWithCommits();
  const items = recentActivity(dir, { sinceDays: 3650 });
  const tools = items.map(i => i.tool).sort();
  assert.deepEqual(tools, ["claude", "cursor"]);
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test scripts/tests/activity.test.mjs`
Expected: FAIL — `Cannot find module '../lib/activity.mjs'`

- [ ] **Step 3: Implement**

```js
// scripts/lib/activity.mjs
import { execFileSync } from "node:child_process";
import { loadConfig, toolForEmail } from "./lib/config.mjs"; // NOTE: adjust to "./config.mjs"

const SEP = " ";

export function recentActivity(cwd = process.cwd(), { sinceDays = 7, max = 200 } = {}) {
  const config = loadConfig(cwd);
  let out = "";
  try {
    out = execFileSync("git",
      ["log", `--since=${sinceDays} days ago`, `-n${max}`, `--pretty=format:%H${SEP}%aI${SEP}%s${SEP}%b%x1e`],
      { cwd, encoding: "utf8" });
  } catch { return []; }
  if (!out.trim()) return [];
  return out.split("").map(rec => rec.trim()).filter(Boolean).map(rec => {
    const [hash, iso, subject, body = ""] = rec.split(SEP);
    const m = body.match(/Co-authored-by:\s*[^<]*<([^>]+)>/i);
    const tool = m ? toolForEmail(config, m[1]) : "unknown";
    return { hash, ts: iso, subject, tool };
  });
}
```

> Fix the import path to `"./config.mjs"` (same dir). The inline comment above flags it.

- [ ] **Step 4: Run to verify pass**

Run: `node --test scripts/tests/activity.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/activity.mjs scripts/tests/activity.test.mjs
git commit -m "feat: derive per-tool activity from git log trailers

Co-authored-by: Claude <noreply@anthropic.com>"
```

---

## Task 6: Rewrite status.ts + whodid.ts onto activity parser

**Files:**
- Modify: `scripts/status.ts`, `scripts/whodid.ts`

- [ ] **Step 1: Rewrite `status.ts`**

Replace the `recent.jsonl` block (lines ~32-55) with:

```ts
import { recentActivity } from "./lib/activity.mjs";
// ...keep git()/gh()/branch/status/uncommitted prints...

console.log("\n--- recent activity (per tool) ---");
const items = recentActivity(process.cwd(), { sinceDays: 14 });
const byTool = (t: string) => items.filter(i => i.tool === t).slice(0, 5);
for (const tool of [...new Set(items.map(i => i.tool))]) {
  console.log(`${tool}:`);
  byTool(tool).forEach(e => console.log(`  ${e.hash.slice(0, 7)} ${e.subject}`));
}
```

- [ ] **Step 2: Rewrite `whodid.ts`**

```ts
import process from "node:process";
import { recentActivity } from "./lib/activity.mjs";

const toolFilter = process.argv.slice(2).find(a => a.startsWith("--tool="))?.split("=")[1];
let items = recentActivity(process.cwd(), { sinceDays: 7 });
if (toolFilter) items = items.filter(i => i.tool === toolFilter);

const counts: Record<string, number> = {};
for (const e of items) counts[e.tool] = (counts[e.tool] || 0) + 1;

console.log(`\n=== whodid (last 7 days${toolFilter ? `, tool=${toolFilter}` : ""}) ===\n`);
console.log(`Total commits: ${items.length}`);
console.log("Per tool:");
for (const [tool, count] of Object.entries(counts)) console.log(`  ${tool}: ${count}`);
console.log("\nRecent commits:");
for (const e of items.slice(0, 20)) console.log(`  ${e.ts.slice(0, 16)} [${e.tool}] ${e.hash.slice(0, 7)} ${e.subject}`);
```

- [ ] **Step 3: Smoke-test both against this repo**

Run: `bun scripts/status.ts && bun scripts/whodid.ts`
Expected: both print recent commits classified under `claude` (this branch's commits), no crash, no reference to recent.jsonl.

- [ ] **Step 4: Commit**

```bash
git add scripts/status.ts scripts/whodid.ts
git commit -m "refactor: status + whodid derive from git log, drop recent.jsonl read

Co-authored-by: Claude <noreply@anthropic.com>"
```

---

## Task 7: Delete post-commit hook, appender, and untrack recent.jsonl

**Files:**
- Delete: `.husky/post-commit`, `scripts/append-coordination.mjs`, `scripts/tests/append-coordination.test.mjs`
- Modify: `.gitignore`
- Delete tracked: `.coordination/recent.jsonl`

- [ ] **Step 1: Remove files and untrack the log**

```bash
git rm .husky/post-commit scripts/append-coordination.mjs scripts/tests/append-coordination.test.mjs
git rm --cached .coordination/recent.jsonl
printf '\n.coordination/recent.jsonl\n' >> .gitignore
```

- [ ] **Step 2: Verify nothing references the deleted appender**

Run: `grep -rn "append-coordination\|recent.jsonl" scripts .husky package.json README.md AGENTS.md || echo "clean"`
Expected: only `.gitignore` line and (until Task 9) doc mentions; no script/hook references.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "refactor: remove post-commit appender and tracked recent.jsonl

Co-authored-by: Claude <noreply@anthropic.com>"
```

---

## Task 8: Update package.json (test glob, bin, version)

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Edit scripts + metadata**

Set `"version": "2.0.0"`. Update `test` to include new mjs tests (the `scripts/tests/*.test.mjs` glob already covers them) and keep the ts test. Add `bin`:

```json
"bin": { "claude-cursor-coordinator": "scripts/cli/init.mjs" },
"files": ["scripts", ".husky", ".coordination/INDEX.md", ".coordination/HANDOFF.md", ".cursor", ".claude", ".github", "AGENTS.md", "coordinator.config.json", "docs", ".gitattributes", ".gitmessage", "LICENSE", "README.md"],
"test": "node --test scripts/tests/*.test.mjs && bun test scripts/tests/gen-rules.test.ts"
```

- [ ] **Step 2: Verify test runner still green**

Run: `bun test`
Expected: PASS (config, commit-msg-guard, activity, gen-rules). No `append-coordination` test remains.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: bump to 2.0.0, add bin, refresh files list

Co-authored-by: Claude <noreply@anthropic.com>"
```

---

## Task 9: `npx claude-cursor-coordinator init` CLI

**Files:**
- Create: `scripts/cli/init.mjs`
- Test: `scripts/tests/init.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// scripts/tests/init.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("init copies config + scripts and is idempotent", () => {
  const dest = mkdtempSync(join(tmpdir(), "ccc-init-"));
  execFileSync("git", ["init", "-q"], { cwd: dest });
  const cli = join(process.cwd(), "scripts/cli/init.mjs");
  execFileSync("node", [cli], { cwd: dest, stdio: "pipe" });
  assert.ok(existsSync(join(dest, "coordinator.config.json")));
  assert.ok(existsSync(join(dest, "scripts/lib/config.mjs")));
  assert.ok(existsSync(join(dest, ".husky/commit-msg")));
  // second run must not throw (idempotent, no clobber without --force)
  execFileSync("node", [cli], { cwd: dest, stdio: "pipe" });
  rmSync(dest, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test scripts/tests/init.test.mjs`
Expected: FAIL — CLI file missing.

- [ ] **Step 3: Implement `scripts/cli/init.mjs`**

```js
#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

const force = process.argv.includes("--force");
const here = dirname(fileURLToPath(import.meta.url));
const templateRoot = join(here, "..", "..");        // package root
const dest = process.cwd();

const COPY = ["scripts", ".husky", ".cursor", ".claude", ".github", "AGENTS.md", ".gitattributes", ".gitmessage", "docs/CANONICAL_EXAMPLES.md", "docs/CURSOR_USER_SETUP.md"];

function copy(rel) {
  const from = join(templateRoot, rel), to = join(dest, rel);
  if (existsSync(to) && !force) { console.log(`skip (exists): ${rel}`); return; }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`copied: ${rel}`);
}

for (const rel of COPY) copy(rel);

const cfgPath = join(dest, "coordinator.config.json");
if (!existsSync(cfgPath) || force) {
  cpSync(join(templateRoot, "coordinator.config.json"), cfgPath);
  console.log("created: coordinator.config.json");
} else {
  console.log("skip (exists): coordinator.config.json");
}

try {
  execFileSync("bun", ["gen:rules"], { cwd: dest, stdio: "inherit" });
} catch {
  console.log("Note: run `bun gen:rules` once Bun is installed.");
}
console.log("\n✓ Coordinator installed. Commit with a Co-authored-by trailer; see .gitmessage.");
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test scripts/tests/init.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/cli/init.mjs scripts/tests/init.test.mjs
git commit -m "feat: add npx init CLI for one-command install

Co-authored-by: Claude <noreply@anthropic.com>"
```

---

## Task 10: CI — trailer-guard from config + drift-dogfood workflow

**Files:**
- Modify: `.github/workflows/trailer-guard.yml`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Rewrite trailer-guard to read config emails via jq + case-insensitive key**

Replace the grep line so the accepted emails come from `coordinator.config.json`:

```yaml
      - name: Verify all commits have a known Co-authored-by trailer
        run: |
          EMAILS=$(jq -r '.agents[].email' coordinator.config.json 2>/dev/null)
          [ -z "$EMAILS" ] && EMAILS=$'noreply@anthropic.com\ncursoragent@cursor.com'
          PATTERN=$(printf '%s\n' "$EMAILS" | sed 's/[.[\*^$]/\\&/g' | paste -sd '|' -)
          BASE_SHA="${{ github.event.pull_request.base.sha || github.event.before }}"
          HEAD_SHA="${{ github.event.pull_request.head.sha || github.sha }}"
          if [ -z "$BASE_SHA" ] || [ "$BASE_SHA" = "0000000000000000000000000000000000000000" ]; then
            BASE_SHA=$(git rev-list --max-parents=0 HEAD | tail -1)
          fi
          MISSING=0
          for SHA in $(git rev-list "$BASE_SHA".."$HEAD_SHA"); do
            MSG=$(git log -1 --pretty=%B "$SHA")
            echo "$MSG" | head -1 | grep -qE "^(Merge|Revert) " && continue
            TRAILERS=$(echo "$MSG" | git interpret-trailers --parse)
            if ! echo "$TRAILERS" | grep -qiE "^Co-authored-by: .*<($PATTERN)>$"; then
              echo "::error::Commit $SHA missing known Co-authored-by trailer"
              MISSING=1
            fi
          done
          [ $MISSING -eq 1 ] && exit 1 || true
```

- [ ] **Step 2: Create `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
jobs:
  test-and-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun test
      - name: Assert no generated drift
        run: |
          bun gen:rules
          git diff --exit-code CLAUDE.md .cursorrules .gitmessage .cursor/rules/ \
            || (echo "::error::Generated files drifted. Run 'bun gen:rules' and commit." && exit 1)
```

- [ ] **Step 3: Validate YAML locally**

Run: `bun -e "require('node:fs').readFileSync('.github/workflows/ci.yml','utf8')" && echo ok` (sanity read; full validation happens on push)
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/trailer-guard.yml .github/workflows/ci.yml
git commit -m "ci: config-driven trailer guard + drift-dogfood workflow

Co-authored-by: Claude <noreply@anthropic.com>"
```

---

## Task 11: Docs + CHANGELOG + AGENTS.md attribution sync

**Files:**
- Create: `CHANGELOG.md`
- Modify: `README.md`, `AGENTS.md`, `docs/CURSOR_USER_SETUP.md`

- [ ] **Step 1: Write `CHANGELOG.md`**

```markdown
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
```

- [ ] **Step 2: Update README**

Edit: install section → `npx claude-cursor-coordinator init` (keep manual POSIX+PowerShell copy as fallback); "What ships" → replace `append-coordination.mjs` line with `coordinator.config.json` + `cli/init.mjs`; the "How it works" ASCII diagram → remove the post-commit→jsonl path, add "status/whodid read git log on demand"; "Customization" → point agent/scope edits at `coordinator.config.json`.

- [ ] **Step 3: Update AGENTS.md attribution + coordination sections**

In `AGENTS.md`: the attribution section should reference `coordinator.config.json` as the source and note generation; the "read last 10 lines of recent.jsonl" instruction → "run `bun status` / `bun whodid` (derived from git log)". Then regenerate.

- [ ] **Step 4: Update `docs/CURSOR_USER_SETUP.md`** to drop any recent.jsonl mention and reference the config file.

- [ ] **Step 5: Regenerate + commit**

```bash
bun gen:rules
git add CHANGELOG.md README.md AGENTS.md CLAUDE.md .cursorrules .cursor/rules/ .gitmessage docs/CURSOR_USER_SETUP.md
git commit -m "docs: sync README/AGENTS/CHANGELOG for v2.0.0

Co-authored-by: Claude <noreply@anthropic.com>"
```

---

## Task 12: Full green + PR + publish

**Files:** none (verification + release)

- [ ] **Step 1: Run the whole suite**

Run: `bun test`
Expected: PASS — config, commit-msg-guard, activity, gen-rules, init. Zero failures.

- [ ] **Step 2: Drift check locally (mirror CI)**

Run: `bun gen:rules && git diff --exit-code CLAUDE.md .cursorrules .gitmessage .cursor/rules/ && echo "no drift"`
Expected: `no drift`

- [ ] **Step 3: Push branch + open PR**

```bash
git push -u origin feat/coordinator-hardening-v2
gh pr create --title "v2.0.0: single-source config, git-log activity, npx init" --body "Implements docs/superpowers/specs/2026-05-29-coordinator-hardening-design.md"
```
Expected: CI (trailer-guard + ci) goes green.

- [ ] **Step 4: Publish to npm (after merge or from branch per user)**

Verify auth, then publish:
```bash
npm whoami            # must succeed; if not, STOP and hand the command to Aaron
npm publish --access public
```
Expected: `claude-cursor-coordinator@2.0.0` published. If `npm whoami` fails, deliver publish-ready and give Aaron the exact two commands.

---

## Self-Review

**Spec coverage:** config single-source (T1,T2,T3,T4,T10) ✓; N-agent (T1,T3) ✓; derive-from-git-log + delete jsonl/hook (T5,T6,T7) ✓; npx init (T9) ✓; CI drift dogfood (T10) ✓; v2.0.0 + CHANGELOG + migration + fail-safe (T1,T8,T11) ✓; case-insensitive trailer bonus (T3,T10) ✓; docs sync (T11) ✓; tests pass for real (T12) ✓; publish (T12) ✓.

**Placeholder scan:** No TBD/TODO. One intentional inline note in Task 5 Step 3 flagging the import path correction (`./config.mjs`); fix applied at implementation.

**Type consistency:** `loadConfig`/`agentEmails`/`toolForEmail` (T1) reused identically in T3, T5. `recentActivity(cwd, {sinceDays,max})` returning `{hash,ts,subject,tool}` (T5) consumed unchanged in T6. `coordinator.config.json` shape (T2) matches loader expectations (T1) and schema (T2).
