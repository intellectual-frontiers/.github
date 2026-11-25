// Spec: 0005-workbench-resolution FR-006
/**
 * The probe: reads the facts of the machine the requirements ask about, and only those. A program is looked for on the PATH and asked its version by running it with the argument vector the requirement names (never a shell);
 * a credential is only ever a NAME found in the environment, and its value is dropped at once; a Git ref and the identity are read with Git; an install is a folder with its `node_modules`.
 *
 * @example
 * ```ts
 * import { probe } from "./probe.ts";
 * // const facts = await probe(requirements, { root: process.cwd(), env: process.env });
 * ```
 *
 * @module
 */
import type { Facts } from "@intellectual-frontiers/workbench/logical";
import type { Requirement } from "@intellectual-frontiers/workbench/governance";
import { fs, path, proc } from "@intellectual-frontiers/system";

/** What the probe reads from: the repository's root and the environment. */
export type ProbeOptions = { readonly root: string; readonly env: Readonly<Record<string, string | undefined>> };

const VERSION = /\d+(?:\.\d+)+/u;

/** The facts about the machine for the requirements: the version of each program, the names set in the environment, the refs, the identity and the installs. */
export async function probe(requirements: readonly Requirement[], options: ProbeOptions): Promise<Facts> {
  const programs: Record<string, string | undefined> = {};
  const refs = new Set<string>();
  const installed = new Set<string>();
  let identity = true;
  for (const r of requirements) {
    if (r.kind === "program") {
      if (proc.which(r.name) === undefined) {
        programs[r.name] = undefined;
        continue;
      }
      const argv = r.probe ?? [r.name, "--version"];
      const out = await proc.run(argv, { cwd: options.root }).catch(() => undefined);
      programs[r.name] = VERSION.exec(`${out?.stdout ?? ""}\n${out?.stderr ?? ""}`)?.[0] ?? "";
    } else if (r.kind === "git" && r.check === "ref-present" && r.ref !== undefined) {
      const out = await proc.run(["git", "-C", options.root, "rev-parse", "--verify", "--quiet", `${r.ref}^{commit}`]).catch(() => undefined);
      if (out?.success === true) refs.add(r.ref);
    } else if (r.kind === "git" && r.check === "identity-set") {
      const out = await proc.run(["git", "-C", options.root, "config", "user.email"]).catch(() => undefined);
      identity = out?.success === true && out.stdout.trim() !== "";
    } else if (r.kind === "install" && (await fs.exists(path.join(options.root, r.folder, "node_modules")))) {
      installed.add(r.folder);
    }
  }
  const env = new Set(Object.entries(options.env).filter(([, v]) => v !== undefined && v !== "").map(([k]) => k));
  return { programs, env, refs, identity, installed, network: {} };
}
