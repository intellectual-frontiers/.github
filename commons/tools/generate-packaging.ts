// Generate the packaging table from the packaging ontology (commons 0002-packaging, 0004-rules).
//
//     deno run --allow-read --allow-write commons/tools/generate-packaging.ts           write commons/generated/packaging.auto.toml, packaging.auto.sh, packaging.auto.ts,
//                                                                                       pins.auto.env, rules.auto.toml and install-record.auto.toml, and the Deno pins between
//                                                                                       the marked lines of bin/erga-bootstrap.sh and bin/erga-bootstrap.ps1
//     deno run --allow-read --allow-write commons/tools/generate-packaging.ts --check   exit 1, writing nothing, where a file is not what the ontology makes
//
// The ontology (commons/ontology/supply-chain/packaging/*.ttl) is the source; the generated files are never edited by hand. The TOML is for programs (a harness reads it),
// the shell fragment is for scripts that run before any harness exists, and the TypeScript module is for the machine setup (bin/setup/), which runs on Deno. The ontology is
// checked first: a rule it breaks stops the run (exit 2) with every finding named, as does an ontology that cannot be read. It imports nothing outside commons/tools.
import { assertNever, err, isKind, ok, pathOfUrl, readText, type Result, sortedText, writeAll } from "./core.ts";
import { Graph, parseInto, type SyntaxError } from "./turtle.ts";
import { decode, describe, type Finding, type PinName, type Table } from "./ontology.ts";
import { pinsBlock, pinsEnv, recordToml, rulesToml, shell, type Syntax, toml, typescript } from "./emit.ts";

const RUN = "deno run --allow-read --allow-write commons/tools/generate-packaging.ts";
const PINS_BLOCK = /# >>> pins\.auto >>>\n[\s\S]*?# <<< pins\.auto <<<\n/;

/** Where commons is: the folder above this file's (a copy of commons, a test's, generates into itself). */
export type Place = { readonly commons: string; readonly root: string; readonly name: string };
export function placeOf(url: URL): Place {
  const commons = Deno.realPathSync(pathOfUrl(new URL("..", url))).replace(/[\\/]$/, "");
  const root = commons.replace(/[\\/][^\\/]*$/, "");
  return { commons, root, name: commons.slice(root.length + 1) };
}

/** Why a run stops, and with what exit status. */
export type Stop =
  | { readonly kind: "unreadable"; readonly file: string; readonly error: SyntaxError }
  | { readonly kind: "broken"; readonly findings: readonly Finding[] }
  | { readonly kind: "no-block"; readonly script: string }
  | { readonly kind: "missing-pins"; readonly script: string; readonly pins: readonly string[] }
  | { readonly kind: "stale"; readonly files: readonly string[] };

export function exitStatus(s: Stop): number {
  switch (s.kind) {
    case "stale":
      return 1;
    case "unreadable":
    case "broken":
    case "no-block":
    case "missing-pins":
      return 2;
    default:
      return assertNever(s);
  }
}

export function report(s: Stop): string {
  switch (s.kind) {
    case "unreadable":
      return `the packaging ontology cannot be read: ${s.file}:${s.error.line}:${s.error.column}: ${s.error.message}\n`;
    case "broken":
      return "the packaging ontology breaks its own rules:\n" + s.findings.map((f) => `  - ${describe(f)}\n`).join("");
    case "no-block":
      return `${s.script} has no block between '# >>> pins.auto >>>' and '# <<< pins.auto <<<' to put the pins in\n`;
    case "missing-pins":
      return `${s.script} needs the pins ${s.pins.join(", ")}, which the ontology does not have\n`;
    case "stale":
      return s.files.map((f) => `${f} is not what the ontology makes; run: ${RUN}\n`).join("");
    default:
      return assertNever(s);
  }
}

