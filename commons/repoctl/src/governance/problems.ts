// Spec: 0002-repoctl-governance FR-004
/**
 * The problem codes of Repoctl and what each means (commons repoctl 0002-repoctl-governance FR-004; commons headless 0003-headless-output FR-008): every problem a run can raise is one of a closed union of codes, and each code has an
 * explanation (a title, what happened, the likely cause and the fix) that `repoctl explain <code>` prints and the documentation renders. The registry holds one entry for every code, which the compiler checks.
 *
 * @example
 * ```ts
 * import { CATALOGUE, isProblemCode } from "./problems.ts";
 * isProblemCode("E-STALE-GENERATED"); // true
 * CATALOGUE["E-STALE-GENERATED"].fix; // "repoctl sync"
 * ```
 *
 * @module
 */

/** What `repoctl explain` says of a code: the shape of Headless' explanation, held here so that the governance imports no more than it needs. */
export type Explained = { readonly title: string; readonly what: string; readonly why: string; readonly fix: string };

/** The code of every problem: a closed union. */
export type ProblemCode =
  | "E-USAGE"
  | "E-ENVIRONMENT"
  | "E-STALE-GENERATED"
  | "E-GENERATOR-FAILED"
  | "E-SPEC-KIT"
  | "E-MIZAN-RULE"
  | "E-VERSIONS"
  | "E-ACCEPTANCE"
  | "E-AGENTS-SIZE"
  | "E-TYPES"
  | "E-VERSION-CONSTANT"
  | "E-UNDECLARED-DEPENDENCY"
  | "E-LIBRARY-CHECK"
  | "E-MERGE-FAILED"
  | "E-MERGE-CONFLICT"
  | "E-REGENERATE-FAILED"
  | "E-NPM-UNREACHABLE"
  | "E-RELEASE-RECORD"
  | "E-RELEASE-FAILED"
  | "E-PUBLISH-REFUSED"
  | "E-NO-TOKEN"
  | "E-NO-TARBALL"
  | "E-PUBLISH-FAILED"
  | "E-TRAIN-NOT-COMMITTED"
  | "E-TRAIN-NOT-PUSHED"
  | "E-TRAIN-CONSUMER"
  | "E-TRAIN-WAITING"
  | "E-TRAIN-INSTALL"
  | "E-TRAIN-VERIFY"
  | "E-COMMIT-SUBJECT"
  | "E-COMMIT-REFS"
  | "E-COMMIT-IMPACT"
  | "E-COMMIT-SESSION"
  | "E-COMMIT-FORBIDDEN"
  | "E-COMMIT-NOTHING"
  | "E-COMMIT-FAILED"
  | "E-LIBRARY-NAME"
  | "E-LIBRARY-RESERVED"
  | "E-LIBRARY-EXISTS"
  | "E-DOCTOR-INSTALL"
  | "E-DOCTOR-LINKS"
  | "E-DOCTOR-NODE"
  | "E-DOCTOR-BUN"
  | "E-DOCTOR-GIT"
  | "E-HYGIENE-GIT"
  | "E-HYGIENE-PATH"
  | "E-HYGIENE-IMPORT"
  | "E-HYGIENE-VENDORED"
  | "E-HYGIENE-DUPLICATE"
  | "E-HYGIENE-RANGE"
  | "E-HYGIENE-IDENTITY"
  | "E-PROVE-FAILED"
  | "E-PROVE-QUARANTINE"
  | "E-CHECK-FAILED"
  | "E-CONFIG-MISSING"
  | "E-CONFIG-LOAD"
  | "E-CONFIG-INVALID"
  | "E-DOCS-GENERATOR-MISSING"
  | "E-DOCS-FAILED"
  | "E-USAGE-UNKNOWN"
  | "E-NAMES-FOUND"
  | "E-CANARY"
  | "E-CANARY-CHANGED";

