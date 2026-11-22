// Spec: 0006-agents FR-011, FR-012
/**
 * The port of a harness adapter (`ergonex:HarnessAdapter`, commons ergonex 0006-agents FR-011): what `agent init` asks of each harness. An adapter says what it would do as steps (a file edit, or a
 * command of the harness's own), and `runSteps` carries them out or, with a preview, only says. An adapter reaches its harness only through files the harness reads and commands it has.
 *
 * @module
 */
import { existsSync, readTextOr } from "../../../platform/r-fs.ts";
import { dirname } from "../../../platform/r-path.ts";
import { type Distro } from "../../distro.ts";
import { MergeRefused } from "../../files.ts";
import { writeBeside } from "../write.ts";
import { type Harness } from "../../persona.ts";

/** What an adapter is told about the machine and the run. */
export type InitSite = {
  readonly scope: "user" | "project";
  /** The home of the user the harness runs as. */
  readonly home: string;
  /** The folder of the project (the working folder). */
  readonly folder: string;
  /** The absolute path of the installed `ergonex`, written into every file (FR-034). */
  readonly ergonexPath: string;
  /** The brief, as Markdown. */
  readonly brief: string;
  readonly distro: Distro;
  readonly which: (name: string) => string | undefined;
  readonly run: (argv: readonly string[], cwd?: string) => Promise<{ readonly success: boolean; readonly stdout: string; readonly stderr: string }>;
};

/** One thing an adapter does. */
export type Step =
  | {
      readonly kind: "file";
      readonly path: string;
      readonly what: string;
      readonly edit: (old: string | undefined) => string;
      /** Where this folder must already be for the step to run: a harness that was never used gets no folder (FR-017). */
      readonly onlyIfDir?: string;
    }
  | {
      readonly kind: "command";
      readonly argv: readonly string[];
      readonly what: string;
      readonly cwd?: string;
      /** A command whose success says the step has been done: the step is then `unchanged`. */
      readonly probe?: readonly string[];
      readonly probeContains?: string;
    };

/** The port. */
export type HarnessAdapter = {
  readonly harness: Harness;
  readonly steps: (site: InitSite) => Promise<readonly Step[]>;
};

/** What happened to a step. */
export type StepResult = {
  readonly what: string;
  readonly target: string;
  readonly outcome: "changed" | "unchanged" | "would-change" | "skipped" | "failed";
  readonly detail?: string;
};

/** Carries out the steps, or, where `apply` is false, says what each would do and writes nothing. */
export async function runSteps(site: InitSite, steps: readonly Step[], apply: boolean): Promise<readonly StepResult[]> {
  const out: StepResult[] = [];
  for (const s of steps) {
    if (s.kind === "file") {
      if (s.onlyIfDir !== undefined && !existsSync(s.onlyIfDir)) {
        out.push({ what: s.what, target: s.path, outcome: "skipped", detail: `${s.onlyIfDir} does not exist: that harness has not been used here, so no folder is made for it` });
        continue;
      }
      try {
        const old = await readTextOr(s.path, undefined);
        const next = s.edit(old);
        if (old === next) out.push({ what: s.what, target: s.path, outcome: "unchanged" });
        else if (!apply) out.push({ what: s.what, target: s.path, outcome: "would-change" });
        else {
          await writeBeside(s.path, next);
          out.push({ what: s.what, target: s.path, outcome: "changed" });
        }
      } catch (e) {
        out.push({ what: s.what, target: s.path, outcome: "failed", detail: e instanceof MergeRefused || e instanceof Error ? e.message : String(e) });
      }
      continue;
    }
    const target = s.argv.slice(0, 3).join(" ");
    if (s.probe !== undefined) {
      const p = await site.run(s.probe, s.cwd);
      if (p.success && (s.probeContains === undefined || p.stdout.includes(s.probeContains))) {
        out.push({ what: s.what, target, outcome: "unchanged" });
        continue;
      }
    }
    if (!apply) {
      out.push({ what: s.what, target, outcome: "would-change" });
      continue;
    }
    const r = await site.run(s.argv, s.cwd);
    out.push(r.success ? { what: s.what, target, outcome: "changed" } : { what: s.what, target, outcome: "failed", detail: r.stderr.trim().split("\n")[0] ?? "the command failed" });
  }
  return out;
}

/** Where the instructions of the persona go: the one shared file of a distribution that has it (user scope), else `AGENTS.md` of the folder of the scope. */
export function instructionsFile(site: InitSite, harnessFolder: string): { readonly path: string; readonly shared: boolean } {
  const shared = site.scope === "user" ? site.distro.sharedInstructions(site.home) : undefined;
  if (shared !== undefined) return { path: shared, shared: true };
  return { path: `${harnessFolder}/AGENTS.md`, shared: false };
}

/** The folder a path is in. */
export const folderOf = dirname;
