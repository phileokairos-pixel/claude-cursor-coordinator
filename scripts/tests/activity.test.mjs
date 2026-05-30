import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recentActivity } from "../lib/activity.mjs";

function repoWithCommits() {
  const dir = mkdtempSync(join(tmpdir(), "ccc-act-"));
  const sh = (args) => execFileSync("git", args, { cwd: dir, stdio: "pipe" });
  sh(["init", "-q"]);
  sh(["config", "user.email", "a@b.c"]);
  sh(["config", "user.name", "A"]);
  writeFileSync(join(dir, "coordinator.config.json"), JSON.stringify({
    agents: { claude: { email: "noreply@anthropic.com" }, cursor: { email: "cursoragent@cursor.com" } },
  }));
  writeFileSync(join(dir, "f1"), "1");
  sh(["add", "-A"]);
  sh(["commit", "-q", "-m", "feat: one with spaces", "-m", "Co-authored-by: Claude <noreply@anthropic.com>"]);
  writeFileSync(join(dir, "f2"), "2");
  sh(["add", "-A"]);
  sh(["commit", "-q", "-m", "fix: two", "-m", "Co-authored-by: Cursor <cursoragent@cursor.com>"]);
  writeFileSync(join(dir, "f3"), "3");
  sh(["add", "-A"]);
  sh(["commit", "-q", "-m", "chore: untagged"]); // no trailer -> unknown
  return dir;
}

test("classifies commits by trailer email and preserves subjects with spaces", () => {
  const dir = repoWithCommits();
  try {
    const items = recentActivity(dir, { sinceDays: 3650 });
    const byHashTool = items.map(i => i.tool).sort();
    assert.deepEqual(byHashTool, ["claude", "cursor", "unknown"]);
    const one = items.find(i => i.subject === "feat: one with spaces");
    assert.ok(one, "subject with spaces must be preserved intact");
    assert.equal(one.tool, "claude");
    assert.match(one.ts, /^\d{4}-\d{2}-\d{2}T/); // ISO timestamp
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("returns [] in a directory with no git repo", () => {
  const dir = mkdtempSync(join(tmpdir(), "ccc-nogit-"));
  try {
    assert.deepEqual(recentActivity(dir, { sinceDays: 7 }), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
