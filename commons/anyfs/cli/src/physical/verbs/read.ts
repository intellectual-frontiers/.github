// Spec: 0004-anyfs-cli-surfaces FR-008
/**
 * The verbs of the program that only read (commons anyfs-cli 0004-anyfs-cli-surfaces FR-008): `ls`, `cat`, `stat`, `head`, `tail`, `find`, `du`, `tree`, `grep`, `diff` and `sha256sum`. Each works through the POSIX
 * view of the store its words point into, so every operation says how it was carried out; `cat`, `head` and `tail` write the bytes of a file as they are, to the port of standard output, and never through text.
 *
 * @example
 * ```ts
 * import { readVerbs } from "./read.ts";
 * // readVerbs(host).map((v) => v.name); // ["ls", "cat", "stat", ...]
 * ```
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { outcomeOf, type Command, type Outcome } from "@intellectual-frontiers/headless/logical";
import { flag, integerText, value, type Args } from "@intellectual-frontiers/terminal/args";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { joinPosix, type PosixPath, type PosixStat } from "@intellectual-frontiers/anyfs-posix/governance";
import { counted, drawTree, finding, humanSize, keep, matchingLines, looksLikeText, modeText, newTrail, parseSizeTest, sizePasses, table, type Host, type TreeNode, unifiedDiff, usage, wildcard } from "@intellectual-frontiers/anyfs-cli/logical";
import type { Bound } from "../bind.ts";
import { bindAll, defineVerb, explainOutcome, failed, POSIX_OPTIONS, withTrail, walk } from "./common.ts";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8");

/** The path a name is shown at: the word as typed, with what is below it. */
export function displayOf(b: Bound, p: PosixPath): string {
  const base = b.text.endsWith("/") ? b.text.slice(0, -1) : b.text;
  const rel = b.inner === "/" ? p : p.slice(b.inner.length);
  return `${base}${rel.startsWith("/") ? rel : `/${rel}`}`;
}

const shortRev = (rev: string | undefined): string => (rev === undefined ? "-" : rev.replace(/^sha256:/, "").slice(0, 12));
const timeOf = (m: string | undefined): string => (m === undefined ? "-" : m.slice(0, 19).replace("T", " "));
const words = (a: { readonly positionals: readonly string[] }, fallback: readonly string[]): readonly string[] => (a.positionals.length === 0 ? fallback : a.positionals);

type Row = { readonly name: string; readonly type: "file" | "dir"; readonly size: number | undefined; readonly mode: number | undefined; readonly mtime: string | undefined; readonly rev: string | undefined };

const rowOfStat = (name: string, s: PosixStat): Row => ({ name, type: s.type, size: s.type === "file" ? s.size : undefined, mode: s.mode, mtime: s.mtime, rev: s.rev });

function lsLine(r: Row, long: boolean, human: boolean): readonly string[] {
  const shown = r.type === "dir" ? `${r.name}/` : r.name;
  if (!long) return [shown];
  const size = r.size === undefined ? "-" : human ? humanSize(r.size) : String(r.size);
  return [r.mode === undefined ? "?" : modeText(r.type, r.mode), size, timeOf(r.mtime), shortRev(r.rev), shown];
}

