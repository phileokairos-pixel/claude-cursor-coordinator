import { readFileSync, existsSync } from "node:fs";
import process from "node:process";

const args = process.argv.slice(2);
const toolFilter = args.find(a => a.startsWith("--tool="))?.split("=")[1];

if (!existsSync(".coordination/recent.jsonl")) {
  console.log("No .coordination/recent.jsonl yet. Make some commits first.");
  process.exit(0);
}

const lines = readFileSync(".coordination/recent.jsonl", "utf8")
  .trim()
  .split("\n")
  .map(l => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  })
  .filter(Boolean);

const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
let recent = lines.filter(e => e.ts >= cutoff);

if (toolFilter) {
  recent = recent.filter(e => e.tool === toolFilter);
}

const counts: Record<string, number> = {};

for (const entry of recent) {
  counts[entry.tool] = (counts[entry.tool] || 0) + 1;
}

console.log(`\n=== whodid (last 7 days${toolFilter ? `, tool=${toolFilter}` : ""}) ===\n`);
console.log(`Total commits: ${recent.length}`);
console.log(`Per tool:`);

for (const [tool, count] of Object.entries(counts)) {
  console.log(`  ${tool}: ${count}`);
}

console.log(`\nRecent commits:`);

for (const entry of recent.slice(-20)) {
  console.log(`  ${entry.ts.slice(0, 16)} [${entry.tool}] ${entry.hash.slice(0, 7)} ${entry.subject}`);
}
