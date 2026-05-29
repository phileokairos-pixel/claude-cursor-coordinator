import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import { loadConfig, agentEmails } from "./lib/config.mjs";

const msgPath = process.argv[2];
const body = readFileSync(msgPath, "utf8").trim();
const subject = body.split("\n", 1)[0];

if (/^(Merge |Revert )/.test(subject)) {
  process.exit(0);
}

let trailers;
try {
  trailers = execFileSync("git", ["interpret-trailers", "--parse"], { input: body, encoding: "utf8" });
} catch {
  trailers = "";
}

const config = loadConfig();
const emails = agentEmails(config);
// Key matched case-insensitively (git treats trailer keys case-insensitively); email matched exactly.
const ok = emails.some(email => {
  const re = new RegExp(`^Co-authored-by:\\s*[^<]*<${email.replace(/[.+]/g, "\\$&")}>\\s*$`, "im");
  return re.test(trailers);
});

if (!ok) {
  const lines = Object.values(config.agents).map(a => `  Co-authored-by: ${a.label ?? "Agent"} <${a.email}>`);
  console.error("");
  console.error("ERROR: Commit message must include an attribution trailer.");
  console.error("");
  console.error("Add a blank line and one of:");
  console.error(lines.join("\n"));
  console.error("");
  console.error("See .gitmessage or coordinator.config.json.");
  process.exit(1);
}
