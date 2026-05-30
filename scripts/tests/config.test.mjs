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
  try {
    const cfg = loadConfig(dir);
    assert.deepEqual(cfg.agents, DEFAULT_AGENTS);
    assert.ok(agentEmails(cfg).includes("noreply@anthropic.com"));
    assert.ok(agentEmails(cfg).length >= 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("malformed JSON falls back to defaults and never throws", () => {
  const dir = tmp("{ not json ");
  try {
    const cfg = loadConfig(dir);
    assert.ok(agentEmails(cfg).length >= 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("config with empty agents object falls back (never fail-open)", () => {
  const dir = tmp(JSON.stringify({ agents: {} }));
  try {
    const cfg = loadConfig(dir);
    assert.ok(agentEmails(cfg).length >= 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("valid config is read and supports a third agent", () => {
  const dir = tmp(JSON.stringify({
    agents: {
      claude: { email: "noreply@anthropic.com", label: "Claude" },
      cursor: { email: "cursoragent@cursor.com", label: "Cursor" },
      codex:  { email: "codex@openai.com", label: "Codex" },
    },
  }));
  try {
    const cfg = loadConfig(dir);
    assert.equal(toolForEmail(cfg, "codex@openai.com"), "codex");
    assert.equal(toolForEmail(cfg, "unknown@x.com"), "unknown");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("array-shaped agents falls back to defaults (no numeric keys)", () => {
  const dir = tmp(JSON.stringify({ agents: [{ email: "x@y.com" }] }));
  try {
    const cfg = loadConfig(dir);
    assert.deepEqual(cfg.agents, DEFAULT_AGENTS);
    assert.equal(toolForEmail(cfg, "x@y.com"), "unknown");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("null agent entry falls back to defaults", () => {
  const dir = tmp(JSON.stringify({ agents: { claude: null } }));
  try {
    const cfg = loadConfig(dir);
    assert.deepEqual(cfg.agents, DEFAULT_AGENTS);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
