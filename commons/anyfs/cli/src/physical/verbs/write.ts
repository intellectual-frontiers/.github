// Spec: 0004-anyfs-cli-surfaces FR-011
/**
 * The verbs of the program that change a store through the POSIX view (commons anyfs-cli 0004-anyfs-cli-surfaces FR-011): `put`, `mkdir`, `touch`, `cp`, `mv` and `rm`. A file is copied by one read and one write
 * that is checked against the digest of its bytes; a directory is copied or moved by a plan of the bridge, which is the plan of a sync and approved by its hash like one. `rm` of a directory is a plan too: the names
 * it would remove and the hash of that list, which `--plan-hash` pins. A run with `--dry-run` changes nothing and says what it would do; the verbs that destroy say so in their facts, and Headless asks for the
 * confirmation.
 *
 * @example
 * ```ts
 * import { writeVerbs } from "./write.ts";
 * // writeVerbs(host).map((v) => v.name); // ["put", "mkdir", "touch", "cp", "mv", "rm"]
 * ```
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { outcomeOf, type Command, type Context, type Outcome } from "@intellectual-frontiers/headless/logical";
import { flag, value } from "@intellectual-frontiers/terminal/args";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { baseName, joinPosix, type PosixPath } from "@intellectual-frontiers/anyfs-posix/governance";
import type { Posix } from "@intellectual-frontiers/anyfs-posix/logical";
import { counted, finding, keep, newTrail, problemOf, type Host, type Trail, usage } from "@intellectual-frontiers/anyfs-cli/logical";
import type { Bound } from "../bind.ts";
import { bindAll, defineVerb, explainOutcome, failed, POSIX_OPTIONS, walk, withTrail } from "./common.ts";
import { diffOptionsOf, PLAN_OPTIONS, planTransfer, previewOutcome, railsOf, refusedOutcome, reportOutcome, runApply, staleOutcome } from "./transfer.ts";

const dry = (ctx: Context): boolean => ctx.mode !== "apply";

const put = (host: Host): Command =>
  defineVerb(host, {
    name: "put",
    id: "put",
    options: { exclusive: flag({ help: "Only where there is no file: a file that is there is an error." }), ...POSIX_OPTIONS },
    operands: [
      { name: "LOCATION", help: "The file to write, in a store.", arity: "one" },
      { name: "SOURCE", help: "A local file; standard input where it is left out or is -.", arity: "optional" },
    ],
    examples: [{ args: ["fleet:/machines/alpha.json", "./alpha.json"], says: "Write the local file as a file of the mount fleet." }, { args: ["fleet:/notes.txt", "-"], says: "Write standard input." }],
    run: async (args, ctx) => {
      const [to, from] = args.positionals;
      if (to === undefined) return usage("put needs the file to write");
      const bound = await bindAll(host, [to]);
      if (bound.kind === "err") return bound.error;
      const dst = bound.value[0];
      if (dst === undefined) return usage("put needs the file to write");
      if (args.options.explain) return explainOutcome(bound.value, ["write-all"]);
      let bytes: Uint8Array;
      if (from === undefined || from === "-") bytes = await host.world.readStdin();
      else {
        const read = await host.world.readLocalFile(from);
        if (read.kind === "err") return finding("E-FILESYSTEM", `ENOENT ${read.error}`);
        bytes = read.value;
      }
      if (dry(ctx)) return outcomeOf({ location: dst.text, bytes: bytes.length, written: false }, { text: `would write ${counted(bytes.length, "byte")} to ${dst.text}` });
      const trail = newTrail();
      const done = keep(trail, "write-all", dst.inner, await dst.view.writeFile(dst.inner, bytes, { exclusive: args.options.exclusive }));
      if (done.kind === "err") return withTrail(failed(done.error), trail, args.options, ctx);
      return withTrail(outcomeOf({ location: dst.text, bytes: bytes.length, sha256: await sha256(bytes), written: true }, { text: `wrote ${counted(bytes.length, "byte")} to ${dst.text}` }), trail, args.options, ctx);
    },
  });

const mkdir = (host: Host): Command =>
  defineVerb(host, {
    name: "mkdir",
    id: "mkdir",
    options: { parents: flag({ short: "p", help: "Make the directories above it too, and no error where it is there." }), ...POSIX_OPTIONS },
    operands: [{ name: "LOCATION", help: "A directory to make.", arity: "many" }],
    examples: [{ args: ["-p", "fleet:/machines/olympia"], says: "Make the directory; a store of objects keeps it only where it keeps a marker, and says which." }],
    run: async (args, ctx) => {
      if (args.positionals.length === 0) return usage("mkdir needs a directory");
      const bound = await bindAll(host, args.positionals);
      if (bound.kind === "err") return bound.error;
      if (args.options.explain) return explainOutcome(bound.value, ["mkdir"]);
      const trail = newTrail();
      const lines: string[] = [];
      for (const b of bound.value) {
        if (dry(ctx)) {
          lines.push(`would make ${b.text}`);
          continue;
        }
        const made = keep(trail, "mkdir", b.inner, await b.view.mkdir(b.inner, { parents: args.options.parents }));
        if (made.kind === "err") return withTrail(failed(made.error), trail, args.options, ctx);
        lines.push(`made ${b.text}`);
      }
      return withTrail(outcomeOf(lines, { text: lines.join("\n") }), trail, args.options, ctx);
    },
  });

const touch = (host: Host): Command =>
  defineVerb(host, {
    name: "touch",
    id: "touch",
    options: { ...POSIX_OPTIONS },
    operands: [{ name: "LOCATION", help: "A file to make where there is none.", arity: "many" }],
    examples: [{ args: ["fleet:/machines/.keep"], says: "An empty file, where there is none." }],
    run: async (args, ctx) => {
      if (args.positionals.length === 0) return usage("touch needs a file");
      const bound = await bindAll(host, args.positionals);
      if (bound.kind === "err") return bound.error;
      if (args.options.explain) return explainOutcome(bound.value, ["touch"]);
      const trail = newTrail();
      const lines: string[] = [];
      for (const b of bound.value) {
        if (dry(ctx)) {
          lines.push(`would touch ${b.text}`);
          continue;
        }
        const done = keep(trail, "touch", b.inner, await b.view.touch(b.inner));
        if (done.kind === "err") return withTrail(failed(done.error), trail, args.options, ctx);
        lines.push(`touched ${b.text}`);
      }
      return withTrail(outcomeOf(lines, { text: lines.join("\n") }), trail, args.options, ctx);
    },
  });

/** Where a source goes: the destination itself, or a name below it where it is a directory. */
async function destinationOf(src: Bound, dst: Bound, many: boolean, trail: Trail): Promise<Result<{ readonly path: PosixPath; readonly asDir: boolean }, Outcome>> {
  const st = await dst.view.stat(dst.inner);
  const isDir = (st.kind === "ok" && st.value.value.type === "dir") || dst.text.endsWith("/");
  if (st.kind === "ok") trail.steps.push({ op: "stat", path: dst.inner, fidelity: st.value.fidelity, notes: [] });
  if (many && !isDir) return err(usage(`${dst.text} is not a directory, and more than one name is to be copied into it`));
  if (!isDir) return ok({ path: dst.inner, asDir: false });
  const name = baseName(src.inner);
  if (name === undefined) return err(usage(`${src.text} has no name to put below ${dst.text}`));
  return ok({ path: joinPosix(dst.inner, name), asDir: true });
}

