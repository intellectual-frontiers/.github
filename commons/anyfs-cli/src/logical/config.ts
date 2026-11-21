// Spec: 0003-anyfs-cli-logical FR-001, FR-002
/**
 * The configuration of the `anyfs` program, written as code (commons anyfs-cli 0003-anyfs-cli-logical FR-001, FR-002): the file `anyfs.config.ts` exports `defineConfig({ ... })`, whose mounts name places (`fleet` is
 * `ssh://alpha.example.org/srv/fleet`), whose defaults bound a transfer, and whose `kinds` are the openers of stores that other libraries bring (`anyfs-git`, `anyfs-sql`, a bucket): so that a new backend is a line of the
 * configuration and no change to the program. `parseConfig` checks the whole of it and returns every problem it finds at once, never the first only.
 *
 * @example
 * ```ts
 * import { defineConfig, parseConfig } from "./config.ts";
 * const parsed = parseConfig(defineConfig({ mounts: [{ name: "scratch", place: "memory:scratch" }] }));
 * parsed.kind === "ok" && parsed.value.mounts.length; // 1
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Place, type PlaceKind, parsePlace, parseReplicaId } from "@intellectual-frontiers/anyfs/governance";
import type { AnyStore } from "@intellectual-frontiers/anyfs/logical";
import type { VerifyMode } from "@intellectual-frontiers/anyfs-bridge/logical";
import { type MountName, parseMountName } from "@intellectual-frontiers/anyfs-cli/governance";

/** Whom a store that merges takes changes from, and how it signs, as a mount says it: the mode, the file or variable (`env:NAME`) that holds the roster of keys, the replicas it takes from where the mode names them, and the files or variables of the keys it signs with (never the keys themselves). */
export type MountTrustInput = {
  readonly mode: "open" | "allowlist" | "signed";
  readonly roster?: string;
  readonly replicas?: readonly string[];
  readonly signKeys?: readonly string[];
};

/** A mount as it is written: its name, its place as text, and whether it may only be read. */
export type MountInput = { readonly name: string; readonly place: string; readonly readOnly?: boolean; readonly note?: string; readonly trust?: MountTrustInput };

/** A mount, checked. */
export type Mount = { readonly name: MountName; readonly place: Place; readonly readOnly: boolean; readonly note: string; readonly trust: MountTrustInput | undefined };

/** What a transfer is bounded by where the command line says nothing. */
export type Defaults = {
  /** At most this many actions at once. */
  readonly concurrency: number;
  readonly verify: VerifyMode;
  /** Files larger than this many bytes are left as they are, in a transfer; none means no limit. */
  readonly maxObjectBytes: number | undefined;
};

/** What an opener of stores is told. */
export type OpenerContext = {
  readonly env: (name: string) => string | undefined;
  /** The folder the program keeps its state in (the bases of two-way syncs, the ledgers of mirrors). */
  readonly stateDir: string;
};

/** The opener of the stores of one kind of place: brought by the library of the kind and listed in the `kinds` of the configuration. */
export type PlaceOpener = {
  readonly kind: PlaceKind;
  /** Opens the store at the root of the place. The place of a store of a folder or a host is its root: the path inside it is the command line's. */
  readonly open: (place: Place, context: OpenerContext) => Promise<Result<AnyStore, string>>;
};

/** How ssh is run: the files of known hosts and the program. */
export type SshInput = { readonly knownHosts?: string; readonly userKnownHosts?: string; readonly program?: string };

/** What `defineConfig` takes. */
export type ConfigInput = {
  readonly mounts?: readonly MountInput[];
  readonly defaults?: Partial<Defaults>;
  readonly kinds?: readonly PlaceOpener[];
  readonly ssh?: SshInput;
};

/** The configuration, checked. */
export type Config = {
  readonly mounts: readonly Mount[];
  readonly defaults: Defaults;
  readonly kinds: readonly PlaceOpener[];
  readonly ssh: SshInput;
};

