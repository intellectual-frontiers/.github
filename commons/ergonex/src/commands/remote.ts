// Spec: 0006-agents FR-027, FR-028, FR-029, FR-030, FR-031, FR-032, FR-036
/**
 * `ergonex remote bootstrap|run|token` (commons ergonex 0006-agents FR-027 to FR-032): reach a Linux machine over SSH, make Ergonex ready there for an agent, run one `ergonex` command there, and refresh
 * its token. The connection is made only with `BatchMode`, no terminal, `StrictHostKeyChecking=yes` and a file of known hosts of its own, after the host's key is known (a fingerprint the caller gives, or
 * trust on first use). The token goes to the machine on standard input and never as an argument or in the environment of the local command; the private key of a GitHub App never goes there.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { parseJson5 } from "@intellectual-frontiers/formats";
import { branch } from "@intellectual-frontiers/headless/logical";
import { type Args, flag, many, value } from "../platform/k-args.ts";
import { makeTempDir, readTextFile, readTextOr, remove, writeTextFile } from "../platform/r-fs.ts";
import { dirname, fromFileUrl, join } from "../platform/r-path.ts";
import type { Finding } from "../findings.ts";
import { AREA } from "../host/workspace.ts";
import type { Context, Outcome } from "../modules/types.ts";
import { ERGONEX_VERSION } from "../state-record.ts";
import { decodeAgentsPolicy } from "../agents/policy.ts";
import { systemRefusal } from "../agents/distro.ts";
import { handshakeInput, readHandshake } from "../agents/mcp-probe.ts";
import { type Target, parseTarget, pinHostKey, resolveTarget, shq, sshRun, targetAllowed, nameOf, type Remote } from "../agents/host/remote.ts";
import { redact } from "../agents/host/token-source.ts";
import { defineCommand } from "./define.ts";
import { changes, HOME, reads } from "./options.ts";
import { jsonOf } from "./common.ts";

const INSTALLER = join(dirname(fromFileUrl(import.meta.url)), "..", "..", "install", "ergonex-install.auto.sh");
/** The `PATH` of a command run over SSH: where Ergonex puts its command, and where Bun does. */
const REMOTE_PATH = 'PATH="$HOME/.local/bin:$HOME/.bun/bin:$HOME/.local/share/mise/shims:$PATH"; export PATH';

const TARGET = [{ name: "TARGET", help: "ssh://user@host:port, or a name of your SSH configuration.", arity: "one" }] as const;

const finding = (ctx: Context, severity: Finding["severity"], message: string, subject: string): Finding => ({ ruleId: "ergonex/remote", severity, message, subject, firstSeen: ctx.today });

/** The local run's known-hosts file of its own (FR-027). */
const knownHostsOf = (home: string): string => join(home, AREA, "known_hosts");

/** A step of a run on a machine. */
type Step = { readonly step: string; readonly status: "changed" | "unchanged" | "would-change" | "skipped" | "failed"; readonly detail?: string };