/** Copies a file by one read and one write, and checks what was written against the digest of the bytes read. */
async function copyFile(src: Bound, from: PosixPath, dst: Bound, to: PosixPath, trail: Trail): Promise<Result<number, Outcome>> {
  const read = keep(trail, "read-all", from, await src.view.readFile(from));
  if (read.kind === "err") return err(failed(read.error));
  const wrote = keep(trail, "write-all", to, await dst.view.writeFile(to, read.value));
  if (wrote.kind === "err") return err(failed(wrote.error));
  const st = keep(trail, "stat", to, await dst.view.stat(to));
  if (st.kind === "ok" && st.value.rev !== undefined && /^sha256:[0-9a-f]{64}$/.test(st.value.rev) && st.value.rev !== `sha256:${await sha256(read.value)}`) {
    return err(finding("E-APPLY-FAILED", `${dst.text}: what was written is not the bytes that were read (${st.value.rev})`));
  }
  return ok(read.value.length);
}

const cp = (host: Host): Command =>
  defineVerb(host, {
    name: "cp",
    id: "cp",
    options: { recursive: flag({ short: "r", help: "Copy directories, and what is in them, by a plan of the bridge." }), ...PLAN_OPTIONS, ...POSIX_OPTIONS },
    operands: [{ name: "SOURCE", help: "Files to copy, then the destination as the last word.", arity: "many" }],
    examples: [{ args: ["./alpha.json", "fleet:/machines/"], says: "Copy a local file into the directory machines of the mount fleet." }, { args: ["-r", "fleet:/machines", "s3backup:/machines"], says: "Copy a directory from one store to another by a plan: --dry-run shows it." }],
    run: async (args, ctx) => {
      if (args.positionals.length < 2) return usage("cp needs one or more sources and a destination");
      const words = args.positionals;
      const bound = await bindAll(host, words);
      if (bound.kind === "err") return bound.error;
      const dst = bound.value[bound.value.length - 1];
      const sources = bound.value.slice(0, -1);
      if (dst === undefined) return usage("cp needs a destination");
      if (args.options.explain) return explainOutcome(bound.value, ["read-all", "write-all"]);
      const trail = newTrail();
      const lines: string[] = [];
      const data: { from: string; to: string; bytes?: number; plan?: string }[] = [];
      for (const src of sources) {
        const target = await destinationOf(src, dst, sources.length > 1, trail);
        if (target.kind === "err") return target.error;
        const st = keep(trail, "stat", src.inner, await src.view.stat(src.inner));
        if (st.kind === "err") return withTrail(failed(st.error), trail, args.options, ctx);
        if (st.value.type === "file") {
          if (dry(ctx)) {
            lines.push(`would copy ${src.text} -> ${target.value.path}`);
            data.push({ from: src.text, to: target.value.path });
            continue;
          }
          const copied = await copyFile(src, src.inner, dst, target.value.path, trail);
          if (copied.kind === "err") return copied.error;
          lines.push(`${src.text} -> ${target.value.asDir ? `${dst.text.replace(/\/$/, "")}/${baseName(src.inner) ?? ""}` : dst.text} (${counted(copied.value, "byte")})`);
          data.push({ from: src.text, to: target.value.path, bytes: copied.value });
          continue;
        }
        if (!args.options.recursive) return finding("E-FILESYSTEM", `EISDIR ${src.text}: is a directory; use -r to copy it`);
        const rails = railsOf(host, args.options);
        if (rails.kind === "err") return usage(rails.error);
        const into: Bound = { ...dst, inner: target.value.path, text: target.value.asDir ? `${dst.text.replace(/\/$/, "")}/${baseName(src.inner) ?? ""}` : dst.text };
        const prepared = await planTransfer({ kind: "copy" }, src, into, diffOptionsOf(rails.value, args.options));
        if (prepared.kind === "err") return prepared.error;
        if (dry(ctx)) return previewOutcome(prepared.value.plan, `anyfs cp -r ${src.text} ${dst.text}`);
        if (args.options.planHash !== undefined && args.options.planHash !== prepared.value.plan.hash) return staleOutcome(args.options.planHash, prepared.value.plan.hash);
        const applied = await runApply(prepared.value, { concurrency: args.options.concurrency ?? host.config.defaults.concurrency, verify: host.config.defaults.verify }, ctx);
        if (applied.kind === "err") return refusedOutcome(applied.error);
        return reportOutcome(applied.value);
      }
      return withTrail(outcomeOf(data, { text: lines.join("\n") }), trail, args.options, ctx);
    },
  });

