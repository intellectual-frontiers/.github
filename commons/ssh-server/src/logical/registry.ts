// Spec: 0002-enrollment-protocol FR-001, FR-002, FR-003, FR-009, FR-010, FR-011, FR-012
/**
 * The registry of service commands: a closed set at runtime, each command a typed definition with its own decoder, its authentication requirement, the effects it may ask for and its audit kind. Adding a command is adding a definition
 * here or in the code that builds the server; `commandOf` and `runCommand` never change. There is no shell syntax anywhere in a command, and a command that is not in the registry does not exist.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import type { Result } from "@intellectual-frontiers/core";
import { MAX_COMMAND, WORD, decodeFacts, parsePublicKeyLine, wordsOf } from "@intellectual-frontiers/ssh-server/governance";
import type { AuditKind, AuthRequirement, Binding, Decode, EffectKind, EnrollPolicy, EnrollmentSession, Facts, InstallPlan, KnownAsset, OfferedKey, ServerPolicy, ServiceAccount, ServiceCommand, SessionId } from "@intellectual-frontiers/ssh-server/governance";
import { classifyClient, factsDrift } from "./decide.ts";
import { decodeMessage, line, step } from "./dialogue.ts";
import type { Effect, Reply } from "./dialogue.ts";
import type { Pin } from "./pins.ts";
import { renderBootstrapPs } from "./script-ps.ts";
import { renderBootstrapSh } from "./script-sh.ts";
import { PAIRING, TOKEN } from "./tokens.ts";
import { pairCommit, pairReveal, tofuPairing } from "./pairing.ts";
import type { CryptoPort } from "./pairing.ts";

/** The shape of a session id. */
export const SESSION_ID = /^en-[a-z2-7]{16}$/;

/** What a command runs with. The server builds it; a test builds it by hand. */
export type CommandContext = {
  readonly now: number;
  readonly policy: ServerPolicy;
  readonly enroll: EnrollPolicy;
  readonly registry: Registry;
  readonly pins: readonly Pin[];
  readonly account: ServiceAccount;
  readonly sourceIp: string;
  readonly clientIdent: string;
  /** The keys the client offered, with `proven` set only where a signature verified. */
  readonly keys: readonly OfferedKey[];
  readonly neighbourMac?: string;
  readonly reverseDns?: string;
  /** The session a command names, loaded by the server. */
  readonly session?: EnrollmentSession;
  /** The asset a proven key belongs to. */
  readonly asset?: KnownAsset;
  readonly assets: readonly KnownAsset[];
  /** What a presented token or pairing code bound, after the store took it. */
  readonly grant?: Binding;
  readonly stdin: string;
  readonly crypto: CryptoPort;
  /** The public key of the host key of the server as `algo base64`. */
  readonly controllerHostKey: string;
  /** Whether the nonce of a reveal was not seen before (the server asks its store before the run). */
  readonly nonceFresh?: boolean;
  /** Whether the asset was found by a key announced by `rekey` that is not yet confirmed. */
  readonly viaPending?: boolean;
  readonly newId: () => SessionId;
  readonly planFor: (facts: Facts) => InstallPlan;
};

/** What a command gives: the reply, the effects, and whether the reply is a bootstrap script (the server hashes it and audits the hash). */
export type CommandOutcome = { readonly reply: Reply; readonly effects: readonly Effect[]; readonly script?: "sh" | "ps" };

/** A typed command definition. */
export type CommandDefinition<A> = {
  readonly name: string;
  readonly summary: string;
  /** The service account (the ssh username) that may run it, and the conversation it belongs to. */
  readonly account: ServiceAccount;
  readonly conversation: string;
  readonly auth: AuthRequirement;
  /** Whether a trailing `token=...` may come with it. */
  readonly acceptsToken?: boolean;
  /** A reserved command is in the registry, so that its name is held, and refuses to run. */
  readonly reserved?: boolean;
  readonly effects: readonly EffectKind[];
  readonly audit: AuditKind;
  /** Whether the server waits for the standard input (up to `maxStdinBytes`) before it runs the command. */
  readonly readsStdin?: boolean;
  readonly decode: Decode<A>;
  readonly sessionOf?: (args: A) => string | undefined;
  /** The nonce a stdin carries, so that the server can check that it was never used before. */
  readonly nonceOf?: (stdin: string) => string | undefined;
  readonly credentialOf?: (args: A) => string | undefined;
  readonly run: (ctx: CommandContext, args: A) => Result<CommandOutcome, string>;
};

