// Spec: 0004-scripts FR-010
/**
 * The one-liners the controller prints for a person to paste on a device: each embeds the host key of the controller as a known_hosts line and checks it strictly, so there is no trust on first use. A variant per shell, and for sh two ways to give
 * the line to `ssh`: a temporary file (any OpenSSH), or `KnownHostsCommand` (OpenSSH 8.5 and later). Reserved and not built: SSHFP with `VerifyHostKeyDNS`.
 *
 * @module
 */
import { ok } from "@intellectual-frontiers/core";
import type { Result } from "@intellectual-frontiers/core";
import { parsePublicKeyLine } from "@intellectual-frontiers/ssh-server/governance";
import type { Endpoint } from "./script-sh.ts";
import { quoted } from "./script-text.ts";

/** How the known_hosts line reaches `ssh`. */
export type KnownHostsVia = "tmpfile" | "known-hosts-command";

/** The known_hosts line of a host key: `[host]:port algo base64`, or `host algo base64` on port 22. */
export function knownHostsLine(endpoint: Endpoint, hostKey: string): Result<string, string> {
  const k = parsePublicKeyLine(hostKey);
  if (k.kind === "err") return k;
  return ok(`${endpoint.port === 22 ? endpoint.host : `[${endpoint.host}]:${endpoint.port}`} ${k.value.algo} ${k.value.base64}`);
}

/** The one-liner for a shell. Where the host key is not a key, an error. */
export function renderOneLiner(shell: "sh" | "ps", endpoint: Endpoint, hostKey: string, via: KnownHostsVia = "tmpfile"): Result<string, string> {
  const line = knownHostsLine(endpoint, hostKey);
  if (line.kind === "err") return line;
  quoted(endpoint.host);
  const target = `-p ${endpoint.port} s-enroll@${endpoint.host}`;
  const strict = "-o PubkeyAuthentication=no -o StrictHostKeyChecking=yes";
  if (shell === "ps") {
    return ok(`$k = New-TemporaryFile; Set-Content -LiteralPath $k.FullName -Value '${line.value}'; ssh -o "UserKnownHostsFile=$($k.FullName)" ${strict} ${target} bootstrap-ps | pwsh; Remove-Item -LiteralPath $k.FullName`);
  }
  if (via === "known-hosts-command") return ok(`ssh -o UserKnownHostsFile=/dev/null -o "KnownHostsCommand=/bin/echo ${line.value}" ${strict} ${target} bootstrap | sh`);
  return ok(`k=$(mktemp) && printf '%s\\n' '${line.value}' > "$k" && ssh -o UserKnownHostsFile="$k" ${strict} ${target} bootstrap | sh; rm -f "$k"`);
}
