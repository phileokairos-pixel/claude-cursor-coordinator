import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("init copies config + scripts and is idempotent", () => {
  const dest = mkdtempSync(join(tmpdir(), "ccc-init-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: dest });
    const cli = join(process.cwd(), "scripts/cli/init.mjs");
    execFileSync("node", [cli], { cwd: dest, stdio: "pipe" });
    assert.ok(existsSync(join(dest, "coordinator.config.json")), "config copied");
    assert.ok(existsSync(join(dest, "scripts/lib/config.mjs")), "lib copied");
    assert.ok(existsSync(join(dest, ".husky/commit-msg")), "husky hook copied");
    // second run must not throw (idempotent, no clobber without --force)
    execFileSync("node", [cli], { cwd: dest, stdio: "pipe" });
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
});