/** A definition whose argument type is closed over. */
export type AnyCommand = Omit<CommandDefinition<unknown>, "sessionOf" | "credentialOf"> & {
  readonly sessionOf: (args: unknown) => string | undefined;
  readonly credentialOf: (args: unknown) => string | undefined;
};
/** The registry. */
export type Registry = ReadonlyMap<string, AnyCommand>;

/** Close a definition over its argument type, so that definitions of different arguments sit in one registry. */
export function defineCommand<A>(d: CommandDefinition<A>): AnyCommand {
  return {
    name: d.name,
    summary: d.summary,
    account: d.account,
    conversation: d.conversation,
    auth: d.auth,
    ...(d.acceptsToken === undefined ? {} : { acceptsToken: d.acceptsToken }),
    ...(d.reserved === undefined ? {} : { reserved: d.reserved }),
    effects: d.effects,
    audit: d.audit,
    ...(d.readsStdin === undefined ? {} : { readsStdin: d.readsStdin }),
    decode: d.decode,
    sessionOf: (a) => d.sessionOf?.(a as A),
    ...(d.nonceOf === undefined ? {} : { nonceOf: d.nonceOf }),
    credentialOf: (a) => d.credentialOf?.(a as A),
    run: (ctx, a) => d.run(ctx, a as A),
  };
}

/** Make a registry from definitions; a name twice, or a name outside the alphabet of a word, is an error. */
export function makeRegistry(defs: readonly AnyCommand[]): Result<Registry, string> {
  const m = new Map<string, AnyCommand>();
  for (const d of defs) {
    if (!WORD.test(d.name) || d.name.includes("=")) return err(`${d.name}: not a command name`);
    if (m.has(d.name)) return err(`${d.name}: defined twice`);
    m.set(d.name, d);
  }
  return ok(m);
}

/** Read a command line against a registry: the words, an optional trailing `token=`, the name and the arguments the definition decodes. */
export function commandOf(registry: Registry, text: unknown): Result<ServiceCommand, string> {
  const w = wordsOf(text);
  if (w.kind === "err") return w;
  let words = [...w.value];
  let token: string | undefined;
  const last = words[words.length - 1] as string;
  if (last.startsWith("token=")) {
    token = last.slice(6);
    if (!TOKEN.test(token)) return err("a token is tok-, 8 and 24 to 48 characters of base32");
    words = words.slice(0, -1);
  }
  const name = words[0] as string;
  const def = registry.get(name);
  if (def === undefined) return err(`unknown command ${name.slice(0, 32)}`);
  if (token !== undefined && def.acceptsToken !== true) return err(`${name} takes no token`);
  const args = def.decode(words.slice(1));
  if (args.kind === "err") return err(`${name}: ${args.error}`);
  return ok({ name, args: args.value, ...(token === undefined ? {} : { token }) });
}

/** A command that does not run, and the exit status it ends with. */
export type CommandRefusal = { readonly exit: number; readonly message: string };

