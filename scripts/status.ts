import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

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

if (existsSync(".coordination/recent.jsonl")) {
  const lines = readFileSync(".coordination/recent.jsonl", "utf8")
    .trim()
    .split("\n")
    .slice(-20)
    .map(l => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const cursorEntries = lines.filter(e => e.tool === "cursor").slice(-5);
  const claudeEntries = lines.filter(e => e.tool === "claude").slice(-5);

  console.log("Cursor:");
  cursorEntries.forEach(e => console.log(`  ${e.hash.slice(0, 7)} ${e.subject}`));
  console.log("Claude:");
  claudeEntries.forEach(e => console.log(`  ${e.hash.slice(0, 7)} ${e.subject}`));
}

console.log("\n--- open PRs ---");
const prs = gh("pr", "list", "--limit", "10");
console.log(prs || "(none or gh not authenticated)");
