#Requires -Version 5.1
# agora-install.ps1: the one command that installs agora on Windows 11. You install Git and GitHub CLI; this does everything else: it signs GitHub CLI
# in if it is not (a code and a browser), copies the `.github` and `erga` repositories to ~\workspaces\github.com\intellectual-frontiers\<repo> (or says they are
# there and brings them up to date) and runs the installer in erga, which gets Bun at its pin, installs agora's packages and runs the doctor. Safe to run again. In PowerShell:
#
#   irm https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/agora-install.ps1 | iex
#
# $env:ERGA_WORKSPACES is the folder the two repositories go in, instead of the one above.
# Spec: erga 274-agora FR-096
$ErrorActionPreference = 'Stop'
function Stop-Install([string] $What, [string] $Next) {
    [Console]::Error.WriteLine("❌ $What")
    if ($Next) { [Console]::Error.WriteLine("   $Next") }
    exit 3
}
$how = 'winget install --id Git.Git -e; winget install --id GitHub.cli -e (then open a new terminal)'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Stop-Install 'Git is not installed' "install Git and GitHub CLI, then run this again: $how" }
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Stop-Install 'GitHub CLI is not installed' "install Git and GitHub CLI, then run this again: $how" }

& gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host '⏳ signing in to GitHub (a code and a browser)'
    & gh auth login --hostname github.com --git-protocol https --web
    if ($LASTEXITCODE -ne 0) { Stop-Install 'GitHub sign-in did not finish' 'run this again' }
}
& gh auth setup-git 2>$null | Out-Null

# Both repositories live side by side in the workspace: ~\workspaces\github.com\intellectual-frontiers\<repo>. One that is there is said so and brought
# up to date by a fast-forward (a copy that cannot be is left as it is, and said); one that is not is copied.
$base = if ($env:ERGA_WORKSPACES) { $env:ERGA_WORKSPACES } else { Join-Path $HOME 'workspaces\github.com\intellectual-frontiers' }
function Sync-Repo([string] $Repo) {
    $dest = Join-Path $base $Repo
    if (Test-Path (Join-Path $dest '.git')) {
        Write-Host "✅ $Repo is already in $dest; bringing it up to date"
        & git -C $dest pull --ff-only
        if ($LASTEXITCODE -ne 0) { Write-Host "⚠️ $Repo could not be fast-forwarded, so it is left as it is (commit or set aside what you changed there)" }
    } else {
        Write-Host "⏳ copying $Repo to $dest"
        New-Item -ItemType Directory -Path $base -Force | Out-Null
        & gh repo clone "intellectual-frontiers/$Repo" $dest
        if ($LASTEXITCODE -ne 0) { Stop-Install "$Repo could not be copied" 'your GitHub account needs read access to the intellectual-frontiers organization' }
    }
}
Sync-Repo '.github'
Sync-Repo 'erga'
$dest = Join-Path $base 'erga'
& (Join-Path $dest 'bin\install.ps1')
exit $LASTEXITCODE
