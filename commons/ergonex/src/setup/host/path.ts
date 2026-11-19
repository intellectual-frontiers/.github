// Spec: 0004-onboarding FR-002
/**
 * Putting `ergonex` on the path, the part that touches the host (commons ergonex 0004-onboarding FR-002): finds an `ergonex` already there, installs the package for every terminal with the runtime that ran
 * `init`, or writes the shims into `<root>/.ergonex/bin` and, on Windows, adds that folder to the user's path. It says each thing in plain words and never fails the run: what cannot be done is said, with
 * the command that does it.
 *
 * @module
 */
import { type Launch, SHIM_MARK, cmdUnsafe, globalInstall, shellFrom, shimCmd, shimSh, userPathScript } from "../onpath.ts";

/** What the step needs of the host, so that a test can give it what it likes. */
export type PathDeps = {
  readonly which: (name: string) => string | undefined;
  readonly run: (argv: readonly string[]) => Promise<{
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
  }>;
  readonly read: (path: string) => Promise<string | undefined>;
  readonly write: (path: string, text: string, executable: boolean) => Promise<void>;
  readonly mkdir: (path: string) => Promise<void>;
};

/** What the step is given. */
export type PathFacts = {
  /** The shim folder, `<root>/.ergonex/bin`, with `/` between parts. */
  readonly bin: string;
  readonly launch: Launch;
  readonly windows: boolean;
  readonly shellVar: string | undefined;
  /** Change the user's path on Windows (not with `--no-path`). */
  readonly changePath: boolean;
};

/** What the step did, as lines for a person and as data. */
export type PathResult = {
  readonly lines: readonly string[];
  readonly data: {
    readonly how: "already" | "installed" | "shim" | "failed";
    readonly files: readonly string[];
    readonly pathChanged: boolean;
  };
};

const firstLine = (s: string): string =>
  s
    .split("\n")
    .find((l) => l.trim() !== "")
    ?.trim() ?? "no reason given";

/** Puts `ergonex` on the path, in the order that asks least of the person: already there, the global install, then the shims. */
export async function putOnPath(deps: PathDeps, f: PathFacts): Promise<PathResult> {
  const lines: string[] = [];
  const there = deps.which("ergonex");
  if (there !== undefined) {
    return {
      lines: [`ergonex is already on your path (${there})`],
      data: { how: "already", files: [], pathChanged: false },
    };
  }
  if (f.launch.kind === "registry") {
    const cmd = globalInstall(f.launch);
    const r = await deps.run(cmd).catch((e: unknown) => ({
      code: 1,
      stdout: "",
      stderr: e instanceof Error ? e.message : String(e),
    }));
    if (r.code === 0) {
      return {
        lines: [`installed ergonex for every terminal with \`${cmd.join(" ")}\`; open a new terminal and type ergonex`],
        data: { how: "installed", files: [], pathChanged: false },
      };
    }
    lines.push(
      `could not install it for every terminal (\`${cmd.join(" ")}\`: ${firstLine(r.stderr)}); using a small command file instead`,
    );
  }
  // the shims
  const files: string[] = [];
  const entries: {
    readonly name: string;
    readonly text: string;
    readonly executable: boolean;
  }[] = [{ name: "ergonex", text: shimSh(f.launch), executable: true }];
  if (f.windows) {
    if (f.launch.kind === "local" && cmdUnsafe(f.launch.entry)) {
      return {
        lines: [
          ...lines,
          `the folder ${f.launch.entry} has a % or a quote in its name, which a Windows command file cannot hold: run ergonex from a folder without one, or install it with \`bun add -g ${"@intellectual-frontiers/ergonex"}\``,
        ],
        data: { how: "failed", files, pathChanged: false },
      };
    }
    entries.push({
      name: "ergonex.cmd",
      text: shimCmd(f.launch),
      executable: false,
    });
  }
  try {
    await deps.mkdir(f.bin);
    for (const e of entries) {
      const path = `${f.bin}/${e.name}`;
      const before = await deps.read(path);
      if (before !== undefined && before !== e.text && !before.includes(SHIM_MARK)) {
        lines.push(`${path} is not a file ergonex wrote, so it was left as it is`);
        continue;
      }
      if (before !== e.text) await deps.write(path, e.text, e.executable);
      files.push(path);
    }
  } catch (e) {
    return {
      lines: [...lines, `the command files could not be written to ${f.bin}: ${e instanceof Error ? e.message : String(e)}`],
      data: { how: "failed", files, pathChanged: false },
    };
  }
  let pathChanged = false;
  if (f.windows && f.changePath) {
    const native = f.bin.replaceAll("/", "\\");
    const r = await deps
      .run(["powershell", "-NoProfile", "-NonInteractive", "-Command", userPathScript(native)])
      .catch(() => ({ code: 1, stdout: "", stderr: "" }));
    if (r.code === 0) {
      pathChanged = r.stdout.trim() === "added";
      lines.push(
        pathChanged
          ? `added ${native} to your path (only yours); open a new terminal and type ergonex`
          : `${native} is already on your path; open a new terminal and type ergonex`,
      );
    } else {
      lines.push(`ergonex is in ${native}; add that folder to your path to use it from any terminal`);
    }
  } else if (f.windows) {
    lines.push(`ergonex is in ${f.bin.replaceAll("/", "\\")}; add that folder to your path to use it from any terminal`);
  } else {
    const shell = shellFrom(f.shellVar);
    lines.push(
      `ergonex is in ${f.bin}; to find it from every terminal, run \`${f.bin}/ergonex shell ${shell} --install\` (it shows what it would add to your shell's start-up file and asks first)`,
    );
  }
  return { lines, data: { how: "shim", files, pathChanged } };
}
