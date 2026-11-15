// Programs: where one is on the PATH, and running one with its output kept. No program reads the setup's standard input (it may be the script, from a
// pipe): each gets none, or the terminal device where it must ask (009-machine-bootstrap FR-009).

export type RunOptions = {
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  /** each piece of output as it comes (a step's spinner counts lines, the sign-in looks for the code) */
  readonly onOutput?: (text: string) => void;
  /** the terminal device for standard input, for a program that asks there itself (sudo) */
  readonly terminal?: boolean;
};
/** What a program did: its exit status and everything it printed, standard output and error in the order they came. */
export type Ran = { readonly code: number; readonly output: string };

export const isWindows = Deno.build.os === "windows";

/** The executable NAME on the PATH (or the path itself where NAME has a slash), or null: `command -v`. */
export function which(name: string, path: string = Deno.env.get("PATH") ?? ""): string | null {
  const candidates = name.includes("/") ? [name] : path.split(isWindows ? ";" : ":").filter((d) => d !== "").map((d) => `${d}/${name}`);
  for (const c of candidates) if (isExecutable(c)) return c;
  return null;
}

export function isExecutable(p: string): boolean {
  try {
    const st = Deno.statSync(p);
    return st.isFile && (isWindows || ((st.mode ?? 0) & 0o111) !== 0);
  } catch {
    return false;
  }
}

export const exists = (p: string): boolean => {
  try {
    Deno.lstatSync(p);
    return true;
  } catch {
    return false;
  }
};
export const isDir = (p: string): boolean => {
  try {
    return Deno.statSync(p).isDirectory;
  } catch {
    return false;
  }
};

/** Run a program, its output kept. A program that cannot be started is status 127 with the reason as its output, as a shell says it. */
export async function run(argv: readonly string[], opts: RunOptions = {}): Promise<Ran> {
  const [cmd, ...args] = argv;
  if (cmd === undefined) return { code: 127, output: "nothing to run\n" };
  let stdin: Deno.FsFile | null = null;
  try {
    if (opts.terminal === true) stdin = await Deno.open("/dev/tty", { read: true }).catch(() => null);
    const child = new Deno.Command(cmd, {
      args,
      cwd: opts.cwd,
      env: opts.env as Record<string, string> | undefined,
      stdin: stdin === null ? "null" : "piped",
      stdout: "piped",
      stderr: "piped",
    }).spawn();
    if (stdin !== null) stdin.readable.pipeTo(child.stdin).catch(() => {});
    const chunks: string[] = [];
    const pump = async (s: ReadableStream<Uint8Array>) => {
      const dec = new TextDecoder();
      for await (const b of s) {
        const t = dec.decode(b, { stream: true });
        chunks.push(t);
        opts.onOutput?.(t);
      }
    };
    const [status] = await Promise.all([child.status, pump(child.stdout), pump(child.stderr)]);
    return { code: status.signal !== null ? 128 + signalNumber(status.signal) : status.code, output: chunks.join("") };
  } catch (e) {
    return { code: 127, output: `${cmd}: ${e instanceof Error ? e.message : String(e)}\n` };
  } finally {
    try {
      stdin?.close();
    } catch { /* already closed */ }
  }
}

/** Run a program in front of the person: its output goes to the screen as it is, and nothing is kept. */
export async function runShown(argv: readonly string[], opts: Omit<RunOptions, "onOutput"> = {}): Promise<number> {
  const [cmd, ...args] = argv;
  if (cmd === undefined) return 127;
  try {
    const st = await new Deno.Command(cmd, { args, cwd: opts.cwd, env: opts.env as Record<string, string> | undefined, stdin: "null", stdout: "inherit", stderr: "inherit" })
      .output();
    return st.code;
  } catch {
    return 127;
  }
}

/** Only the exit status, nothing shown (a check: `gh auth status`, `xcode-select -p`). */
export async function succeeds(argv: readonly string[], opts: RunOptions = {}): Promise<boolean> {
  return (await run(argv, opts)).code === 0;
}

/** The first line a program prints, trimmed, or "" where it fails. */
export async function firstLine(argv: readonly string[], opts: RunOptions = {}): Promise<string> {
  const r = await run(argv, opts);
  return r.code === 0 ? (r.output.split("\n")[0] ?? "").trim() : "";
}

function signalNumber(s: Deno.Signal): number {
  const n: Partial<Record<Deno.Signal, number>> = { SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGKILL: 9, SIGTERM: 15 };
  return n[s] ?? 1;
}

export const sleep = (seconds: number): Promise<void> => new Promise((r) => setTimeout(r, seconds * 1000));
