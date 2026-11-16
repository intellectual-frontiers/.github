#Requires -Version 5.1
# agora-install.ps1: the one command that installs agora on Windows 11. You install Git and GitHub CLI; this does everything else: it signs GitHub
# in where erga cannot be read yet (GitHub CLI, a code and a browser), turns on long paths (Windows', once, with a prompt, and Git's), copies the `.github` and `erga`
# repositories to ~\workspaces\github.com\intellectual-frontiers\<repo> (or says they are there and brings them up to date) and runs the installer in erga, which gets
# Bun at its pin, installs agora's packages and runs the doctor. Safe to run again. In PowerShell:
#
#   irm https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/agora-install.ps1 | iex
#
# `iex` runs this text inside your own session, so it never ends that session or changes it: no `exit` (which would close the window), everything in one function with its own
# settings, the variables it sets for Git put back, and the result left in $LASTEXITCODE. A window that was opened only to run this command (a shortcut, Win+R, "Run with
# PowerShell") waits for Enter before it closes, so that what it said can be read.
# $env:ERGA_DESTROY_EXISTING = '1' (set before the command, and removed after) removes the copies that are there, with anything not committed in them, and copies both again.
# $env:ERGA_WORKSPACES is the folder the two repositories go in, instead of the one above.
# Spec: erga 274-agora FR-096, FR-122

# Stop-Install says what stopped the install and throws an OperationCanceledException, which Install-Agora's caller catches: the install stops, and the session goes on.
function Stop-Install([string] $What, [string] $Next) {
    [Console]::Error.WriteLine("❌ $What")
    if ($Next) { [Console]::Error.WriteLine("   $Next") }
    throw [System.OperationCanceledException]::new($What)
}