const ls = (host: Host): Command =>
  defineVerb(host, {
    name: "ls",
    id: "ls",
    options: { long: flag({ short: "l", help: "One line for each name: mode, size, time, revision." }), recursive: flag({ short: "R", help: "Go into directories." }), human: flag({ help: "Sizes for a person (K, M, G)." }), ...POSIX_OPTIONS },
    operands: [{ name: "LOCATION", help: "A directory or a file: a path, a mount (name:/path) or an address (ssh://host/path). Here by default.", arity: "many" }],
    examples: [{ args: ["fleet:/machines"], says: "The names in the directory machines of the mount fleet." }, { args: ["-l", "ssh://alpha.example.org/srv/fleet"], says: "The same with their sizes, times and revisions." }],
    run: async (args, ctx) => {
      const bound = await bindAll(host, words(args, ["."]));
      if (bound.kind === "err") return bound.error;
      if (args.options.explain) return explainOutcome(bound.value, ["stat-file", "readdir"]);
      const trail = newTrail();
      const blocks: string[] = [];
      const data: { location: string; entries: Row[] }[] = [];
      for (const b of bound.value) {
        const st = keep(trail, "stat", b.inner, await b.view.stat(b.inner));
        if (st.kind === "err") return withTrail(failed(st.error), trail, args.options, ctx);
        const rows: Row[] = [];
        if (st.value.type === "file") rows.push(rowOfStat(displayOf(b, b.inner), st.value));
        else if (args.options.recursive) {
          const walked = await walk(b, b.inner, trail);
          if (walked.kind === "err") return walked.error;
          for (const w of walked.value) rows.push({ name: displayOf(b, w.path), type: w.entry.type, size: w.entry.size, mode: undefined, mtime: w.entry.mtime, rev: w.entry.rev });
        } else {
          const listed = keep(trail, "readdir", b.inner, await b.view.readdir(b.inner));
          if (listed.kind === "err") return withTrail(failed(listed.error), trail, args.options, ctx);
          for (const e of [...listed.value].sort((x, y) => (x.name < y.name ? -1 : 1))) {
            let mode: number | undefined;
            if (args.options.long) {
              const child = joinPosix(b.inner, e.name);
              const s = keep(trail, "stat", child, await b.view.stat(child));
              if (s.kind === "ok") mode = s.value.mode;
            }
            rows.push({ name: e.name, type: e.type, size: e.size, mode, mtime: e.mtime, rev: e.rev });
          }
        }
        data.push({ location: b.text, entries: rows });
        const text = args.options.long ? table(rows.map((r) => lsLine(r, true, args.options.human))) : rows.map((r) => lsLine(r, false, false)[0] ?? "").join("\n");
        blocks.push(bound.value.length > 1 ? `${b.text}:\n${text}` : text);
      }
      return withTrail(outcomeOf(data, { text: blocks.join("\n\n") }), trail, args.options, ctx);
    },
  });

const cat = (host: Host): Command =>
  defineVerb(host, {
    name: "cat",
    id: "cat",
    options: { ...POSIX_OPTIONS },
    operands: [{ name: "LOCATION", help: "A file of a store.", arity: "many" }],
    examples: [{ args: ["fleet:/machines/alpha.json"], says: "The bytes of the file, as they are, on standard output." }],
    run: async (args, ctx) => {
      if (args.positionals.length === 0) return usage("cat needs a file");
      const bound = await bindAll(host, args.positionals);
      if (bound.kind === "err") return bound.error;
      if (args.options.explain) return explainOutcome(bound.value, ["read-all"]);
      const trail = newTrail();
      const data: { location: string; size: number; sha256: string }[] = [];
      for (const b of bound.value) {
        const read = keep(trail, "read-all", b.inner, await b.view.readFile(b.inner));
        if (read.kind === "err") return withTrail(failed(read.error), trail, args.options, ctx);
        if (!host.world.json) host.world.writeStdout(read.value);
        data.push({ location: b.text, size: read.value.length, sha256: await sha256(read.value) });
      }
      return withTrail(outcomeOf(data), trail, args.options, ctx);
    },
  });

const stat = (host: Host): Command =>
  defineVerb(host, {
    name: "stat",
    id: "stat",
    options: { ...POSIX_OPTIONS },
    operands: [{ name: "LOCATION", help: "A name in a store.", arity: "many" }],
    examples: [{ args: ["fleet:/machines/alpha.json"], says: "Its type, size, mode, time and revision." }],
    run: async (args, ctx) => {
      if (args.positionals.length === 0) return usage("stat needs a name");
      const bound = await bindAll(host, args.positionals);
      if (bound.kind === "err") return bound.error;
      if (args.options.explain) return explainOutcome(bound.value, ["stat-file", "stat-dir"]);
      const trail = newTrail();
      const lines: string[] = [];
      const data: { location: string; type: string; size: number; mode: number; uid: number; gid: number; mtime: string | null; rev: string | null }[] = [];
      for (const b of bound.value) {
        const st = keep(trail, "stat", b.inner, await b.view.stat(b.inner));
        if (st.kind === "err") return withTrail(failed(st.error), trail, args.options, ctx);
        const s = st.value;
        lines.push(`${b.text}\n  type ${s.type}  size ${s.size}  mode ${modeText(s.type, s.mode)}  uid ${s.uid}  gid ${s.gid}\n  time ${s.mtime ?? "-"}  revision ${s.rev ?? "-"}`);
        data.push({ location: b.text, type: s.type, size: s.size, mode: s.mode, uid: s.uid, gid: s.gid, mtime: s.mtime ?? null, rev: s.rev ?? null });
      }
      return withTrail(outcomeOf(data, { text: lines.join("\n") }), trail, args.options, ctx);
    },
  });

