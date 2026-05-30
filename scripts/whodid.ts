import process from "node:process";
import { recentActivity } from "./lib/activity.mjs";

const toolFilter = process.argv.slice(2).find((a) => a.startsWith("--tool="))?.split("=")[1];
let items = recentActivity(process.cwd(), { sinceDays: 7 });
if (toolFilter) items = items.filter((i) => i.tool === toolFilter);

const counts: Record<string, number> = {};
for (const e of items) counts[e.tool] = (counts[e.tool] || 0) + 1;

console.log(`\n=== whodid (last 7 days${toolFilter ? `, tool=${toolFilter}` : ""}) ===\n`);
console.log(`Total commits: ${items.length}`);
console.log("Per tool:");
for (const [tool, count] of Object.entries(counts)) console.log(`  ${tool}: ${count}`);
console.log("\nRecent commits:");
for (const e of items.slice(0, 20)) console.log(`  ${e.ts.slice(0, 16)} [${e.tool}] ${e.hash.slice(0, 7)} ${e.subject}`);