/** The ontology's files read into one graph, and the SHA-256 of their names and bytes (`name NUL bytes`, file after file, in the order of their names). */
export async function load(dir: string): Promise<Result<{ graph: Graph; digest: string }, Stop>> {
  const names = sortedText([...Deno.readDirSync(dir)].map((e) => e.name).filter((n) => n.endsWith(".ttl") && isKind(`${dir}/${n}`, "file")));
  const graph = new Graph();
  const parts: Uint8Array[] = [];
  for (const name of names) {
    const data = Deno.readFileSync(`${dir}/${name}`);
    parts.push(new TextEncoder().encode(name), new Uint8Array([0]), data);
    const read = parseInto(graph, new TextDecoder("utf-8", { fatal: true }).decode(data));
    if (!read.ok) return err({ kind: "unreadable", file: name, error: read.error });
  }
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", all))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return ok({ graph, digest });
}

/** The bootstraps carry the pins they need between their marks, as a script piped from the internet has no file beside it. */
const SCRIPTS: readonly { readonly path: string; readonly pins: readonly string[]; readonly syntax: Syntax }[] = [
  { path: "bin/erga-bootstrap.sh", pins: ["deno"], syntax: "sh" },
  { path: "bin/erga-bootstrap.ps1", pins: ["deno"], syntax: "ps1" },
];

/** Every file the ontology makes, by its path from the repository's root, in the order they are written. */
export function wanted(place: Place, t: Table, digest: string): Result<ReadonlyMap<string, string>, Stop> {
  const want = new Map<string, string>([
    [`${place.name}/generated/packaging.auto.toml`, toml(t, digest)],
    [`${place.name}/generated/packaging.auto.sh`, shell(t, digest)],
    [`${place.name}/generated/packaging.auto.ts`, typescript(t, digest)],
    [`${place.name}/generated/pins.auto.env`, pinsEnv(t, digest)],
    [`${place.name}/generated/rules.auto.toml`, rulesToml(t, digest)],
    [`${place.name}/generated/install-record.auto.toml`, recordToml(t, digest)],
  ]);
  for (const script of SCRIPTS) {
    const path = `${place.root}/${script.path}`;
    if (!isKind(path, "file")) continue; // a copy of commons alone (a test's) has no scripts beside it
    const text = readText(path);
    if (!PINS_BLOCK.test(text)) return err({ kind: "no-block", script: script.path });
    const names: PinName[] = [];
    const missing: string[] = [];
    for (const n of script.pins) {
      const known = [...t.pins.keys()].find((k) => k === n);
      if (known === undefined) missing.push(n);
      else names.push(known);
    }
    if (missing.length > 0) return err({ kind: "missing-pins", script: script.path, pins: missing });
    const block = pinsBlock(t, names, script.syntax);
    want.set(script.path, text.replace(PINS_BLOCK, () => block));
  }
  return ok(want);
}

export async function main(argv: readonly string[], place: Place = placeOf(new URL(import.meta.url))): Promise<number> {
  const stop = (s: Stop): number => {
    writeAll(Deno.stderr, report(s));
    return exitStatus(s);
  };
  const loaded = await load(`${place.commons}/ontology/supply-chain/packaging`);
  if (!loaded.ok) return stop(loaded.error);
  const table = decode(loaded.value.graph);
  if (!table.ok) return stop({ kind: "broken", findings: table.error });
  const want = wanted(place, table.value, loaded.value.digest);
  if (!want.ok) return stop(want.error);
  const full = (rel: string): string => `${place.root}/${rel}`;
  if (argv.includes("--check")) {
    const stale = [...want.value].filter(([rel, text]) => !isKind(full(rel), "file") || readText(full(rel)) !== text).map(([rel]) => rel);
    return stale.length > 0 ? stop({ kind: "stale", files: stale }) : 0;
  }
  Deno.mkdirSync(`${place.commons}/generated`, { recursive: true });
  for (const [rel, text] of want.value) {
    Deno.writeTextFileSync(full(rel), text);
    writeAll(Deno.stdout, `wrote ${rel}\n`);
  }
  return 0;
}

if (import.meta.main) Deno.exit(await main(Deno.args));
