# Contributing

Thanks for thinking about contributing.

## Ground rules

This template is intentionally small. The goal is to stay easy to understand and easy to drop into any repo. PRs that add features should justify the cost in scope and complexity.

## Good PRs

- Bug fixes with a failing test that now passes
- Cross-platform fixes (Linux/macOS support that matches the existing Windows-aware code)
- Docs improvements (typos, broken links, clearer setup steps)
- New scope examples in `scripts/gen-rules.ts` (Python, Ruby, Go, etc.)

## PRs that need conversation first

- New scripts or hooks (open an issue first explaining the problem you hit)
- Changes to the trailer format or attribution scheme
- Anything that changes the file structure of `.coordination/`

## Required for any PR

Every commit on your PR must end with one of these trailers:

```
Co-authored-by: Cursor <cursoragent@cursor.com>
Co-authored-by: Claude <noreply@anthropic.com>
```

This template enforces its own rules on its own contributions. The CI will reject your PR if any commit is missing the trailer.

## Local development

```bash
git clone https://github.com/phileokairos-pixel/claude-cursor-coordinator.git
cd claude-cursor-coordinator
bun install
bun test
```

All four script test suites should pass before you push.

## Reporting bugs

Open an issue at https://github.com/phileokairos-pixel/claude-cursor-coordinator/issues with:
1. What you ran
2. What you expected to happen
3. What actually happened
4. Your OS + bun/node version + Cursor version

## Reporting security issues

See [SECURITY.md](SECURITY.md). Don't open public issues for security problems.
