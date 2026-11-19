// Spec: 0004-onboarding FR-002
/**
 * Putting `ergonex` on the path, the part that touches the host (commons ergonex 0004-onboarding FR-002, commons 0031-install-locations FR-005): finds an `ergonex` already there or installs the package for every
 * terminal with the runtime that ran `init`. It writes no file and changes no path: the runtime puts the program where it puts what it installs. It says each thing in plain words and never fails the run: what cannot be
 * done is said, with the command that does it.
 *
 * @module
 */
import { type Launch, globalInstall, isRegistryCopy } from "../onpath.ts";

/** What the step needs of the host, so that a test can give it what it likes. */
export type PathDeps = {
  readonly which: (name: string) => string | undefined;
  readonly run: (argv: readonly string[]) => Promise<{
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
  }>;
};

/** What the step did, as lines for a person and as data. */
export type PathResult = {
  readonly lines: readonly string[];
  readonly data: {
    readonly how: "already" | "installed" | "checkout" | "failed";
  };
};

const firstLine = (s: string): string =>
  s
    .split("\n")
    .find((l) => l.trim() !== "")
    ?.trim() ?? "no reason given";

/** Puts `ergonex` on the path, in the order that asks least of the person: already there, then the runtime's global install; a checkout is not installed. */
export async function putOnPath(deps: PathDeps, launch: Launch): Promise<PathResult> {
  // `bunx` and `npx` put their own temporary copy first on the PATH of the run: that copy is gone with the cache, so it is not an install
  const found = deps.which("ergonex");
  const there = found !== undefined && launch.kind === "registry" && isRegistryCopy(found) ? undefined : found;
  if (there !== undefined)
    return {
      lines: [`ergonex is already on your path (${there})`],
      data: { how: "already" },
    };
  if (launch.kind === "local") {
    return {
      lines: [
        `this is a checkout, which is not installed: run it as \`${launch.runtime} ${launch.entry}\`, or install the package with \`bun add -g @intellectual-frontiers/ergonex\``,
      ],
      data: { how: "checkout" },
    };
  }
  const cmd = globalInstall(launch);
  const r = await deps.run(cmd).catch((e: unknown) => ({
    code: 1,
    stdout: "",
    stderr: e instanceof Error ? e.message : String(e),
  }));
  if (r.code === 0)
    return {
      lines: [`installed ergonex for every terminal with \`${cmd.join(" ")}\`; open a new terminal and type ergonex`],
      data: { how: "installed" },
    };
  return {
    lines: [
      `could not install ergonex for every terminal (\`${cmd.join(" ")}\`: ${firstLine(r.stderr)}); run that command yourself when you can, or use \`${launch.runtime === "bun" ? "bunx" : "npx"} ${launch.spec}\``,
    ],
    data: { how: "failed" },
  };
}