/** The file the program looks for, from the working folder up. */
export const CONFIG_FILE = "anyfs.config.ts";

/** What a transfer is bounded by where nothing is said. */
export const DEFAULT_DEFAULTS: Defaults = { concurrency: 4, verify: "auto", maxObjectBytes: undefined };

/** The configuration as it is written: a typed identity, so that the editor checks the file. */
export function defineConfig(input: ConfigInput): ConfigInput {
  return input;
}

/** The configuration of no file: no mount, the default bounds, no opener but the program's own. */
export const EMPTY_CONFIG: Config = { mounts: [], defaults: DEFAULT_DEFAULTS, kinds: [], ssh: {} };

/** The trust of a mount, checked: a mode that is one of three, replicas that are identities where the mode takes them, a roster where the mode is signed, and keys named by a file or a variable. */
function checkTrust(mount: string, t: MountTrustInput | undefined, problems: string[]): MountTrustInput | undefined {
  if (t === undefined) return undefined;
  const bad = (what: string): void => void problems.push(`${mount}: trust ${what}`);
  if (t.mode !== "open" && t.mode !== "allowlist" && t.mode !== "signed") bad(`mode is ${String(t.mode)}: open, allowlist or signed`);
  for (const r of t.replicas ?? []) if (parseReplicaId(r).kind === "err") bad(`replica ${r} is not an identity (32 hexadecimal digits)`);
  if (t.mode === "allowlist" && (t.replicas ?? []).length === 0) bad("allowlist names the replicas it takes changes from");
  if (t.mode === "signed" && (t.roster === undefined || t.roster === "")) bad("signed names a roster of keys (a file, or env:NAME)");
  for (const k of t.signKeys ?? []) if (k === "" || k === "env:") bad("signKeys name a file or env:NAME each");
  return t;
}

/** Checks a configuration, and gives every problem found. */
export function parseConfig(input: ConfigInput): Result<Config, readonly string[]> {
  const problems: string[] = [];
  const mounts: Mount[] = [];
  const seen = new Set<string>();
  for (const m of input.mounts ?? []) {
    const name = parseMountName(m.name);
    if (name.kind === "err") {
      problems.push(name.error);
      continue;
    }
    if (seen.has(name.value)) {
      problems.push(`${name.value}: two mounts have this name`);
      continue;
    }
    seen.add(name.value);
    const place = parsePlace(m.place);
    if (place.kind === "err") {
      problems.push(`${name.value}: ${place.error}`);
      continue;
    }
    const trust = checkTrust(name.value, m.trust, problems);
    mounts.push({ name: name.value, place: place.value, readOnly: m.readOnly === true, note: m.note ?? "", trust });
  }
  const d = input.defaults ?? {};
  const concurrency = d.concurrency ?? DEFAULT_DEFAULTS.concurrency;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 64) problems.push(`defaults.concurrency is ${String(concurrency)}: a whole number from 1 to 64`);
  const verify = d.verify ?? DEFAULT_DEFAULTS.verify;
  if (verify !== "auto" && verify !== "read-back" && verify !== "none") problems.push(`defaults.verify is ${String(verify)}: auto, read-back or none`);
  const maxObjectBytes = d.maxObjectBytes ?? DEFAULT_DEFAULTS.maxObjectBytes;
  if (maxObjectBytes !== undefined && (!Number.isInteger(maxObjectBytes) || maxObjectBytes < 1)) problems.push(`defaults.maxObjectBytes is ${String(maxObjectBytes)}: a whole number of bytes, at least 1`);
  const kinds = input.kinds ?? [];
  const kindSeen = new Set<string>();
  for (const k of kinds) {
    if (kindSeen.has(k.kind)) problems.push(`kinds: two openers for ${k.kind}`);
    kindSeen.add(k.kind);
  }
  if (problems.length > 0) return err(problems);
  return ok({ mounts, defaults: { concurrency, verify, maxObjectBytes }, kinds, ssh: input.ssh ?? {} });
}
