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
  return agents && typeof agents === "object" && !Array.isArray(agents) && Object.keys(agents).length > 0
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
