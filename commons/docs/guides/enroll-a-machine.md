# Enroll a machine

A machine that runs an operating system joins the fleet over SSH. It connects to the controller's own SSH server (the library `ssh-server`), on port 2222 by default, as the service account `s-enroll`. Nothing is installed first, and the machine does not need an agent: it needs an `ssh` client and, for the full path, a POSIX shell or PowerShell 7. A person types one short code. Booting a blank machine (PXE, TFTP) is not a concern of commons: [install an operating system](install-an-os.md) says how to get an OS onto the machine first.

## Three steps

1. On the controller, start the enrollment server and show the one-liner for the machine. The one-liner holds the host key of the controller.
2. On the machine, paste the one-liner. It prints a short code (6 digits by default) and waits.
3. On the controller, a person types that code: `opsfolio enroll approve ID --code NNNNNN`. The machine installs what the approved plan says, after it asks you once more on its own terminal.

## What runs where

| Where | What | What it can do |
|---|---|---|
| The machine | `ssh -p 2222 s-enroll@opsfolio bootstrap \| sh` | Prints a script. `sh` runs it. The first connection is anonymous and carries only `hello`, `bootstrap`, `status`, `knock` and `join`. |
| The machine | the script | Makes an ed25519 key on the machine (the private key never leaves it), reconnects with it, pairs, reports facts from a fixed list of probes, waits, asks for consent, runs the typed plan. |
| The controller | the SSH server | Speaks a closed set of typed commands. It never gives a shell, a terminal, a forward or a file transfer. A person approves, unless a policy you wrote says otherwise. |

Read it before you run it: `ssh -p 2222 s-enroll@opsfolio bootstrap > enroll.sh`, read `enroll.sh`, then `sh enroll.sh`. The PowerShell form for Windows is `ssh -p 2222 s-enroll@opsfolio bootstrap-ps | pwsh`, or save it and run `pwsh ./enroll.ps1`.

## The commands the one-liner prints for a person to paste

The controller prints each with its host key embedded, so that the machine does not trust the first thing that answers:

```sh
k=$(mktemp) && printf '%s\n' '[opsfolio]:2222 ssh-ed25519 AAAA...' > "$k" && ssh -o UserKnownHostsFile="$k" -o PubkeyAuthentication=no -o StrictHostKeyChecking=yes -p 2222 s-enroll@opsfolio bootstrap | sh; rm -f "$k"
```

For OpenSSH 8.5 and later the line can come from `KnownHostsCommand` instead of a file (the controller prints that variant too). For PowerShell the controller prints the same with `New-TemporaryFile` and `bootstrap-ps | pwsh`. The script embeds the same key, and says so loudly where it holds none.

## The security model

- **The code is not a secret.** Six digits are guessed at once offline. It is a short authentication string, as in the numeric comparison of Bluetooth: both sides commit to what they saw before they learn what the other saw, and both derive the code from the controller's host key as the device saw it, the device's key and both nonces. A man in the middle who holds one host key toward the machine and another toward the controller makes the two codes differ, so the code the person types is refused. Three wrong codes, or five minutes, burn the pairing (`E-SSH-PAIRING-BURNED`), and the controller records a possible interception.
- **Keys, not passwords.** Only `s-enroll` works without a key, and only for the enrollment commands. After the pairing the machine's key is the key of its service account `s-device`, and the machine pins the controller's host key.
- **The plan is typed.** It holds installs from a pinned address with a SHA-256 (verified before the installer runs), keys to authorize, accounts to ensure, and argument vectors to run. The script runs argument vectors without a shell and refuses any word outside a small alphabet.
- **Safe by default.** Only private, loopback, link-local and ULA sources connect (add a block to `allowCidrs` to allow another). Connections, time and size are limited, a source that misbehaves is penalised, and every command is an audit event in a hash chain.
- **A device that cannot run a script** (a router, a switch): `ssh -p 2222 s-enroll@opsfolio knock` leaves a pending session. The controller prints a code in the output and a person confirms it. This tier trusts the first connection, so use the one-liner on a network you do not trust. A device that cannot make a key is never given one by the controller: the controller prints the command for the device that authorizes the controller's own key.

## Without a person

A fleet that boots by itself uses a scoped token (its hash is stored, it works once and expires) with the host key embedded: `bootstrap token=tok-...`. A policy rule for that token approves the session, and the audit says which rule and why. The first-boot snippets in [install an operating system](install-an-os.md) do this.

## Make the name resolve

The scripts call `opsfolio` by default. Until discovery by mDNS (`_opsfolio-enroll._tcp`) is built (it is reserved in the specification), make the name resolve: add a DNS record `opsfolio` for the controller, or a search domain by DHCP so that the short name resolves. You can always pass the address: the scripts read `OPSFOLIO_HOST` and `OPSFOLIO_PORT`.

## Tested and not tested

Proved on Linux against the OpenSSH 9.6 client, and with the script run on a Debian 13 container with an OpenSSH 10.0 client, on Bun and Node 26. Not yet run: the PowerShell script on Windows, and the Windows `ssh.exe` client. See the requirement `0001-ssh-server-layers FR-006` for the list.
