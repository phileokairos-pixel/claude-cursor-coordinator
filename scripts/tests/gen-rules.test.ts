import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("../gen-rules.ts", import.meta.url));
const fixturePath = fileURLToPath(new URL("./fixtures/agents-fixture.md", import.meta.url));

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "gen-rules-test-"));

  copyFileSync(fixturePath, join(dir, "AGENTS.md"));

  return dir;
}

function runGen(dir: string) {
  execFileSync("bun", [scriptPath], { cwd: dir, encoding: "utf8" });
}

test("generates CLAUDE.md identical to AGENTS.md", () => {
  const dir = setup();

  try {
    runGen(dir);
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    const claude = readFileSync(join(dir, "CLAUDE.md"), "utf8");

    assert.equal(claude, agents);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("generates .cursorrules with full content", () => {
  const dir = setup();

  try {
    runGen(dir);
    const cursorrules = readFileSync(join(dir, ".cursorrules"), "utf8");

    assert.match(cursorrules, /Always-on canonical content/);
    assert.match(cursorrules, /PHP conventions/);
    assert.match(cursorrules, /React conventions/);
    assert.match(cursorrules, /Coordination protocol/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("generates 000-canonical.mdc with always-on frontmatter and canonical content only", () => {
  const dir = setup();

  try {
    runGen(dir);
    const mdc = readFileSync(join(dir, ".cursor/rules/000-canonical.mdc"), "utf8");

    assert.match(mdc, /alwaysApply: true/);
    assert.match(mdc, /Always-on canonical content/);
    assert.match(mdc, /More canonical content/);
    assert.doesNotMatch(mdc, /PHP-only rules/);
    assert.doesNotMatch(mdc, /React-only rules/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("generates 100-php.mdc with PHP glob and PHP-scoped content", () => {
  const dir = setup();

  try {
    runGen(dir);
    const mdc = readFileSync(join(dir, ".cursor/rules/100-php.mdc"), "utf8");

    assert.match(mdc, /globs:/);
    assert.match(mdc, /\*\*\/\*\.php/);
    assert.match(mdc, /PHP conventions/);
    assert.doesNotMatch(mdc, /React conventions/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("generates 200-react.mdc with React content", () => {
  const dir = setup();

  try {
    runGen(dir);
    const mdc = readFileSync(join(dir, ".cursor/rules/200-react.mdc"), "utf8");

    assert.match(mdc, /React conventions/);
    assert.doesNotMatch(mdc, /PHP conventions/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("generates 300-coordination.mdc with alwaysApply and coordination content", () => {
  const dir = setup();

  try {
    runGen(dir);
    const mdc = readFileSync(join(dir, ".cursor/rules/300-coordination.mdc"), "utf8");

    assert.match(mdc, /alwaysApply: true/);
    assert.match(mdc, /Coordination protocol/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