/** The first `lines` lines of bytes, or the first `count` bytes, as bytes. */
export function firstOf(bytes: Uint8Array, lines: number | undefined, count: number | undefined): Uint8Array {
  if (count !== undefined) return bytes.slice(0, count);
  let seen = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 10 && ++seen === lines) return bytes.slice(0, i + 1);
  }
  return bytes;
}

/** The last `lines` lines of bytes, or the last `count` bytes, as bytes. */
export function lastOf(bytes: Uint8Array, lines: number | undefined, count: number | undefined): Uint8Array {
  if (count !== undefined) return bytes.slice(Math.max(0, bytes.length - count));
  let end = bytes.length;
  if (end > 0 && bytes[end - 1] === 10) end--;
  let seen = 0;
  for (let i = end - 1; i >= 0; i--) {
    if (bytes[i] === 10 && ++seen === lines) return bytes.slice(i + 1);
  }
  return bytes;
}

const slice = (name: "head" | "tail", host: Host): Command =>
  defineVerb(host, {
    name,
    id: name,
    options: { lines: value({ short: "n", parse: integerText, default: 10, valueName: "N", help: `The ${name === "head" ? "first" : "last"} N lines (10 by default).` }), bytes: value({ short: "c", parse: integerText, valueName: "N", help: `The ${name === "head" ? "first" : "last"} N bytes instead of lines.` }), ...POSIX_OPTIONS },
    operands: [{ name: "LOCATION", help: "A file of a store.", arity: "many" }],
    examples: [{ args: ["-n", "5", "fleet:/machines/alpha.json"], says: `The ${name === "head" ? "first" : "last"} five lines.` }],
    run: async (args, ctx) => {
      if (args.positionals.length === 0) return usage(`${name} needs a file`);
      if (args.options.lines < 0 || (args.options.bytes !== undefined && args.options.bytes < 0)) return usage("a count is not negative");
      const bound = await bindAll(host, args.positionals);
      if (bound.kind === "err") return bound.error;
      if (args.options.explain) return explainOutcome(bound.value, ["read-all"]);
      const trail = newTrail();
      const data: { location: string; bytes: number }[] = [];
      for (const b of bound.value) {
        const read = keep(trail, "read-all", b.inner, await b.view.readFile(b.inner));
        if (read.kind === "err") return withTrail(failed(read.error), trail, args.options, ctx);
        const part = name === "head" ? firstOf(read.value, args.options.lines, args.options.bytes) : lastOf(read.value, args.options.lines, args.options.bytes);
        if (!host.world.json) {
          if (bound.value.length > 1) host.world.writeStdout(ENCODER.encode(`==> ${b.text} <==\n`));
          host.world.writeStdout(part);
        }
        data.push({ location: b.text, bytes: part.length });
      }
      return withTrail(outcomeOf(data), trail, args.options, ctx);
    },
  });

const parseType = (t: string): Result<"f" | "d", string> => (t === "f" || t === "d" ? ok(t) : err("expected f (file) or d (directory)"));

const find = (host: Host): Command =>
  defineVerb(host, {
    name: "find",
    id: "find",
    options: {
      name: value({ valueName: "WILDCARD", help: "Only names that match a wildcard (* and ?), by their last word." }),
      type: value({ parse: parseType, valueName: "f|d", help: "Only files (f) or directories (d)." }),
      size: value({ valueName: "TEST", help: "Only files by size: +N over, -N under, N exactly; K, M or G after the number." }),
      maxdepth: value({ parse: integerText, valueName: "N", help: "Go down at most N directories." }),
      ...POSIX_OPTIONS,
    },
    operands: [{ name: "LOCATION", help: "A directory to look below. Here by default.", arity: "many" }],
    examples: [{ args: ["fleet:/", "--name", "*.json", "--type", "f"], says: "Every JSON file below the root of the mount fleet." }],
    run: async (args, ctx) => {
      const size = args.options.size === undefined ? undefined : parseSizeTest(args.options.size);
      if (size !== undefined && size.kind === "err") return usage(size.error);
      const bound = await bindAll(host, words(args, ["."]));
      if (bound.kind === "err") return bound.error;
      if (args.options.explain) return explainOutcome(bound.value, ["readdir"]);
      const trail = newTrail();
      const found: { path: string; type: string; size: number | null }[] = [];
      for (const b of bound.value) {
        const walked = await walk(b, b.inner, trail, args.options.maxdepth === undefined ? {} : { maxDepth: args.options.maxdepth });
        if (walked.kind === "err") return walked.error;
        for (const w of walked.value) {
          if (args.options.type !== undefined && (args.options.type === "f" ? "file" : "dir") !== w.entry.type) continue;
          if (args.options.name !== undefined && !wildcard(args.options.name, w.entry.name)) continue;
          if (size !== undefined && (w.entry.type !== "file" || w.entry.size === undefined || !sizePasses(size.value, w.entry.size))) continue;
          found.push({ path: displayOf(b, w.path), type: w.entry.type, size: w.entry.size ?? null });
        }
      }
      return withTrail(outcomeOf(found, { text: found.map((f) => f.path).join("\n") }), trail, args.options, ctx);
    },
  });

