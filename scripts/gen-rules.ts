import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { loadConfig } from "./lib/config.mjs";

interface Section {
  scope: string;
  content: string;
}

function parseScopedSections(source: string): { canonical: string; scoped: Section[] } {
  const scopeRegex = /<!-- @scope: (\w+) -->\n([\s\S]*?)\n<!-- @endscope -->/g;
  const scoped: Section[] = [];
  const canonical = source.replace(scopeRegex, (_match, scope, content) => {
    scoped.push({ scope, content: content.trim() });

    return ""; // Remove from canonical bucket
  });

  return { canonical: canonical.trim(), scoped };
}

function buildCanonical(canonical: string, scoped: Section[]): string {
  const allScoped = scoped.map(s => `## ${s.scope.toUpperCase()} scope\n\n${s.content}`).join("\n\n");

  return `${canonical}\n\n${allScoped}\n`;
}

function buildMdc(frontmatter: string, content: string): string {
  return `---\n${frontmatter}\n---\n\n${content}\n`;
}

function buildGitmessage(agents: Record<string, { email: string; label?: string }>): string {
  const lines = Object.values(agents).map(a => `# Co-authored-by: ${a.label ?? "Agent"} <${a.email}>`);
  return [
    "",
    "# <type>: <subject>   (feat|fix|docs|refactor|test|chore)",
    "#",
    "# Add ONE attribution trailer below (uncomment the one that applies):",
    ...lines,
    "",
  ].join("\n");
}

function main() {
  const config = loadConfig();
  const source = readFileSync("AGENTS.md", "utf8");
  const { canonical, scoped } = parseScopedSections(source);

  // CLAUDE.md = identical to AGENTS.md
  writeFileSync("CLAUDE.md", source);

  // .cursorrules = full content (legacy compat)
  writeFileSync(".cursorrules", buildCanonical(canonical, scoped));

  // .gitmessage = attribution trailers from config
  writeFileSync(".gitmessage", buildGitmessage(config.agents));

  // .cursor/rules/*.mdc files
  mkdirSync(".cursor/rules", { recursive: true });

  // 000-canonical.mdc
  writeFileSync(
    ".cursor/rules/000-canonical.mdc",
    buildMdc(
      `description: Canonical agent rules from AGENTS.md\nalwaysApply: true`,
      canonical
    )
  );

  // Generate one .mdc per scope — sourced from config, not a hardcoded map
  for (const section of scoped) {
    const scopeConfig = config.scopes[section.scope] ?? {
      description: `${section.scope} scope`,
      alwaysApply: false,
      priority: 999,
    };

    const priority = scopeConfig.priority ?? 999;
    const alwaysApply = scopeConfig.alwaysApply ?? false;
    const globs: string[] | undefined = scopeConfig.globs;

    const filename = `${String(priority).padStart(3, "0")}-${section.scope}.mdc`;
    const lines = [`description: ${scopeConfig.description ?? `${section.scope} scope`}`];

    if (globs) {
      lines.push("globs:");

      for (const g of globs) {
        lines.push(`  - "${g}"`);
      }
    }

    lines.push(`alwaysApply: ${alwaysApply}`);

    writeFileSync(`.cursor/rules/${filename}`, buildMdc(lines.join("\n"), section.content));
  }

  console.log(
    `Generated: CLAUDE.md, .cursorrules, .gitmessage, .cursor/rules/*.mdc from AGENTS.md` +
    ` (config: ${config._source})`
  );
}

main();
