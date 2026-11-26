# Install an operating system

Booting a blank machine is not our job: PXE, TFTP and boot servers are out of scope for commons. This page says what to use instead, and then the part that is ours: the first boot of the new system enrolls itself ([enroll a machine](enroll-a-machine.md)).

## Linux

To install Linux over the network, use the netboot.xyz project (`netboot.xyz`): a boot menu that your DHCP server or a bootable image points at. Commons does not run it, host it or depend on it. Any installer you like works, as long as it can run a command at the end.

## Windows

There is more than one route, and commons recommends none. The options:

- **iPXE with wimboot** and a WinPE `boot.wim` with an `autounattend.xml`: the route a Linux-hosted network uses.
- **Windows Deployment Services (WDS)**: Microsoft has deprecated it from Windows Server 2028.
- **Microsoft Configuration Manager**: if you already run it.
- A USB stick with an `autounattend.xml`.

## First boot enrolls the machine

Each snippet runs the one-liner for an unattended fleet: a token for the fleet (so a policy approves), and the host key of the controller embedded. Replace `TOKEN` and the key line with what the controller printed. Nothing is a real host name here.

### Debian preseed

```
d-i preseed/late_command string \
  in-target sh -c 'k=$(mktemp) && printf "%s\n" "[opsfolio]:2222 ssh-ed25519 AAAA..." > "$k" && ssh -o UserKnownHostsFile="$k" -o PubkeyAuthentication=no -o StrictHostKeyChecking=yes -p 2222 s-enroll@opsfolio bootstrap token=TOKEN | OPSFOLIO_CONSENT=yes sh'
```

### Ubuntu autoinstall

```yaml
autoinstall:
  version: 1
  late-commands:
    - curtin in-target --target=/target -- sh -c 'k=$(mktemp) && printf "%s\n" "[opsfolio]:2222 ssh-ed25519 AAAA..." > "$k" && ssh -o UserKnownHostsFile="$k" -o PubkeyAuthentication=no -o StrictHostKeyChecking=yes -p 2222 s-enroll@opsfolio bootstrap token=TOKEN | OPSFOLIO_CONSENT=yes sh'
```

### Rocky or Alma kickstart

```
%post
k=$(mktemp) && printf '%s\n' '[opsfolio]:2222 ssh-ed25519 AAAA...' > "$k" && ssh -o UserKnownHostsFile="$k" -o PubkeyAuthentication=no -o StrictHostKeyChecking=yes -p 2222 s-enroll@opsfolio bootstrap token=TOKEN | OPSFOLIO_CONSENT=yes sh
%end
```

### Windows autounattend

```xml
<FirstLogonCommands>
  <SynchronousCommand wcm:action="add">
    <Order>1</Order>
    <CommandLine>pwsh -NoProfile -Command "$k = New-TemporaryFile; Set-Content -LiteralPath $k.FullName -Value '[opsfolio]:2222 ssh-ed25519 AAAA...'; $env:OPSFOLIO_CONSENT = 'yes'; ssh -o ('UserKnownHostsFile=' + $k.FullName) -o PubkeyAuthentication=no -o StrictHostKeyChecking=yes -p 2222 s-enroll@opsfolio bootstrap-ps token=TOKEN | pwsh"</CommandLine>
    <Description>Enroll this machine</Description>
  </SynchronousCommand>
</FirstLogonCommands>
```

`OPSFOLIO_CONSENT=yes` is the consent of the person who wrote the unattended install; without it the script asks at the terminal. The snippets need an `ssh` client and, for the preseed and kickstart forms, `curl` or `wget` in the new system for the downloads of the plan. The PowerShell snippet has not been run on Windows yet.
