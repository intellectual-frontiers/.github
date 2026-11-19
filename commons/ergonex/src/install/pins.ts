// Spec: 0004-onboarding FR-008
/**
 * What the installers pin (commons ergonex 0004-onboarding FR-008, commons 0031-install-locations FR-006): the version of Bun that its own installer is asked for on Linux and macOS, and the WinGet package
 * identifiers of the prerequisites on Windows. Nothing is downloaded by an installer of ours and put in a folder of ours: Bun's own installer puts Bun where Bun keeps itself, and WinGet installs the rest.
 *
 * @module
 */

/** The version of Bun that its own installer is asked for where there is no Bun (the same that commons pins, which `suite/ergonex-install.test.ts` compares where commons is beside this library). */
export const BUN_VERSION = "1.4.4";

/** Where Bun's own installer is. */
export const BUN_INSTALLER = "https://bun.sh/install";

/** The WinGet package identifiers of the prerequisites on Windows (to verify against the WinGet repository before a release): the runtimes, Git and GitHub CLI. */
export const WINGET = {
  bun: "Oven-sh.Bun",
  node: "OpenJS.NodeJS",
  git: "Git.Git",
  gh: "GitHub.cli",
} as const;
