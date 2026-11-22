// Spec: 0001-ergonex FR-010
/**
 * The problem codes of `ergonex` and what each means (commons 0001-ergonex FR-010; commons headless 0003-headless-output FR-008): every rule that can make a finding is a stable code (`E-` and the rule's words in capitals), and `ergonex explain <code>`
 * says what happened, the likely cause and the fix. The catalogue is Headless' data of the program: the mechanism that finds, translates and writes an explanation is Headless', the words are Ergonex's.
 *
 * @remarks
 * A rule is `ergonex/<words>` (or `changes/<words>` for a commit message, which commons 0020-ifccm owns), and its code is `E-` and the words, upper-case, joined by dashes: `ergonex/repository-diverged` is `E-REPOSITORY-DIVERGED`. A rule that is
 * made from a word of a union (`ergonex/tool-too-old`) is one entry for each word. `tests` prove that every rule written in the sources has an entry here.
 *
 * @example
 * ```ts
 * import { codeOfRule } from "./catalogue.ts";
 * codeOfRule("ergonex/repository-diverged"); // "E-REPOSITORY-DIVERGED"
 * ```
 *
 * @module
 */
import type { Catalogue, Explanation, RawPattern } from "@intellectual-frontiers/headless/logical";

/** The code of a rule: `E-` and the rule's words in capitals, joined by dashes. */
export function codeOfRule(ruleId: string): string {
  const words = ruleId
    .replace(/^(?:ergonex|changes)\//, (m) => (m.startsWith("changes") ? "changes-" : ""))
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `E-${words === "" ? "FAILED" : words}`;
}

/** One rule and its explanation: the rule, a title, what happened, the likely cause and the fix. */
type Row = readonly [rule: string, title: string, what: string, why: string, fix: string];

const ROWS: readonly Row[] = [
  ["ergonex/usage", "The command line does not fit", "The words after `ergonex` do not name a command, an option or an argument it takes.", "A typing mistake, or an option of another command.", "ergonex help"],
  ["ergonex/environment", "This computer cannot do it", "Something the run needs is not there: a program, the root, a file, or a place to write.", "Git is not installed, the root does not exist, or a folder cannot be written.", "ergonex doctor"],
  ["ergonex/evidence", "The evidence record could not be written", "Every run leaves one record under the workspace's state folder, and this run could not write it.", "The state folder is not writable or the disk is full.", "ergonex paths"],
  ["ergonex/loopback-http", "http to the loopback interface is accepted", "ERGONEX_ALLOW_LOOPBACK_HTTP is set, so a pinned artifact may be fetched over http from this computer.", "A person's own local mirror or a test sets it on purpose; the SHA-256 is still checked.", "unset ERGONEX_ALLOW_LOOPBACK_HTTP"],
  ["ergonex/manifest-shape", "The manifest does not decode", "`.ergonex/workspace.ts` is not the shape of a manifest, or could not be loaded.", "A field has the wrong type, or the file has a syntax error.", "ergonex doctor"],
  ["ergonex/manifest-remote", "A repository's remote is not valid", "A remote in the manifest is not a repository on a Git host.", "A path on this computer, or an address with a credential in it.", "ergonex repos remove"],
  ["ergonex/manifest-path", "A repository's path is not portable", "The path a remote makes is not valid on Linux, macOS and Windows alike.", "A name with a reserved word, a trailing dot or a character Windows refuses.", "ergonex doctor"],
  ["ergonex/manifest-branch", "A branch is not valid", "A branch in the manifest is not a branch name Git accepts.", "A space, a colon or another character Git refuses in a ref name.", "ergonex doctor"],
  ["ergonex/manifest-host", "A Git host is not valid", "A host in the manifest is not a host name.", "A port, a scheme or a credential in the name.", "ergonex doctor"],
  ["ergonex/manifest-signing", "The signing policy is not valid", "The manifest's signing policy names something the policy does not know.", "A misspelt key, or a domain that is not a list of words.", "ergonex doctor"],
  ["ergonex/manifest-module", "A registered module is not valid", "A module the manifest registers has no valid name or program.", "A name with a character a module name may not have.", "ergonex doctor"],
  ["ergonex/catalog-shape", "The tool catalog does not decode", "The tool catalog in the manifest is not the shape of a catalog.", "A field is missing or has the wrong type.", "ergonex doctor"],
  ["ergonex/catalog-tool", "A tool of the catalog is not valid", "A tool is pinned to something that is not a version, or has no artifact for a system.", "`latest`, a range, an address that is not https, or a hash that is not SHA-256.", "ergonex doctor"],
  ["ergonex/path-collision", "Two repositories make the same path", "Two repositories of the manifest would be the same folder on a system that ignores the case of names.", "Two remotes that differ only in upper and lower case.", "ergonex repos remove"],
  ["ergonex/host-not-allowed", "The Git host is not allowed", "A repository is on a host that the manifest's policy does not allow.", "A new host was added to the list without updating the policy.", "ergonex doctor"],
  ["ergonex/state-record", "The state record is damaged", "The state record in ergonex's state folder cannot be read.", "It was edited by hand or truncated.", "ergonex render"],
  ["ergonex/generated-path", "A template made a file that is refused", "A generated file would be at a path that is not valid on every system.", "A group name that is not a portable name.", "ergonex doctor"],
  ["ergonex/generated", "The generated files are as they should be", "Every generated file is as written and as the templates give it now.", "Nothing is wrong.", "ergonex verify"],
  ["ergonex/generated-missing", "A generated file is missing", "A file that was written is not on disk.", "It was deleted.", "ergonex render"],
  ["ergonex/generated-unrecorded", "A generated file is not in the state record", "A generated file is on disk but the state record does not name it.", "The record was lost, or the file was copied in.", "ergonex render"],
  ["ergonex/generated-drift", "The templates give something else now", "A generated file is as it was written, but the templates now make different text.", "Ergonex or the manifest changed since it was written.", "ergonex render"],
  ["ergonex/generated-edited", "A generated file was edited by hand", "A generated file is not as it was written, so ergonex will not overwrite it.", "A person edited it.", "ergonex render --force"],
  ["ergonex/render-would-change", "A generated file would change", "`render --check` found a generated file that differs from what the templates give now.", "The manifest or ergonex changed since the files were rendered.", "ergonex render"],
  ["ergonex/apply-refused", "An action was refused", "`apply` did not carry out an action, to protect work that exists nowhere else.", "A folder is not the repository the manifest names, or a generated file was edited.", "ergonex plan"],
  ["ergonex/apply-failed", "An action failed", "`apply` tried an action and Git or the file system refused it.", "No network, a missing branch, or no right to write.", "ergonex status"],
  ["ergonex/wrong-remote", "A folder is a clone of another repository", "The folder is a repository, but its origin is not the one the manifest names.", "A different repository was cloned there.", "ergonex status"],
  ["ergonex/not-a-repository", "A folder is not a Git repository", "Something is at the path of a repository that is not a clone.", "A folder was made by hand.", "ergonex status"],
  ["ergonex/repository-diverged", "A repository has diverged from its remote", "It has commits its remote does not have, and the remote has commits it does not have.", "Work was committed here and pushed from elsewhere; only a person merges.", "ergonex status"],
  ["ergonex/repository-locked", "A repository has a Git lock file", "Another process may be working in it, and ergonex never removes a lock.", "A running Git, or one that was killed.", "ergonex status"],
  ["ergonex/unmanaged-repository", "A repository is under the root but not in the manifest", "A clone is in the workspace that the manifest does not name.", "It was cloned by hand.", "ergonex repos adopt"],
  ["ergonex/worktree-base", "A worktree cannot be made here", "The repository is missing, locked, a clone of another repository or not a repository.", "It has not been cloned yet.", "ergonex apply"],
  ["ergonex/modules-file", "The registered modules file cannot be read", "`.ergonex/modules.auto.json` does not decode.", "It was edited by hand.", "ergonex render"],
  ["ergonex/module-name", "A program is not named as a module", "An `ergonex-*` program on the PATH has a name a module may not have.", "A name with a dot or a capital letter.", "ergonex modules"],
  ["ergonex/module-hidden", "A module is hidden by another", "A module of a later source has the name of one found first.", "A built-in command has the same name.", "ergonex modules"],
  ["ergonex/module-outside-catalog", "A module is outside the catalog", "An `ergonex-*` program is on the PATH or registered, and the tool catalog does not list it.", "It was installed by hand.", "ergonex tools"],
  ["ergonex/module-probe-timeout", "A module did not answer in time", "`modules --probe` waited for the manifest of a module and none came.", "The module is slow, or is not an ergonex module.", "ergonex modules --probe --probe-timeout 10"],
  ["ergonex/unknown-module", "A module is not known", "No module has that name.", "A typing mistake.", "ergonex modules"],
  ["ergonex/tool-outside-catalog", "A tool is outside the catalog", "A tool is in ergonex's tools folder and the catalog does not list it.", "It was copied in by hand.", "ergonex tools"],
  ["ergonex/tool-drift", "An installed tool is not as pinned", "An installed tool's files differ from the install record.", "It was changed after it was installed.", "ergonex setup"],
  ["ergonex/tool-ok", "A tool is as expected", "The tool is installed at a version that is enough.", "Nothing is wrong.", "ergonex tools"],
  ["ergonex/tool-too-old", "A tool is too old", "The tool is installed, but older than the minimum.", "An old install.", "ergonex doctor"],
  ["ergonex/tool-missing", "A tool is missing", "The tool is not on the PATH.", "It is not installed.", "ergonex doctor"],
  ["ergonex/tool-unreadable", "A tool's version cannot be read", "`<tool> --version` printed nothing that is a version.", "Another program has the name.", "ergonex doctor"],
  ["ergonex/setup-manifest", "Setup could not read the manifest", "`setup` stopped before it changed anything.", "The manifest does not decode.", "ergonex doctor"],
  ["ergonex/setup-apply", "Setup could not carry out a step", "A step of the plan failed.", "No network, a hash that differs, or no right to write.", "ergonex setup --dry-run"],
  ["ergonex/setup-install", "A tool could not be installed", "The artifact could not be fetched or its SHA-256 differs from the pin.", "A wrong pin, or a changed artifact.", "ergonex tools"],
  ["ergonex/setup-longpaths", "Windows long paths need an administrator", "Long paths are off and this run is not elevated.", "A person without administrator rights.", "ergonex setup"],
  ["ergonex/setup-git-include", "The global Git include was not added", "The include of the generated Git configuration was not written.", "No terminal to ask on, or a configuration ergonex cannot edit.", "ergonex setup --git-include"],
  ["ergonex/windows-long-paths", "Windows long paths are not enabled", "Long paths are off, and a path of the workspace may be longer than 259 characters.", "The Windows default.", "ergonex setup"],
  ["ergonex/path-too-long", "A path is too long for Windows", "A path of the workspace is longer than Windows allows while long paths are off.", "A deep group or a long repository name.", "ergonex setup"],
  ["ergonex/path-length", "Paths of the workspace are near the limit", "A path of the workspace is near the length Windows allows.", "A deep root.", "ergonex doctor"],
  ["ergonex/repo-path-room", "A repository's path leaves little room", "A repository's own path leaves little room for the files inside it on Windows.", "A deep root.", "ergonex doctor"],
  ["ergonex/repo-path-too-long", "A repository's path is too long", "A repository's own path is too long for the system.", "A deep root or a long name.", "ergonex doctor"],
  ["ergonex/runtime", "The runtime is not the one expected", "ergonex runs on Bun by default and Node 26 as the backup.", "An older runtime.", "ergonex doctor"],
  ["ergonex/enx", "Another program is named enx", "A program named enx is on the PATH, so the short name enx of `ergonex shell` is not defined (it is defined only where none is found); ergonex always works.", "Another tool, such as a package of the same name, put an enx on the PATH.", "which -a enx"],
  ["ergonex/tool", "A tool that ergonex needs is not usable", "Git, Bun or Node is missing or too old.", "It is not installed.", "ergonex doctor"],
  ["ergonex/filesystem", "The file system of the root is not suitable", "The root is on a file system that is case-insensitive or does not keep Git's files safe.", "A network or removable disk.", "ergonex doctor"],
  ["ergonex/hooks", "A repository's hooks are not the generated ones", "The repository does not use the hooks folder that ergonex generates.", "It has not been configured yet.", "ergonex apply"],
  ["ergonex/token", "The token for reading packages is not ready", "ERGONEX_GITHUB_TOKEN is not set, or GitHub CLI is not there to provide it.", "A shell without the ergonex snippet.", "ergonex shell install bash"],
  ["ergonex/plaintext-token", "A token is written in a file", "A file of the workspace holds text of the shape of a credential.", "A token was pasted into a file.", "ergonex doctor"],
  ["ergonex/scan-refused", "A file was not scanned", "A file was left out of the scan of plaintext tokens, and the finding says why.", "It is outside the workspace or too large.", "ergonex doctor"],
  ["ergonex/commit-not-signed", "A commit is not signed", "A local commit is not signed and verified.", "Signing is not set up for this repository.", "git commit --amend --no-edit -S"],
  ["ergonex/commit-signing-waived", "Signing is waived for a repository", "The repository's own record waives the signed-commit rule for a bot account.", "A decision of that repository.", "ergonex doctor"],
  ["ergonex/signing-waiver-unread", "A waiver could not be read", "A repository's record of decisions could not be read, so no waiver of it holds.", "The file is missing or not valid.", "ergonex doctor"],
  ["ergonex/unsigned-commit", "A pushed commit is not signed", "A commit that is being pushed is not signed and verified.", "Signing is not set up.", "git commit --amend --no-edit -S"],
  ["changes/commit-names-no-issue", "A commit names no issue", "The message has no `Refs #N` line.", "A message written without the rule of 0020-ifccm.", "git commit --amend"],
  ["changes/wrong-closing-word", "A commit uses a closing word a host reads", "A word like `Fixes` closes an issue on a host that reads it.", "An habit from another project.", "git commit --amend"],
];

/** The explanation of every code, by code. */
export const CATALOGUE: Catalogue = Object.fromEntries(
  ROWS.map(([rule, title, what, why, fix]): [string, Explanation] => [codeOfRule(rule), { title, what, why, fix }]),
);

/** The rules the catalogue explains, as the sources write them. */
export const RULES: readonly string[] = ROWS.map((r) => r[0]);

/** The raw errors of other programs that are recognized and given a code: Git's answers that a person meets most. */
export const PATTERNS: readonly RawPattern[] = [
  [/Could not resolve host|unable to access .*: Could not resolve/i, "E-ENVIRONMENT"],
  [/Permission denied \(publickey\)|Authentication failed/i, "E-ENVIRONMENT"],
];