/** Every code, in the order the explanations are listed. */
export const PROBLEM_CODES: readonly ProblemCode[] = [
  "E-USAGE",
  "E-ENVIRONMENT",
  "E-STALE-GENERATED",
  "E-GENERATOR-FAILED",
  "E-SPEC-KIT",
  "E-MIZAN-RULE",
  "E-VERSIONS",
  "E-ACCEPTANCE",
  "E-AGENTS-SIZE",
  "E-TYPES",
  "E-VERSION-CONSTANT",
  "E-UNDECLARED-DEPENDENCY",
  "E-LIBRARY-CHECK",
  "E-MERGE-FAILED",
  "E-MERGE-CONFLICT",
  "E-REGENERATE-FAILED",
  "E-NPM-UNREACHABLE",
  "E-RELEASE-RECORD",
  "E-RELEASE-FAILED",
  "E-PUBLISH-REFUSED",
  "E-NO-TOKEN",
  "E-NO-TARBALL",
  "E-PUBLISH-FAILED",
  "E-TRAIN-NOT-COMMITTED",
  "E-TRAIN-NOT-PUSHED",
  "E-TRAIN-CONSUMER",
  "E-TRAIN-WAITING",
  "E-TRAIN-INSTALL",
  "E-TRAIN-VERIFY",
  "E-COMMIT-SUBJECT",
  "E-COMMIT-REFS",
  "E-COMMIT-IMPACT",
  "E-COMMIT-SESSION",
  "E-COMMIT-FORBIDDEN",
  "E-COMMIT-NOTHING",
  "E-COMMIT-FAILED",
  "E-LIBRARY-NAME",
  "E-LIBRARY-RESERVED",
  "E-LIBRARY-EXISTS",
  "E-DOCTOR-INSTALL",
  "E-DOCTOR-LINKS",
  "E-DOCTOR-NODE",
  "E-DOCTOR-BUN",
  "E-DOCTOR-GIT",
  "E-HYGIENE-GIT",
  "E-HYGIENE-PATH",
  "E-HYGIENE-IMPORT",
  "E-HYGIENE-VENDORED",
  "E-HYGIENE-DUPLICATE",
  "E-HYGIENE-RANGE",
  "E-HYGIENE-IDENTITY",
  "E-PROVE-FAILED",
  "E-PROVE-QUARANTINE",
  "E-CHECK-FAILED",
  "E-CONFIG-MISSING",
  "E-CONFIG-LOAD",
  "E-CONFIG-INVALID",
  "E-DOCS-GENERATOR-MISSING",
  "E-DOCS-FAILED",
  "E-USAGE-UNKNOWN",
  "E-NAMES-FOUND",
  "E-CANARY",
  "E-CANARY-CHANGED",
];

/** Whether a text is one of the codes. */
export function isProblemCode(text: string): text is ProblemCode {
  return PROBLEM_CODES.some((c) => c === text);
}