const du = (host: Host): Command =>
  defineVerb(host, {
    name: "du",
    id: "du",
    options: { summarize: flag({ short: "s", help: "Only the total of each argument." }), human: flag({ help: "Sizes for a person (K, M, G)." }), ...POSIX_OPTIONS },
    operands: [{ name: "LOCATION", help: "A directory or a file. Here by default.", arity: "many" }],
    examples: [{ args: ["-s", "--human", "fleet:/"], says: "How much is in the mount fleet." }],
    run: async (args, ctx) => {
      const bound = await bindAll(host, words(args, ["."]));
      if (bound.kind === "err") return bound.error;
      if (args.options.explain) return explainOutcome(bound.value, ["readdir"]);
      const trail = newTrail();
      const shown = (n: number): string => (args.options.human ? humanSize(n) : String(n));
      const lines: string[] = [];
      const data: { path: string; bytes: number; files: number }[] = [];
      for (const b of bound.value) {
        const st = keep(trail, "stat", b.inner, await b.view.stat(b.inner));
        if (st.kind === "err") return withTrail(failed(st.error), trail, args.options, ctx);
        if (st.value.type === "file") {
          lines.push(`${shown(st.value.size)}\t${b.text}`);
          data.push({ path: b.text, bytes: st.value.size, files: 1 });
          continue;
        }
        const walked = await walk(b, b.inner, trail);
        if (walked.kind === "err") return walked.error;
        const sums = new Map<string, { bytes: number; files: number }>();
        const add = (dir: string, size: number): void => {
          const s = sums.get(dir) ?? { bytes: 0, files: 0 };
          sums.set(dir, { bytes: s.bytes + size, files: s.files + 1 });
        };
        for (const w of walked.value) {
          if (w.entry.type !== "file") continue;
          let dir: string = w.path;
          const size = w.entry.size ?? 0;
          while (dir.length >= b.inner.length && dir !== "/") {
            dir = dir.slice(0, dir.lastIndexOf("/")) === "" ? "/" : dir.slice(0, dir.lastIndexOf("/"));
            add(dir, size);
            if (dir === b.inner || dir === "/") break;
          }
        }
        const all = [...sums.entries()].sort(([x], [y]) => (x < y ? -1 : 1));
        const total = sums.get(b.inner) ?? { bytes: 0, files: 0 };
        for (const [dir, s] of args.options.summarize ? [] : all) {
          lines.push(`${shown(s.bytes)}\t${displayOf(b, dir as PosixPath)}`);
          data.push({ path: displayOf(b, dir as PosixPath), bytes: s.bytes, files: s.files });
        }
        if (args.options.summarize) {
          lines.push(`${shown(total.bytes)}\t${b.text}`);
          data.push({ path: b.text, bytes: total.bytes, files: total.files });
        }
      }
      return withTrail(outcomeOf(data, { text: lines.join("\n") }), trail, args.options, ctx);
    },
  });

