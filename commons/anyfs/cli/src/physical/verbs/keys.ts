// Spec: 0007-anyfs-cli-keys FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * The verbs of the keys that signed merges need (commons anyfs-cli 0007-anyfs-cli-keys FR-001 to FR-006): `keygen` makes the signing key of a replica, `roster show|add|publish|fetch|rotate` keeps the roster of the keys
 * that are known and hands it from one computer to another through any store. A private key is written to a file for its owner only and never printed or sent; a roster holds public keys only; a key that arrives in a
 * roster from a store is taken only when its id was named with `--accept`, so that the check of the key (its id is told out of band) is a person's act and not a default. These verbs change a file of this computer and
 * come through the command line only, never through the tool server.
 *
 * @example
 * ```ts
 * import { keyVerbs } from "./keys.ts";
 * // keyVerbs(host).map((v) => v.name); // ["keygen", "roster"]
 * ```
 *
 * @module
 */
import { generateSigningKey, parseRoster, parseSigningKey, rosterText, signingKeyText, type KeyEntry, type KeyRoster } from "@intellectual-frontiers/anyfs/merge";
import { parseReplicaId } from "@intellectual-frontiers/anyfs/governance";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { branch, outcomeOf, type Command, type Context, type Node, type Outcome } from "@intellectual-frontiers/headless/logical";
import { value } from "@intellectual-frontiers/terminal/args";
import { exists, writeTextFile } from "@intellectual-frontiers/system/fs";
import { resolve } from "@intellectual-frontiers/system/path";
import { entryLine, finding, rotate as rotateRoster, takeEntries, usage, type Host } from "@intellectual-frontiers/anyfs-cli/logical";
import { bindAll, defineVerb } from "./common.ts";

const dry = (ctx: Context): boolean => ctx.mode !== "apply";

const msText = (name: string, text: string | undefined): Result<number | undefined, Outcome> => {
  if (text === undefined) return ok(undefined);
  const n = Number(text);
  return Number.isInteger(n) && n >= 0 ? ok(n) : err(usage(`${name} is ${text}: a whole number of milliseconds since 1970`));
};

async function readRoster(host: Host, file: string, what: string): Promise<Result<KeyRoster, Outcome>> {
  const read = await host.world.readLocalFile(file);
  if (read.kind === "err") return err(usage(`${what}: ${read.error}`));
  const roster = parseRoster(new TextDecoder().decode(read.value));
  return roster.kind === "err" ? err(usage(`${what} ${file}: ${roster.error}`)) : roster;
}

const idsOf = (text: string | undefined): ReadonlySet<string> => new Set((text ?? "").split(",").map((t) => t.trim()).filter((t) => t !== ""));

const keygen = (host: Host): Command =>
  defineVerb(host, {
    name: "keygen",
    id: "keygen",
    options: {
      replica: value({ valueName: "ID", help: "The replica the key speaks for: 32 hexadecimal digits." }),
      key: value({ valueName: "FILE", help: "The file to write the key to, readable by its owner only; a file that is there is never written over." }),
      notBefore: value({ valueName: "MS", help: "The instant the key begins to speak, in milliseconds since 1970." }),
      notAfter: value({ valueName: "MS", help: "The instant the key stops speaking." }),
    },
    operands: [],
    examples: [{ args: ["--replica", "0123456789abcdef0123456789abcdef", "--key", "a.key"], says: "Make the key of a replica; the entry for the roster is printed, the private key never." }],
    run: async (args, ctx, h) => {
      const replica = parseReplicaId(args.options.replica ?? "");
      if (replica.kind === "err" || args.options.key === undefined) return usage("keygen needs --replica (32 hexadecimal digits) and --key (the file to write)");
      const nb = msText("--not-before", args.options.notBefore);
      if (nb.kind === "err") return nb.error;
      const na = msText("--not-after", args.options.notAfter);
      if (na.kind === "err") return na.error;
      const file = resolve(h.world.cwd, args.options.key);
      if (await exists(file)) return finding("E-FILESYSTEM", `${args.options.key} is there already; a key is never written over`);
      if (dry(ctx)) return outcomeOf({ key: args.options.key, written: false }, { text: `would write a key for ${replica.value} to ${args.options.key}` });
      const made = await generateSigningKey(replica.value, { ...(nb.value === undefined ? {} : { notBefore: nb.value }), ...(na.value === undefined ? {} : { notAfter: na.value }) });
      await writeTextFile(file, signingKeyText(made), { mode: 0o600 });
      return outcomeOf({ key: args.options.key, entry: made.entry, written: true }, { text: `${JSON.stringify(made.entry, null, 2)}\nwrote the key to ${args.options.key} (readable by its owner only); the entry above is what the others add to their rosters` });
    },
  });

