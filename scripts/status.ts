import { execFileSync } from "node:child_process";
import { recentActivity } from "./lib/activity.mjs";

function git(...args: string[]): string {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function gh(...args: string[]): string {
  try {
    return execFileSync("gh", args, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
const status = git("status", "-sb");
const uncommitted = git("diff", "--stat");

console.log(`\n=== STATUS for branch: ${branch} ===\n`);
console.log(status);

if (uncommitted) {
  console.log("\n--- uncommitted changes ---");
  console.log(uncommitted);
}

console.log("\n--- recent activity (per tool) ---");
const items = recentActivity(process.cwd(), { sinceDays: 14 });
for (const tool of [...new Set(items.map((i) => i.tool))]) {
  console.log(`${tool}:`);
  items.filter((i) => i.tool === tool).slice(0, 5).forEach((e) => console.log(`  ${e.hash.slice(0, 7)} ${e.subject}`));
}

console.log("\n--- open PRs ---");
const prs = gh("pr", "list", "--limit", "10");
console.log(prs || "(none or gh not authenticated)");
