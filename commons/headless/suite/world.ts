/**
 * What the tests of Headless share: a sample program with a command of each kind, an in-memory store of state, and a world to run it in.
 *
 * @module
 */
import { flag, value } from "@intellectual-frontiers/terminal/args";
import { problem } from "../src/governance/mod.ts";
import { branch, command, outcomeOf, programOf, startPhase, type Program } from "../src/logical/mod.ts";
import type { Io, SignalPort, StopSignal, TimerPort } from "../src/surfaces/cli/io.ts";
import type { StateStore, StoredFile } from "../src/surfaces/cli/state.ts";

/** A store of state in memory; `mtime` says when a file was changed, and `writes` how often it was written. */
export type MemoryStore = StateStore & { readonly files: Map<string, { text: string; mtimeMs: number }>; now: number; writes: number };

/** An empty store whose files are changed at `now`. */
export function memoryStore(now = 0): MemoryStore {
  const files = new Map<string, { text: string; mtimeMs: number }>();
  const store: MemoryStore = {
    files,
    now,
    writes: 0,
    readText: (f) => files.get(f)?.text,
    writeText(f, text) {
      store.writes += 1;
      files.set(f, { text, mtimeMs: store.now });
    },
    appendText(f, text) {
      store.writes += 1;
      files.set(f, { text: (files.get(f)?.text ?? "") + text, mtimeMs: store.now });
    },
    list(dir) {
      const prefix = dir.endsWith("/") || dir.endsWith("\\") ? dir : `${dir}${dir.includes("\\") ? "\\" : "/"}`;
      return [...files.entries()]
        .filter(([f]) => f.startsWith(prefix) && !f.slice(prefix.length).includes("/") && !f.slice(prefix.length).includes("\\"))
        .map(([f, v]): StoredFile => ({ name: f.slice(prefix.length), mtimeMs: v.mtimeMs }));
    },
    remove(f) {
      files.delete(f);
    },
  };
  return store;
}

/** Signals a test sends. */
export type FakeSignals = SignalPort & { send(signal: StopSignal): void; readonly listening: () => number };

/** A port of signals that a test sends by hand. */
export function fakeSignals(): FakeSignals {
  const handlers = new Map<StopSignal, Set<() => void>>();
  return {
    on(signal, handler) {
      const set = handlers.get(signal) ?? new Set<() => void>();
      set.add(handler);
      handlers.set(signal, set);
      return () => void set.delete(handler);
    },
    send(signal) {
      for (const h of [...(handlers.get(signal) ?? [])]) h();
    },
    listening: () => [...handlers.values()].reduce((n, s) => n + s.size, 0),
  };
}

/** A timer a test ticks by hand. */
export type FakeTimer = TimerPort & { tick(): void; readonly running: () => number };

/** A timer that calls only when told to. */
export function fakeTimer(): FakeTimer {
  const fns = new Set<() => void>();
  return {
    every(_ms, fn) {
      fns.add(fn);
      return () => void fns.delete(fn);
    },
    tick() {
      for (const f of [...fns]) f();
    },
    running: () => fns.size,
  };
}

/** The pieces of a world a test sets; the rest is a pipe on Linux at time 0. */
export type WorldOptions = {
  readonly env?: Readonly<Record<string, string>>;
  readonly terminal?: boolean | { readonly stdin: boolean; readonly stdout: boolean; readonly stderr: boolean };
  readonly os?: Io["os"];
  readonly columns?: number;
  readonly lines?: readonly string[];
  readonly store?: StateStore | false;
  readonly signals?: SignalPort;
  readonly timer?: TimerPort;
  readonly now?: () => number;
  readonly pid?: number;
  readonly observer?: Io["observer"];
};

/** An `Io` for a test. */
export function world(o: WorldOptions = {}): Io & { readonly asked: string[] } {
  const lines = [...(o.lines ?? [])];
  const asked: string[] = [];
  const t = o.terminal === undefined || o.terminal === false ? { stdin: false, stdout: false, stderr: false } : o.terminal === true ? { stdin: true, stdout: true, stderr: true } : o.terminal;
  return {
    env: (n) => o.env?.[n],
    os: o.os ?? "linux",
    terminal: t,
    columns: o.columns,
    now: o.now ?? (() => Date.UTC(2026, 10, 20, 10, 0, 0)),
    pid: o.pid ?? 4242,
    readLine: () => {
      asked.push("read");
      return Promise.resolve(lines.shift());
    },
    asked,
    ...(o.store === false ? {} : { state: o.store ?? memoryStore() }),
    ...(o.signals === undefined ? {} : { signals: o.signals }),
    ...(o.timer === undefined ? {} : { timer: o.timer }),
    ...(o.observer === undefined ? {} : { observer: o.observer }),
  };
}

const syncOptions = {
  warn: flag({ help: "Warn about something." }),
  fail: flag({ help: "Fail." }),
  wait: flag({ help: "Leave something pending." }),
  throws: flag({ help: "Throw." }),
};

/** A program with a report, a mutating action, a destructive one, and a branch of two. */
export function sample(extra: Partial<Parameters<typeof programOf>[0]> = {}): Program {
  return programOf({
    name: "tool",
    summary: "A tool for the tests.",
    version: "1.2.3",
    ...extra,
    children: [
      command({
        name: "status",
        summary: "Show the status.",
        options: { limit: value({ help: "How many.", parse: (t) => (/^\d+$/.test(t) ? { kind: "ok", value: Number(t) } : { kind: "err", error: "expected a number" }) }) },
        action: { kind: "report" },
        examples: [{ args: [], says: "Show it." }],
        run: () => Promise.resolve(outcomeOf({ files: 3 }, { text: "3 files, all fine" })),
      }),
      command({
        name: "sync",
        summary: "Sync the files.",
        options: syncOptions,
        action: { kind: "action", dryRun: true, check: true },
        run: (args, ctx) => {
          const o = args.options;
          if (o["throws"] === true) return Promise.reject(new Error("the disk exploded"));
          const ph = startPhase(ctx.progress, "Files");
          ph.ok("a.txt");
          ph.change("b.txt");
          if (o["warn"] === true) ph.warn("b.txt is large", { code: "E001-LARGE", fix: "tool trim (it removes the old copies)" });
          if (o["fail"] === true) ph.fail("the disk is full", { fix: "tool clean", code: "E002-DISK" });
          if (o["wait"] === true) ph.pending("no token yet", "tool token", { code: "P001-TOKEN" });
          ph.done("2 files");
          return Promise.resolve(outcomeOf({ mode: ctx.mode }));
        },
      }),
      command({
        name: "wipe",
        summary: "Delete the cache.",
        options: {},
        action: { kind: "action", effect: "destructive", dryRun: true },
        run: (_args, ctx) => Promise.resolve(outcomeOf({ wiped: ctx.mode === "apply" }, { outcomes: [ctx.mode === "apply" ? "Wiped the cache" : "Would wipe the cache"] })),
      }),
      branch({
        name: "work",
        summary: "Works.",
        children: [
          command({ name: "build", summary: "Build a work.", options: {}, operands: [{ name: "WORK", help: "The work.", arity: "optional" }], action: { kind: "action" }, run: (args) => Promise.resolve(outcomeOf({ built: args.positionals })) }),
          command({ name: "plan", summary: "Plan the build.", options: {}, action: { kind: "report" }, run: () => Promise.resolve(outcomeOf(null, { text: "nothing to build", problems: [problem("action", "send the change", { fix: "tool sync" })] })) }),
        ],
      }),
    ],
  });
}
