// Spec: 0005-anyfs-posix-conformance FR-003
/**
 * The model cases of the suite: a seeded sequence of operations on a small set of names (so that names collide, move and are removed again) run against the view and against the reference model, with the
 * answers compared at every step and the two trees compared at the end. A difference names the seed, the step and the operation, so that it can be run again.
 *
 * @module
 */
import { type Case, ConformanceFailure, type Make, bytes } from "./kit.ts";
import { PosixModel, type Answer } from "./model.ts";
import type { Posix } from "../posix.ts";

const NAMES = ["a", "b", "c"] as const;

/** A generator of numbers from a seed: the same seed, the same numbers, on every run and every runtime. */
export function generator(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Step =
  | { readonly op: "writeFile"; readonly path: string; readonly data: Uint8Array; readonly exclusive: boolean }
  | { readonly op: "readFile" | "stat" | "readdir" | "rmdir" | "unlink" | "touch" | "removeAll"; readonly path: string }
  | { readonly op: "mkdir"; readonly path: string; readonly parents: boolean }
  | { readonly op: "rename"; readonly path: string; readonly to: string }
  | { readonly op: "truncate"; readonly path: string; readonly length: number }
  | { readonly op: "appendFile"; readonly path: string; readonly data: Uint8Array };

const OPS: readonly Step["op"][] = ["writeFile", "writeFile", "writeFile", "readFile", "stat", "readdir", "mkdir", "rmdir", "unlink", "rename", "rename", "truncate", "appendFile", "touch", "removeAll"];

function pathOf(next: () => number): string {
  const depth = 1 + Math.floor(next() * 3);
  const parts: string[] = [];
  for (let i = 0; i < depth; i++) parts.push(NAMES[Math.floor(next() * NAMES.length)] ?? "a");
  return `/${parts.join("/")}`;
}

function stepOf(next: () => number): Step {
  const op = OPS[Math.floor(next() * OPS.length)] ?? "stat";
  const path = pathOf(next);
  const data = bytes("x".repeat(Math.floor(next() * 5)));
  switch (op) {
    case "writeFile":
      return { op, path, data, exclusive: next() < 0.2 };
    case "mkdir":
      return { op, path, parents: next() < 0.3 };
    case "rename":
      return { op, path, to: pathOf(next) };
    case "truncate":
      return { op, path, length: Math.floor(next() * 6) };
    case "appendFile":
      return { op, path, data };
    default:
      return { op, path } as Step;
  }
}

function modelAnswer(model: PosixModel, s: Step): Answer<unknown> {
  switch (s.op) {
    case "writeFile":
      return model.writeFile(s.path, s.data, s.exclusive);
    case "readFile":
      return model.readFile(s.path);
    case "stat":
      return model.stat(s.path);
    case "readdir":
      return model.readdir(s.path);
    case "mkdir":
      return model.mkdir(s.path, s.parents);
    case "rmdir":
      return model.rmdir(s.path);
    case "unlink":
      return model.unlink(s.path);
    case "touch":
      return model.touch(s.path);
    case "removeAll":
      return model.removeAll(s.path);
    case "rename":
      return model.rename(s.path, s.to);
    case "truncate":
      return model.truncate(s.path, s.length);
    case "appendFile":
      return model.appendFile(s.path, s.data);
  }
}

type Seen = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly errno: string };