const tree = (host: Host): Command =>
  defineVerb(host, {
    name: "tree",
    id: "tree",
    options: { depth: value({ short: "L", parse: integerText, valueName: "N", help: "Go down at most N directories." }), ...POSIX_OPTIONS },
    operands: [{ name: "LOCATION", help: "A directory. Here by default.", arity: "many" }],
    examples: [{ args: ["-L", "2", "fleet:/"], says: "Two levels of the mount fleet, drawn." }],
    run: async (args, ctx) => {
      const bound = await bindAll(host, words(args, ["."]));
      if (bound.kind === "err") return bound.error;
      if (args.options.explain) return explainOutcome(bound.value, ["readdir"]);
      const trail = newTrail();
      const blocks: string[] = [];
      const data: { location: string; directories: number; files: number }[] = [];
      for (const b of bound.value) {
        const walked = await walk(b, b.inner, trail, args.options.depth === undefined ? {} : { maxDepth: args.options.depth });
        if (walked.kind === "err") return walked.error;
        const make = (dir: PosixPath, depth: number): readonly TreeNode[] =>
          walked.value
            .filter((w) => w.depth === depth && w.path.startsWith(dir === "/" ? "/" : `${dir}/`) && w.path.slice(dir === "/" ? 1 : dir.length + 1).indexOf("/") === -1)
            .map((w) => ({ name: w.entry.type === "dir" ? `${w.entry.name}/` : w.entry.name, children: w.entry.type === "dir" ? make(w.path, depth + 1) : [] }));
        const lines = drawTree({ name: b.text, children: make(b.inner, 1) });
        const dirs = walked.value.filter((w) => w.entry.type === "dir").length;
        const files = walked.value.length - dirs;
        blocks.push(`${lines.join("\n")}\n\n${counted(dirs, "directory", "directories")}, ${counted(files, "file")}`);
        data.push({ location: b.text, directories: dirs, files });
      }
      return withTrail(outcomeOf(data, { text: blocks.join("\n\n") }), trail, args.options, ctx);
    },
  });

const grep = (host: Host): Command =>
  defineVerb(host, {
    name: "grep",
    id: "grep",
    options: {
      ignoreCase: flag({ short: "i", help: "Ignore the case of letters." }),
      lineNumber: flag({ short: "n", help: "Write the number of each line." }),
      filesWithMatches: flag({ short: "l", help: "Only the names of files that hold the text." }),
      count: flag({ short: "c", help: "Only how many lines each file holds." }),
      recursive: flag({ short: "r", help: "Go into directories." }),
      maxFiles: value({ parse: integerText, default: 10_000, valueName: "N", help: "Look in at most N files (10000 by default)." }),
      maxBytes: value({ parse: integerText, default: 8_388_608, valueName: "N", help: "Skip files larger than N bytes (8 MiB by default)." }),
      ...POSIX_OPTIONS,
    },
    operands: [
      { name: "TEXT", help: "The text to look for, as it is written: not a pattern.", arity: "one" },
      { name: "LOCATION", help: "Files or directories (with -r) to look in.", arity: "many" },
    ],
    examples: [{ args: ["-rn", "ssh-ed25519", "fleet:/keys"], says: "Every line below keys that holds ssh-ed25519, with its number." }],
    run: async (args, ctx) => {
      const needle = args.positionals[0];
      if (needle === undefined || needle === "") return usage("grep needs the text to look for");
      const bound = await bindAll(host, words({ positionals: args.positionals.slice(1) }, ["."]));
      if (bound.kind === "err") return bound.error;
      if (args.options.explain) return explainOutcome(bound.value, ["readdir", "read-all"]);
      const trail = newTrail();
      const lines: string[] = [];
      const data: { path: string; lines: { line: number; text: string }[] }[] = [];
      let looked = 0;
      let skipped = 0;
      for (const b of bound.value) {
        const st = keep(trail, "stat", b.inner, await b.view.stat(b.inner));
        if (st.kind === "err") return withTrail(failed(st.error), trail, args.options, ctx);
        let files: { path: PosixPath; size: number | undefined }[] = [{ path: b.inner, size: st.value.size }];
        if (st.value.type === "dir") {
          if (!args.options.recursive) return finding("E-FILESYSTEM", `EISDIR ${b.text}: is a directory; use -r to look in it`);
          const walked = await walk(b, b.inner, trail);
          if (walked.kind === "err") return walked.error;
          files = walked.value.filter((w) => w.entry.type === "file").map((w) => ({ path: w.path, size: w.entry.size }));
        }
        for (const f of files) {
          if (looked >= args.options.maxFiles) break;
          if (f.size !== undefined && f.size > args.options.maxBytes) {
            skipped++;
            continue;
          }
          const read = keep(trail, "read-all", f.path, await b.view.readFile(f.path));
          if (read.kind === "err") return withTrail(failed(read.error), trail, args.options, ctx);
          looked++;
          if (!looksLikeText(read.value)) {
            skipped++;
            continue;
          }
          const hits = matchingLines(DECODER.decode(read.value), needle, args.options.ignoreCase);
          if (hits.length === 0) continue;
          const shown = displayOf(b, f.path);
          data.push({ path: shown, lines: hits.map((h) => ({ line: h.line, text: h.text })) });
          if (args.options.filesWithMatches) lines.push(shown);
          else if (args.options.count) lines.push(`${shown}:${hits.length}`);
          else for (const h of hits) lines.push(`${shown}:${args.options.lineNumber ? `${h.line}:` : ""}${h.text}`);
        }
      }
      const done = outcomeOf({ files: data, looked, skipped }, { text: lines.join("\n") });
      const result: Outcome = data.length === 0 ? { ...done, exit: "findings" } : done;
      return withTrail(result, trail, args.options, ctx);
    },
  });

