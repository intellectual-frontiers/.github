# erga-windows.ps1: OPTIONAL. Prepares Windows 11 for erga: WSL 2 with Debian, a Linux user, and then the usual erga-bootstrap.sh inside it.
# Run it from Windows PowerShell (not as administrator; Windows asks if it needs that):
#   irm https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/erga-windows.ps1 | iex
# Spec: erga's 009-machine-bootstrap FR-093. The bootstrap works without this script, directly on Debian, Ubuntu, Arch and a Mac; this only saves the Windows steps.
#
# What it does, and nothing else:
#   1. installs WSL 2 and Debian if they are not there (wsl --install -d Debian --no-launch); if Windows must restart first, it says so: restart, then run this again,
#   2. makes your Linux user (the name you choose; you type its password once), gives it sudo, and makes it the default user of Debian,
#   3. installs curl and wget, which a new Debian lacks,
#   4. runs the bootstrap as that user. The bootstrap then asks for your password once and for the GitHub sign-in.
# It never deletes or resets a Debian that exists: it continues in it, or stops and says why. It changes nothing outside WSL.
# Options (set before running, e.g. $env:ERGA_WSL_DISTRO='Ubuntu'): ERGA_WSL_DISTRO (default Debian), ERGA_WSL_USER (default: asked), ERGA_BOOTSTRAP_URL.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Distro = if ($env:ERGA_WSL_DISTRO) { $env:ERGA_WSL_DISTRO } else { 'Debian' }
$Url = if ($env:ERGA_BOOTSTRAP_URL) { $env:ERGA_BOOTSTRAP_URL } else { 'https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/erga-bootstrap.sh' }

function Say($text) { Write-Host $text }
# throw, not exit: run with `irm | iex` an exit would close the person's window before they can read the message
function Stop-Here($text) { Write-Host "`n$text" -ForegroundColor Yellow; throw 'erga: stopped (see above)' }

# wsl.exe prints UTF-16; this reads its list of distributions as plain lines
function Get-Distros {
    $old = [Console]::OutputEncoding
    try { [Console]::OutputEncoding = [System.Text.Encoding]::Unicode; $names = & wsl.exe --list --quiet 2>$null }
    finally { [Console]::OutputEncoding = $old }
    if ($null -eq $names) { return @() }
    return @($names | ForEach-Object { ($_ -replace "`0", '').Trim() } | Where-Object { $_ })
}

# Inside Debian, as root or as the user: the command is passed to sh as one argument, so no quoting by PowerShell reaches the shell
function Invoke-Linux([string]$As, [string]$Command) {
    & wsl.exe -d $Distro -u $As -- sh -c $Command
    if ($LASTEXITCODE -ne 0) { Stop-Here "A step inside $Distro failed (exit $LASTEXITCODE): $Command" }
}

Say "Setting up Windows for erga: WSL 2 with $Distro, then erga's own setup inside it."

if ([Environment]::OSVersion.Platform -ne 'Win32NT') { Stop-Here 'This script is for Windows. On Linux or a Mac run erga-bootstrap.sh directly.' }
if ($null -eq (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    Stop-Here 'WSL is not part of this Windows. It needs Windows 11 (or Windows 10 version 2004 or later), fully updated. Run Windows Update and try again.'
}

# 1. WSL and the distribution
if ((Get-Distros) -notcontains $Distro) {
    Say "Installing WSL 2 and $Distro (a download of a few hundred megabytes)..."
    & wsl.exe --install -d $Distro --no-launch
    if ($LASTEXITCODE -ne 0) { Stop-Here "WSL could not be installed (exit $LASTEXITCODE). If Windows asked you to restart, restart and run this line again." }
    if ((Get-Distros) -notcontains $Distro) {
        Stop-Here "Windows has to restart to finish installing WSL. Restart it, then run the same line again: it continues from here."
    }
} else {
    Say "$Distro is already installed: continuing in it. Nothing in it is deleted."
}

# 2. the Linux user
$existing = (& wsl.exe -d $Distro -u root -- sh -c 'getent passwd 1000 | cut -d: -f1' 2>$null | Out-String).Trim()
if ($existing) {
    $User = $existing
    Say "Using the Linux user that is already there: $User."
} else {
    $User = $env:ERGA_WSL_USER
    while (-not $User -or $User -notmatch '^[a-z_][a-z0-9_-]{0,30}$') {
        $User = (Read-Host 'Choose a Linux username (lowercase letters, digits, - and _; it need not match your Windows name)').Trim()
    }
    Say "Making the Linux user $User. Type its password twice when asked; nothing shows while you type: that is normal."
    Invoke-Linux 'root' "apt-get update && apt-get install -y sudo && adduser --gecos '' $User && usermod -aG sudo $User"
}

# make it the user a new window opens as
Invoke-Linux 'root' "grep -qs '^default=$User' /etc/wsl.conf || printf '[user]\ndefault=$User\n' >> /etc/wsl.conf"
& wsl.exe --terminate $Distro | Out-Null

# 3. curl and wget, which a new Debian lacks
Invoke-Linux 'root' 'apt-get update && apt-get install -y curl wget'

# 4. erga's own bootstrap, as the user, in front of the person (it asks for the Linux password once, and for the GitHub sign-in)
Say "`nRunning erga's setup inside $Distro. It asks for your Linux password once and for a GitHub sign-in. The build of erga takes about 5 to 15 minutes, once."
& wsl.exe -d $Distro -u $User -- sh -c "cd && curl -fsSL '$Url' | sh"
$setup = $LASTEXITCODE
# Exit 1 is the setup's own word for "set up, and erga's checks found something to look at" (erga-setup.sh, 009-machine-bootstrap FR-055): the computer is ready, so it is a note, not a stop.
if ($setup -ne 0 -and $setup -ne 1) { Stop-Here "erga's setup stopped (exit $setup). Its last lines say why; run this line again to continue, it repeats nothing that is done." }

if ($setup -eq 1) {
    Say "`nDone, with notes: erga is installed, and its own checks found things to look at (listed above; ./erga doctor and ./erga check say what to do)."
} else {
    Say "`nDone."
}
Say "Open Debian from the Start menu or Windows Terminal (a new tab, Debian) to use erga."