async function viewAnswer(posix: Posix, s: Step): Promise<Seen> {
  const wrap = <T>(r: { readonly kind: "ok"; readonly value: { readonly value: T } } | { readonly kind: "err"; readonly error: { readonly errno: string } }, shape: (v: T) => unknown = (v) => v): Seen =>
    r.kind === "ok" ? { ok: true, value: shape(r.value.value) } : { ok: false, errno: r.error.errno };
  switch (s.op) {
    case "writeFile":
      return wrap(await posix.writeFile(s.path, s.data, { exclusive: s.exclusive }), () => undefined);
    case "readFile":
      return wrap(await posix.readFile(s.path));
    case "stat":
      return wrap(await posix.stat(s.path), (v) => ({ type: v.type, size: v.size }));
    case "readdir":
      return wrap(await posix.readdir(s.path), (v) => v.map((e) => (e.type === "file" ? { name: e.name, type: e.type, size: e.size } : { name: e.name, type: e.type })));
    case "mkdir":
      return wrap(await posix.mkdir(s.path, { parents: s.parents }), () => undefined);
    case "rmdir":
      return wrap(await posix.rmdir(s.path), () => undefined);
    case "unlink":
      return wrap(await posix.unlink(s.path), () => undefined);
    case "touch":
      return wrap(await posix.touch(s.path), () => undefined);
    case "removeAll":
      return wrap(await posix.removeAll(s.path), (v) => v.count);
    case "rename":
      return wrap(await posix.rename(s.path, s.to), () => undefined);
    case "truncate":
      return wrap(await posix.truncate(s.path, s.length), () => undefined);
    case "appendFile":
      return wrap(await posix.appendFile(s.path, s.data), () => undefined);
  }
}

const show = (value: unknown): string => JSON.stringify(value, (_k, v) => (v instanceof Uint8Array ? Array.from(v) : v));

async function treeOfView(posix: Posix, dir: string, out: string[]): Promise<void> {
  const r = await posix.readdir(dir);
  if (r.kind === "err") {
    out.push(`${dir}: ${r.error.errno}`);
    return;
  }
  for (const e of r.value.value) {
    const p = dir === "/" ? `/${e.name}` : `${dir}/${e.name}`;
    if (e.type === "dir") {
      out.push(`${p}/`);
      await treeOfView(posix, p, out);
    } else {
      const f = await posix.readFile(p);
      out.push(`${p} ${f.kind === "ok" ? show(f.value.value) : f.error.errno}`);
    }
  }
}

function treeOfModel(model: PosixModel, dir: string, out: string[]): void {
  const r = model.readdir(dir);
  if (!r.ok) {
    out.push(`${dir}: ${r.errno}`);
    return;
  }
  for (const e of r.value) {
    const p = dir === "/" ? `/${e.name}` : `${dir}/${e.name}`;
    if (e.type === "dir") {
      out.push(`${p}/`);
      treeOfModel(model, p, out);
    } else {
      const f = model.readFile(p);
      out.push(`${p} ${f.ok ? show(f.value) : f.errno}`);
    }
  }
}

/** A case that runs `steps` operations from a seed against the view and the model and compares them. */
export function modelCase(seed: number, steps: number): Case {
  return {
    id: `model-${seed}`,
    title: `${steps} operations of seed ${seed} give the answers of the reference model, and the same tree at the end`,
    needs: ["write", "delete"],
    lacks: [],
    traced: false,
    run: async (make: Make) => {
      const { posix } = await make();
      if (posix.policy.ancestors !== "check") return;
      const model = new PosixModel({ cas: posix.capabilities.has("cas"), keep: posix.policy.markers.kind === "keep" });
      const next = generator(seed);
      for (let i = 0; i < steps; i++) {
        const s = stepOf(next);
        const want = modelAnswer(model, s);
        const got = await viewAnswer(posix, s);
        const same = want.ok === got.ok && (want.ok && got.ok ? show(want.value) === show(got.value) : !want.ok && !got.ok && want.errno === got.errno);
        if (!same) throw new ConformanceFailure(`seed ${seed}, step ${i}, ${show(s)}: the model says ${show(want)}, the view says ${show(got)}`);
      }
      const a: string[] = [];
      const b: string[] = [];
      await treeOfView(posix, "/", a);
      treeOfModel(model, "/", b);
      if (show(a) !== show(b)) throw new ConformanceFailure(`seed ${seed}: the trees differ at the end: the model has ${show(b)}, the view has ${show(a)}`);
    },
  };
}
