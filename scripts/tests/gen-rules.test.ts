import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, copyFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("../gen-rules.ts", import.meta.url));
const fixturePath = fileURLToPath(new URL("./fixtures/agents-fixture.md", import.meta.url));

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "gen-rules-test-"));

  copyFileSync(fixturePath, join(dir, "AGENTS.md"));

  writeFileSync(join(dir, "coordinator.config.json"), JSON.stringify({
    agents: { claude: { email: "noreply@anthropic.com", label: "Claude" }, cursor: { email: "cursoragent@cursor.com", label: "Cursor" } },
    scopes: {
      php:          { globs: ["**/*.php"],            priority: 100, description: "PHP / Laravel conventions" },
      react:        { globs: ["**/*.tsx", "**/*.ts"], priority: 200, description: "React / TypeScript / TSX conventions" },
      coordination: { alwaysApply: true,              priority: 300, description: "Coordination protocol for Claude+Cursor" },
    },
  }));

  return dir;
}

function setupCustom(config: object, agentsMd: string) {
  const dir = mkdtempSync(join(tmpdir(), "gen-rules-cust-"));
  writeFileSync(join(dir, "AGENTS.md"), agentsMd);
  writeFileSync(join(dir, "coordinator.config.json"), JSON.stringify(config));
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

test("generates .gitmessage from config agents", () => {
  const dir = setup();
  try {
    runGen(dir);
    const gitmessage = readFileSync(join(dir, ".gitmessage"), "utf8");
    assert.match(gitmessage, /Co-authored-by: Claude <noreply@anthropic\.com>/);
    assert.match(gitmessage, /Co-authored-by: Cursor <cursoragent@cursor\.com>/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scope config without description falls back to '<scope> scope'", () => {
  const config = {
    agents: { claude: { email: "noreply@anthropic.com", label: "Claude" } },
    scopes: { go: { globs: ["**/*.go"], priority: 150 } }, // no description
  };
  const agentsMd = "# AGENTS\n\nCanonical.\n\n<!-- @scope: go -->\nUse gofmt.\n<!-- @endscope -->\n";
  const dir = setupCustom(config, agentsMd);
  try {
    runGen(dir);
    const mdc = readFileSync(join(dir, ".cursor/rules/150-go.mdc"), "utf8");
    assert.match(mdc, /description: go scope/);
    assert.doesNotMatch(mdc, /description: undefined/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scope mdc globs come from config, not a hardcoded map", () => {
  const config = {
    agents: { claude: { email: "noreply@anthropic.com", label: "Claude" } },
    scopes: { go: { globs: ["**/*.go"], priority: 150, description: "Go conventions" } },
  };
  const agentsMd = "# AGENTS\n\nCanonical.\n\n<!-- @scope: go -->\nUse gofmt.\n<!-- @endscope -->\n";
  const dir = setupCustom(config, agentsMd);
  try {
    runGen(dir);
    const mdc = readFileSync(join(dir, ".cursor/rules/150-go.mdc"), "utf8");
    assert.match(mdc, /\*\*\/\*\.go/);
    assert.match(mdc, /Go conventions/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
