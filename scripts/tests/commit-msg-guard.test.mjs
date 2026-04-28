import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const guardPath = fileURLToPath(new URL("../commit-msg-guard.mjs", import.meta.url));

function runGuard(message) {
  const dir = mkdtempSync(join(tmpdir(), "guard-test-"));
  const msgFile = join(dir, "COMMIT_EDITMSG");

  writeFileSync(msgFile, message);

  try {
    execFileSync("node", [guardPath, msgFile], { encoding: "utf8" });

    return { exitCode: 0 };
  } catch (err) {
    return { exitCode: err.status, stderr: err.stderr?.toString() };
  } finally {
    rmSync(dir, { recursive: true });
  }
}

test("accepts commit with Co-authored-by Cursor trailer", () => {
  const msg = "fix: catalog typo\n\nFixed a typo in the catalog page.\n\nCo-authored-by: Cursor <cursoragent@cursor.com>\n";
  const result = runGuard(msg);

  assert.equal(result.exitCode, 0);
});

test("accepts commit with Cursor Agent display name", () => {
  const msg = "fix: thing\n\nCo-authored-by: Cursor Agent <cursoragent@cursor.com>\n";
  const result = runGuard(msg);

  assert.equal(result.exitCode, 0);
});

test("accepts commit with Co-authored-by Claude trailer", () => {
  const msg = "feat: add wizard\n\nNew onboarding wizard.\n\nCo-authored-by: Claude <noreply@anthropic.com>\n";
  const result = runGuard(msg);

  assert.equal(result.exitCode, 0);
});

test("rejects commit without trailer", () => {
  const msg = "fix: typo\n";
  const result = runGuard(msg);

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /attribution trailer/);
});

test("rejects commit with right name but wrong Cursor email", () => {
  const msg = "fix: thing\n\nCo-authored-by: Cursor <attacker@evil.com>\n";
  const result = runGuard(msg);

  assert.equal(result.exitCode, 1);
});

test("rejects commit with wrong author", () => {
  const msg = "fix: typo\n\nCo-authored-by: Bob <bob@example.com>\n";
  const result = runGuard(msg);

  assert.equal(result.exitCode, 1);
});

test("skips merge commits", () => {
  const msg = "Merge branch 'feature/foo' into main\n";
  const result = runGuard(msg);

  assert.equal(result.exitCode, 0);
});

test("skips revert commits", () => {
  const msg = "Revert \"feat: bad change\"\n";
  const result = runGuard(msg);

  assert.equal(result.exitCode, 0);
});

test("does NOT skip a regular commit whose body contains 'Merge your changes'", () => {
  const msg = "fix: docs\n\nMerge your changes carefully before pushing.\n";
  const result = runGuard(msg);

  assert.equal(result.exitCode, 1);
});