function Install-Agora {
    $ErrorActionPreference = 'Stop'
    $how = 'winget install --id Git.Git -e; winget install --id GitHub.cli -e (then open a new terminal)'
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Stop-Install 'Git is not installed' "install Git and GitHub CLI, then run this again: $how" }

    # Long paths. Windows refuses a path of more than 260 characters unless "Enable Win32 long paths" is on, and the clone and the packages have such paths. The setting
    # is one registry value that only an administrator can write, so where it is off this asks Windows, once, to run that one command elevated (a prompt you allow). Git has a
    # setting of its own, which needs no rights and is set whatever Windows says.
    $fileSystem = 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem'
    function Test-LongPaths {
        try { return ((Get-ItemProperty -Path $fileSystem -Name LongPathsEnabled -ErrorAction Stop).LongPathsEnabled -eq 1) } catch { return $false }
    }
    if (Test-LongPaths) {
        Write-Host '✅ Windows long paths are enabled'
    } else {
        Write-Host '⏳ enabling Windows long paths (Windows asks you to allow it once)'
        $enable = "Set-ItemProperty -Path '$fileSystem' -Name LongPathsEnabled -Type DWord -Value 1"
        $admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        try {
            if ($admin) { Set-ItemProperty -Path $fileSystem -Name LongPathsEnabled -Type DWord -Value 1 }
            else { Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile', '-Command', $enable }
        } catch {
            # Declined, or refused: said below, and the install goes on, because Git's own setting below is enough for the clone.
        }
        if (Test-LongPaths) { Write-Host '✅ Windows long paths are enabled' }
        else { Write-Host "⚠️ Windows long paths are still off, so a long path can break a package install. In PowerShell as administrator, run: $enable" }
    }
    & git config --global core.longpaths true | Out-Host

    # The repositories are read through Git alone. GitHub CLI is needed only to sign in, and only where erga cannot be read yet.
    $url = 'https://github.com/intellectual-frontiers'
    function Test-Readable {
        $before = $env:GIT_TERMINAL_PROMPT
        $env:GIT_TERMINAL_PROMPT = '0'
        try {
            & git ls-remote --exit-code "$url/erga.git" HEAD 2>$null | Out-Null
            return ($LASTEXITCODE -eq 0)
        } finally {
            if ($null -eq $before) { Remove-Item Env:GIT_TERMINAL_PROMPT -ErrorAction SilentlyContinue } else { $env:GIT_TERMINAL_PROMPT = $before }
        }
    }
    if (-not (Test-Readable)) {
        if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Stop-Install 'GitHub CLI is not installed, and erga cannot be read without signing in' "install Git and GitHub CLI, then run this again: $how" }
        & gh auth status 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host '⏳ signing in to GitHub (a code and a browser)'
            & gh auth login --hostname github.com --git-protocol https --web | Out-Host
            if ($LASTEXITCODE -ne 0) { Stop-Install 'GitHub sign-in did not finish' 'run this again' }
        }
        & gh auth setup-git | Out-Host
        if (-not (Test-Readable)) { Stop-Install 'your GitHub account cannot read intellectual-frontiers/erga' 'ask for read access to the intellectual-frontiers organization, then run this again' }
    }

    # Both repositories live side by side in the workspace: ~\workspaces\github.com\intellectual-frontiers\<repo>. One that is there is said so and brought
    # up to date by a fast-forward (a copy that cannot be is left as it is, and said); one that is not is copied.
    $base = if ($env:ERGA_WORKSPACES) { $env:ERGA_WORKSPACES } else { Join-Path $HOME 'workspaces\github.com\intellectual-frontiers' }
    function Sync-Repo([string] $Repo) {
        $dest = Join-Path $base $Repo
        if ($env:ERGA_DESTROY_EXISTING -and (Test-Path $dest)) {
            Write-Host "🗑️ removing $dest (ERGA_DESTROY_EXISTING), to copy $Repo again"
            Remove-Item -LiteralPath $dest -Recurse -Force
        }
        if (Test-Path (Join-Path $dest '.git')) {
            Write-Host "✅ $Repo is already in $dest; bringing it up to date"
            # A copy that stopped part way (a path too long for Windows, a full disk) leaves Git seeing changes that stop a pull. Three repairs, none touching content: an index that was
            # never written (every file staged as deleted) is rebuilt from the commit; files that are missing are restored; files that differ only in line endings or mode are set back.
            $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
            $tracked = @(& git -C $dest ls-tree -r --name-only HEAD).Count
            $staged = @(& git -C $dest diff --cached --name-only --diff-filter=D).Count
            if ($staged -ge 20 -and ($staged * 2) -ge $tracked) {
                Write-Host "⏳ rebuilding $Repo's index from its commit: an earlier copy stopped before it was written, so Git saw every file as deleted"
                & git -C $dest reset --quiet
            }
            $missing = @(& git -C $dest ls-files --deleted)
            if ($missing.Count -gt 0) {
                Write-Host "⏳ restoring the $($missing.Count) files an earlier copy of $Repo did not finish"
                $missing | & git -C $dest restore --pathspec-from-file=- | Out-Host
                if ($LASTEXITCODE -ne 0) { Write-Host "⚠️ $Repo's missing files could not be restored" }
            }
            $real = @(& git -C $dest -c core.fileMode=false diff --ignore-cr-at-eol --numstat | ForEach-Object { ($_ -split "`t", 3)[2] })
            $same = @(& git -C $dest diff --name-only | Where-Object { $real -notcontains $_ })
            if ($same.Count -gt 0) { $same | & git -C $dest restore --pathspec-from-file=- 2>$null | Out-Null }
            & git -C $dest pull --ff-only | Out-Host
            if ($LASTEXITCODE -ne 0) {
                Write-Host "⚠️ $Repo could not be fast-forwarded, so it is left as it is. What Git sees there:"
                & git -C $dest status --short | Select-Object -First 8 | Out-Host
                Write-Host "   To put your changes aside and update: git -C `"$dest`" stash push --include-untracked, then run this again"
            }
        } else {
            Write-Host "⏳ copying $Repo to $dest"
            New-Item -ItemType Directory -Path $base -Force | Out-Null
            & git clone "$url/$Repo.git" $dest | Out-Host
            if ($LASTEXITCODE -ne 0) { Stop-Install "$Repo could not be copied" 'your GitHub account needs read access to the intellectual-frontiers organization' }
        }
    }
    Sync-Repo '.github'
    Sync-Repo 'erga'
    # erga's installer is a script run with `&`: its own `exit` ends it alone.
    & (Join-Path $base 'erga\bin\install.ps1') | Out-Host
    return $LASTEXITCODE
}

# A window opened only to run this command closes when it ends, with what it said: it waits for Enter first. A session you opened yourself (the usual way) does not.
function Wait-BeforeClose {
    $words = [Environment]::GetCommandLineArgs()
    $oneShot = [bool]($words | Where-Object { $_ -match '^-(c|command|f|file|ec|encodedcommand)$' }) -and -not [bool]($words | Where-Object { $_ -match '^-noexit$' })
    if ($oneShot -and [Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
        Write-Host ''
        Read-Host 'Press Enter to close this window' | Out-Null
    }
}

$agoraInstallCode = 0
try {
    $agoraInstallCode = [int](Install-Agora | Select-Object -Last 1)
} catch [System.OperationCanceledException] {
    $agoraInstallCode = 3
} catch {
    [Console]::Error.WriteLine("❌ $($_.Exception.Message)")
    $agoraInstallCode = 1
}
$global:LASTEXITCODE = $agoraInstallCode
Wait-BeforeClose