const sha256Text = async (text: string): Promise<string> => {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

/** Whether the policy lets this run reach the target: the persona agent only the hosts the policy's `remote` list names; a human where the policy names none or names it (FR-027). */
function mayReach(ctx: Context, t: Target): string | undefined {
  const list = ctx.agents?.remote ?? [];
  if (ctx.identity.persona === "agent" && !targetAllowed(list, t)) return `the agents policy's remote list does not name ${nameOf(t)}: add it to \`agents.remote\` in the manifest`;
  if (ctx.identity.persona !== "agent" && list.length > 0 && !targetAllowed(list, t)) return `the policy's remote list does not name ${nameOf(t)}`;
  return undefined;
}

/** The envelope or text a remote ergonex printed, as data where it is the JSON envelope. */
function envelopeOf(stdout: string): { readonly data: unknown; readonly whole: unknown } | undefined {
  const p = parseJson5(stdout.trim());
  if (p.kind !== "ok" || typeof p.value !== "object" || p.value === null || Array.isArray(p.value)) return undefined;
  return { data: Reflect.get(p.value, "data"), whole: p.value };
}

const BOOTSTRAP_OPTIONS = (() => {
  const { harness: _harness, ...rest } = HOME;
  return {
    ...rest,
    harness: many({ help: "A harness to write the files of on the machine (claude-code, codex, herdr, other); repeat for each.", valueName: "HARNESS" }),
    fingerprint: value({ help: "The fingerprint (SHA256:...) the host's key must have, checked by another way than this connection.", valueName: "SHA256:..." }),
    trustOnFirstUse: flag({ help: "Accept the key the host offers now and record it; its fingerprint is printed." }),
    allowRoot: flag({ help: "Allow the account to be root." }),
    tokenStdin: flag({ help: "Read the token from standard input and put it on the machine (a file of mode 0600)." }),
    expiresAt: value({ help: "When the token expires (an ISO 8601 time), recorded beside it.", valueName: "TIME" }),
    policy: value({ help: "The file that holds the agents policy of the machine; it is decoded here before anything is sent.", valueName: "FILE" }),
    identity: value({ help: "The private key file ssh logs in with (else ssh's own choice).", valueName: "FILE" }),
    timeout: value({ help: "Seconds each remote step may take (300 by default).", valueName: "SECONDS" }),
  };
})();

/** The text of the token, as the lines of standard input give it: one non-empty line, trimmed. */
const tokenOf = (stdin: string): string | undefined => {
  const lines = stdin.split("\n").map((l) => l.trim()).filter((l) => l !== "");
  return lines.length === 1 ? lines[0] : undefined;
};

/** The command that writes a file of mode 0600 whole beside the old one from standard input, and says its SHA-256 first where it was already as given. */
const writeSecretCommand = (rel: string, sha: string): string =>
  `umask 077; f="$HOME/${rel}"; d=$(dirname "$f"); mkdir -p "$d"; ` +
  `if [ -f "$f" ] && [ "$(sha256sum < "$f" | cut -d' ' -f1)" = ${shq(sha)} ] && [ "$(stat -c %a "$f")" = 600 ]; then cat >/dev/null; echo unchanged; ` +
  `else cat > "$f.new" && chmod 600 "$f.new" && mv "$f.new" "$f" && echo changed; fi`;

const bootstrap = defineCommand({
  name: "bootstrap",
  summary: "Make Ergonex ready for an agent on a Linux machine over SSH: the runtime, the token, ergonex, the workspace and policy, the harness files, the doctor and a handshake with the tool server.",
  options: BOOTSTRAP_OPTIONS,
  operands: TARGET,
  examples: [
    { args: ["ssh://agent@box:22", "--fingerprint", "SHA256:...", "--token-stdin", "--policy", "agents.json", "--harness", "claude-code"], says: "Bootstrap the machine, its host key checked against the fingerprint." },
    { args: ["box", "--dry-run", "--trust-on-first-use"], says: "Probe the machine and print the steps, changing nothing." },
  ],
  action: changes({ idempotent: true, dryRun: true }),
  run: async (ctx, args): Promise<Outcome> => {
    // a preview probes the machine with the key it would pin, held in a file that lives only for the run (it pins nothing)
    const scratch: string[] = [];
    try {
      return await bootstrapRun(ctx, args, scratch);
    } finally {
      for (const f of scratch) await remove(f, { recursive: true }).catch(() => undefined);
    }
  },
});

async function bootstrapRun(ctx: Context, args: Args<typeof BOOTSTRAP_OPTIONS>, scratch: string[]): Promise<Outcome> {
  {
    const parsed = parseTarget(args.positionals[0] ?? "");
    if (parsed.kind === "err") return err({ kind: "usage", message: parsed.error });
    const denied = mayReach(ctx, parsed.value);
    if (denied !== undefined) return err({ kind: "usage", message: denied });
    if (ctx.home === undefined) return err({ kind: "environment", message: "no root can be found: set ERGONEX_HOME, or give --home" });
    const apply = ctx.mode === "apply";
    const seconds = Number.parseInt(args.options.timeout ?? "300", 10);
    if (Number.isNaN(seconds) || seconds < 1) return err({ kind: "usage", message: "--timeout is a number of seconds" });
    const timeoutMs = seconds * 1000;
    const harnesses = args.options.harness;
    for (const h of harnesses) if (!["claude-code", "codex", "herdr", "other"].includes(h)) return err({ kind: "usage", message: `${JSON.stringify(h)} is not a harness` });
    // the policy is decoded here, before anything is sent (FR-029)
    let policyText: string | undefined;
    if (args.options.policy !== undefined) {
      const text = await readTextFile(args.options.policy).catch(() => undefined);
      if (text === undefined) return err({ kind: "usage", message: `${args.options.policy} cannot be read` });
      const p = parseJson5(text);
      if (p.kind === "err") return err({ kind: "usage", message: "the agents policy is not JSON" });
      const d = decodeAgentsPolicy(p.value);
      if (d.kind === "err") return err({ kind: "usage", message: `the agents policy is not valid: ${d.error.map((i) => `${i.path}: ${i.message}`).join("; ")}` });
      policyText = JSON.stringify(p.value);
    }
    let token: string | undefined;
    if (args.options.tokenStdin === true) {
      token = tokenOf(await ctx.stdin());
      if (token === undefined) return err({ kind: "usage", message: "--token-stdin takes one line on standard input: the token" });
    }
    const secrets = token === undefined ? [] : [token];
    const t = parsed.value;
    const resolved = await resolveTarget(t);
    if (resolved.kind === "err") return err({ kind: "environment", message: resolved.error });
    let known = knownHostsOf(ctx.home);
    const identity = args.options.identity;
    const steps: Step[] = [];
    const findings: Finding[] = [];
    const stop = (message: string): Outcome => {
      findings.push(finding(ctx, "Error", redact(message, secrets), nameOf(t)));
      return ok({ text: renderSteps(steps, findings), data: jsonOf({ target: nameOf(t), steps }), findings });
    };

    // the host's key is known before the first connection (FR-028)
    const pinned = await pinHostKey(known, resolved.value, { ...(args.options.fingerprint === undefined ? {} : { fingerprint: args.options.fingerprint }), trustOnFirstUse: args.options.trustOnFirstUse === true }, apply);
    if (pinned.kind === "refused") {
      steps.push({ step: "host key", status: "failed", detail: pinned.message });
      if (pinned.reason === "unknown" || pinned.reason === "mismatch" || pinned.reason === "changed")
        return err({ kind: pinned.reason === "unknown" ? "usage" : "environment", message: `${pinned.message}${pinned.fingerprints.length === 0 ? "" : `\n  ${pinned.fingerprints.join("\n  ")}`}` });
      return err({ kind: "environment", message: pinned.message });
    }
    steps.push({ step: "host key", status: pinned.kind === "known" ? "unchanged" : apply ? "changed" : "would-change", ...(pinned.kind === "pinned" ? { detail: `${pinned.fingerprint} (${pinned.how === "first-use" ? "trust on first use" : "given"})` } : {}) });
    if (!apply && pinned.kind === "pinned") {
      const dir = await makeTempDir({ prefix: "ergonex-preview-" });
      scratch.push(dir);
      known = join(dir, "known_hosts");
      await writeTextFile(known, pinned.line);
    }

    const sh = (command: string, input?: string): Promise<Remote> => sshRun(t, known, command, { ...(input === undefined ? {} : { input }), timeoutMs, ...(identity === undefined ? {} : { identity }) });

    // the probe (FR-029); a system that is not Linux is refused (FR-032)
    const probe = await sh('uname -s; uname -m; id -u; printf "%s\\n" "$HOME"; echo ---; cat /etc/os-release 2>/dev/null; true');
    if (probe.code !== 0) {
      steps.push({ step: "probe", status: "failed", detail: redact(probe.stderr.trim().split("\n")[0] ?? "ssh failed", secrets) });
      return err({ kind: "environment", message: `the machine could not be reached: ${redact(probe.stderr.trim().split("\n")[0] ?? "", secrets)}` });
    }
    const [head = "", osText = ""] = probe.stdout.split("\n---\n");
    const [kernel = "", arch = "", uid = ""] = head.split("\n");
    const refusal = systemRefusal(kernel);
    if (refusal !== undefined) return err({ kind: "environment", message: refusal });
    if (uid === "0" && args.options.allowRoot !== true) return err({ kind: "usage", message: "the account is root; an agent does not run as root: use another account, or give --allow-root" });
    steps.push({ step: "probe", status: "unchanged", detail: `${kernel} ${arch}, uid ${uid}, ${/^ID=(.*)$/m.exec(osText)?.[1]?.replaceAll('"', "") ?? "unknown distribution"}` });

    // the runtime
    const rt = await sh(`${REMOTE_PATH}; if command -v bun >/dev/null 2>&1; then echo bun $(bun --version); elif command -v node >/dev/null 2>&1; then echo node $(node --version); else echo none; fi`);
    const runtime = rt.stdout.trim();
    steps.push({ step: "runtime", status: runtime === "none" || runtime === "" ? (apply ? "changed" : "would-change") : "unchanged", detail: runtime === "none" ? "none yet: the installer of ergonex installs Bun" : runtime });

    // the token (FR-029): from standard input, to a file of mode 0600, never an argument
    if (token !== undefined) {
      const sum = await sha256Text(`${token}\n`);
      const state = apply ? await sh(writeSecretCommand(".config/ergonex/token", sum), `${token}\n`) : await sh(`f="$HOME/.config/ergonex/token"; if [ -f "$f" ] && [ "$(sha256sum < "$f" | cut -d' ' -f1)" = ${shq(sum)} ]; then echo unchanged; else echo changed; fi`);
      steps.push({ step: "token", status: state.code !== 0 ? "failed" : state.stdout.trim() === "unchanged" ? "unchanged" : apply ? "changed" : "would-change", detail: "a file of mode 0600; the value is not shown" });
      if (state.code !== 0) return stop(`the token could not be written: ${state.stderr.trim().split("\n")[0] ?? ""}`);
      if (args.options.expiresAt !== undefined) {
        if (Number.isNaN(Date.parse(args.options.expiresAt))) return err({ kind: "usage", message: "--expires-at is a time in ISO 8601" });
        const iso = new Date(args.options.expiresAt).toISOString();
        if (apply) await sh(writeSecretCommand(".config/ergonex/token.expires", await sha256Text(`${iso}\n`)), `${iso}\n`);
      }
    } else steps.push({ step: "token", status: "skipped", detail: "no --token-stdin: the machine keeps the token it has" });

    // ergonex of this version (FR-029, FR-034): checked, then installed from the registry by the installer script, sent on standard input with its SHA-256 checked
    const have = await sh(`${REMOTE_PATH}; ergonex --version 2>/dev/null | head -n 1`);
    const installed = have.stdout.includes(ERGONEX_VERSION);
    let ready = installed;
    if (installed) steps.push({ step: "ergonex", status: "unchanged", detail: have.stdout.trim() });
    else if (!apply) steps.push({ step: "ergonex", status: "would-change", detail: `install ${ERGONEX_VERSION} from the package registry` });
    else {
      const script = await readTextOr(INSTALLER, undefined);
      if (script === undefined) return stop(`the installer ${INSTALLER} is not in this package`);
      const sum = await sha256Text(script);
      const bunfig = 'f="$HOME/.bunfig.toml"; if ! grep -q "ergonex:begin" "$f" 2>/dev/null; then printf "# ergonex:begin\\n[install.scopes]\\n\\"@intellectual-frontiers\\" = { token = \\"\\\\$ERGONEX_GITHUB_TOKEN\\", url = \\"https://npm.pkg.github.com/\\" }\\n# ergonex:end\\n" >> "$f"; fi';
      const cmd =
        `${REMOTE_PATH}; set -e; ${bunfig}; s=$(mktemp); cat > "$s"; echo ${shq(`${sum}  `)}"$s" | sha256sum -c - >/dev/null || { echo "the installer does not have the SHA-256 that was sent" >&2; exit 3; }; ` +
        `if [ -f "$HOME/.config/ergonex/token" ]; then ERGONEX_GITHUB_TOKEN="$(cat "$HOME/.config/ergonex/token")"; export ERGONEX_GITHUB_TOKEN; fi; ` +
        `ERGONEX_VERSION=${shq(ERGONEX_VERSION)} sh "$s"; rm -f "$s"; mkdir -p "$HOME/.local/bin"; ` +
        `p=$(command -v ergonex); if [ "$p" != "$HOME/.local/bin/ergonex" ]; then ln -sf "$p" "$HOME/.local/bin/ergonex"; fi`;
      const r = await sh(cmd, script);
      ready = r.code === 0;
      steps.push({ step: "ergonex", status: r.code === 0 ? "changed" : "failed", ...(r.code === 0 ? {} : { detail: redact(r.stderr.trim().split("\n").slice(-2).join(" "), secrets) }) });
      if (r.code !== 0) return stop("ergonex could not be installed on the machine");
    }

    const initWords = `ergonex init --no-install --persona agent${policyText === undefined ? "" : " --policy -"} --json`;
    // the workspace and its policy (FR-029); `init` is run as the persona agent. A preview only compares: the workspace folder and the policy file as they would be written
    if (!apply) {
      const expected = policyText === undefined ? undefined : `${JSON.stringify({ persona: "agent", agents: JSON.parse(policyText) }, null, 2)}\n`;
      const check = await sh(`d="$HOME/workspaces/.ergonex"; [ -f "$d/workspace.ts" ] || { echo missing; exit 0; }; ${expected === undefined ? "echo same" : '[ -f "$d/agents.json" ] && cmp -s - "$d/agents.json" && echo same || echo differs'}`, expected);
      steps.push({ step: "workspace", status: check.stdout.trim() === "same" ? "unchanged" : "would-change" });
    } else {
      const init = await sh(`${REMOTE_PATH}; ${initWords}`, policyText === undefined ? undefined : `${policyText}\n`);
      const env = envelopeOf(init.stdout);
      const made = env !== undefined && typeof env.data === "object" && env.data !== null && "made" in env.data && Array.isArray(env.data.made) ? env.data.made.length : undefined;
      if (init.code !== 0) {
        steps.push({ step: "workspace", status: "failed", detail: redact(init.stderr.trim().split("\n").pop() ?? "", secrets) });
        return stop("the workspace could not be made on the machine");
      }
      steps.push({ step: "workspace", status: made === 0 ? "unchanged" : "changed" });
    }

    // the files of each harness (FR-013 to FR-016), at the user scope of the account
    for (const h of harnesses) {
      if (!ready) {
        steps.push({ step: `harness ${h}`, status: "would-change" });
        continue;
      }
      const r = await sh(`${REMOTE_PATH}; ergonex agent init --harness ${shq(h)} --scope user --ergonex-path "$HOME/.local/bin/ergonex" ${apply ? "" : "--dry-run "}--json`);
      const env = envelopeOf(r.stdout);
      const results = env !== undefined && typeof env.data === "object" && env.data !== null && "results" in env.data && Array.isArray(env.data.results) ? env.data.results : [];
      const changed = results.some((x) => typeof x === "object" && x !== null && "outcome" in x && (x.outcome === "changed" || x.outcome === "would-change"));
      steps.push({ step: `harness ${h}`, status: r.code !== 0 ? "failed" : changed ? (apply ? "changed" : "would-change") : "unchanged", ...(r.code !== 0 ? { detail: redact(r.stderr.trim().split("\n").pop() ?? "", secrets) } : {}) });
    }

    // the doctor, and a handshake with the tool server over the same connection (FR-029)
    let doctor: unknown;
    if (ready) {
      const d = await sh(`${REMOTE_PATH}; ergonex agent doctor --json`);
      const env = envelopeOf(d.stdout);
      doctor = env?.data;
      steps.push({ step: "doctor", status: env === undefined ? "failed" : "unchanged", detail: env === undefined ? "the doctor gave no report" : "its report is in the data of this run" });
      const hs = await sh(`${REMOTE_PATH}; ERGONEX_PERSONA=agent ergonex mcp`, handshakeInput("ergonex-remote"));
      const h = readHandshake(hs.stdout);
      steps.push(h.kind === "ok" ? { step: "tool server", status: "unchanged", detail: `answers a handshake over this connection (protocol ${h.value.protocolVersion}, ${h.value.tools.length} tools)` } : { step: "tool server", status: "failed", detail: h.error });
      if (h.kind === "err") findings.push(finding(ctx, "Error", `the tool server does not answer a handshake: ${h.error}`, nameOf(t)));
    }
    return ok({ text: renderSteps(steps, findings), data: jsonOf({ target: nameOf(t), steps, doctor: doctor === undefined ? null : doctor }), findings });
  }
}

function renderSteps(steps: readonly Step[], findings: readonly Finding[]): string {
  const lines = steps.map((s) => `${s.status.padEnd(12)} ${s.step}${s.detail === undefined ? "" : `: ${s.detail}`}`);
  return [...lines, ...findings.map((f) => `${f.severity.toLowerCase()}: ${f.message}`)].join("\n");
}

const RUN_OPTIONS = (() => {
  return {
    ...HOME,
    fingerprint: value({ help: "Not used: the host's key must already be known (`remote bootstrap` pins it).", valueName: "SHA256:..." }),
    timeout: value({ help: "Seconds the command may take (60 by default).", valueName: "SECONDS" }),
    identity: value({ help: "The private key file ssh logs in with.", valueName: "FILE" }),
    raw: flag({ help: "Run the words as a command of the machine and not as an ergonex command: refused unless the policy's rawCommands is true." }),
  };
})();

const remoteRun = defineCommand({
  name: "run",
  summary: "Run exactly one ergonex command on the machine without a terminal, and give its status and its JSON envelope.",
  options: RUN_OPTIONS,
  operands: [...TARGET, { name: "WORDS", help: "The words of the ergonex command, after --.", arity: "many" }] as const,
  examples: [{ args: ["box", "--", "status"], says: "Run `ergonex status` on box and give its envelope." }],
  action: reads(),
  run: async (ctx, args): Promise<Outcome> => {
    const parsed = parseTarget(args.positionals[0] ?? "");
    if (parsed.kind === "err") return err({ kind: "usage", message: parsed.error });
    const denied = mayReach(ctx, parsed.value);
    if (denied !== undefined) return err({ kind: "usage", message: denied });
    if (ctx.home === undefined) return err({ kind: "environment", message: "no root can be found: set ERGONEX_HOME, or give --home" });
    const words = [...args.positionals.slice(1), ...args.rest];
    if (words.length === 0) return err({ kind: "usage", message: "remote run takes the words of one ergonex command after --" });
    if (args.options.raw === true && ctx.agents?.rawCommands !== true) return err({ kind: "usage", message: "the policy does not let `remote` run commands that are not ergonex's: set `rawCommands: true` in the agents policy" });
    const seconds = Number.parseInt(args.options.timeout ?? "60", 10);
    if (Number.isNaN(seconds) || seconds < 1) return err({ kind: "usage", message: "--timeout is a number of seconds" });
    const resolved = await resolveTarget(parsed.value);
    if (resolved.kind === "err") return err({ kind: "environment", message: resolved.error });
    const command = args.options.raw === true ? `${REMOTE_PATH}; ${words.map(shq).join(" ")}` : `${REMOTE_PATH}; ERGONEX_PERSONA=agent ergonex ${words.map(shq).join(" ")}`;
    const r = await sshRun(parsed.value, knownHostsOf(ctx.home), command, { timeoutMs: seconds * 1000, ...(args.options.identity === undefined ? {} : { identity: args.options.identity }) });
    if (r.code === 255) return err({ kind: "environment", message: `the machine could not be reached: ${r.stderr.trim().split("\n")[0] ?? ""}` });
    const env = envelopeOf(r.stdout);
    const findings = r.code === 0 ? [] : [finding(ctx, "Warning", `the command ended with status ${r.code}`, nameOf(parsed.value))];
    return ok({ text: r.stdout.trimEnd(), data: jsonOf({ status: r.code, envelope: env === undefined ? null : env.whole, stdout: env === undefined ? r.stdout : null, stderr: r.stderr }), findings });
  },
});

const TOKEN_OPTIONS = { ...HOME, tokenStdin: flag({ help: "Read the new token from standard input." }), expiresAt: value({ help: "When the new token expires (ISO 8601).", valueName: "TIME" }), identity: value({ help: "The private key file ssh logs in with.", valueName: "FILE" }) };

const tokenRefresh = defineCommand({
  name: "refresh",
  summary: "Rewrite the token file on the machine atomically from standard input (a GitHub App installation token lasts one hour); the App's private key never goes there.",
  options: TOKEN_OPTIONS,
  operands: TARGET,
  action: changes({ idempotent: true }),
  run: async (ctx, args): Promise<Outcome> => {
    const parsed = parseTarget(args.positionals[0] ?? "");
    if (parsed.kind === "err") return err({ kind: "usage", message: parsed.error });
    const denied = mayReach(ctx, parsed.value);
    if (denied !== undefined) return err({ kind: "usage", message: denied });
    if (ctx.home === undefined) return err({ kind: "environment", message: "no root can be found: set ERGONEX_HOME, or give --home" });
    if (args.options.tokenStdin !== true) return err({ kind: "usage", message: "remote token refresh takes --token-stdin: the token is never an argument" });
    const token = tokenOf(await ctx.stdin());
    if (token === undefined) return err({ kind: "usage", message: "--token-stdin takes one line on standard input: the token" });
    const resolved = await resolveTarget(parsed.value);
    if (resolved.kind === "err") return err({ kind: "environment", message: resolved.error });
    const known = knownHostsOf(ctx.home);
    const opts = { timeoutMs: 60_000, ...(args.options.identity === undefined ? {} : { identity: args.options.identity }) };
    const r = await sshRun(parsed.value, known, writeSecretCommand(".config/ergonex/token", await sha256Text(`${token}\n`)), { ...opts, input: `${token}\n` });
    if (r.code !== 0) return err({ kind: "environment", message: `the token could not be written: ${redact(r.stderr.trim().split("\n")[0] ?? "", [token])}` });
    if (args.options.expiresAt !== undefined) {
      if (Number.isNaN(Date.parse(args.options.expiresAt))) return err({ kind: "usage", message: "--expires-at is a time in ISO 8601" });
      const iso = new Date(args.options.expiresAt).toISOString();
      await sshRun(parsed.value, known, writeSecretCommand(".config/ergonex/token.expires", await sha256Text(`${iso}\n`)), { ...opts, input: `${iso}\n` });
    }
    const status = r.stdout.trim() === "unchanged" ? "unchanged" : "changed";
    return ok({ text: `${status}: the token file on ${nameOf(parsed.value)} (the value is not shown)`, data: jsonOf({ target: nameOf(parsed.value), status }), findings: [] });
  },
});

/** The commands of the branch `remote`; `token` is the branch `remote token`, whose one command is `refresh`. */
export const remoteCommands = {
  bootstrap,
  run: remoteRun,
  token: (host: Parameters<typeof bootstrap>[0]) => ({ ...tokenBranchOf(host) }),
};

function tokenBranchOf(host: Parameters<typeof bootstrap>[0]): ReturnType<typeof branch> {
  return branch({ name: "token", summary: "The token on a machine: refresh it.", children: [tokenRefresh(host)] });
}
