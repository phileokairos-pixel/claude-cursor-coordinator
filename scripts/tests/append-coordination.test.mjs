import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("../append-coordination.mjs", import.meta.url));

function makeTestRepo() {
  const dir = mkdtempSync(join(tmpdir(), "append-test-"));

  execFileSync("git", ["init"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: dir });
  execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: dir });

  return dir;
}

test("appends entry with tool=cursor when commit has Cursor trailer", () => {
  const dir = makeTestRepo();

  try {
    writeFileSync(join(dir, "test.txt"), "hello");
    execFileSync("git", ["add", "test.txt"], { cwd: dir });
    execFileSync(
      "git",
      ["commit", "-m", "test commit\n\nCo-authored-by: Cursor <cursoragent@cursor.com>"],
      { cwd: dir }
    );
    execFileSync("node", [scriptPath], { cwd: dir });

    const file = join(dir, ".coordination/recent.jsonl");

    assert.ok(existsSync(file));

    const line = readFileSync(file, "utf8").trim();
    const entry = JSON.parse(line);

    assert.equal(entry.tool, "cursor");
    assert.equal(entry.subject, "test commit");
    assert.ok(entry.hash.length === 40);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("appends entry with tool=claude when commit has Claude trailer", () => {
  const dir = makeTestRepo();

  try {
    writeFileSync(join(dir, "test.txt"), "hello");
    execFileSync("git", ["add", "test.txt"], { cwd: dir });
    execFileSync(
      "git",
      ["commit", "-m", "feat: thing\n\nCo-authored-by: Claude <noreply@anthropic.com>"],
      { cwd: dir }
    );
    execFileSync("node", [scriptPath], { cwd: dir });

    const file = join(dir, ".coordination/recent.jsonl");
    const line = readFileSync(file, "utf8").trim();
    const entry = JSON.parse(line);

    assert.equal(entry.tool, "claude");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("appends entry with tool=cursor for Cursor Agent display name", () => {
  const dir = makeTestRepo();

  try {
    writeFileSync(join(dir, "test.txt"), "hello");
    execFileSync("git", ["add", "test.txt"], { cwd: dir });
    execFileSync(
      "git",
      ["commit", "-m", "feat: thing\n\nCo-authored-by: Cursor Agent <cursoragent@cursor.com>"],
      { cwd: dir }
    );
    execFileSync("node", [scriptPath], { cwd: dir });

    const file = join(dir, ".coordination/recent.jsonl");
    const line = readFileSync(file, "utf8").trim();
    const entry = JSON.parse(line);

    assert.equal(entry.tool, "cursor");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("appends entry with tool=unknown when no trailer", () => {
  const dir = makeTestRepo();

  try {
    writeFileSync(join(dir, "test.txt"), "hello");
    execFileSync("git", ["add", "test.txt"], { cwd: dir });
    execFileSync("git", ["commit", "-m", "no trailer"], { cwd: dir });
    execFileSync("node", [scriptPath], { cwd: dir });

    const file = join(dir, ".coordination/recent.jsonl");
    const line = readFileSync(file, "utf8").trim();
    const entry = JSON.parse(line);

    assert.equal(entry.tool, "unknown");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