const diff = (host: Host): Command =>
  defineVerb(host, {
    name: "diff",
    id: "diff",
    options: { ...POSIX_OPTIONS },
    operands: [{ name: "A", help: "The first file.", arity: "one" }, { name: "B", help: "The second file.", arity: "one" }],
    examples: [{ args: ["fleet:/a.json", "./a.json"], says: "How the file in the store differs from the local one." }],
    run: async (args, ctx) => {
      const [a, b] = args.positionals;
      if (a === undefined || b === undefined) return usage("diff needs two files");
      const bound = await bindAll(host, [a, b]);
      if (bound.kind === "err") return bound.error;
      const [left, right] = bound.value;
      if (left === undefined || right === undefined) return usage("diff needs two files");
      if (args.options.explain) return explainOutcome(bound.value, ["read-all"]);
      const trail = newTrail();
      const one = keep(trail, "read-all", left.inner, await left.view.readFile(left.inner));
      if (one.kind === "err") return withTrail(failed(one.error), trail, args.options, ctx);
      const two = keep(trail, "read-all", right.inner, await right.view.readFile(right.inner));
      if (two.kind === "err") return withTrail(failed(two.error), trail, args.options, ctx);
      const compared = unifiedDiff(DECODER.decode(one.value), DECODER.decode(two.value), left.text, right.text);
      if (compared.kind === "same") return withTrail(outcomeOf({ same: true }, { text: "the files are the same" }), trail, args.options, ctx);
      if (compared.kind === "too-large") return withTrail(finding("E-DIFFERENT", `${left.text} and ${right.text} are too large to compare line by line (${compared.lines} lines): compare them with anyfs check or sha256sum`), trail, args.options, ctx);
      const base = finding("E-DIFFERENT", `${left.text} and ${right.text} differ: ${compared.added} added, ${compared.removed} removed`);
      return withTrail({ ...base, data: { same: false, added: compared.added, removed: compared.removed }, text: compared.text }, trail, args.options, ctx);
    },
  });

const sha256sum = (host: Host): Command =>
  defineVerb(host, {
    name: "sha256sum",
    id: "sha256sum",
    options: { ...POSIX_OPTIONS },
    operands: [{ name: "LOCATION", help: "Files of a store.", arity: "many" }],
    examples: [{ args: ["fleet:/machines/alpha.json"], says: "The SHA-256 of the file, and its name." }],
    run: async (args, ctx) => {
      if (args.positionals.length === 0) return usage("sha256sum needs a file");
      const bound = await bindAll(host, args.positionals);
      if (bound.kind === "err") return bound.error;
      if (args.options.explain) return explainOutcome(bound.value, ["stat-file", "read-all"]);
      const trail = newTrail();
      const lines: string[] = [];
      const data: { location: string; sha256: string }[] = [];
      for (const b of bound.value) {
        const st = keep(trail, "stat", b.inner, await b.view.stat(b.inner));
        if (st.kind === "err") return withTrail(failed(st.error), trail, args.options, ctx);
        if (st.value.type === "dir") return finding("E-FILESYSTEM", `EISDIR ${b.text}: is a directory`);
        const native = st.value.rev !== undefined && /^sha256:[0-9a-f]{64}$/.test(st.value.rev) ? st.value.rev.slice(7) : undefined;
        let digest: string;
        if (native !== undefined) digest = native;
        else {
          const read = keep(trail, "read-all", b.inner, await b.view.readFile(b.inner));
          if (read.kind === "err") return withTrail(failed(read.error), trail, args.options, ctx);
          digest = await sha256(read.value);
        }
        lines.push(`${digest}  ${b.text}`);
        data.push({ location: b.text, sha256: digest });
      }
      return withTrail(outcomeOf(data, { text: lines.join("\n") }), trail, args.options, ctx);
    },
  });

/** The verbs that only read. */
export function readVerbs(host: Host): readonly Command[] {
  return [ls(host), cat(host), stat(host), slice("head", host), slice("tail", host), find(host), du(host), tree(host), grep(host), diff(host), sha256sum(host)];
}

export type { Args };
export { joinPosix };
