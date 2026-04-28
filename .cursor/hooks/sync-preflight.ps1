# Cursor sessionStart hook — runs `bun sync` for preflight visibility
# PowerShell wrapper required due to Cursor Windows hook launcher behavior
# (Cursor's hook launcher invokes via PowerShell on Windows; .sh scripts silently fail)

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot\..\..

if (Get-Command bun -ErrorAction SilentlyContinue) {
    bun run sync
} else {
    Write-Warning "bun not on PATH; skipping preflight sync. Install bun and reload Cursor."
}

exit 0