const show = (host: Host): Command =>
  defineVerb(host, {
    name: "show",
    id: "roster show",
    options: { at: value({ valueName: "MS", help: "The instant to judge the keys at; now where it is left out." }) },
    operands: [{ name: "ROSTER", help: "The file of the roster.", arity: "one" }],
    examples: [{ args: ["roster.json"], says: "Each key with the replica it speaks for and whether it speaks now." }],
    run: async (args, _ctx, h) => {
      const [file] = args.positionals;
      if (file === undefined) return usage("roster show needs the roster file");
      const at = msText("--at", args.options.at);
      if (at.kind === "err") return at.error;
      const roster = await readRoster(h, file, "the roster");
      if (roster.kind === "err") return roster.error;
      const now = at.value ?? Date.now();
      return outcomeOf({ at: now, keys: roster.value }, { text: roster.value.length === 0 ? "the roster is empty" : roster.value.map((e) => entryLine(e, now)).join("\n") });
    },
  });

/** The entries a file holds: a roster, one entry, or a signing key (only its public entry is read; the private part is never used). */
async function entriesOf(host: Host, file: string): Promise<Result<KeyRoster, Outcome>> {
  const read = await host.world.readLocalFile(file);
  if (read.kind === "err") return err(usage(read.error));
  const text = new TextDecoder().decode(read.value);
  const key = parseSigningKey(text);
  if (key.kind === "ok") return ok([key.value.entry]);
  const roster = parseRoster(text);
  if (roster.kind === "ok") return roster;
  const single = parseRoster(`[${text}]`);
  return single.kind === "ok" ? single : err(usage(`${file}: neither a roster, a key entry nor a signing key`));
}

const SAVED = (n: number, file: string): string => `${n} ${n === 1 ? "key" : "keys"} in ${file}`;

const add = (host: Host): Command =>
  defineVerb(host, {
    name: "add",
    id: "roster add",
    options: {},
    operands: [{ name: "ROSTER", help: "The roster file; made where it is not there.", arity: "one" }, { name: "SOURCE", help: "Files whose public keys to add: a roster, an entry or a signing key (its private part is not read out).", arity: "many" }],
    examples: [{ args: ["roster.json", "a.entry.json", "b.key"], says: "Add the keys of the two files to the roster." }],
    run: async (args, ctx, h) => {
      const [file, ...sources] = args.positionals;
      if (file === undefined || sources.length === 0) return usage("roster add needs the roster file and what to add");
      const abs = resolve(h.world.cwd, file);
      let roster: KeyRoster = [];
      if (await exists(abs)) {
        const held = await readRoster(h, file, "the roster");
        if (held.kind === "err") return held.error;
        roster = held.value;
      }
      const incoming: KeyEntry[] = [];
      for (const s of sources) {
        const e = await entriesOf(h, s);
        if (e.kind === "err") return e.error;
        incoming.push(...e.value);
      }
      const taken = takeEntries(roster, incoming, new Set(incoming.map((e) => e.keyId)));
      if (taken.kind === "err") return finding("E-FILESYSTEM", taken.error);
      if (dry(ctx)) return outcomeOf({ added: taken.value.added.length, written: false }, { text: `would add ${taken.value.added.length} of ${incoming.length}; ${SAVED(taken.value.roster.length, file)}` });
      await writeTextFile(abs, rosterText(taken.value.roster));
      return outcomeOf({ added: taken.value.added, written: true }, { text: `added ${taken.value.added.length} of ${incoming.length}; ${SAVED(taken.value.roster.length, file)}` });
    },
  });

const publish = (host: Host): Command =>
  defineVerb(host, {
    name: "publish",
    id: "roster publish",
    options: {},
    operands: [{ name: "ROSTER", help: "The roster file.", arity: "one" }, { name: "LOCATION", help: "The file of a store to write it to, so that the others can fetch it.", arity: "one" }],
    examples: [{ args: ["roster.json", "shared:/keys/roster.json"], says: "Put the roster, public keys only, on the shared store." }],
    run: async (args, ctx, h) => {
      const [file, to] = args.positionals;
      if (file === undefined || to === undefined) return usage("roster publish needs the roster file and where to put it");
      const roster = await readRoster(h, file, "the roster");
      if (roster.kind === "err") return roster.error;
      const bound = await bindAll(h, [to]);
      if (bound.kind === "err") return bound.error;
      const dst = bound.value[0];
      if (dst === undefined) return usage("roster publish needs where to put it");
      const bytes = new TextEncoder().encode(rosterText(roster.value));
      if (dry(ctx)) return outcomeOf({ keys: roster.value.length, written: false }, { text: `would write ${SAVED(roster.value.length, dst.text)}` });
      const done = await dst.view.writeFile(dst.inner, bytes, {});
      if (done.kind === "err") return finding("E-FILESYSTEM", `${dst.text}: ${String(done.error)}`);
      return outcomeOf({ keys: roster.value.length, written: true, location: dst.text }, { text: `wrote ${SAVED(roster.value.length, dst.text)}` });
    },
  });

