/**
 * What the tests run the program in: a folder of its own with a configuration written as a file (so that the loader is the one that runs), a state folder, and standard input and output that are captured as bytes. A
 * run is `main` itself, so what a test sees is what a person sees: the words, the exit status, standard output, standard error and the bytes a verb wrote to the port of standard output.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { main } from "../src/anyfs.ts";

/** What one run of the program gave. */
export type Ran = {
  readonly code: number;
  /** What the program wrote as its report, without the newline that ends it. */
  readonly out: string;
  /** What it wrote as its problems and verdict. */
  readonly err: string;
  /** The bytes a verb wrote to the port of standard output, joined. */
  readonly bytes: Uint8Array;
};

/** The place of a test. */
export type Lab = {
  readonly dir: string;
  readonly state: string;
  /** Writes a configuration file in the lab: the text of a module. */
  readonly config: (source: string) => Promise<void>;
  /** Runs the program in the lab. */
  readonly run: (args: readonly string[], options?: { readonly stdin?: Uint8Array; readonly env?: Readonly<Record<string, string | undefined>>; readonly cwd?: string }) => Promise<Ran>;
  readonly cleanup: () => Promise<void>;
};

const joined = (parts: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

/** A lab with a real folder. */
export async function lab(): Promise<Lab> {
  const dir = await fs.realPath(await fs.makeTempDir({ prefix: "anyfs-cli-" }));
  const state = path.join(dir, "state");
  await fs.mkdir(state, { recursive: true });
  return {
    dir,
    state,
    config: (source) => fs.writeTextFile(path.join(dir, "anyfs.config.ts"), source),
    run: async (args, options = {}) => {
      let out = "";
      let err = "";
      const chunks: Uint8Array[] = [];
      const code = await main(args, {
        cwd: options.cwd ?? dir,
        env: { ...options.env },
        stateDir: state,
        out: (t) => void (out += t),
        err: (t) => void (err += t),
        readStdin: () => Promise.resolve(options.stdin ?? new Uint8Array()),
        writeStdout: (b) => void chunks.push(b),
      });
      return { code, out: out.replace(/\n$/, ""), err, bytes: joined(chunks) };
    },
    cleanup: () => fs.remove(dir, { recursive: true }),
  };
}

/** A configuration module with mounts of a folder each and one of memory. */
export function mountsOf(dir: string, names: readonly string[]): string {
  const rows = names.map((n) => `    { name: ${JSON.stringify(n)}, place: ${JSON.stringify(`file://${path.join(dir, n)}`)} },`);
  return `export default {\n  mounts: [\n${rows.join("\n")}\n    { name: "scratch", place: "memory:scratch" },\n  ],\n};\n`;
}

/** Makes the folders of mounts and writes files in them: each key is a path below the lab. */
export async function fill(dir: string, files: Readonly<Record<string, string | Uint8Array>>): Promise<void> {
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(dir, rel);
    await fs.mkdir(path.dirname(file), { recursive: true });
    if (typeof content === "string") await fs.writeTextFile(file, content);
    else await fs.writeFile(file, content);
  }
}

/** The text of the bytes. */
export const textOf = (b: Uint8Array): string => new TextDecoder().decode(b);