/** Run a command: the authentication it requires is checked first, then the session it names (which must have been opened from this source), then its own code. */
export function runCommand(registry: Registry, cmd: ServiceCommand, ctx: CommandContext): Result<CommandOutcome, CommandRefusal> {
  const def = registry.get(cmd.name);
  if (def === undefined) return err({ exit: 64, message: "unknown command" });
  if (def.account !== ctx.account) return err({ exit: 77, message: `${def.name} is not run by ${ctx.account}` });
  if (def.reserved === true) return err({ exit: 69, message: `${def.name} is reserved and not built` });
  const proven = ctx.keys.filter((k) => k.proven);
  if (def.auth === "proven-key" && proven.length === 0) return err({ exit: 77, message: "this command needs a key that proved itself over this connection" });
  if (def.account === "s-device" && ctx.asset === undefined) return err({ exit: 77, message: "this command needs a key that an enrolled device proved" });
  if (ctx.viaPending === true && def.name !== "rekey-confirm") return err({ exit: 77, message: "a new key is confirmed with rekey-confirm before it is used" });
  if (def.auth === "pairing-code" && ctx.grant?.kind !== "pairing") return err({ exit: 77, message: "the pairing code is unknown, used or expired" });
  if (def.auth === "token" && ctx.grant?.kind !== "token") return err({ exit: 77, message: "a valid token is needed" });
  if (def.sessionOf(cmd.args) !== undefined && (ctx.session === undefined || ctx.session.sourceIp !== ctx.sourceIp)) return err({ exit: 66, message: "unknown session" });
  if (def.auth === "proven-key" && def.account === "s-enroll" && def.sessionOf(cmd.args) !== undefined && def.name !== "pair-commit") {
    const key = ctx.session?.deviceKey;
    if (key === undefined) return err({ exit: 77, message: "pair first: the session has no key yet" });
    if (!proven.some((k) => k.fingerprint === key)) return err({ exit: 66, message: "unknown session" });
  }
  const r = def.run(ctx, cmd.args);
  return r.kind === "ok" ? r : err({ exit: 65, message: r.error });
}

/** Open a session in the state `pending`. */
export function openSession(ctx: CommandContext, binding?: Binding): EnrollmentSession {
  return {
    id: ctx.newId(),
    state: "pending",
    sourceIp: ctx.sourceIp,
    clientIdent: ctx.clientIdent.slice(0, 128),
    deviceClass: classifyClient(ctx.clientIdent),
    offeredKeys: ctx.keys,
    ...(ctx.neighbourMac === undefined ? {} : { neighbourMac: ctx.neighbourMac }),
    ...(ctx.reverseDns === undefined ? {} : { reverseDns: ctx.reverseDns }),
    ...(binding === undefined ? {} : { binding }),
    createdAt: ctx.now,
    updatedAt: ctx.now,
    expiresAt: ctx.now + ctx.policy.sessionTtlMs,
  };
}

function aud(ctx: CommandContext, kind: "command" | "script" | "removal-request", detail: string, session?: string, outcome: "ok" | "refused" = "ok"): Effect {
  return { kind: "audit", event: { at: ctx.now, kind, sourceIp: ctx.sourceIp, ...(session === undefined ? {} : { session }), outcome, detail } };
}

const none: Decode<Record<string, never>> = (w) => (w.length === 0 ? ok({}) : err("takes no argument"));
const sessionArg: Decode<{ readonly session: string }> = (w) => (w.length === 1 && SESSION_ID.test(w[0] as string) ? ok({ session: w[0] as string }) : err("takes one session id (en- and 16 characters)"));

function bootstrap(shell: "sh" | "ps"): (ctx: CommandContext) => Result<CommandOutcome, string> {
  return (ctx) => {
    const s = openSession(ctx, ctx.grant);
    const render = shell === "sh" ? renderBootstrapSh : renderBootstrapPs;
    const text = render({ id: s.id }, ctx.pins, ctx.policy.endpoint, { brand: ctx.policy.brand, hostKey: ctx.controllerHostKey, pairing: ctx.policy.pairing });
    return ok({ reply: { stdout: text, stderr: "", exit: 0 }, effects: [{ kind: "put-session", session: s }, aud(ctx, "script", `bootstrap script for ${shell}`, s.id)], script: shell });
  };
}

