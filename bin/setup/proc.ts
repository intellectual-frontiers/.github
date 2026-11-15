// Programs, as the setup runs them, on commons' runtime/proc: what a program printed is kept as one text, standard output and error line by line in the order
// they came, and each line is handed on as it comes (a step's progress counts lines, the sign-in looks for the code). A program that cannot be started is
// status 127 with the reason as its output, as a shell says it. No program reads the setup's standard input (it may be the script, from a pipe): each gets
// none; sudo asks on the terminal device itself (009-machine-bootstrap FR-009).
import * as proc from "../../commons/ts/runtime/proc.ts";
import * as fs from "../../commons/ts/runtime/fs.ts";

export type RunOptions = {
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  /** each line of output as it comes, with its line feed */
  readonly onOutput?: (text: string) => void;
};
/** What a program did: its exit status and everything it printed. */
export type Ran = { readonly code: number; readonly output: string };

/** Run a program, its output kept. */
export async function run(argv: readonly string[], opts: RunOptions = {}): Promise<Ran> {
  const lines: string[] = [];
  try {
    const r = await proc.run(argv, {
      ...(opts.cwd === undefined ? {} : { cwd: opts.cwd }),
      ...(opts.env === undefined ? {} : { env: opts.env }),
      onLine: (_stream, line) => {
        lines.push(`${line}\n`);
        opts.onOutput?.(`${line}\n`);
      },
    });
    return { code: r.code, output: lines.join("") };
  } catch (e) {
    return { code: 127, output: `${argv[0] ?? ""}: ${e instanceof Error ? e.message : String(e)}\n` };
  }
}

/** Only the exit status, nothing shown (a check: `gh auth status`, `xcode-select -p`). */
export async function succeeds(argv: readonly string[], opts: RunOptions = {}): Promise<boolean> {
  return (await run(argv, opts)).code === 0;
}

/** The executable on the PATH (or the path itself where it has a slash), or null: `command -v`. */
export const which = (name: string): string | null => proc.which(name) ?? null;

/** Whether something is at the path (a dangling link counts); a path that cannot be looked at is nothing. */
export const exists = (p: string): boolean => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
};

export const isDir = (p: string): boolean => {
  try {
    return fs.statSync(p).isDirectory;
  } catch {
    return false;
  }
};

/** Whether this process has a terminal to ask on, even where its standard input is a pipe: the terminal device opens. */
export async function hasTerminal(): Promise<boolean> {
  return (await run(["sh", "-c", "exec 3</dev/tty"])).code === 0;
}

export const sleep = (seconds: number): Promise<void> => proc.sleep(seconds * 1000);
