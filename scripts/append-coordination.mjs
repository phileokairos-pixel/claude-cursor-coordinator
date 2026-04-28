import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import process from "node:process";

mkdirSync(".coordination", { recursive: true });

function git(...args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const hash = git("rev-parse", "HEAD");

if (!hash) {
  process.exit(0);
}

const subject = git("log", "-1", "--pretty=%s");
const author = git("log", "-1", "--pretty=%an");
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
const body = git("log", "-1", "--pretty=%B");

// Parse tool by EMAIL (load-bearing identity), allow any display name
let tool = "unknown";

if (/Co-authored-by:\s*[^<]*<cursoragent@cursor\.com>/m.test(body)) {
  tool = "cursor";
} else if (/Co-authored-by:\s*[^<]*<noreply@anthropic\.com>/m.test(body)) {
  tool = "claude";
}

const line = JSON.stringify({
  ts: new Date().toISOString(),
  hash,
  tool,
  branch,
  subject,
  author,
}) + "\n";

appendFileSync(".coordination/recent.jsonl", line);