const mv = (host: Host): Command =>
  defineVerb(host, {
    name: "mv",
    id: "mv",
    options: { ...PLAN_OPTIONS, ...POSIX_OPTIONS },
    operands: [{ name: "SOURCE", help: "Names to move, then the destination as the last word.", arity: "many" }],
    examples: [{ args: ["fleet:/machines/alpha.json", "fleet:/retired/"], says: "Move a file within a store, by a rename where the store has one." }],
    run: async (args, ctx) => {
      if (args.positionals.length < 2) return usage("mv needs one or more sources and a destination");
      const bound = await bindAll(host, args.positionals);
      if (bound.kind === "err") return bound.error;
      const dst = bound.value[bound.value.length - 1];
      const sources = bound.value.slice(0, -1);
      if (dst === undefined) return usage("mv needs a destination");
      if (args.options.explain) return explainOutcome(bound.value, ["rename-file", "rename-dir", "read-all", "write-all", "unlink"]);
      const trail = newTrail();
      const lines: string[] = [];
      for (const src of sources) {
        const target = await destinationOf(src, dst, sources.length > 1, trail);
        if (target.kind === "err") return target.error;
        const st = keep(trail, "stat", src.inner, await src.view.stat(src.inner));
        if (st.kind === "err") return withTrail(failed(st.error), trail, args.options, ctx);
        const same = src.store === dst.store;
        if (st.value.type === "dir" && !same) {
          const rails = railsOf(host, args.options);
          if (rails.kind === "err") return usage(rails.error);
          const into: Bound = { ...dst, inner: target.value.path };
          const prepared = await planTransfer({ kind: "move" }, src, into, diffOptionsOf(rails.value, args.options));
          if (prepared.kind === "err") return prepared.error;
          if (dry(ctx)) return previewOutcome(prepared.value.plan, `anyfs mv ${src.text} ${dst.text}`);
          if (args.options.planHash !== undefined && args.options.planHash !== prepared.value.plan.hash) return staleOutcome(args.options.planHash, prepared.value.plan.hash);
          const applied = await runApply(prepared.value, { concurrency: args.options.concurrency ?? host.config.defaults.concurrency, verify: host.config.defaults.verify }, ctx);
          if (applied.kind === "err") return refusedOutcome(applied.error);
          return reportOutcome(applied.value);
        }
        if (dry(ctx)) {
          lines.push(`would move ${src.text} -> ${target.value.path}`);
          continue;
        }
        if (same) {
          const moved = keep(trail, st.value.type === "dir" ? "rename-dir" : "rename-file", src.inner, await src.view.rename(src.inner, target.value.path));
          if (moved.kind === "err") return withTrail(failed(moved.error), trail, args.options, ctx);
        } else {
          const copied = await copyFile(src, src.inner, dst, target.value.path, trail);
          if (copied.kind === "err") return copied.error;
          const removed = keep(trail, "unlink", src.inner, await src.view.unlink(src.inner));
          if (removed.kind === "err") return withTrail(failed(removed.error), trail, args.options, ctx);
        }
        lines.push(`${src.text} -> ${target.value.path}`);
      }
      return withTrail(outcomeOf(lines, { text: lines.join("\n") }), trail, args.options, ctx);
    },
  });

