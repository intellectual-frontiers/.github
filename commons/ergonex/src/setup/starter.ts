// Spec: 0001-ergonex FR-018
/**
 * The starter manifest `ergonex setup --apply` writes where the workspace has none (commons 0001-ergonex FR-018): a TypeScript module that names no repository yet, with the places a person adds
 * them, the tool catalog and the policy, as comments. It is never written over an existing manifest.
 *
 * @module
 */

/** The name of the manifest inside the root. */
export const MANIFEST_FILE = "workspace.ts";

/** The text of the starter manifest: an empty list of repositories, ready to be filled in. */
export function starterManifest(): string {
  return [
    "/**",
    " * The manifest of this workspace (Intellectual Frontiers Workspaces): the repositories it holds, the tools it approves and its policy.",
    " * Edit it, then run `ergonex plan` to see what would change and `ergonex apply` to bring the workspace to it.",
    " */",
    "export default {",
    "  repositories: [",
    '    // { remote: "https://github.com/owner/repository" },',
    "  ],",
    '  // gitlabHosts: ["gitlab.example.com"],',
    "  // policy: { regulatedDomain: [], requiresSignedCommits: false },",
    '  // tools: [{ name: "example", version: "1.2.3", artifacts: [{ os: "linux", arch: "x64", url: "https://example.com/example-1.2.3.tar.gz", sha256: "<64 hex digits>", kind: "tar.gz", bin: "example" }] }],',
    "};",
    "",
  ].join("\n");
}
