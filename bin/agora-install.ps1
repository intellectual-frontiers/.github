#Requires -Version 5.1
# agora-install.ps1: the one command that installs agora on Windows 11. You install Git and GitHub CLI; this does everything else: it signs GitHub CLI
# in if it is not (a code and a browser), copies the `erga` repository to ~\workspaces\github.com\intellectual-frontiers\erga (or brings that copy up
# to date) and runs the installer in it, which gets Bun at its pin, installs agora's packages and runs the doctor. Safe to run again. In PowerShell:
#
#   irm https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/agora-install.ps1 | iex
#
# $env:ERGA_DIR is where the copy of erga goes, instead of the folder above.
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

$dest = if ($env:ERGA_DIR) { $env:ERGA_DIR } else { Join-Path $HOME 'workspaces\github.com\intellectual-frontiers\erga' }
if (Test-Path (Join-Path $dest '.git')) {
    Write-Host "⏳ bringing $dest up to date"
    & git -C $dest pull --ff-only
    if ($LASTEXITCODE -ne 0) { Stop-Install "$dest could not be brought up to date" 'commit or set aside what you changed there, then run this again' }
} else {
    Write-Host "⏳ copying erga to $dest"
    New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
    & gh repo clone intellectual-frontiers/erga $dest
    if ($LASTEXITCODE -ne 0) { Stop-Install 'erga could not be copied' 'your GitHub account needs read access to the intellectual-frontiers organization' }
}
& (Join-Path $dest 'bin\install.ps1')
exit $LASTEXITCODE
