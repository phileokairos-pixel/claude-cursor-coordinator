# Cursor user-level setup (one-time per machine)

This walks you through configuring Cursor's USER-level settings so this coordination system works correctly. Repo-level config is committed to git; user-level is per-machine.

## 1. Set Cursor default terminal to Git Bash (Windows)

- Cursor Settings → Terminal → Default Profile (Windows) → `Git Bash`
- Why: Husky hooks use POSIX sh syntax; Git Bash matches natively. PowerShell needs wrapper hell.

On macOS / Linux, use whatever shell you normally use.

## 2. Verify Cursor attribution is ON

- Cursor Settings → Agents → Attribution → ON
- Default since v2.4.21. Cursor auto-adds `Co-authored-by: Cursor <cursoragent@cursor.com>` to every commit.
- Trailer guard requires this. If you turn this off, your commits will be rejected.

## 3. Configure user-level MCP servers (optional)

If you want Cursor to have access to user-level MCP servers (memory, knowledge graph, etc.), edit `~/.cursor/mcp.json` (Windows: `C:\Users\<you>\.cursor\mcp.json`).

⚠️ **DO NOT commit this file. It contains personal API tokens.**

Example structure:

```json
{
  "mcpServers": {
    "your-server-name": {
      "command": "path/to/binary",
      "args": ["arg1", "arg2"]
    }
  }
}
```

Restart Cursor after editing.

## 4. Install bun (if not already)

Run:

**Windows:**
```
powershell -c "irm bun.sh/install.ps1 | iex"
```

**macOS / Linux:**
```
curl -fsSL https://bun.sh/install | bash
```

Verify: `bun --version` should print `1.x.x`.

## 5. Install gitleaks (recommended, optional)

For secret-leak protection:

**Windows:** `scoop install gitleaks`
**macOS:** `brew install gitleaks`
**Linux:** download from https://github.com/gitleaks/gitleaks/releases

The pre-commit hook will run gitleaks if installed; warns if not. Commits work either way.

## 6. Set git commit template (one-time)

```bash
git config commit.template .gitmessage
```

Now `git commit` (without `-m`) opens the template with both trailer options pre-filled.

## 7. Enable GitHub branch protection on `main` (repo admin only)

Required for the `trailer-guard` GitHub Action to actually block bad merges:

- GitHub repo settings → Branches → Add rule for `main`
- Check "Require status checks to pass before merging"
- Add `check-trailers` as required status check
- Save