/** The hash of the names a recursive removal would remove, in order: what `--plan-hash` pins. */
export async function removalHash(paths: readonly string[]): Promise<string> {
  return await sha256(`anyfs-rm/1\n${[...paths].sort().join("\n")}\n`);
}

/** Removes a file, or a directory and what is below it where the view says so. */
async function removeOne(view: Posix, path: PosixPath, isDir: boolean, trail: Trail): Promise<Result<number, Outcome>> {
  if (!isDir) {
    const r = keep(trail, "unlink", path, await view.unlink(path));
    return r.kind === "err" ? err(failed(r.error)) : ok(1);
  }
  const r = keep(trail, "rm-r", path, await view.removeAll(path));
  return r.kind === "err" ? err(failed(r.error)) : ok(r.value.count);
}

const rm = (host: Host): Command =>
  defineVerb(host, {
    name: "rm",
    id: "rm",
    options: {
      recursive: flag({ short: "r", help: "Remove directories and everything below them." }),
      force: flag({ short: "f", help: "No error where a name is not there." }),
      planHash: value({ valueName: "HASH", help: "Remove only what the plan with this hash lists, which --dry-run printed: if the names changed since, nothing is removed." }),
      ...POSIX_OPTIONS,
    },
    operands: [{ name: "LOCATION", help: "Files, or directories with -r.", arity: "many" }],
    examples: [{ args: ["-r", "--dry-run", "fleet:/retired"], says: "The names that would go, and the hash of that list." }, { args: ["-r", "--yes", "--plan-hash", "<hash>", "fleet:/retired"], says: "Remove exactly that list." }],
    run: async (args, ctx) => {
      if (args.positionals.length === 0) return usage("rm needs a name");
      const bound = await bindAll(host, args.positionals);
      if (bound.kind === "err") return bound.error;
      if (args.options.explain) return explainOutcome(bound.value, ["unlink", "rm-r"]);
      const trail = newTrail();
      const planned: { readonly b: Bound; readonly isDir: boolean; readonly names: readonly string[] }[] = [];
      for (const b of bound.value) {
        const st = keep(trail, "stat", b.inner, await b.view.stat(b.inner));
        if (st.kind === "err") {
          if (args.options.force && st.error.errno === "ENOENT") continue;
          return withTrail(failed(st.error), trail, args.options, ctx);
        }
        if (st.value.type === "dir") {
          if (!args.options.recursive) return finding("E-FILESYSTEM", `EISDIR ${b.text}: is a directory; use -r to remove it and what is in it`);
          const walked = await walk(b, b.inner, trail);
          if (walked.kind === "err") return walked.error;
          planned.push({ b, isDir: true, names: walked.value.filter((w) => w.entry.type === "file").map((w) => `${b.text.replace(/\/$/, "")}${w.path.slice(b.inner === "/" ? 0 : b.inner.length)}`) });
        } else planned.push({ b, isDir: false, names: [b.text] });
      }
      const names = planned.flatMap((p) => p.names);
      const hash = await removalHash(names);
      if (dry(ctx)) {
        return withTrail(outcomeOf({ names, hash }, { text: [...names.map((n) => `would remove ${n}`), `${counted(names.length, "name")}`, `plan ${hash}`].join("\n"), next: planned.some((p) => p.isDir) ? [`next: anyfs rm ${args.options.recursive ? "-r " : ""}${args.positionals.join(" ")} --yes --plan-hash ${hash}`] : [] }), trail, args.options, ctx);
      }
      if (args.options.planHash !== undefined && args.options.planHash !== hash) return staleOutcome(args.options.planHash, hash);
      let count = 0;
      for (const p of planned) {
        const removed = await removeOne(p.b.view, p.b.inner, p.isDir, trail);
        if (removed.kind === "err") return withTrail(removed.error, trail, args.options, ctx);
        count += removed.value;
      }
      return withTrail(outcomeOf({ removed: count, hash }, { text: `removed ${counted(count, "name")}` }), trail, args.options, ctx);
    },
  });

/** The verbs that change a store through the view. */
export function writeVerbs(host: Host): readonly Command[] {
  return [put(host), mkdir(host), touch(host), cp(host), mv(host), rm(host)];
}

export { problemOf };
