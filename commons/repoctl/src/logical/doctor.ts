// Spec: 0005-repoctl-library-commit-doctor FR-008
/**
 * `repoctl doctor` (commons repoctl 0005-repoctl-library-commit-doctor FR-008): what is wrong with this checkout and what to do about it, in the order a person would fix it: Git and the checkout, the installed dependencies, the links of the libraries,
 * Node 26, the version of Bun the packaging ontology pins, and the generated files that are stale. The facts are gathered through the ports; the diagnosis is a function of the facts.
 *
 * @example
 * ```ts
 * import { diagnose } from "./doctor.ts";
 * diagnose({ git: { works: true, inside: true, origin: true }, installed: true, unlinked: [], node: "v26.13.1", bun: "1.4.4", pinnedBun: "1.4.4", stale: [] }); // []
 * ```
 *
 * @module
 */
import type { Generator } from "@intellectual-frontiers/repoctl/governance";
import { finding, type Finding } from "./findings.ts";
import type { World } from "./ports.ts";
import { findingsOfSync, runSync } from "./sync.ts";

/** What is found of the checkout and the tools. */
export type Facts = {
  readonly git: { readonly works: boolean; readonly inside: boolean; readonly origin: boolean };
  /** Whether the root has its `node_modules`. */
  readonly installed: boolean;
  /** The libraries that are not linked under `commons/node_modules`. */
  readonly unlinked: readonly string[];
  /** What `node --version` says, or undefined where Node does not run. */
  readonly node: string | undefined;
  /** What `bun --version` says. */
  readonly bun: string | undefined;
  /** The version of Bun the packaging ontology pins. */
  readonly pinnedBun: string | undefined;
  /** The generated files that are stale. */
  readonly stale: readonly Finding[];
};

/** The major number of a version such as `v26.13.1`, or undefined. */
export function majorOf(version: string | undefined): number | undefined {
  const m = /^v?(\d+)\./.exec(version ?? "");
  return m?.[1] === undefined ? undefined : Number(m[1]);
}

/** Everything wrong, in the order to fix it. */
export function diagnose(f: Facts): readonly Finding[] {
  const out: Finding[] = [];
  if (!f.git.works) out.push(finding("fail", "E-DOCTOR-GIT", "git does not run here", "install Git and run repoctl doctor again"));
  else if (!f.git.inside) out.push(finding("fail", "E-DOCTOR-GIT", "this folder is not inside a Git working tree", "run repoctl from a clone of the repository"));
  else if (!f.git.origin) out.push(finding("warn", "E-DOCTOR-GIT", "this checkout has no remote named origin, so the tags and the base of the checks are not known", "git remote add origin <address of the repository>"));
  if (!f.installed) out.push(finding("fail", "E-DOCTOR-INSTALL", "the root has no node_modules", "bun install --frozen-lockfile"));
  if (f.unlinked.length > 0) out.push(finding("fail", "E-DOCTOR-LINKS", `the libraries are not linked: ${f.unlinked.join(", ")}`, "bun commons/libraries/src/link.ts"));
  const major = majorOf(f.node);
  if (major === undefined || major < 26) out.push(finding("fail", "E-DOCTOR-NODE", `Node is ${f.node ?? "not available"} and commons needs Node 26`, "install Node 26 and put it first on the PATH"));
  if (f.bun !== undefined && f.pinnedBun !== undefined && f.bun !== f.pinnedBun)
    out.push(finding("warn", "E-DOCTOR-BUN", `Bun is ${f.bun} and the packaging ontology pins ${f.pinnedBun}`, `bun upgrade --version ${f.pinnedBun}`));
  return [...out, ...f.stale];
}

const firstLine = (text: string): string | undefined =>
  text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l !== "");

/** Gathers the facts through the ports. */
export async function gatherFacts(w: World, order: readonly Generator[]): Promise<Facts> {
  const here = { cwd: w.repo };
  const git = await w.process.run(["git", "--version"], here).catch(() => ({ code: 127, stdout: "", stderr: "" }));
  const inside = git.code === 0 && (await w.process.run(["git", "rev-parse", "--is-inside-work-tree"], here)).stdout.trim() === "true";
  const origin = inside && (await w.process.run(["git", "remote", "get-url", "origin"], here)).code === 0;
  const node = await w.process.run(["node", "--version"], here).catch(() => ({ code: 127, stdout: "", stderr: "" }));
  const bun = await w.process.run(["bun", "--version"], here).catch(() => ({ code: 127, stdout: "", stderr: "" }));
  const pins = await w.files.read(`${w.repo}/commons/generated/pins.auto.env`);
  const pinnedBun = pins === undefined ? undefined : /^BUN_VERSION=(.+)$/m.exec(pins)?.[1]?.trim();
  const installed = await w.files.exists(`${w.repo}/node_modules`);
  const libs = await w.libraries.list();
  const linked = await w.files.list(`${w.repo}/commons/node_modules/@intellectual-frontiers`);
  const unlinked = libs.kind === "ok" ? libs.value.map((l) => l.name).filter((n) => !linked.includes(n)) : [];
  const stale = installed ? findingsOfSync(await runSync(w, "check", order)) : [];
  return {
    git: { works: git.code === 0, inside, origin },
    installed,
    unlinked,
    node: node.code === 0 ? firstLine(node.stdout) : undefined,
    bun: bun.code === 0 ? firstLine(bun.stdout) : undefined,
    pinnedBun,
    stale,
  };
}
