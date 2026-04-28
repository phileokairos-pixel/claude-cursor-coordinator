import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";

const msgPath = process.argv[2];
const body = readFileSync(msgPath, "utf8").trim();

// Carve out merge and revert commits (their default messages have no trailers)
const subject = body.split("\n", 1)[0];

if (/^(Merge |Revert )/.test(subject)) {
  process.exit(0);
}

// Use git's native trailer parser (more robust than regex against folded trailers)
let trailers;

try {
  trailers = execFileSync(
    "git",
    ["interpret-trailers", "--parse"],
    { input: body, encoding: "utf8" }
  );
} catch {
  trailers = "";
}

// Trust email as identity, allow any display name
const hasCursor = /^Co-authored-by:\s*[^<]*<cursoragent@cursor\.com>\s*$/m.test(trailers);
const hasClaude = /^Co-authored-by:\s*[^<]*<noreply@anthropic\.com>\s*$/m.test(trailers);

if (!hasCursor && !hasClaude) {
  console.error("");
  console.error("ERROR: Commit message must include attribution trailer.");
  console.error("");
  console.error("Add a blank line and one of:");
  console.error("  Co-authored-by: Cursor <cursoragent@cursor.com>");
  console.error("  Co-authored-by: Claude <noreply@anthropic.com>");
  console.error("");
  console.error("Cursor adds its trailer automatically (Settings > Agents > Attribution).");
  console.error("Claude Code adds its trailer via .claude/settings.json.");
  console.error("Manual commits: see .gitmessage template.");
  process.exit(1);
}
