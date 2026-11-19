// Spec: 0004-onboarding FR-002
/**
 * Putting `ergonex` on the person's path (commons ergonex 0004-onboarding FR-002, commons 0031-install-locations FR-005): by the runtime's own global install and no file of ours, so that the command is found where the
 * runtime puts the programs it installs (Bun's global folder, npm's) and not where we made up. What the global install is, and how a run tells a copy installed from a registry from a checkout. All pure: `host/path.ts` runs it.
 *
 * @module
 */

/** How the command is started again: from the registry by its package and version, or from the files that are running now (a checkout, which is not installed). */
export type Launch =
  | {
      readonly kind: "registry";
      readonly runtime: "bun" | "node";
      readonly spec: string;
    }
  | {
      readonly kind: "local";
      readonly runtime: "bun" | "node";
      readonly entry: string;
    };

/** The package a person installs. */
export const PACKAGE = "@intellectual-frontiers/ergonex";

/** Whether the files that run are a copy a package manager keeps (a registry install, `bunx` or `npx`) and not a checkout. */
export function isRegistryCopy(entry: string): boolean {
  return /(^|[\\/])(node_modules|_npx)([\\/]|$)|[\\/]\.bun[\\/]install[\\/]cache[\\/]/.test(entry);
}

/** How the command is started again, from what runs now. */
export function launchFor(f: { readonly runtime: "bun" | "node"; readonly entry: string; readonly version: string }): Launch {
  return isRegistryCopy(f.entry)
    ? { kind: "registry", runtime: f.runtime, spec: `${PACKAGE}@${f.version}` }
    : { kind: "local", runtime: f.runtime, entry: f.entry };
}

/** The command that installs the package for every terminal: Bun's global install, or npm's where Node ran it. */
export function globalInstall(l: Extract<Launch, { kind: "registry" }>): readonly string[] {
  return l.runtime === "bun" ? ["bun", "add", "-g", l.spec] : ["npm", "install", "-g", l.spec];
}
