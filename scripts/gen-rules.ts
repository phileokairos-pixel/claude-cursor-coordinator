import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

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

function main() {
  const source = readFileSync("AGENTS.md", "utf8");
  const { canonical, scoped } = parseScopedSections(source);

  // CLAUDE.md = identical to AGENTS.md
  writeFileSync("CLAUDE.md", source);

  // .cursorrules = full content (legacy compat)
  writeFileSync(".cursorrules", buildCanonical(canonical, scoped));

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

  // Generate one .mdc per scope (PHP, React, coordination, or anything else the user defines)
  // Customize globs per scope name in this map:
  const scopeGlobs: Record<string, { description: string; globs?: string[]; alwaysApply: boolean; priority: number }> = {
    php: { description: "PHP / Laravel conventions", globs: ["**/*.php"], alwaysApply: false, priority: 100 },
    react: { description: "React / TypeScript / TSX conventions", globs: ["**/*.tsx", "**/*.ts"], alwaysApply: false, priority: 200 },
    python: { description: "Python conventions", globs: ["**/*.py"], alwaysApply: false, priority: 100 },
    ruby: { description: "Ruby / Rails conventions", globs: ["**/*.rb"], alwaysApply: false, priority: 100 },
    coordination: { description: "Coordination protocol for Claude+Cursor", alwaysApply: true, priority: 300 },
  };

  for (const section of scoped) {
    const config = scopeGlobs[section.scope] ?? {
      description: `${section.scope} scope`,
      alwaysApply: false,
      priority: 999,
    };

    const filename = `${String(config.priority).padStart(3, "0")}-${section.scope}.mdc`;
    const lines = [`description: ${config.description}`];

    if (config.globs) {
      lines.push("globs:");

      for (const g of config.globs) {
        lines.push(`  - "${g}"`);
      }
    }

    lines.push(`alwaysApply: ${config.alwaysApply}`);

    writeFileSync(`.cursor/rules/${filename}`, buildMdc(lines.join("\n"), section.content));
  }

  console.log("Generated: CLAUDE.md, .cursorrules, .cursor/rules/*.mdc from AGENTS.md");
}

main();
