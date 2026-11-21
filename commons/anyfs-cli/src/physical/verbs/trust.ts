// Spec: 0005-anyfs-cli-merge-signing FR-001, FR-002
/**
 * Whom `merge` and `sync-medium` take changes from, and what they sign with (commons anyfs-cli 0005-anyfs-cli-merge-signing FR-001, FR-002): `--trust open|allowlist|signed` with `--replicas` for the replicas an allowlist or
 * a signed trust names, `--roster` for the keys that are known, and `--sign-key` for the keys that sign what is published. A key or a roster is always named by a file or by `env:NAME`, never given on the command line, so that
 * a secret is not in the history of a shell or the list of processes. Where the command line says nothing the mounts say it (`trust` in the mount table), and where neither says anything the stores keep the trust they were opened with.
 *
 * @example
 * ```ts
 * import { trustOptions } from "./trust.ts";
 * Object.keys(trustOptions); // ["trust", "roster", "signKey", "replicas"]
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Outcome } from "@intellectual-frontiers/headless/logical";
import { value } from "@intellectual-frontiers/terminal/args";
import { parseReplicaId, type ReplicaId, type Trust } from "@intellectual-frontiers/anyfs/governance";
import { makeSigner, parseRoster, parseSigningKey, rosterTrust, type Signer } from "@intellectual-frontiers/anyfs/merge";
import { type Host, type MountTrustInput, usage } from "@intellectual-frontiers/anyfs-cli/logical";

/** The options of a verb that takes changes from others or signs what it publishes. */
export const trustOptions = {
  trust: value({ valueName: "MODE", help: "Whom to take changes from: open (anyone), allowlist (the replicas of --replicas) or signed (the keys of --roster). Where it is left out the mount says, and where the mount says nothing the store keeps the trust it has." }),
  roster: value({ valueName: "FILE", help: "The keys that are known, as a file of a JSON list (or env:NAME, a variable that holds the text): for --trust signed." }),
  signKey: value({ valueName: "FILE[,FILE]", help: "The keys that sign what is published, each a file (or env:NAME, a variable that holds the key): a delta is signed with the key of the replica that made it. The key is never given on the command line." }),
  replicas: value({ valueName: "ID[,ID]", help: "The replicas that are taken changes from, by identity (32 hexadecimal digits); with --trust signed it narrows the roster." }),
};

/** What the command line said of trust. */
export type TrustFlags = { readonly trust?: string | undefined; readonly roster?: string | undefined; readonly signKey?: string | undefined; readonly replicas?: string | undefined };

/** The trust a side judges by and the keys that sign, as the command line and the mounts say them. */
export type Resolved = { readonly trust: Trust | undefined; readonly signers: readonly Signer[] };

async function textOf(host: Host, spec: string, what: string): Promise<Result<string, Outcome>> {
  if (spec.startsWith("env:")) {
    const v = host.env(spec.slice(4));
    return v === undefined ? err(usage(`${what}: the variable ${spec.slice(4)} is not set`)) : ok(v);
  }
  const read = await host.world.readLocalFile(spec);
  return read.kind === "err" ? err(usage(`${what}: ${read.error}`)) : ok(new TextDecoder().decode(read.value));
}

const idsOf = (text: string | readonly string[] | undefined): Result<readonly ReplicaId[], Outcome> => {
  const out: ReplicaId[] = [];
  for (const t of typeof text === "string" ? text.split(",").filter((s) => s !== "") : (text ?? [])) {
    const id = parseReplicaId(t.trim());
    if (id.kind === "err") return err(usage(`${t}: ${id.error}`));
    out.push(id.value);
  }
  return ok(out);
};

/** The trust and the signers for a side: the flags first, the mount's trust for what the flags leave out. */
export async function resolveTrust(host: Host, flags: TrustFlags, mount: MountTrustInput | undefined): Promise<Result<Resolved, Outcome>> {
  const mode = flags.trust ?? mount?.mode;
  if (mode !== undefined && mode !== "open" && mode !== "allowlist" && mode !== "signed") return err(usage(`--trust is ${mode}: open, allowlist or signed`));
  const rosterSpec = flags.roster ?? mount?.roster;
  const replicaSpec = flags.replicas !== undefined ? flags.replicas : mount?.replicas;
  const keySpecs = flags.signKey !== undefined ? flags.signKey.split(",").filter((s) => s !== "") : (mount?.signKeys ?? []);
  if (mode === undefined && flags.roster !== undefined) return err(usage("--roster needs --trust signed"));
  if (mode === undefined && flags.replicas !== undefined) return err(usage("--replicas needs --trust allowlist or --trust signed"));
  const signers: Signer[] = [];
  for (const spec of keySpecs) {
    const text = await textOf(host, spec, "--sign-key");
    if (text.kind === "err") return text;
    const key = parseSigningKey(text.value);
    if (key.kind === "err") return err(usage(`--sign-key ${spec.startsWith("env:") ? spec : "the file"}: ${key.error}`));
    signers.push(await makeSigner(key.value));
  }
  const replicas = idsOf(replicaSpec);
  if (replicas.kind === "err") return replicas;
  switch (mode) {
    case undefined:
      return ok({ trust: undefined, signers });
    case "open":
      return ok({ trust: { kind: "open" }, signers });
    case "allowlist":
      if (replicas.value.length === 0) return err(usage("--trust allowlist names the replicas with --replicas"));
      return ok({ trust: { kind: "allowlist", replicas: new Set(replicas.value) }, signers });
    case "signed": {
      if (rosterSpec === undefined) return err(usage("--trust signed names the keys with --roster"));
      const text = await textOf(host, rosterSpec, "--roster");
      if (text.kind === "err") return text;
      const roster = parseRoster(text.value);
      if (roster.kind === "err") return err(usage(`--roster: ${roster.error}`));
      return ok({ trust: rosterTrust(roster.value, replicas.value.length === 0 ? undefined : new Set(replicas.value)), signers });
    }
  }
}

/** The signers of two sides as one list: where both name a key of one replica the first is kept. */
export function signersOf(...sides: readonly Resolved[]): readonly Signer[] {
  const out: Signer[] = [];
  for (const s of sides) for (const x of s.signers) if (!out.some((o) => o.replica === x.replica)) out.push(x);
  return out;
}

/** A refusal outcome for a delta the trust refused, as a line. */
export const refusalLine = (side: string, o: { readonly kind: string; readonly refusal?: { readonly kind: string; readonly message: string } } | undefined): string =>
  o === undefined ? `${side}: nothing to take` : o.kind === "refused" && o.refusal !== undefined ? `${side}: refused (${o.refusal.kind}): ${o.refusal.message}` : `${side}: ${o.kind}`;