/** The explanation of every code: a registry the compiler holds complete. */
export const CATALOGUE: Readonly<Record<ProblemCode, Explained>> = {
  "E-USAGE": {
    title: "The command line does not fit",
    what: "The words after `repoctl` do not name a verb, an option or an operand it takes.",
    why: "A typing mistake, or an option of another verb.",
    fix: "repoctl help",
  },
  "E-ENVIRONMENT": {
    title: "This checkout cannot do it",
    what: "Something the run needs is not there: a program, a folder, a file or the network.",
    why: "Git, Bun or npm is not installed or not on the PATH, or the working folder is not this repository.",
    fix: "repoctl doctor",
  },
  "E-STALE-GENERATED": {
    title: "A generated file is stale",
    what: "A generator's own check says its files are not what it makes now from their sources.",
    why: "A source (a manifest, an about.ts, an ontology, a specification) changed and the generated files were not made again.",
    fix: "repoctl sync",
  },
  "E-GENERATOR-FAILED": {
    title: "A generator could not run",
    what: "A generator ended with a status that is neither success nor staleness, so what it makes is not known.",
    why: "A source it reads is broken (a manifest that does not decode, an ontology that breaks a rule), or its program is missing.",
    fix: "repoctl check",
  },
  "E-SPEC-KIT": {
    title: "A specification kit breaks the format",
    what: "The check of the specification format found a finding in a specification kit.",
    why: "A requirement without a row in enforcement.tsv, a number that is not in registry.tsv, or a form a specification must have.",
    fix: "run the command named in the finding and read its output",
  },
  "E-MIZAN-RULE": {
    title: "A rule of Mizan finds something",
    what: "The rules Mizan adds to the format found a finding that its baseline does not hold, or a line of the baseline that no longer occurs.",
    why: "A change that breaks a rule, or a fix that left its line in the baseline.",
    fix: "run the command named in the finding and read its output",
  },
  "E-VERSIONS": {
    title: "A version record is wrong",
    what: "The check of versions found a record that is wrong, an identity that changed, or a version that went back since the base.",
    why: "A version was raised by hand or lowered; versions grow only at the release.",
    fix: "run the command named in the finding and read its output",
  },
  "E-ACCEPTANCE": {
    title: "An accepted risk is wrong",
    what: "A typed file of accepted findings (commons/spec-kit/accepted-findings) has no reason, an end that is not a day or is more than 366 days ahead, an approver who is not on the list, a name that is not its finding's id, or accepts a finding twice.",
    why: "An acceptance is a person's word that a risk has been seen until a day (commons 0038-build-policy FR-008), and a file that breaks its rules would say it for no one.",
    fix: "run the command named in the finding and read its output",
  },
  "E-AGENTS-SIZE": {
    title: "AGENTS.md is past its budget",
    what: "The file AGENTS.md of the repository is more than 8 KiB or more than 80 lines (commons 0011-documentation FR-043).",
    why: "The agents that read the file document limits (the guidance of Claude Code is under 200 lines, the default cap of Codex is 32 KiB), and a long file is truncated or ignored in part; the rules belong in the specifications, and the file is their index.",
    fix: "State each rule in one or two sentences and point to the requirement, guide or generated page that states it in full; move the text to where it belongs first",
  },
  "E-TYPES": {
    title: "TypeScript 7 finds a type error",
    what: "The type check of the tests of the root, or of commons' tools, which no library's own check covers, found an error.",
    why: "A change to a test or a tool that does not type-check under the strict settings of the repository's base configuration.",
    fix: "run the command named in the finding and read its output",
  },
  "E-VERSION-CONSTANT": {
    title: "A constant of the sources disagrees with its library's version",
    what: "A constant named for a library (`TOOL_VERSION`) or named by its manifest in `versionConstants` does not say the version of its package.",
    why: "The release raised the version in the manifest and the package and a constant in a source was left at the old one.",
    fix: "Set the constant to the version of its library; list it in the manifest's versionConstants so that the release writes it",
  },
  "E-UNDECLARED-DEPENDENCY": {
    title: "A library imports a package its manifest does not declare",
    what: "A source, a test or a tool of a library imports a package by name (or a `node:` built-in, which needs `@types/node`) that its package.json declares neither in dependencies nor in devDependencies.",
    why: "A library job of CI installs only its own folder, so the import, or the types of Node, are found in a checkout with the whole repository installed and are missing there.",
    fix: "Add the package, at an exact version, to the devDependencies of the library's package.json (a library of commons as link:../<name>) and run bun install in its folder",
  },
  "E-LIBRARY-CHECK": {
    title: "The check of a library's own rules finds something",
    what: "A library's manifest or its folder breaks a rule that the register of libraries holds.",
    why: "A manifest that does not decode, a folder without its files, or a name that is held for a family.",
    fix: "repoctl check",
  },
  "E-MERGE-FAILED": {
    title: "The merge could not be made",
    what: "Git refused the merge for a reason that is not a conflict.",
    why: "Uncommitted changes in the working tree, or a reference that is not there.",
    fix: "git status",
  },
  "E-MERGE-CONFLICT": {
    title: "A file a person wrote conflicts",
    what: "The merge conflicts in a file that is not generated; it is left as Git left it, for a person.",
    why: "Both sides changed the same lines of a source or a document.",
    fix: "repoctl merge --help",
  },
  "E-REGENERATE-FAILED": {
    title: "A conflicted generated file could not be made again",
    what: "A generated file conflicted and its generator could not make it, so it stays unresolved.",
    why: "A source the generator reads is in conflict or broken.",
    fix: "repoctl sync",
  },
  "E-NPM-UNREACHABLE": {
    title: "npm could not be asked",
    what: "The registry of npm did not answer for a library, so its version there is not known.",
    why: "No network, a proxy, or a registry that is down.",
    fix: "repoctl status --offline",
  },
  "E-RELEASE-FAILED": {
    title: "The release could not be made",
    what: "The release stopped before it was made: a version that went back, a registry that could not be compared, a generator or a test that failed.",
    why: "A manifest is wrong, a tag is missing from the clone, or a test that packs a library failed.",
    fix: "repoctl release plan",
  },
  "E-RELEASE-RECORD": {
    title: "The release record is missing",
    what: "`release publish` reads commons/generated/release.auto.json and it is not there or does not decode.",
    why: "`release apply` was not run, or its record was not committed.",
    fix: "repoctl release apply",
  },
  "E-PUBLISH-REFUSED": {
    title: "The publication was refused",
    what: "`release publish` needs the releaser tier and a typed confirmation, and one of them is missing.",
    why: "REPOCTL_TIER is not releaser, or --confirm does not say the phrase that --dry-run printed.",
    fix: "repoctl release publish --dry-run",
  },
  "E-NO-TOKEN": {
    title: "There is no npm credential",
    what: "The variable INFRO_NPMJS_TOKEN is not set, so nothing can be sent to npm by hand.",
    why: "The token is held only by the person who publishes.",
    fix: "repoctl doctor",
  },
  "E-NO-TARBALL": {
    title: "A package was not packed",
    what: "The tarball of a library of the record is not under dist/.",
    why: "`release apply` did not pack it, or it is a library that names no npm.",
    fix: "repoctl release apply",
  },
  "E-PUBLISH-FAILED": {
    title: "npm did not take a package",
    what: "npm refused a package or the run could not start it; nothing was tagged.",
    why: "The version is on npm already with other files, the token may not publish the package, or the network failed.",
    fix: "repoctl status",
  },
  "E-TRAIN-NOT-COMMITTED": {
    title: "The release is not committed",
    what: "`release train` found a release waiting for its publication, and the release record is not tracked by Git or the working tree has a change.",
    why: "What `release apply` made was not committed with its record, and a publication asked for now would run on a commit that lacks it.",
    fix: "repoctl commit",
  },
  "E-TRAIN-NOT-PUSHED": {
    title: "The release commit is not on origin/main",
    what: "The commit at HEAD holds the release record, and `origin/main` as this checkout knows it does not contain it.",
    why: "The commit was not pushed, or this clone has not fetched the push.",
    fix: "git push origin HEAD:main",
  },
  "E-TRAIN-CONSUMER": {
    title: "A consumer cannot be read",
    what: "A directory given with `--consumer` is not a Git checkout, a tracked package.json is not JSON, or its commons-consumer.json is not what the specification says.",
    why: "A wrong path or a file that was edited by hand.",
    fix: "repoctl release train --help",
  },
  "E-TRAIN-WAITING": {
    title: "A consumer waits for the publication",
    what: "The install of a consumer cannot find the version of the release, so the consumer was left as it was.",
    why: "The release is not published yet, or the registry has not shown it yet.",
    fix: "repoctl release train --wait 300",
  },
  "E-TRAIN-INSTALL": {
    title: "A consumer could not install the release",
    what: "The install of a consumer failed for a reason other than a version that is not there yet; its manifest and lockfiles are as they were.",
    why: "A registry credential is missing in the environment, or a dependency of the consumer is wrong.",
    fix: "repoctl release train --help",
  },
  "E-TRAIN-VERIFY": {
    title: "A consumer does not pass its check",
    what: "A command of the consumer's commons-consumer.json ended with a failure after its pins moved.",
    why: "The new version changes something the consumer relies on.",
    fix: "repoctl release train --only PATH",
  },
  "E-COMMIT-SUBJECT": {
    title: "The commit subject is not valid",
    what: "The subject is empty, has more than one line, is longer than 100 characters or ends with a full stop.",
    why: "A subject written as a sentence or a paragraph.",
    fix: "repoctl commit --help",
  },
  "E-COMMIT-REFS": {
    title: "The issue number is not valid",
    what: "`--refs` is not an issue number.",
    why: "A word where digits were expected.",
    fix: "repoctl commit --help",
  },
  "E-COMMIT-IMPACT": {
    title: "The impact is not valid",
    what: "`--impact` is not major, minor or patch, or the repository's commits carry no `Impact:` line.",
    why: "A word other than the three impacts of a version, or a configuration whose trailers leave `impact` out.",
    fix: "repoctl commit --help",
  },
  "E-COMMIT-SESSION": {
    title: "The session address is missing or not valid",
    what: "The trailer Claude-Session needs an https address, from --session or CLAUDE_SESSION_URL.",
    why: "The variable is not set in this shell, or the address has a credential in it.",
    fix: "repoctl commit --help",
  },
  "E-COMMIT-FORBIDDEN": {
    title: "A file that must not be committed is staged",
    what: "A path under .claude/, under node_modules or one that looks like a secret is among the files to commit.",
    why: "A tool's local folder was added with `git add .`, or a key or a .env file was.",
    fix: "git restore --staged <path>",
  },
  "E-COMMIT-NOTHING": {
    title: "There is nothing to commit",
    what: "Nothing is staged and no path was given.",
    why: "The change was committed already or was never added.",
    fix: "git status",
  },
  "E-COMMIT-FAILED": {
    title: "Git did not make the commit",
    what: "Git refused the commit.",
    why: "A hook failed, or the repository is in the middle of a merge.",
    fix: "git status",
  },
  "E-LIBRARY-NAME": {
    title: "The library name is not valid",
    what: "The name is not lower-case letters, digits and hyphens starting with a letter.",
    why: "A capital, a space or an underscore.",
    fix: "repoctl new library --help",
  },
  "E-LIBRARY-RESERVED": {
    title: "The library name is held for a family",
    what: "The name is one that commons/libraries/src/family.ts holds for the library of a family.",
    why: "The names of the fleet libraries and their dialects are reserved.",
    fix: "repoctl new library --help",
  },
  "E-LIBRARY-EXISTS": {
    title: "The library exists",
    what: "A folder with this name is already in commons/.",
    why: "The library was made before.",
    fix: "repoctl status",
  },
  "E-DOCTOR-INSTALL": {
    title: "The dependencies are not installed",
    what: "The root has no node_modules, so no program can import a library.",
    why: "`bun install` was not run in this checkout.",
    fix: "bun install --frozen-lockfile",
  },
  "E-DOCTOR-LINKS": {
    title: "The libraries are not linked",
    what: "The folder under which the configuration's doctor policy says the libraries are linked does not link every library.",
    why: "A library was added and the links were not made again.",
    fix: "run the program the doctor policy names to link the libraries",
  },
  "E-DOCTOR-NODE": {
    title: "Node 26 is missing",
    what: "The program `node` is older than the least version the configuration's doctor policy names, or is not there.",
    why: "The machine has an older Node.",
    fix: "install the Node version the configuration's doctor policy names and put it first on the PATH",
  },
  "E-DOCTOR-BUN": {
    title: "Bun is not the pinned version",
    what: "The version of Bun is not the one the repository pins (the file the doctor policy names).",
    why: "Bun was installed by another route or not upgraded.",
    fix: "bun upgrade",
  },
  "E-DOCTOR-GIT": {
    title: "Git is not available or this is not a checkout",
    what: "`git` does not run here, or the folder is not a Git working tree with an origin.",
    why: "Git is not installed, or the folder is not a clone.",
    fix: "git --version",
  },
  "E-HYGIENE-IDENTITY": {
    title: "A merge commit was not made by the repository's identity",
    what: "A merge commit of the history has an author or a committer that is not the identity `commit.identity` of the configuration, and the configuration does not hold it in `commit.heldMerges`; or a held hash matches no merge of the history.",
    why: "A `git pull` or `git merge` made where `user.name` and `user.email` were not set takes the identity of the machine or the session, so the history credits another name. History is never rewritten: the commit stays, and only the held list can carry it.",
    fix: "git config user.name and user.email to the identity of the configuration before a pull, or merge with repoctl merge; list an old offender in commit.heldMerges",
  },
  "E-HYGIENE-GIT": {
    title: "A dependency by Git on the repository of commons",
    what: "A package.json depends on the family's own repository by Git (github:, git+https:, git: or ssh:, at a commit or not).",
    why: "The family's packages reach a repository only as published packages; a Git dependency installs sources that are not a release and is not the rule.",
    fix: "bun add <scope>/<package>@<version> --exact",
  },
  "E-HYGIENE-PATH": {
    title: "A path dependency into a checkout of commons",
    what: "A package.json has a file: or link: dependency whose path goes through the folder the hygiene policy names.",
    why: "A checkout of commons next to the repository was linked in place of installing the published package.",
    fix: "bun add <scope>/<package>@<version> --exact",
  },
  "E-HYGIENE-IMPORT": {
    title: "A relative import into a copy of commons",
    what: "A source imports a relative path that goes through the folder the hygiene policy names.",
    why: "A copy of the family sits in the repository and its files are imported by path.",
    fix: "import from the package, installed from a registry",
  },
  "E-HYGIENE-VENDORED": {
    title: "A vendored copy of a library of commons",
    what: "A folder of the repository, outside node_modules, carries a package of the policy's scope and is not the root package or a workspace the root declares.",
    why: "A package of the family was copied into the repository.",
    fix: "remove the folder and install the published package with --exact",
  },
  "E-HYGIENE-DUPLICATE": {
    title: "Two installed copies of one library",
    what: "The lockfile or node_modules holds one package of the policy's scope at two versions within the tree of one consumer (the top of the tree, or one workspace).",
    why: "Two dependencies of that consumer ask for different versions of it, or one is pinned and another is a range. Two workspaces that pin their own versions are not a duplicate.",
    fix: "pin one version with overrides in the package.json of that consumer and install again",
  },
  "E-HYGIENE-RANGE": {
    title: "A dependency that is not an exact version",
    what: "A dependency of the policy's scope is a range, a tag or latest.",
    why: "The family is installed as one coherent set per release; a range lets two releases meet in one tree.",
    fix: "bun add <package>@<version> --exact",
  },
  "E-PROVE-FAILED": {
    title: "A proof of the plan failed",
    what: "A proof that `repoctl prove` ran (a type check, a check of the specifications, a suite, a packing) ended with a failure.",
    why: "The change broke what that proof holds, or the proof is flaky: a failing property test prints its seed.",
    fix: "repoctl prove --why",
  },
  "E-PROVE-QUARANTINE": {
    title: "A quarantined test is past its expiry, or the record is wrong",
    what: "The quarantine record names a test whose expiry day has passed (it runs again), or the record is not a list of entries with a test, an owner, an expiry and a reason.",
    why: "A quarantine holds a flaky test back for a time and names who fixes it; it never holds one for good.",
    fix: "fix the test, or renew its entry with a new expiry and a reason",
  },
  "E-CHECK-FAILED": {
    title: "A check of the repository found something",
    what: "A named check of the repository's configuration ended with 1 and said what is wrong, line by line.",
    why: "What the check judges is wrong in this checkout.",
    fix: "run the check's own command, named in the finding, and read its output",
  },
  "E-CONFIG-MISSING": {
    title: "This repository has no repoctl.config.ts",
    what: "No `repoctl.config.ts` is in this folder or above it, and `--config` did not name one.",
    why: "repoctl is driven by a typed configuration at the root of the repository it operates; without one it knows no generator, check or rule.",
    fix: "write repoctl.config.ts at the root of the repository (see the guide: repoctl in your repository)",
  },
  "E-CONFIG-LOAD": {
    title: "The configuration could not be loaded",
    what: "`repoctl.config.ts` could not be imported, or it exports no configuration (its default export or `config`).",
    why: "A syntax error, an import that is not installed, or a file that exports nothing.",
    fix: "run the file with bun or node to read the error, and export `defineConfig({ ... })` as the default",
  },
  "E-CONFIG-INVALID": {
    title: "The configuration is not valid",
    what: "`repoctl.config.ts` was loaded and says something that cannot be: an id used twice, a generator that waits for one that is not there, a capability that needs `libraries`, a variable that is not a name.",
    why: "A typing mistake in the configuration; every reason is listed.",
    fix: "correct each reason listed, then run repoctl doctor",
  },
  "E-DOCS-GENERATOR-MISSING": {
    title: "The documentation generator is not installed",
    what: "The generator `ifc-docs` cannot be imported from this repository: neither the entry `./docs` of the one package `@intellectual-frontiers/commons` (`single` mode) nor the package `@intellectual-frontiers/docs` (`per-library` mode) is installed.",
    why: "`repoctl docs` wraps the generator and does not carry it: it is an optional peer of repoctl.",
    fix: "bun add --dev @intellectual-frontiers/commons (or npm install --save-dev @intellectual-frontiers/commons) in `single` mode; bun add --dev @intellectual-frontiers/docs in `per-library` mode. The generator names its own optional peers (shiki, beautiful-mermaid, typescript) when one is missing: install them too.",
  },
  "E-DOCS-FAILED": {
    title: "The documentation generator reported a failure",
    what: "The generator ended with a status that is not 0, or could not be served.",
    why: "The site has a finding (its lines are above), or the configuration file named by `docs.config` is wrong.",
    fix: "repoctl docs check",
  },
  "E-USAGE-UNKNOWN": {
    title: "A library the package does not hold is imported",
    what: "A file of the repository imports `@intellectual-frontiers/commons/<library>` and the installed package has no library of that name; it is not counted.",
    why: "A library that was renamed or removed, a library of a newer version than the one installed, or a path that only looks like an import.",
    fix: "install the version of the package the repository was written against, or correct the import",
  },
  "E-NAMES-FOUND": {
    title: "A file says a name it must not",
    what: "A file in the scope of the check holds a name from the names files, as a whole phrase in any case, where no allowance covers it.",
    why: "A fixture, a specification or a test that was written with a real tenant, host, network or retired name instead of a synthetic one.",
    fix: "replace it with a synthetic name (synthetic-<kind>-NN), or add an allowance for the path where the name is public",
  },
  "E-CANARY": {
    title: "A canary file passed the secret scanner",
    what: "A file holds text that looks like a secret and is one of the canary files the configuration pins by path and digest, and its content is the pinned one. It is told, not refused: it never fails a commit or a build.",
    why: "The canaries are text that looks like a secret and is not one, kept in one module so that tests can hand a program a fake key or token without holding one in their own files.",
    fix: "nothing: the finding is informational; a file that is not pinned, or is edited, is refused as an ordinary holder of a secret",
  },
  "E-CANARY-CHANGED": {
    title: "A pinned canary file is missing or is not the pinned content",
    what: "A file that commit.forbidden.canaries pins is not there, or its content has another SHA-256 than the one pinned, so the scanner no longer lets it pass.",
    why: "The canary file was edited (a canary was added or changed) and the pin of the configuration was not changed with it, or the file was moved or removed.",
    fix: "sha256sum the file, check that it holds only canaries and no real secret, and pin the digest in commit.forbidden.canaries of repoctl.config.ts (the owner's change), or remove the pin",
  },
};
