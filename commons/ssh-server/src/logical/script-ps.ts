// Spec: 0004-scripts FR-002, FR-003, FR-004, FR-007, FR-008
/**
 * The renderer of the bootstrap script for PowerShell 7 (`#Requires -Version 7.0`, strict mode, errors stop). The same flow as the script for sh: it says what it will do, reads a fixed list of facts (CIM, the OpenSSH host keys, Get-NetAdapter,
 * winget), sends them with `ssh -p PORT s-enroll@HOST report SESSION`, waits for a person to approve, asks for consent before it installs, and runs only the typed steps of the plan, an argument vector at a time, after verifying every SHA-256.
 * Not yet run on Windows: see 0004-scripts, UNVERIFIED.
 *
 * @module
 */
import type { Pin } from "./pins.ts";
import { offered } from "./pins.ts";
import type { Endpoint, ScriptSession } from "./script-sh.ts";
import { LETTERS } from "@intellectual-frontiers/ssh-server/governance";
import { COMMIT_TAG, SAS_TAG } from "./pairing.ts";
import { DEFAULT_SCRIPT_OPTIONS } from "./script-sh.ts";
import type { ScriptOptions } from "./script-sh.ts";
import { quoted, script } from "./script-text.ts";

/** Render the bootstrap script for PowerShell 7. */
export function renderBootstrapPs(session: ScriptSession, pins: readonly Pin[], endpoint: Endpoint, options: ScriptOptions): string {
  const brand = options.brand;
  const P = brand.envPrefix;
  const pairing = options.pairing ?? DEFAULT_SCRIPT_OPTIONS.pairing;
  const [hkAlgo = "", hkB64 = ""] = (options.hostKey ?? "").split(" ");
  const offer = offered(pins, "windows").map((p) => `'${p}'`).join(", ") || "'nothing is offered for this system'";
  return script`#Requires -Version 7.0
# ${brand.name} enrollment bootstrap, for PowerShell 7 on Windows. Read it before you run it: ssh -p ${String(endpoint.port)} s-enroll@${endpoint.host} bootstrap-ps > enroll.ps1
# It reports facts about this machine, waits for a person to approve, asks you before it installs anything, and runs only the typed steps of the plan.
# It holds no secret. It never evaluates what the server sends: it reads fields of a small alphabet and runs argument vectors without a shell.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$nl = [string][char]10
$tab = [string][char]9

$Session = ${quoted(session.id)}
$EnrollHost = if ($env:${P}_HOST) { $env:${P}_HOST } else { ${quoted(endpoint.host)} }
$Port = if ($env:${P}_PORT) { $env:${P}_PORT } else { ${quoted(String(endpoint.port))} }
$WaitMax = if ($env:${P}_WAIT_MAX) { [int]$env:${P}_WAIT_MAX } else { 1800 }
$Poll = if ($env:${P}_POLL) { [int]$env:${P}_POLL } else { 10 }
$Offered = @(${offer})
$HostKeyAlgo = ${quoted(hkAlgo)}
$HostKeyBlob = ${quoted(hkB64)}
$PairKind = ${quoted(pairing.kind)}
$PairLen = ${quoted(String(pairing.length))}
$Alphabet = ${quoted(LETTERS)}
$CommitTag = ${quoted(COMMIT_TAG)}
$SasTag = ${quoted(SAS_TAG)}
$Dir = if ($env:${P}_DIR) { $env:${P}_DIR } else { Join-Path $env:ProgramData ${quoted(brand.stateDir.windows)} }

if (-not $IsWindows) { throw 'This script is for Windows: on Linux or macOS run the script for sh (bootstrap).' }

function Say {
    param([string]$Text)
    Write-Information -MessageData $Text -InformationAction Continue
}

function Invoke-Door {
    param([string[]]$Words, [string]$Text = '')
    $extra = if ($env:${P}_SSH_OPTS) { @($env:${P}_SSH_OPTS -split ' ') } else { @() }
    $output = $Text | & ssh -p $Port -i $script:KeyPath -o IdentitiesOnly=yes -o PubkeyAuthentication=yes -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no -o ConnectTimeout=15 -o "UserKnownHostsFile=$($script:KnownHosts)" -o "StrictHostKeyChecking=$($script:Strict)" -o HashKnownHosts=no @extra "s-enroll@$EnrollHost" @Words
    if ($LASTEXITCODE -ne 0) { throw "the server refused: ssh ended with $LASTEXITCODE" }
    return @($output)
}

function Get-Sha256Text {
    param([string]$Text)
    $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
    return ([BitConverter]::ToString([Security.Cryptography.SHA256]::HashData($bytes))).Replace('-', '').ToLowerInvariant()
}

function Get-Code {
    param([string]$HashHex)
    $n = [Convert]::ToInt64($HashHex.Substring(0, 8), 16)
    if ($PairKind -eq 'digits') { return ($n % [int64][Math]::Pow(10, [int]$PairLen)).ToString().PadLeft([int]$PairLen, '0') }
    $out = ''
    for ($i = 0; $i -lt [int]$PairLen; $i++) { $out += $Alphabet[[int]($n % $Alphabet.Length)]; $n = [int64][Math]::Floor($n / $Alphabet.Length) }
    return $out
}

function Test-Safe {
    param([string]$Value)
    if ($Value -notmatch '^[A-Za-z0-9._:/@=+,% -]+$') { throw 'a field of the plan is outside the safe alphabet' }
}

function Get-Fact {
    $os = Get-CimInstance Win32_OperatingSystem
    $cs = Get-CimInstance Win32_ComputerSystem
    $bios = Get-CimInstance Win32_BIOS
    $machineId = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Cryptography').MachineGuid
    $arch = switch ($env:PROCESSOR_ARCHITECTURE) { 'AMD64' { 'x86_64' } 'ARM64' { 'aarch64' } default { [string]$env:PROCESSOR_ARCHITECTURE } }
    $disks = @(Get-CimInstance Win32_DiskDrive | ForEach-Object { @{ name = [string]$_.DeviceID; sizeBytes = [int64]$_.Size } })
    $nics = @(Get-NetAdapter -Physical | ForEach-Object {
        $index = $_.ifIndex
        @{
            name = [string]$_.Name
            mac = ([string]$_.MacAddress).Replace('-', ':').ToLowerInvariant()
            addresses = @(Get-NetIPAddress -InterfaceIndex $index -ErrorAction SilentlyContinue | ForEach-Object { [string]$_.IPAddress })
        }
    })
    $hostKeys = @()
    $keyFiles = Get-ChildItem -Path (Join-Path $env:ProgramData 'ssh') -Filter 'ssh_host_*_key.pub' -ErrorAction SilentlyContinue
    foreach ($file in $keyFiles) {
        $algo = (Get-Content -LiteralPath $file.FullName -TotalCount 1).Split(' ')[0]
        $fingerprint = (& ssh-keygen -lf $file.FullName).Split(' ')[1]
        $hostKeys += @{ algo = $algo; fingerprint = $fingerprint }
    }
    $admins = @(Get-LocalGroupMember -Group 'Administrators' | ForEach-Object { ([string]$_.Name).Split('\')[-1] })
    $principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
    $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    $manager = if (Get-Command winget -ErrorAction SilentlyContinue) { 'winget' } elseif (Get-Command choco -ErrorAction SilentlyContinue) { 'choco' } else { 'none' }
    $facts = [ordered]@{
        os = [ordered]@{ family = 'windows'; name = [string]$os.Caption; version = [string]$os.Version; arch = $arch }
        kernel = 'Windows NT ' + [string]$os.Version
        hostname = [string]$cs.Name
        machineId = [string]$machineId
        cpus = [int]$cs.NumberOfLogicalProcessors
        memoryBytes = [int64]$cs.TotalPhysicalMemory
        disks = $disks
        nics = $nics
        hostKeys = $hostKeys
        adminUsers = $admins
        packageManager = $manager
        sudo = if ($isAdmin) { 'administrator' } else { 'none' }
        init = 'windows-service'
    }
    if ($bios.SerialNumber) { $facts['serial'] = [string]$bios.SerialNumber }
    return [ordered]@{ type = 'facts'; facts = $facts }
}

function Get-Consent {
    if ($env:${P}_CONSENT -eq 'yes') { Say 'consent given by ${P}_CONSENT=yes'; return $true }
    if (-not [Console]::IsInputRedirected) { return ((Read-Host 'Run the steps above on this machine? Type yes to agree') -eq 'yes') }
    Say 'No terminal to ask you on (the script came in on the standard input): save it and run it from a file, or set ${P}_CONSENT=yes.'
    return $false
}

function Get-Sha256 {
    param([string]$Path)
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Invoke-Step {
    param([string[]]$Fields)
    $kind = $Fields[1]
    switch ($kind) {
        'install-package' {
            $installer = $Fields[2]; $name = $Fields[3]; $version = $Fields[4]; $url = $Fields[5]; $want = $Fields[6]
            if (-not $url.StartsWith('https://')) { throw 'a download is over https only' }
            if ($installer -ne 'msi') { throw "the installer $installer is not run on Windows" }
            $dir = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
            New-Item -ItemType Directory -Path $dir | Out-Null
            $file = Join-Path $dir ([IO.Path]::GetFileName($url))
            Say "  download $name $version"
            Invoke-WebRequest -Uri $url -OutFile $file
            $got = Get-Sha256 -Path $file
            if ($got -ne $want) { Remove-Item -Recurse -Force $dir; throw "the SHA-256 of $name does not match the plan: wanted $want, got $got" }
            Say '  sha256 verified'
            $process = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/i', $file, '/qn', '/norestart') -Wait -PassThru
            Remove-Item -Recurse -Force $dir
            if ($process.ExitCode -notin @(0, 3010)) { throw "msiexec ended with $($process.ExitCode)" }
        }
        'authorize-key' {
            $account = $Fields[2]; $entry = $Fields[3] + ' ' + $Fields[4]
            $path = Join-Path (Join-Path (Join-Path $env:SystemDrive 'Users') $account) '.ssh'
            New-Item -ItemType Directory -Force -Path $path | Out-Null
            $file = Join-Path $path 'authorized_keys'
            if (-not (Test-Path -LiteralPath $file) -or -not ((Get-Content -LiteralPath $file) -contains $entry)) { Add-Content -LiteralPath $file -Value $entry }
        }
        'ensure-account' {
            $name = $Fields[2]
            if (-not (Get-LocalUser -Name $name -ErrorAction SilentlyContinue)) { New-LocalUser -Name $name -NoPassword | Out-Null }
            if ($Fields[3] -eq 'sudo') { Add-LocalGroupMember -Group 'Administrators' -Member $name -ErrorAction SilentlyContinue }
        }
        'pin-controller' {
            New-Item -ItemType Directory -Force -Path $Dir | Out-Null
            $entry = if ($Fields[3] -eq '22') { "$($Fields[2]) $($Fields[4]) $($Fields[5])" } else { "[$($Fields[2])]:$($Fields[3]) $($Fields[4]) $($Fields[5])" }
            $file = Join-Path $Dir 'known_hosts'
            if (-not (Test-Path -LiteralPath $file) -or -not ((Get-Content -LiteralPath $file) -contains $entry)) { Add-Content -LiteralPath $file -Value $entry }
        }
        'run' {
            $words = @($Fields[4].Split(' ', [StringSplitOptions]::RemoveEmptyEntries))
            $expect = @($Fields[3].Split(',') | ForEach-Object { [int]$_ })
            if ($words.Count -gt 1) { & $words[0] @($words[1..($words.Count - 1)]) } else { & $words[0] }
            if ($LASTEXITCODE -notin $expect) { throw "the program ended with $LASTEXITCODE" }
        }
        default { throw "a step this script does not know: $kind" }
    }
}

Say 'This script will:'
Say '  1. read facts about this machine from a fixed list of probes (CIM, the OpenSSH host keys, network adapters, administrators, winget)'
Say "  2. send them to $EnrollHost port $Port, session $Session"
Say '  3. wait until a person approves this machine'
Say '  4. ask you, here, before it installs anything, and only then run the steps of the approved plan'
Say 'A plan may install, from a pinned address with a verified SHA-256:'
foreach ($item in $Offered) { Say "  $item" }

if (-not (Get-Command ssh-keygen -ErrorAction SilentlyContinue)) { throw 'ssh-keygen is needed to make this machine''s key' }
$work = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $work | Out-Null
$script:KeyPath = Join-Path $work 'device_key'
$script:KnownHosts = Join-Path $work 'known_hosts'
if ($HostKeyAlgo) {
    $prefix = if ($Port -eq '22') { $EnrollHost } else { "[$EnrollHost]:$Port" }
    Set-Content -LiteralPath $script:KnownHosts -Value "$prefix $HostKeyAlgo $HostKeyBlob"
    $script:Strict = 'yes'
} else {
    Set-Content -LiteralPath $script:KnownHosts -Value ''
    $script:Strict = 'accept-new'
    Say 'warning: this script holds no host key of the controller, so the first connection trusts what answers (trust on first use). On a network you do not trust, use the one-liner the controller prints.'
}
& ssh-keygen -q -t ed25519 -N '' -C ${brand.keyComment} -f $script:KeyPath
$devicePub = ((Get-Content -LiteralPath "$($script:KeyPath).pub" -TotalCount 1).Split(' ')[0..1]) -join ' '
$null = Invoke-Door -Words @('status', $Session)
$seen = @(Get-Content -LiteralPath $script:KnownHosts | Where-Object { $_ })[0].Split(' ')
$observed = $seen[1] + ' ' + $seen[2]
$nonce = ([BitConverter]::ToString([Security.Cryptography.RandomNumberGenerator]::GetBytes(16))).Replace('-', '').ToLowerInvariant()
$commit = Get-Sha256Text -Text ($CommitTag + $nl + $nonce + $nl + $devicePub + $nl + $observed)
Say 'pairing: sending the commitment'
$reply = (Invoke-Door -Words @('pair-commit', $Session) -Text (@{ type = 'pair-commit'; commit = $commit } | ConvertTo-Json -Compress))[0]
if ($reply.Split($tab)[0] -ne 'COMMIT') { throw "the pairing was refused: $reply" }
$controllerCommit = $reply.Split($tab)[1]
$reply = (Invoke-Door -Words @('pair-reveal', $Session) -Text (@{ type = 'pair-reveal'; nonce = $nonce; devicePub = $devicePub; hostKey = $observed } | ConvertTo-Json -Compress))[0]
$parts = $reply.Split($tab)
if ($parts[0] -ne 'REVEAL') { throw "the pairing was refused: $reply" }
$controllerNonce = $parts[1]
$controllerKey = $parts[2]
if ((Get-Sha256Text -Text ($CommitTag + $nl + $controllerNonce + $nl + $controllerKey)) -ne $controllerCommit -or $controllerKey -ne $observed) { throw "the controller's answer does not match its commitment or the host key seen: a possible interception, stop here" }
$code = Get-Code -HashHex (Get-Sha256Text -Text ($SasTag + $nl + $observed + $nl + $devicePub + $nl + $controllerNonce + $nl + $nonce))
$facts = Get-Fact | ConvertTo-Json -Compress -Depth 8
Say "sending facts to $($EnrollHost):$Port"
$null = Invoke-Door -Words @('report', $Session) -Text $facts
Say ''
Say "Your pairing code is: $code"
Say "A person types it into the controller to approve this machine: ${brand.approveHint("$Session", "$code")}"
Say 'If the code the controller expects is another, stop: someone is between this machine and the controller.'
Say ''
Say "waiting for a person to approve this machine (session $Session)"
$waited = 0
while ($true) {
    $answer = Invoke-Door -Words @('next', $Session)
    $head = [string]$answer[0]
    $tag = $head.Split($tab)[0]
    if ($tag -eq 'PLAN') { break }
    if ($tag -eq 'WAIT') {
        if ($waited -ge $WaitMax) { throw "no decision within $WaitMax seconds" }
        Start-Sleep -Seconds $Poll
        $waited += $Poll
        continue
    }
    if ($tag -in @('REFUSED', 'EXPIRED', 'ENROLLED')) { Say "the server says: $head"; return }
    throw "an answer this script does not know: $tag"
}
Say 'approved. The plan:'
$steps = @()
foreach ($row in $answer) {
    $fields = ([string]$row).Split($tab)
    if ($fields[0] -ne 'STEP') { continue }
    foreach ($f in $fields[1..($fields.Count - 1)]) { Test-Safe -Value $f }
    $steps += , $fields
    Say ('  ' + ($fields[1..($fields.Count - 1)] -join ' '))
}
if (Get-Consent) {
    $null = Invoke-Door -Words @('report', $Session) -Text '{"type":"consent","granted":true}'
} else {
    $null = Invoke-Door -Words @('report', $Session) -Text '{"type":"consent","granted":false}'
    Say 'declined: nothing was installed'
    return
}
$results = @()
$failed = $false
$index = 0
foreach ($fields in $steps) {
    Say "step $($index): $($fields[1])"
    $ok = $true
    try { Invoke-Step -Fields $fields } catch { Say "  failed: $($_.Exception.Message)"; $ok = $false; $failed = $true }
    $results += [ordered]@{ index = $index; ok = $ok; detail = [string]$fields[1] }
    $index += 1
    if ($failed) { break }
}
if (-not $failed) {
    try {
        New-Item -ItemType Directory -Force -Path $Dir | Out-Null
        Copy-Item -LiteralPath $script:KeyPath -Destination (Join-Path $Dir 'device_key') -Force
        Copy-Item -LiteralPath "$($script:KeyPath).pub" -Destination (Join-Path $Dir 'device_key.pub') -Force
    } catch { Say "  failed: $($_.Exception.Message)"; $failed = $true }
}
$result = [ordered]@{ type = 'result'; ok = (-not $failed); steps = @($results) } | ConvertTo-Json -Compress -Depth 6
$null = Invoke-Door -Words @('done', $Session) -Text $result
if ($failed) { throw 'a step failed: see above' }
Say 'done: this machine is enrolled'
`;
}
