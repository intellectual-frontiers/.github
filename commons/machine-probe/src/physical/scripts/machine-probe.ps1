# machine-probe 1: read-only facts for the fleet, on Windows (commons machine-probe 0002-machine-probe-contract).
# Run only by the fleet's probe key (authorized_keys forces it). It changes nothing. The same requests
# and output as the POSIX probe (machine-probe.sh):
#   facts             @section and key=value lines
#   osquery <base64>  one SELECT through osqueryi, when osquery is installed
#   version           the probe's version
# Windows PowerShell 5.1 and PowerShell 7. Anything it cannot read (BitLocker without
# administrator rights, say) it reports as unknown.
$ErrorActionPreference = 'SilentlyContinue'
$version = '1'
$req = $env:SSH_ORIGINAL_COMMAND
if (-not $req) { $req = if ($args.Count) { $args -join ' ' } else { 'facts' } }

function kv($k, $v) { Write-Output ('{0}={1}' -f $k, ("$v" -replace '[\r\n]+', ' ').Trim()) }

function Get-Facts {
  $os = Get-CimInstance Win32_OperatingSystem
  $cs = Get-CimInstance Win32_ComputerSystem
  $bios = Get-CimInstance Win32_BIOS
  Write-Output '@probe'; kv version $version; kv at ((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))
  Write-Output '@os'
  kv kernel 'Windows'; kv release $os.Version; kv arch $env:PROCESSOR_ARCHITECTURE; kv hostname $env:COMPUTERNAME
  kv family 'windows'; kv name $os.Caption; kv version $os.BuildNumber
  kv serial $bios.SerialNumber; kv model ('{0} {1}' -f $cs.Manufacturer, $cs.Model)
  Write-Output '@hardware'
  kv cpus $cs.NumberOfLogicalProcessors; kv memory_mb ([int]($cs.TotalPhysicalMemory / 1MB))
  $d = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$($env:SystemDrive)'"
  if ($d.Size) { kv disk_total_gb ([int]($d.Size / 1GB)); kv disk_used_pct ([int](100 - 100 * $d.FreeSpace / $d.Size)) }
  Write-Output '@security'
  $bl = Get-BitLockerVolume -MountPoint $env:SystemDrive
  if ($null -eq $bl) {
    $enc = Get-CimInstance -Namespace root\cimv2\Security\MicrosoftVolumeEncryption -ClassName Win32_EncryptableVolume -Filter "DriveLetter='$($env:SystemDrive)'"
    if ($null -eq $enc) {
      # Without administrator rights (a controller PC observing itself): the Shell's
      # BitLocker property, which any user may read (1 on, 3 encrypting, 2 off).
      $bp = $null; try { $bp = (New-Object -ComObject Shell.Application).NameSpace("$($env:SystemDrive)\").Self.ExtendedProperty('System.Volume.BitLockerProtection') } catch {}
      if ($bp -eq 1 -or $bp -eq 3) { kv disk_encryption 'on' } elseif ($bp -eq 2) { kv disk_encryption 'off' } else { kv disk_encryption 'unknown' }
    } elseif ($enc.ProtectionStatus -eq 1) { kv disk_encryption 'on' } else { kv disk_encryption 'off' }
  } elseif ("$($bl.ProtectionStatus)" -eq 'On') { kv disk_encryption 'on' } else { kv disk_encryption 'off' }
  $fw = Get-NetFirewallProfile
  if ($null -eq $fw) { kv firewall 'unknown' } elseif (@($fw | Where-Object { -not $_.Enabled }).Count -eq 0) { kv firewall 'on' } else { kv firewall 'off' }
  $au = Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU'
  if ($au.NoAutoUpdate -eq 1) { kv auto_updates 'off' } else { kv auto_updates 'on' }
  $mp = Get-MpComputerStatus
  if ($null -eq $mp) { kv antivirus 'unknown' } elseif ($mp.RealTimeProtectionEnabled) { kv antivirus 'on' } else { kv antivirus 'off' }
  $sid = 'S-1-5-32-544' # Administrators, whatever the language
  $admins = Get-LocalGroupMember -SID $sid | ForEach-Object { ($_.Name -split '\\')[-1] }
  kv admins (@($admins) -join ' ')
  $sshd = 'C:\ProgramData\ssh\sshd_config'
  if (Test-Path $sshd) {
    $pa = (Select-String -Path $sshd -Pattern '^\s*PasswordAuthentication\s+(\S+)' | Select-Object -First 1)
    if ($pa) { kv ssh_password_auth $pa.Matches[0].Groups[1].Value.ToLower() } else { kv ssh_password_auth 'default' }
  }
  Write-Output '@software'
  $keys = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  kv manager 'windows'; kv packages (@(Get-ItemProperty $keys | Where-Object { $_.DisplayName }).Count)
  $oq = Join-Path $env:ProgramFiles 'osquery\osqueryi.exe'
  if (Test-Path $oq) { kv osquery ((& $oq --version) -split ' ')[-1] }
  Write-Output '@listening'
  $ports = Get-NetTCPConnection -State Listen | Select-Object -ExpandProperty LocalPort | Sort-Object -Unique
  kv ports (@($ports) -join ' ')
}

switch -regex ($req) {
  '^facts$' { Get-Facts; exit 0 }
  '^version$' { Write-Output $version; exit 0 }
  '^osquery (\S+)$' {
    $oq = Join-Path $env:ProgramFiles 'osquery\osqueryi.exe'
    if (-not (Test-Path $oq)) { [Console]::Error.WriteLine('osquery is not installed here'); exit 3 }
    try { $sql = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Matches[1])) } catch { [Console]::Error.WriteLine('not base64'); exit 2 }
    $sql = $sql.Trim().TrimEnd(';').Trim()
    if ($sql -notmatch '^(?i)(select|with)\b') { [Console]::Error.WriteLine('only SELECT'); exit 2 }
    if ($sql.Contains(';')) { [Console]::Error.WriteLine('one statement'); exit 2 }
    & $oq --json $sql; exit $LASTEXITCODE
  }
  default { [Console]::Error.WriteLine("machine-probe: unknown probe: $req (facts, osquery, version)"); exit 2 }
}
