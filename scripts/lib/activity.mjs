import { execFileSync } from "node:child_process";
import { loadConfig, toolForEmail } from "./config.mjs";

const FIELD = "\x1f";   // unit separator between fields
const RECORD = "\x1e";  // record separator between commits

export function recentActivity(cwd = process.cwd(), { sinceDays = 7, max = 200 } = {}) {
  const config = loadConfig(cwd);
  let out = "";
  try {
    out = execFileSync(
      "git",
      ["log", `--since=${sinceDays} days ago`, `-n${max}`, `--pretty=format:%H${FIELD}%aI${FIELD}%s${FIELD}%b${RECORD}`],
      { cwd, encoding: "utf8" }
    );
  } catch {
    return [];
  }
  if (!out.trim()) return [];
  return out
    .split(RECORD)
    .map((rec) => rec.replace(/^\s+/, ""))
    .filter(Boolean)
    .map((rec) => {
      const [hash, iso, subject, body = ""] = rec.split(FIELD);
      const m = body.match(/Co-authored-by:\s*[^<]*<([^>]+)>/i);
      const tool = m ? toolForEmail(config, m[1]) : "unknown";
      return { hash, ts: iso, subject, tool };
    });
}