/** One JSON line that is an object, within a size. */
function jsonLine(text: string, max: number): Result<Record<string, unknown>, string> {
  if (text.length > max) return err("the message is too large");
  try {
    const v: unknown = JSON.parse(text.trim());
    return typeof v === "object" && v !== null && !Array.isArray(v) ? ok(v as Record<string, unknown>) : err("the message is an object");
  } catch {
    return err("the message is not JSON");
  }
}

/** The built-in definitions. */
export const BUILTIN: readonly AnyCommand[] = [
  defineCommand<Record<string, never>>({
    name: "hello",
    account: "s-enroll",
    conversation: "enroll",
    summary: "say who answers and which commands exist",
    auth: "none",
    effects: ["audit"],
    audit: "hello",
    decode: none,
    run: (ctx) => {
      const names = [...ctx.registry.values()].filter((d) => d.account === ctx.account && d.reserved !== true).map((d) => `${d.name}\t${d.summary}`).join("\n");
      return ok({ reply: { stdout: `${ctx.policy.brand.name} enrollment\nyou are ${ctx.sourceIp}\n${names}\n`, stderr: "", exit: 0 }, effects: [aud(ctx, "command", "hello")] });
    },
  }),
  defineCommand<{ readonly session?: string }>({
    name: "status",
    account: "s-enroll",
    conversation: "enroll",
    summary: "say whether the door is open, or the state of a session",
    auth: "none",
    effects: ["audit"],
    audit: "status",
    decode: (w) => (w.length === 0 ? ok({}) : sessionArg(w)),
    sessionOf: (a) => a.session,
    run: (ctx, a) => ok({ reply: a.session === undefined || ctx.session === undefined ? line("READY") : line("STATE", ctx.session.state), effects: [] }),
  }),
  defineCommand<Record<string, never>>({
    name: "bootstrap",
    account: "s-enroll",
    conversation: "enroll",
    summary: "print the POSIX sh script that reports facts and, if a person agrees, installs",
    auth: "none",
    acceptsToken: true,
    effects: ["put-session", "audit"],
    audit: "script",
    decode: none,
    run: bootstrap("sh"),
  }),
  defineCommand<Record<string, never>>({
    name: "bootstrap-ps",
    account: "s-enroll",
    conversation: "enroll",
    summary: "print the PowerShell 7 script that reports facts and, if a person agrees, installs",
    auth: "none",
    acceptsToken: true,
    effects: ["put-session", "audit"],
    audit: "script",
    decode: none,
    run: bootstrap("ps"),
  }),
  defineCommand<{ readonly session: string }>({
    name: "report",
    account: "s-enroll",
    conversation: "enroll",
    readsStdin: true,
    summary: "take one JSON line on the standard input: the facts of the device, or its consent",
    auth: "proven-key",
    effects: ["put-session", "audit"],
    audit: "facts",
    decode: sessionArg,
    sessionOf: (a) => a.session,
    run: (ctx, a) => {
      const msg = decodeMessage("report", ctx.stdin, ctx.policy.maxStdinBytes);
      if (msg.kind === "err") return err(msg.error);
      const s = ctx.session as EnrollmentSession;
      const r = step(s, msg.value, { now: ctx.now, enroll: ctx.enroll, assets: ctx.assets, planFor: ctx.planFor, sourceIp: ctx.sourceIp });
      return r.kind === "ok" ? ok({ reply: r.value.reply, effects: r.value.effects }) : err(`${a.session}: ${r.error}`);
    },
  }),
  defineCommand<{ readonly session: string }>({
    name: "next",
    account: "s-enroll",
    conversation: "enroll",
    summary: "ask what to do next: wait, the typed install plan, or an end",
    auth: "proven-key",
    effects: ["audit"],
    audit: "plan",
    decode: sessionArg,
    sessionOf: (a) => a.session,
    run: (ctx) => {
      const r = step(ctx.session as EnrollmentSession, { type: "plan" }, { now: ctx.now, enroll: ctx.enroll, assets: ctx.assets, planFor: ctx.planFor, sourceIp: ctx.sourceIp });
      return r.kind === "ok" ? ok({ reply: r.value.reply, effects: r.value.effects }) : err(r.error);
    },
  }),
  defineCommand<{ readonly session: string }>({
    name: "done",
    account: "s-enroll",
    conversation: "enroll",
    readsStdin: true,
    summary: "take one JSON line on the standard input: the result of the install",
    auth: "proven-key",
    effects: ["put-session", "audit"],
    audit: "result",
    decode: sessionArg,
    sessionOf: (a) => a.session,
    run: (ctx) => {
      const msg = decodeMessage("done", ctx.stdin, ctx.policy.maxStdinBytes);
      if (msg.kind === "err") return err(msg.error);
      const r = step(ctx.session as EnrollmentSession, msg.value, { now: ctx.now, enroll: ctx.enroll, assets: ctx.assets, planFor: ctx.planFor, sourceIp: ctx.sourceIp });
      return r.kind === "ok" ? ok({ reply: r.value.reply, effects: r.value.effects }) : err(r.error);
    },
  }),
  defineCommand<{ readonly session: string }>({
    name: "pair-commit",
    summary: "the device commits to its key and the host key it saw (one JSON line); the controller answers with its own commitment",
    account: "s-enroll",
    conversation: "enroll",
    readsStdin: true,
    auth: "proven-key",
    effects: ["put-session", "audit"],
    audit: "pairing",
    decode: sessionArg,
    sessionOf: (a) => a.session,
    run: (ctx) => {
      const key = ctx.keys.find((k) => k.proven);
      const body = jsonLine(ctx.stdin, ctx.policy.maxStdinBytes);
      if (body.kind === "err") return body;
      if (key === undefined || body.value["type"] !== "pair-commit") return err("a pair-commit message is one JSON line with a commit");
      const r = pairCommit(ctx.session as EnrollmentSession, body.value["commit"], key.fingerprint, ctx.crypto, ctx.controllerHostKey, ctx.now, ctx.policy.pairingTtlMs);
      if (r.kind === "err") return r;
      return ok({ reply: r.value.kind === "ok" ? line("COMMIT", r.value.out["cc"] as string) : line("BURNED", r.value.detail), effects: r.value.effects });
    },
  }),
  defineCommand<{ readonly session: string }>({
    name: "pair-reveal",
    summary: "the device reveals its nonce, its key and the host key it saw; the controller reveals its nonce and its host key",
    account: "s-enroll",
    conversation: "enroll",
    readsStdin: true,
    auth: "proven-key",
    effects: ["put-session", "audit"],
    audit: "pairing",
    decode: sessionArg,
    sessionOf: (a) => a.session,
    nonceOf: (stdin) => {
      const b = jsonLine(stdin, 4096);
      return b.kind === "ok" && typeof b.value["nonce"] === "string" ? b.value["nonce"] : undefined;
    },
    run: (ctx) => {
      const key = ctx.keys.find((k) => k.proven);
      const body = jsonLine(ctx.stdin, ctx.policy.maxStdinBytes);
      if (body.kind === "err") return body;
      if (key === undefined || body.value["type"] !== "pair-reveal") return err("a pair-reveal message is one JSON line with a nonce, the device key and the host key");
      const r = pairReveal(ctx.session as EnrollmentSession, { nonce: body.value["nonce"], devicePub: body.value["devicePub"], hostKey: body.value["hostKey"] }, key.fingerprint, ctx.nonceFresh === true, ctx.crypto, ctx.policy.pairing, ctx.now);
      if (r.kind === "err") return r;
      if (r.value.kind === "burned") return ok({ reply: { stdout: `BURNED\t${r.value.detail}\n`, stderr: "", exit: 78 }, effects: r.value.effects });
      return ok({ reply: line("REVEAL", r.value.out["nc"] as string, r.value.out["controllerHostKey"] as string), effects: r.value.effects });
    },
  }),
  defineCommand<{ readonly code: string; readonly shell: "sh" | "ps" }>({
    name: "join",
    account: "s-enroll",
    conversation: "enroll",
    summary: "join with a pairing code shown on the controller: print the script, bound to what the code binds",
    auth: "pairing-code",
    effects: ["put-session", "audit"],
    audit: "join",
    decode: (w) => {
      if ((w.length !== 1 && w.length !== 2) || !PAIRING.test(w[0] as string)) return err("takes a pairing code (two words and four digits) and optionally sh or ps");
      if (w.length === 2 && w[1] !== "sh" && w[1] !== "ps") return err("the second word is sh or ps");
      return ok({ code: w[0] as string, shell: (w[1] ?? "sh") as "sh" | "ps" });
    },
    credentialOf: (a) => a.code,
    run: (ctx, a) => bootstrap(a.shell)(ctx),
  }),
  defineCommand<Record<string, never>>({
    name: "knock",
    account: "s-enroll",
    conversation: "enroll",
    summary: "for a device with only an ssh client: leave a pending session for a person, with what the connection shows",
    auth: "none",
    effects: ["put-session", "audit"],
    audit: "knock",
    decode: none,
    run: (ctx) => {
      const s = tofuPairing(openSession(ctx), ctx.crypto, ctx.policy.pairing, ctx.controllerHostKey, ctx.now, ctx.policy.pairingTtlMs);
      const text = `KNOCK\t${s.id}\t${s.deviceClass}\nCODE\t${s.pairing?.sas ?? ""}\nA person types this code into the controller to approve this device. This connection was not checked against the host key of the controller: on a network you do not trust, use the one-liner the controller prints.\n`;
      return ok({ reply: { stdout: text, stderr: "", exit: 0 }, effects: [{ kind: "put-session", session: s }, aud(ctx, "command", `knock from a ${s.deviceClass} client`, s.id)] });
    },
  }),
  defineCommand<Record<string, never>>({
    name: "checkin",
    account: "s-device",
    conversation: "checkin",
    readsStdin: true,
    summary: "periodic, by an enrolled device that proves its key: report facts drift, receive pending work",
    auth: "proven-key",
    effects: ["put-session", "put-asset", "audit"],
    audit: "checkin",
    decode: none,
    run: (ctx) => {
      const asset = ctx.asset as KnownAsset;
      const effects: Effect[] = [];
      let facts: Facts | undefined;
      if (ctx.stdin.trim() !== "") {
        let json: unknown;
        try {
          json = JSON.parse(ctx.stdin.trim());
        } catch {
          return err("the facts are not JSON");
        }
        const f = decodeFacts((json as { facts?: unknown } | null)?.facts ?? json);
        if (f.kind === "err") return err(f.error);
        facts = f.value;
      }
      const drift = facts !== undefined && asset.facts !== undefined ? factsDrift(asset.facts, facts) : [];
      if (facts !== undefined) effects.push({ kind: "put-asset", asset: { ...asset, facts } });
      let out = `OK\n${drift.map((d) => `DRIFT\t${d}\n`).join("")}${asset.rotate === true ? "ROTATE\tthe controller asks for a new key: run rekey\n" : ""}`;
      if (asset.pending !== undefined && asset.pending.steps.length > 0) {
        const s: EnrollmentSession = { ...openSession(ctx), state: "approved", plan: asset.pending, assetId: asset.id, decision: { outcome: "approve", by: "controller", at: ctx.now, explanation: "work queued for the asset" } };
        effects.push({ kind: "put-session", session: s });
        out += `WORK\t${s.id}\n`;
      }
      effects.push(aud(ctx, "command", `checkin of ${asset.id}, drift ${drift.length}`));
      return ok({ reply: { stdout: out, stderr: "", exit: 0 }, effects });
    },
  }),
  defineCommand<Record<string, never>>({
    name: "leave",
    account: "s-device",
    conversation: "enroll",
    summary: "an enrolled device asks to be removed: a person must confirm",
    auth: "proven-key",
    effects: ["put-asset", "request-removal", "audit"],
    audit: "leave",
    decode: none,
    run: (ctx) => {
      const asset = ctx.asset as KnownAsset;
      return ok({ reply: line("OK", "a person must confirm the removal"), effects: [{ kind: "put-asset", asset: { ...asset, removalRequested: true } }, { kind: "request-removal", assetId: asset.id }, aud(ctx, "removal-request", `removal requested for ${asset.id}`)] });
    },
  }),
  defineCommand<Record<string, never>>({
    name: "rekey",
    summary: "an enrolled device announces a new key, signed by being sent over a connection of its old key",
    account: "s-device",
    conversation: "rekey",
    readsStdin: true,
    auth: "proven-key",
    effects: ["put-asset", "audit"],
    audit: "checkin",
    decode: none,
    run: (ctx) => {
      const asset = ctx.asset as KnownAsset;
      const body = jsonLine(ctx.stdin, 4096);
      if (body.kind === "err") return body;
      const k = parsePublicKeyLine(body.value["publicKey"]);
      if (body.value["type"] !== "rekey" || k.kind === "err" || k.value.algo !== "ssh-ed25519") return err("a rekey message is one JSON line with an ssh-ed25519 public key");
      const fp = ctx.crypto.fingerprintOfLine(`${k.value.algo} ${k.value.base64}`);
      if (fp === undefined) return err("the key does not read");
      const next = { ...asset, pendingKeys: [fp] };
      return ok({ reply: line("OK", "connect with the new key and run rekey-confirm"), effects: [{ kind: "put-asset", asset: next }, aud(ctx, "command", `rekey announced for ${asset.id}`)] });
    },
  }),
  defineCommand<Record<string, never>>({
    name: "rekey-confirm",
    summary: "the device proves the new key by connecting with it: the controller swaps the old key for it",
    account: "s-device",
    conversation: "rekey",
    auth: "proven-key",
    effects: ["put-asset", "audit"],
    audit: "checkin",
    decode: none,
    run: (ctx) => {
      const asset = ctx.asset as KnownAsset;
      const fp = ctx.keys.find((k) => k.proven)?.fingerprint;
      if (ctx.viaPending !== true || fp === undefined) return err("there is no new key to confirm");
      const next: KnownAsset = { ...asset, keys: [fp], pendingKeys: [], rotate: false };
      return ok({ reply: line("OK", "the old key is replaced"), effects: [{ kind: "put-asset", asset: next }, aud(ctx, "command", `key of ${asset.id} replaced`)] });
    },
  }),
  defineCommand<Record<string, never>>({
    name: "revoke",
    summary: "an enrolled device revokes its own keys (lost or retired): nothing proves it again until a person enrolls it",
    account: "s-device",
    conversation: "rekey",
    auth: "proven-key",
    effects: ["put-asset", "audit"],
    audit: "leave",
    decode: none,
    run: (ctx) => {
      const asset = ctx.asset as KnownAsset;
      return ok({ reply: line("OK", "your keys are revoked"), effects: [{ kind: "put-asset", asset: { ...asset, keys: [], pendingKeys: [], revoked: true } }, aud(ctx, "command", `keys of ${asset.id} revoked by the device`)] });
    },
  }),
  defineCommand<Record<string, never>>({
    name: "tether",
    account: "s-device",
    conversation: "tether",
    summary: "reserved: an outbound reverse forward so that a controller can manage a device behind NAT (UNBUILT)",
    auth: "proven-key",
    reserved: true,
    effects: [],
    audit: "reserved",
    decode: none,
    run: () => err("reserved"),
  }),
];

/** The registry of the built-in commands. */
export function builtinRegistry(extra: readonly AnyCommand[] = []): Registry {
  const r = makeRegistry([...BUILTIN, ...extra]);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** The longest command line, so that a server can refuse before it reads. */
export { MAX_COMMAND };