const fetch = (host: Host): Command =>
  defineVerb(host, {
    name: "fetch",
    id: "roster fetch",
    options: { accept: value({ valueName: "KEYID[,KEYID]", help: "The ids of the new keys to take in, as you checked them with their owners by another way than the store. A new key not named here is only shown." }) },
    operands: [{ name: "ROSTER", help: "The roster file; made where it is not there.", arity: "one" }, { name: "LOCATION", help: "The file of a store that holds a roster.", arity: "one" }],
    examples: [{ args: ["roster.json", "shared:/keys/roster.json"], says: "Show the keys the shared roster has that yours has not; nothing is added." }, { args: ["--accept", "0123456789abcdef", "roster.json", "shared:/keys/roster.json"], says: "Take in the one key you checked." }],
    run: async (args, ctx, h) => {
      const [file, from] = args.positionals;
      if (file === undefined || from === undefined) return usage("roster fetch needs the roster file and where to read from");
      const abs = resolve(h.world.cwd, file);
      const held = (await exists(abs)) ? await readRoster(h, file, "the roster") : ok<KeyRoster>([]);
      if (held.kind === "err") return held.error;
      const bound = await bindAll(h, [from]);
      if (bound.kind === "err") return bound.error;
      const src = bound.value[0];
      if (src === undefined) return usage("roster fetch needs where to read from");
      const read = await src.view.readFile(src.inner);
      if (read.kind === "err") return finding("E-FILESYSTEM", `${src.text}: ${String(read.error)}`);
      const theirs = parseRoster(new TextDecoder().decode(read.value.value));
      if (theirs.kind === "err") return finding("E-FILESYSTEM", `${src.text}: ${theirs.error}`);
      const taken = takeEntries(held.value, theirs.value, idsOf(args.options.accept));
      if (taken.kind === "err") return finding("E-FILESYSTEM", `${src.text}: ${taken.error}`);
      const t = taken.value;
      const lines = [...t.added.map((e) => `added    ${e.replica}  ${e.keyId}`), ...t.pending.map((e) => `pending  ${e.replica}  ${e.keyId}  (check the key with its owner, then --accept ${e.keyId})`)];
      const text = `${t.known.length} known, ${t.added.length} added, ${t.pending.length} pending${lines.length === 0 ? "" : `\n${lines.join("\n")}`}`;
      if (!dry(ctx) && t.added.length > 0) await writeTextFile(abs, rosterText(t.roster));
      return outcomeOf({ known: t.known.length, added: t.added, pending: t.pending, written: !dry(ctx) && t.added.length > 0 }, { text });
    },
  });

const rotateVerb = (host: Host): Command =>
  defineVerb(host, {
    name: "rotate",
    id: "roster rotate",
    options: {
      key: value({ valueName: "FILE", help: "The file to write the new key to, readable by its owner only; never written over a file that is there." }),
      at: value({ valueName: "MS", help: "The instant the old key stops and the new one starts; now where it is left out." }),
    },
    operands: [{ name: "ROSTER", help: "The roster file.", arity: "one" }, { name: "KEYID", help: "The id of the key to replace.", arity: "one" }],
    examples: [{ args: ["--key", "a2.key", "roster.json", "0123456789abcdef"], says: "Make a new key for the same replica; the old one stops speaking now and the new one starts a millisecond after, so what the old one signed still holds." }],
    run: async (args, ctx, h) => {
      const [file, keyId] = args.positionals;
      if (file === undefined || keyId === undefined || args.options.key === undefined) return usage("roster rotate needs the roster file, the key id and --key");
      const at = msText("--at", args.options.at);
      if (at.kind === "err") return at.error;
      const roster = await readRoster(h, file, "the roster");
      if (roster.kind === "err") return roster.error;
      const old = roster.value.find((e) => e.keyId === keyId);
      if (old === undefined) return finding("E-FILESYSTEM", `the roster has no key ${keyId}`);
      const keyFile = resolve(h.world.cwd, args.options.key);
      if (await exists(keyFile)) return finding("E-FILESYSTEM", `${args.options.key} is there already; a key is never written over`);
      const instant = at.value ?? Date.now();
      if (dry(ctx)) return outcomeOf({ replica: old.replica, retired: keyId, at: instant, written: false }, { text: `would end the key ${keyId} of ${old.replica} at ${instant} and start a new one` });
      const fresh = await generateSigningKey(old.replica);
      const rotated = rotateRoster(roster.value, keyId, fresh.entry, instant);
      if (rotated.kind === "err") return finding("E-FILESYSTEM", rotated.error);
      await writeTextFile(keyFile, signingKeyText(fresh), { mode: 0o600 });
      await writeTextFile(resolve(h.world.cwd, file), rosterText(rotated.value.roster));
      return outcomeOf({ replica: old.replica, retired: rotated.value.retired, started: rotated.value.started, written: true }, { text: `the key ${keyId} of ${old.replica} ends at ${instant}; the new key ${fresh.entry.keyId} starts at ${instant + 1} (private key in ${args.options.key})\nnext: publish the roster, give the replica the new key (--sign-key), and delete the old key file once nothing signs with it` });
    },
  });

/** The verbs of keys and rosters. */
export function keyVerbs(host: Host): readonly Node[] {
  return [keygen(host), branch({ name: "roster", summary: "The roster of the keys that are known: show it, add keys, publish it to a store, fetch one, and rotate a key.", children: [show(host), add(host), publish(host), fetch(host), rotateVerb(host)] })];
}
