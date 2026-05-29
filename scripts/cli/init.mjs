#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

const force = process.argv.includes("--force");
const here = dirname(fileURLToPath(import.meta.url));
const templateRoot = join(here, "..", "..");   // package root (scripts/cli -> root)
const dest = process.cwd();

const COPY = [
  "scripts", ".husky", ".cursor", ".claude", ".github",
  "AGENTS.md", ".gitattributes", ".gitmessage",
  "docs/CANONICAL_EXAMPLES.md", "docs/CURSOR_USER_SETUP.md",
];

function copy(rel) {
  const from = join(templateRoot, rel);
  const to = join(dest, rel);
  if (!existsSync(from)) { console.log(`skip (not in template): ${rel}`); return; }
  if (existsSync(to) && !force) { console.log(`skip (exists): ${rel}`); return; }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`copied: ${rel}`);
}

if (dest === templateRoot) {
  console.log("Refusing to init into the template's own directory.");
  process.exit(0);
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
  execFileSync("bun", ["scripts/gen-rules.ts"], { cwd: dest, stdio: "inherit", shell: true });
} catch {
  console.log("Note: rule generation skipped. Run `bun scripts/gen-rules.ts` (install Bun if needed).");
}

console.log("\n✓ Coordinator installed. Commit with a Co-authored-by trailer; see .gitmessage.");
