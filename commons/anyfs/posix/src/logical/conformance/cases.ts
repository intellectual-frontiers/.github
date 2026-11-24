// Spec: 0005-anyfs-posix-conformance FR-002
/**
 * The cases of the conformance suite: what a view of any store does, written once. Each case says which capabilities the store must have and which it must not have (a case about a store that cannot compare
 * revisions is run only for one), and each reads the fidelity of what it does, so that a view that pretends is found. A case makes its own view from the function it is given and never shares one.
 *
 * @module
 */
import { type Case, type Make, bad, bytes, expect, fidelityIs, good, names, same, text } from "./kit.ts";
import type { PlanOp } from "@intellectual-frontiers/anyfs-posix/governance";

const c = (id: string, title: string, run: Case["run"], needs: Case["needs"] = [], lacks: Case["lacks"] = [], traced = false): Case => ({ id, title, needs, lacks, traced, run });

async function fresh(make: Make): Promise<import("./kit.ts").World> {
  return make();
}

const isKeep = (kind: "none" | "keep"): boolean => kind === "keep";

/** The cases, in the order the suite runs them. */
export const CASES: readonly Case[] = [
  c("round-trip", "a file written is read back as written, with its size and a mode that says whether it can be written", async (make) => {
    const { posix } = await fresh(make);
    const w = good(await posix.writeFile("/a.txt", bytes("hello")), "write");
    fidelityIs(w.fidelity, "native", undefined, "writeFile");
    const r = good(await posix.readFile("/a.txt"), "read");
    same(text(r.value), "hello", "the bytes");
    fidelityIs(r.fidelity, "native", undefined, "readFile");
    const s = good(await posix.stat("/a.txt"), "stat");
    same([s.value.type, s.value.size, s.value.mode], ["file", 5, 0o644], "the stat of a file");
    fidelityIs(s.fidelity, "native", undefined, "stat of a file");
    good(await posix.writeFile("/a.txt", bytes("bye")), "replace");
    same(text(good(await posix.readFile("/a.txt"), "read again").value), "bye", "a file written over is the new bytes");
  }),

  c("missing-names", "a name that is not there is ENOENT whatever is asked of it", async (make) => {
    const { posix } = await fresh(make);
    for (const [what, r] of [
      ["stat", await posix.stat("/nope")],
      ["readFile", await posix.readFile("/nope")],
      ["readdir", await posix.readdir("/nope")],
      ["unlink", await posix.unlink("/nope")],
      ["rmdir", await posix.rmdir("/nope")],
      ["rename", await posix.rename("/nope", "/other")],
      ["open", await posix.open("/nope", "r")],
      ["removeAll", await posix.removeAll("/nope")],
    ] as const) {
      bad(r, "ENOENT", what);
    }
  }),

  c("derived-directories", "a directory is where a file lies below it: its names are the first segments below it, in order, and reading it says it is derived", async (make) => {
    const { posix } = await fresh(make);
    good(await posix.writeFile("/d/x/1.txt", bytes("1")), "write");
    good(await posix.writeFile("/d/2.txt", bytes("22")), "write");
    good(await posix.writeFile("/e", bytes("e")), "write");
    const root = good(await posix.readdir("/"), "readdir /");
    same(names(root.value), ["d/", "e"], "the root");
    const d = good(await posix.readdir("/d"), "readdir /d");
    same(names(d.value), ["2.txt", "x/"], "a directory below");
    same(d.value.find((e) => e.name === "2.txt")?.size, 2, "the size of a file in a list");
    fidelityIs(d.fidelity, "emulated", "derived-directory", "readdir");
    const s = good(await posix.stat("/d"), "stat /d");
    same([s.value.type, s.value.mode], ["dir", 0o755], "the stat of a directory");
    fidelityIs(s.fidelity, "emulated", "derived-directory", "stat of a directory");
    same(good(await posix.stat("/"), "stat /").value.type, "dir", "the root is a directory");
  }),

  c("mkdir-policy", "mkdir writes nothing where the policy keeps no empty directories, and a marker where it does", async (make) => {
    const { posix } = await fresh(make);
    const m = good(await posix.mkdir("/m"), "mkdir");
    if (isKeep(posix.policy.markers.kind)) {
      fidelityIs(m.fidelity, "emulated", "marker-object", "mkdir with markers");
      same(good(await posix.stat("/m"), "stat").value.type, "dir", "a kept directory is there");
      same(good(await posix.readdir("/m"), "readdir").value, [], "a marker is not a name");
      const marker = posix.policy.markers.kind === "keep" ? posix.policy.markers.name : "";
      bad(await posix.writeFile(`/m/${marker}`, bytes("x")), "EINVAL", "a file with the name of a marker");
      good(await posix.rmdir("/m"), "rmdir");
      bad(await posix.stat("/m"), "ENOENT", "a removed directory");
    } else {
      fidelityIs(m.fidelity, "emulated", "no-marker", "mkdir without markers");
      expect(m.fidelity.kind === "emulated" && m.fidelity.risk === "not-durable", "an empty directory that is not kept is a risk of not being durable");
      bad(await posix.stat("/m"), "ENOENT", "an empty directory is not kept");
      good(await posix.writeFile("/m/f", bytes("f")), "write below");
      same(good(await posix.stat("/m"), "stat").value.type, "dir", "a directory with a file below it is there");
    }
  }),

  c("mkdir-errors", "mkdir of a name that is there is EEXIST, below a file is ENOTDIR, and -p of one that is there is nothing", async (make) => {
    const { posix } = await fresh(make);
    good(await posix.writeFile("/f", bytes("f")), "write");
    good(await posix.writeFile("/d/x", bytes("x")), "write");
    bad(await posix.mkdir("/f"), "EEXIST", "mkdir over a file");
    bad(await posix.mkdir("/d"), "EEXIST", "mkdir over a directory");
    good(await posix.mkdir("/d", { parents: true }), "mkdir -p over a directory");
    bad(await posix.mkdir("/"), "EEXIST", "mkdir of the root");
    if (posix.policy.ancestors === "check") bad(await posix.mkdir("/f/sub"), "ENOTDIR", "mkdir below a file");
  }),

  c("rmdir-errors", "rmdir of a directory that holds something is ENOTEMPTY, of a file ENOTDIR, of the root EINVAL, and a directory with nothing left is gone", async (make) => {
    const { posix } = await fresh(make);
    good(await posix.writeFile("/d/f", bytes("f")), "write");
    bad(await posix.rmdir("/d"), "ENOTEMPTY", "rmdir of a directory with a file");
    bad(await posix.rmdir("/d/f"), "ENOTDIR", "rmdir of a file");
    bad(await posix.rmdir("/"), "EINVAL", "rmdir of the root");
    good(await posix.unlink("/d/f"), "unlink");
    if (posix.policy.markers.kind === "none") bad(await posix.rmdir("/d"), "ENOENT", "a directory that held its last file is gone");
    else bad(await posix.stat("/d/f"), "ENOENT", "the file is gone");
  }),

  c("unlink", "unlink removes a file, and is EISDIR for a directory", async (make) => {
    const { posix } = await fresh(make);
    good(await posix.writeFile("/d/f", bytes("f")), "write");
    const u = good(await posix.unlink("/d/f"), "unlink");
    fidelityIs(u.fidelity, "native", undefined, "unlink");
    bad(await posix.stat("/d/f"), "ENOENT", "a removed file");
    good(await posix.writeFile("/d/g", bytes("g")), "write");
    bad(await posix.unlink("/d"), "EISDIR", "unlink of a directory");
  }),

  c("names-and-kinds", "a file is not a directory and a directory is not a file, whatever is asked", async (make) => {
    const { posix } = await fresh(make);
    good(await posix.writeFile("/f", bytes("f")), "write");
    good(await posix.writeFile("/d/g", bytes("g")), "write");
    bad(await posix.readdir("/f"), "ENOTDIR", "readdir of a file");
    bad(await posix.readFile("/d"), "EISDIR", "readFile of a directory");
    bad(await posix.open("/d", "r"), "EISDIR", "open of a directory");
    bad(await posix.writeFile("/d", bytes("x")), "EISDIR", "writeFile over a directory");
    bad(await posix.readFile("/"), "EISDIR", "readFile of the root");
    if (posix.policy.ancestors === "check") bad(await posix.writeFile("/f/under", bytes("x")), "ENOTDIR", "writeFile below a file");
  }),

  c("rename-file", "a file is moved to a free name with its bytes, and over a file as a copy and a delete; onto a directory it is EISDIR", async (make) => {
    const { posix } = await fresh(make);
    good(await posix.writeFile("/a", bytes("one")), "write");
    const r = good(await posix.rename("/a", "/b"), "rename");
    if (posix.capabilities.has("rename")) fidelityIs(r.fidelity, "native", undefined, "rename with the store's rename");
    else {
      fidelityIs(r.fidelity, "emulated", "copy-then-delete", "rename without the store's rename");
      expect(r.fidelity.kind === "emulated" && r.fidelity.risk === "non-atomic", "a copy and a delete are not one change");
    }
    same(text(good(await posix.readFile("/b"), "read").value), "one", "the bytes moved");
    bad(await posix.stat("/a"), "ENOENT", "the source is gone");
    good(await posix.writeFile("/c", bytes("two")), "write");
    const over = good(await posix.rename("/c", "/b"), "rename over");
    fidelityIs(over.fidelity, "emulated", "copy-then-delete", "rename over a file");
    same(text(good(await posix.readFile("/b"), "read").value), "two", "the file over which it was moved is replaced");
    good(await posix.writeFile("/d/x", bytes("x")), "write");
    good(await posix.writeFile("/e", bytes("e")), "write");
    bad(await posix.rename("/e", "/d"), "EISDIR", "a file onto a directory");
    good(await posix.rename("/e", "/e"), "a file onto itself");
    if (posix.policy.ancestors === "check") bad(await posix.rename("/e", "/b/under"), "ENOTDIR", "a file below a file");
  }),

  c("rename-dir", "a directory is moved whole, never onto a directory that is there, never into itself, never onto a file", async (make) => {
    const { posix } = await fresh(make);
    good(await posix.writeFile("/s/a", bytes("a")), "write");
    good(await posix.writeFile("/s/n/b", bytes("b")), "write");
    const r = good(await posix.rename("/s", "/t"), "rename dir");
    fidelityIs(r.fidelity, "emulated", "listing-walk", "rename of a directory");
    same(names(good(await posix.readdir("/t"), "readdir").value), ["a", "n/"], "the tree moved");
    same(text(good(await posix.readFile("/t/n/b"), "read").value), "b", "a file below moved");
    bad(await posix.stat("/s"), "ENOENT", "the source is gone");
    good(await posix.writeFile("/u/x", bytes("x")), "write");
    bad(await posix.rename("/t", "/u"), "EEXIST", "onto a directory that is there");
    bad(await posix.rename("/t", "/t/inside"), "EINVAL", "into itself");
    good(await posix.writeFile("/f", bytes("f")), "write");
    bad(await posix.rename("/t", "/f"), "ENOTDIR", "onto a file");
    bad(await posix.rename("/", "/z"), "EINVAL", "the root");
  }),

  c("write-back", "an object written through a handle is not in the store until close, and is whole after it", async (make) => {
    const { posix } = await fresh(make);
    const open = good(await posix.open("/w.txt", "w"), "open");
    fidelityIs(open.fidelity, "emulated", "write-back-buffer", "open for writing");
    const fd = open.value;
    const w = good(await posix.write(fd, bytes("hello ")), "write");
    same(w.value, 6, "bytes written");
    good(await posix.write(fd, bytes("world")), "write");
    bad(await posix.stat("/w.txt"), "ENOENT", "nothing is in the store before close");
    const closed = good(await posix.close(fd), "close");
    fidelityIs(closed.fidelity, "emulated", posix.capabilities.has("cas") ? "write-back-buffer" : "unguarded-write", "close");
    same(text(good(await posix.readFile("/w.txt"), "read").value), "hello world", "the bytes after close");
    bad(await posix.close(fd), "EBADF", "a handle closed twice");
  }),

  c("handles", "a handle reads and writes where it says, and only as it was opened", async (make) => {
    const { posix } = await fresh(make);
    good(await posix.writeFile("/h.txt", bytes("abcdef")), "write");
    const ro = good(await posix.open("/h.txt", "r"), "open r").value;
    same(text(good(await posix.read(ro, 2), "read").value), "ab", "the first read");
    same(text(good(await posix.read(ro, 2), "read").value), "cd", "the position moved");
    same(text(good(await posix.read(ro, 3, 1), "read at").value), "bcd", "a read at a position");
    bad(await posix.write(ro, bytes("x")), "EBADF", "a write to a handle opened to read");
    good(await posix.close(ro), "close");
    const rw = good(await posix.open("/h.txt", "r+"), "open r+").value;
    good(await posix.write(rw, bytes("XY"), 1), "write at");
    same(text(good(await posix.read(rw, 6, 0), "read").value), "aXYdef", "a handle reads what it wrote");
    good(await posix.ftruncate(rw, 3), "ftruncate");
    good(await posix.close(rw), "close");
    same(text(good(await posix.readFile("/h.txt"), "read").value), "aXY", "the bytes after close");
    const wo = good(await posix.open("/h.txt", "w"), "open w").value;
    bad(await posix.read(wo, 1), "EBADF", "a read from a handle opened to write");
    good(await posix.close(wo), "close");
    same(good(await posix.stat("/h.txt"), "stat").value.size, 0, "w makes the file empty");
    bad(await posix.read(9999 as never, 1), "EBADF", "a handle that was never open");
  }),

  c("exclusive-and-append", "wx is EEXIST where the file is, and a appends at the end whatever the position", async (make) => {
    const { posix } = await fresh(make);
    good(await posix.writeFile("/x", bytes("old")), "write");
    bad(await posix.open("/x", "wx"), "EEXIST", "wx over a file");
    bad(await posix.writeFile("/x", bytes("new"), { exclusive: true }), "EEXIST", "an exclusive write over a file");
    const a = good(await posix.open("/x", "a+"), "open a+").value;
    good(await posix.write(a, bytes("++"), 0), "write");
    same(text(good(await posix.read(a, 10, 0), "read").value), "old++", "an append goes to the end");
    good(await posix.close(a), "close");
    const fresh1 = good(await posix.open("/y", "wx"), "wx over a name that is free").value;
    good(await posix.write(fresh1, bytes("y")), "write");
    good(await posix.close(fresh1), "close");
    same(text(good(await posix.readFile("/y"), "read").value), "y", "a file made by wx");
    bad(await posix.open("/z", "r+"), "ENOENT", "r+ of a name that is not there");
  }),

  c(
    "close-conflict",
    "a change another writer made since the open is ESTALE at close, and what the other writer wrote stays",
    async (make) => {
      const { posix } = await fresh(make);
      good(await posix.writeFile("/c.txt", bytes("one")), "write");
      const fd = good(await posix.open("/c.txt", "r+"), "open").value;
      good(await posix.writeFile("/c.txt", bytes("other")), "the other writer");
      good(await posix.write(fd, bytes("mine"), 0), "write");
      bad(await posix.close(fd), "ESTALE", "close after another writer");
      same(text(good(await posix.readFile("/c.txt"), "read").value), "other", "the other writer's bytes stay");
      const fresh2 = good(await posix.open("/new.txt", "w"), "open a name that is free").value;
      good(await posix.writeFile("/new.txt", bytes("first")), "the other writer makes it");
      good(await posix.write(fresh2, bytes("late")), "write");
      bad(await posix.close(fresh2), "ESTALE", "close where the object appeared");
    },
    ["cas"],
  ),

  c(
    "unguarded-close",
    "where the store cannot compare revisions the close overwrites, and the fidelity says it is unguarded",
    async (make) => {
      const { posix } = await fresh(make);
      good(await posix.writeFile("/c.txt", bytes("one")), "write");
      const fd = good(await posix.open("/c.txt", "r+"), "open").value;
      good(await posix.writeFile("/c.txt", bytes("other")), "the other writer");
      good(await posix.write(fd, bytes("mine"), 0), "write");
      const closed = good(await posix.close(fd), "close");
      fidelityIs(closed.fidelity, "emulated", "unguarded-write", "close without compare-and-write");
      expect(closed.notes.length > 0, "the outcome says that a change was overwritten");
      same(text(good(await posix.readFile("/c.txt"), "read").value), "mine", "the last writer wins");
    },
    [],
    ["cas"],
  ),

  c(
    "append-and-truncate",
    "an append makes the file where it is not and adds where it is, a truncate cuts and pads with zeros, and both say they read and write back",
    async (make) => {
      const { posix } = await fresh(make);
      const a = good(await posix.appendFile("/log", bytes("one\n")), "append to a name that is free");
      fidelityIs(a.fidelity, "emulated", "read-modify-write", "append");
      good(await posix.appendFile("/log", bytes("two\n")), "append");
      same(text(good(await posix.readFile("/log"), "read").value), "one\ntwo\n", "the bytes appended");
      const t = good(await posix.truncate("/log", 3), "truncate");
      fidelityIs(t.fidelity, "emulated", "read-modify-write", "truncate");
      same(text(good(await posix.readFile("/log"), "read").value), "one", "cut");
      good(await posix.truncate("/log", 5), "extend");
      same(Array.from(good(await posix.readFile("/log"), "read").value), [111, 110, 101, 0, 0], "padded with zeros");
      bad(await posix.truncate("/nothing", 1), "ENOENT", "truncate of a name that is not there");
      good(await posix.writeFile("/dir/f", bytes("f")), "write");
      bad(await posix.truncate("/dir", 1), "EISDIR", "truncate of a directory");
      bad(await posix.appendFile("/dir", bytes("x")), "EISDIR", "append to a directory");
    },
    ["cas"],
  ),

  c(
    "read-modify-write-refused",
    "where the store cannot compare revisions an append and a truncate are refused, because they would lose what another writer wrote",
    async (make) => {
      const { posix } = await fresh(make);
      good(await posix.writeFile("/log", bytes("one")), "write");
      const a = bad(await posix.appendFile("/log", bytes("x")), "ENOTSUP", "append");
      fidelityIs(a.fidelity, "refused", "capability-absent", "append");
      const t = bad(await posix.truncate("/log", 1), "ENOTSUP", "truncate");
      fidelityIs(t.fidelity, "refused", "capability-absent", "truncate");
      same(text(good(await posix.readFile("/log"), "read").value), "one", "nothing changed");
    },
    [],
    ["cas"],
  ),

  c("touch", "touch makes an empty file where there is none and leaves one that is there, and says it keeps no time", async (make) => {
    const { posix } = await fresh(make);
    const t = good(await posix.touch("/t"), "touch");
    fidelityIs(t.fidelity, "emulated", "touch-without-mtime", "touch");
    expect(t.fidelity.kind === "emulated" && t.fidelity.risk === "lossy", "a touch that changes no time is lossy");
    same(good(await posix.stat("/t"), "stat").value.size, 0, "an empty file");
    good(await posix.writeFile("/t", bytes("kept")), "write");
    const again = good(await posix.touch("/t"), "touch again");
    expect(again.notes.length > 0, "the outcome says the file was left");
    same(text(good(await posix.readFile("/t"), "read").value), "kept", "a file that is there is left");
    good(await posix.writeFile("/d/x", bytes("x")), "write");
    bad(await posix.touch("/d"), "EISDIR", "touch of a directory");
  }),

  c("remove-all", "rm -r removes a tree and says how many, and a name that is not there is ENOENT", async (make) => {
    const { posix } = await fresh(make);
    good(await posix.writeFile("/t/a", bytes("a")), "write");
    good(await posix.writeFile("/t/n/b", bytes("b")), "write");
    good(await posix.writeFile("/keep", bytes("k")), "write");
    const r = good(await posix.removeAll("/t"), "removeAll");
    same(r.value.count, 2, "the objects removed");
    fidelityIs(r.fidelity, "emulated", "listing-walk", "rm -r");
    bad(await posix.stat("/t"), "ENOENT", "a removed tree");
    same(good(await posix.removeAll("/keep"), "removeAll of a file").value.count, 1, "a file");
    bad(await posix.removeAll("/t"), "ENOENT", "a tree that is gone");
    bad(await posix.removeAll("/"), "EINVAL", "the root");
  }),

  c("refused-operations", "what an object store has no thing for is refused with ENOTSUP and the reason, never done in part", async (make) => {
    const { posix } = await fresh(make);
    good(await posix.writeFile("/f", bytes("f")), "write");
    for (const [what, r] of [
      ["chmod", await posix.chmod("/f", 0o600)],
      ["chown", await posix.chown("/f", 1, 1)],
      ["utimes", await posix.utimes("/f", new Date(0), new Date(0))],
      ["symlink", await posix.symlink("/f", "/l")],
      ["link", await posix.link("/f", "/l")],
      ["readlink", await posix.readlink("/f")],
      ["mmap", await posix.mmap(3 as never)],
    ] as const) {
      const e = bad(r, "ENOTSUP", what);
      fidelityIs(e.fidelity, "refused", "not-in-model", what);
    }
    bad(await posix.stat("/l"), "ENOENT", "no link was made");
  }),

  c("paths", "a path is resolved by its text against the working directory, `..` stops at the root, and a backslash or an empty text is EINVAL", async (make) => {
    const { posix } = await fresh(make);
    good(await posix.writeFile("/a/b/c.txt", bytes("c")), "write");
    const cwd = posix.withCwd("/a/b");
    expect(cwd.kind === "ok", "a working directory is resolved");
    if (cwd.kind !== "ok") return;
    same(text(good(await cwd.value.readFile("c.txt"), "relative").value), "c", "a relative path");
    same(text(good(await cwd.value.readFile("./c.txt"), "dot").value), "c", "dot");
    same(text(good(await cwd.value.readFile("../b/c.txt"), "dotdot").value), "c", "dot dot");
    same(text(good(await cwd.value.readFile("//a//b/c.txt"), "slashes").value), "c", "repeated slashes");
    same(text(good(await cwd.value.readFile("/../../a/b/c.txt"), "above the root").value), "c", "above the root is the root");
    good(await cwd.value.writeFile("d.txt", bytes("d")), "write relative");
    same(text(good(await posix.readFile("/a/b/d.txt"), "read").value), "d", "written below the working directory");
    bad(await posix.readFile("a\\b"), "EINVAL", "a backslash");
    bad(await posix.readFile(""), "EINVAL", "an empty text");
    bad(await posix.readFile("a\u0000b"), "EINVAL", "a NUL");
  }),

  c("fidelity-is-the-plan", "the fidelity of every operation is the fidelity `explain` gives for it", async (make) => {
    const { posix } = await fresh(make);
    const table: readonly [PlanOp, () => Promise<{ readonly kind: string; readonly value?: { readonly fidelity: unknown }; readonly error?: { readonly fidelity: unknown } }>][] = [
      ["write-all", () => posix.writeFile("/p/f", bytes("f"))],
      ["stat-file", () => posix.stat("/p/f")],
      ["stat-dir", () => posix.stat("/p")],
      ["readdir", () => posix.readdir("/p")],
      ["read-all", () => posix.readFile("/p/f")],
      ["touch", () => posix.touch("/p/g")],
      ["rename-file", () => posix.rename("/p/g", "/p/h")],
      ["unlink", () => posix.unlink("/p/h")],
      ["chmod", () => posix.chmod("/p/f", 0o644)],
    ];
    for (const [op, run] of table) {
      const r = await run();
      const f = r.kind === "ok" ? r.value?.fidelity : r.error?.fidelity;
      same(f, posix.explain(op).fidelity, `the fidelity of ${op}`);
    }
  }),

  c(
    "plans-cover-execution",
    "an operation uses no operation of the store that its plan does not name",
    async (make) => {
      const world = await fresh(make);
      const { posix, trace, reset } = world;
      expect(trace !== undefined && reset !== undefined, "the case needs a world that records the operations of the store");
      if (trace === undefined || reset === undefined) return;
      const script: readonly [PlanOp, () => Promise<unknown>][] = [
        ["write-all", () => posix.writeFile("/p/f", bytes("f"))],
        ["stat-file", () => posix.stat("/p/f")],
        ["stat-dir", () => posix.stat("/p")],
        ["readdir", () => posix.readdir("/p")],
        ["read-all", () => posix.readFile("/p/f")],
        ["touch", () => posix.touch("/p/g")],
        ["rename-file", () => posix.rename("/p/g", "/p/h")],
        ["rename-over", () => posix.rename("/p/h", "/p/f")],
        ["mkdir", () => posix.mkdir("/q")],
        ["rename-dir", () => posix.rename("/p", "/r")],
        ["unlink", () => posix.unlink("/r/f")],
        ["rm-r", () => posix.removeAll("/r")],
      ];
      for (const [op, run] of script) {
        reset();
        await run();
        const steps = new Set<string>(posix.explain(op).steps);
        for (const used of trace()) expect(steps.has(used), `${op} used ${used}, which its plan does not name (${[...steps].join(", ")})`);
      }
      reset();
      const fd = good(await posix.open("/o", "w"), "open").value;
      const open = new Set<string>(posix.explain("open-write").steps);
      for (const used of trace()) expect(open.has(used), `open used ${used}, which its plan does not name`);
      reset();
      good(await posix.write(fd, bytes("x")), "write");
      expect(trace().length === 0, "a write into a handle uses no operation of the store");
      reset();
      good(await posix.close(fd), "close");
      const close = new Set<string>(posix.explain("close").steps);
      for (const used of trace()) expect(close.has(used), `close used ${used}, which its plan does not name`);
    },
    [],
    [],
    true,
  ),
];
