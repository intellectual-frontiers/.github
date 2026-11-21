// Spec: 0009-repoctl-config FR-001
/**
 * The configuration of a repository (commons repoctl 0009-repoctl-config FR-001 to FR-006): `repoctl.config.ts` at the repository's root says everything `repoctl` knows of the repository it operates, as typed data. `defineConfig` is
 * the one way a configuration is written (it checks the shape and is the identity); `parseConfig` is the one way the host reads one (it makes every identity by its smart constructor and says every reason a configuration is wrong, at once).
 * Nothing about any repository is in the host: the generators, the checks, the commit rules, the hygiene policy, the doctor's pins, the names of the variables and the optional verbs are all here.
 *
 * @example
 * ```ts
 * import { defineConfig, parseConfig } from "./config.ts";
 * const input = defineConfig({
 *   repo: "app",
 *   commit: { identity: { name: "A B", email: "a@example.test" }, issue: { prefix: "Refs #", required: false }, trailers: ["issue"] },
 * });
 * parseConfig(input).kind; // "ok"
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Check } from "./checks.ts";
import type { Generator, Step, StepFunction } from "./generators.ts";
import { type Identity } from "./identity.ts";
import { parseStepId, parseVariableName, type VariableName } from "./ids.ts";
import { isProblemCode, type ProblemCode } from "./problems.ts";
import type { VerbId } from "./verbs.ts";

/** The trailers a commit may carry, in the order a configuration lists them: the reference to an issue, the impact on a version, the line that credits the agent and the address of the session. */
export type TrailerKind = "issue" | "impact" | "co-author" | "session";

/** Every trailer, in the order of the documentation. */
export const TRAILER_KINDS: readonly TrailerKind[] = ["issue", "impact", "co-author", "session"];

/** A path that must not be committed, by a glob from the repository's root, and the reason said to the person. */
export type ForbiddenPath = { readonly glob: string; readonly why: string };

/** A text that looks like a secret: a regular expression's source and what it looks like. */
export type SecretPattern = { readonly pattern: string; readonly label: string };

/** The rules of `repoctl commit`. */
export type CommitPolicy = {
  /** The author and the committer of every commit. */
  readonly identity: Identity;
  /** The reference to an issue: the line is the prefix and the number (`Refs #` and `10` make `Refs #10`); `required` makes `--refs` mandatory. */
  readonly issue: { readonly prefix: string; readonly required: boolean };
  /** The trailers after the subject, in order. The line that credits the agent comes from `--co-author` or `REPOCTL_CO_AUTHOR` (else `coAuthor`), the session from `--session` or `CLAUDE_SESSION_URL`. */
  readonly trailers: readonly TrailerKind[];
  /** The line that credits the agent where neither the command line nor the environment gives one. */
  readonly coAuthor: string | undefined;
  readonly forbidden: {
    readonly paths: readonly ForbiddenPath[];
    /** Globs of paths that are allowed though a forbidden glob matches them. */
    readonly allow: readonly string[];
    readonly secrets: readonly SecretPattern[];
  };
};

/** The policy of `repoctl hygiene`: how a repository may consume the packages of a family. */
export type HygienePolicy = {
  /** The scope of the packages that are the family's (`@scope/`). */
  readonly scope: string;
  /** Fragments (lower case) of a Git dependency's specifier that name the family's own repository. */
  readonly gitSources: readonly string[];
  /** A folder name that a `file:` or `link:` dependency or a relative import must not go through. */
  readonly pathSegment: string;
  /** The file whose presence says this repository is the family's own, where the path, import and vendored findings are not made. */
  readonly sourceMarker: string;
  /** Allowances: globs of dependency paths that may be linked, and package names that may be carried by a folder of the repository. */
  readonly allow: { readonly paths: readonly string[]; readonly packages: readonly string[] };
};

/** What `repoctl doctor` checks of a checkout besides Git and the generated files. */
export type DoctorPolicy = {
  /** The least major version of Node, or none where the repository has no rule. */
  readonly minNode: number | undefined;
  /** The file (from the root) that pins the version of Bun and the variable in it, or none. */
  readonly bunPin: { readonly file: string; readonly variable: string } | undefined;
  /** The folder (from the root) under which the libraries are linked, and the program that links them, or none. */
  readonly links: { readonly folder: string; readonly fix: readonly string[] } | undefined;
  /** What to run to install the dependencies, said in the finding. */
  readonly install: string;
};

/** The settings of the verbs that know a family of libraries (status, release, new library, prove). */
export type LibrariesSettings = {
  /** The folder (from the root) whose subfolders are the libraries, each with a `library.ts` manifest. */
  readonly folder: string;
  /** The program that judges the specification kit of a library: the words `{kit}` and `{level}` are replaced by its folder and level. */
  readonly specKit: { readonly format: readonly string[]; readonly rules: readonly string[] } | undefined;
  /** Whether a source that says a library's version in a constant is checked against the manifest. */
  readonly versionConstants: boolean;
  /** Whether every package a library imports is declared in its manifest (a library job installs only its own folder). */
  readonly declaredDependencies: boolean;
  /** The program that links the libraries under the folder before a verb imports one, or none. */
  readonly linker: readonly string[] | undefined;
  /** The source (from the root) that classifies each library by role, which `new library` edits to add the new one; none where the repository has no such file. */
  readonly roleFile: string | undefined;
  /** The configuration of the documentation site (from the root), which lists the spec kit of every library and which `new library` edits to add the new one's; none where the repository has no such file. */
  readonly docsFile: string | undefined;
};

/** The optional verbs a repository turns on. */
export type Capabilities = {
  /** `release plan`, `release apply` and `release publish`: only for a repository with library manifests. */
  readonly release: boolean;
  /** `new library`. */
  readonly newLibrary: boolean;
  /** `query`: questions of the libraries, specifications and requirements in SQL. */
  readonly query: boolean;
  /** `status` of the packages. */
  readonly status: boolean;
  /** `prove`, the proof of a change by its blast radius. */
  readonly prove: boolean;
};

/** The documentation generator's settings: its configuration file and the folder the site is built into, from the root, and the module (from the root) that is the generator where it is a source of the repository and not an installed package. */
export type DocsSettings = { readonly config: string; readonly out: string; readonly generator: string | undefined };

/** A configuration, as the host reads it: every identity made, every default filled. */
export type Config = {
  readonly repo: string;
  /** The variable that says which tier the host holds, and the one that says a tool server may only read. */
  readonly tierVariable: VariableName;
  readonly readOnlyVariable: VariableName;
  readonly commit: CommitPolicy;
  readonly generators: readonly Generator[];
  readonly checks: readonly Check[];
  readonly capabilities: Capabilities;
  readonly libraries: LibrariesSettings | undefined;
  readonly hygiene: HygienePolicy | undefined;
  readonly doctor: DoctorPolicy;
  readonly docs: DocsSettings | undefined;
};

/** A program or a typed function, as a configuration writes it. */
export type StepInput = readonly string[] | StepFunction;

/** A generator, as a configuration writes it: the check is the program with `--check` added where it is not given. */
export type GeneratorInput = {
  readonly id: string;
  readonly summary?: string;
  readonly command: StepInput;
  readonly check?: StepInput;
  readonly inputs?: readonly string[];
  readonly outputs: readonly string[];
  readonly after?: readonly string[];
  readonly mixed?: readonly string[];
};

/** A check, as a configuration writes it. */
export type CheckInput = { readonly id: string; readonly summary?: string; readonly command: StepInput; readonly code?: ProblemCode };

/** A configuration as it is written in `repoctl.config.ts`: what it leaves out has the default the documentation says. */
export type ConfigInput = {
  readonly repo: string;
  readonly tierVariable?: string;
  readonly readOnlyVariable?: string;
  readonly commit: {
    readonly identity: Identity;
    readonly issue?: { readonly prefix: string; readonly required?: boolean };
    readonly trailers?: readonly TrailerKind[];
    readonly coAuthor?: string;
    readonly forbidden?: { readonly paths?: readonly ForbiddenPath[]; readonly allow?: readonly string[]; readonly secrets?: readonly SecretPattern[] };
  };
  readonly generators?: readonly GeneratorInput[];
  readonly checks?: readonly CheckInput[];
  readonly capabilities?: Partial<Capabilities>;
  readonly libraries?: { readonly folder: string; readonly specKit?: LibrariesSettings["specKit"]; readonly versionConstants?: boolean; readonly declaredDependencies?: boolean; readonly linker?: readonly string[]; readonly roleFile?: string; readonly docsFile?: string };
  readonly hygiene?: { readonly scope: string; readonly gitSources?: readonly string[]; readonly pathSegment?: string; readonly sourceMarker?: string; readonly allow?: { readonly paths?: readonly string[]; readonly packages?: readonly string[] } };
  readonly doctor?: { readonly minNode?: number; readonly bunPin?: DoctorPolicy["bunPin"]; readonly links?: DoctorPolicy["links"]; readonly install?: string };
  readonly docs?: { readonly config?: string; readonly out?: string; readonly generator?: string };
};

/** The names of the optional verbs a configuration turns on with a flag. */
export const CAPABILITY_NAMES: readonly (keyof Capabilities)[] = ["release", "newLibrary", "status", "prove", "query"];

/** The name of the file a repository keeps its configuration in, at its root. */
export const CONFIG_FILE = "repoctl.config.ts";

/** The variable that fixes the tier the host holds, where a configuration does not name another. */
export const DEFAULT_TIER_VARIABLE = "REPOCTL_TIER";

/** The variable that says the key of a tool server may only read, where a configuration does not name another. */
export const DEFAULT_READ_ONLY_VARIABLE = "REPOCTL_READ_ONLY";

/** The paths no repository commits: the local folder of an agent, installed packages, files that hold secrets. A configuration spreads or replaces it. */
export const DEFAULT_FORBIDDEN_PATHS: readonly ForbiddenPath[] = [
  { glob: "**/.claude/**", why: "the local folder of an agent (.claude/)" },
  { glob: "**/node_modules/**", why: "installed packages (node_modules/)" },
  { glob: "**/.env", why: "an environment file, which may hold secrets" },
  { glob: "**/.env.*", why: "an environment file, which may hold secrets" },
  { glob: "**/*.pem", why: "a key or a certificate" },
  { glob: "**/*.key", why: "a key or a certificate" },
  { glob: "**/*.p12", why: "a key or a certificate" },
  { glob: "**/*.pfx", why: "a key or a certificate" },
  { glob: "**/*.jks", why: "a key or a certificate" },
  { glob: "**/*.keystore", why: "a key or a certificate" },
  { glob: "**/id_rsa", why: "a private key of ssh" },
  { glob: "**/id_dsa", why: "a private key of ssh" },
  { glob: "**/id_ecdsa", why: "a private key of ssh" },
  { glob: "**/id_ed25519", why: "a private key of ssh" },
  { glob: "**/.npmrc", why: "a file of credentials" },
  { glob: "**/.netrc", why: "a file of credentials" },
  { glob: "**/.pypirc", why: "a file of credentials" },
  { glob: "**/credentials", why: "a file of credentials" },
  { glob: "**/credentials.json", why: "a file of credentials" },
];

/** The environment files that are examples and are committed. */
export const DEFAULT_ALLOWED_PATHS: readonly string[] = ["**/.env.example", "**/.env.sample", "**/.env.template"];

/** The texts that look like secrets: the keys and tokens of the common services. */
export const DEFAULT_SECRET_PATTERNS: readonly SecretPattern[] = [
  { pattern: "-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY", label: "a private key" },
  { pattern: "\\bnpm_[A-Za-z0-9]{36}\\b", label: "an npm token" },
  { pattern: "\\bgh[pousr]_[A-Za-z0-9]{36,}\\b", label: "a GitHub token" },
  { pattern: "\\bgithub_pat_[A-Za-z0-9_]{22,}\\b", label: "a GitHub token" },
  { pattern: "\\bAKIA[0-9A-Z]{16}\\b", label: "an access key of AWS" },
  { pattern: "\\bxox[baprs]-[A-Za-z0-9-]{10,}", label: "a token of Slack" },
  { pattern: "\\bsk-ant-[A-Za-z0-9_-]{20,}", label: "a key of an API" },
];

/** A configuration, written: the identity that checks its shape. */
export function defineConfig(input: ConfigInput): ConfigInput {
  return input;
}

const stepOf = (input: StepInput, label: string): Step => (typeof input === "function" ? { kind: "function", call: input, label } : { kind: "program", argv: input });

const dedupe = (words: readonly string[]): boolean => new Set(words).size === words.length;

/** Whether a path is relative, inside the repository and written with `/`. */
const relative = (p: string): boolean => p !== "" && !p.startsWith("/") && !/^[A-Za-z]:/.test(p) && !p.split("/").includes("..") && !p.includes("\\");

/** The configuration as the host reads it, or every reason it is wrong. */
export function parseConfig(input: ConfigInput): Result<Config, readonly string[]> {
  const problems: string[] = [];
  const bad = (m: string): void => void problems.push(m);
  const variable = (name: string | undefined, fallback: string, what: string): VariableName | undefined => {
    const r = parseVariableName(name ?? fallback);
    if (r.kind === "ok") return r.value;
    bad(`${what}: ${r.error}`);
    return undefined;
  };
  if (input.repo.trim() === "") bad("repo is the name of the repository and is not empty");
  const tierVariable = variable(input.tierVariable, DEFAULT_TIER_VARIABLE, "tierVariable");
  const readOnlyVariable = variable(input.readOnlyVariable, DEFAULT_READ_ONLY_VARIABLE, "readOnlyVariable");

  const c = input.commit;
  if (c.identity.name.trim() === "" || !/^[^@\s]+@[^@\s]+$/.test(c.identity.email)) bad("commit.identity needs a name and an email address");
  const trailers = c.trailers ?? TRAILER_KINDS.filter((t) => t !== "issue" || c.issue !== undefined);
  if (!dedupe(trailers)) bad("commit.trailers names a trailer twice");
  if (c.issue === undefined && trailers.includes("issue")) bad("commit.trailers has \"issue\" and commit.issue gives no prefix");
  if (c.issue !== undefined && c.issue.prefix.trim() === "") bad("commit.issue.prefix is not empty (for example \"Refs #\")");
  if (c.issue?.required === true && !trailers.includes("issue")) bad("commit.issue is required and commit.trailers has no \"issue\"");
  const secrets = c.forbidden?.secrets ?? DEFAULT_SECRET_PATTERNS;
  for (const s of secrets) {
    try {
      new RegExp(s.pattern);
    } catch {
      bad(`commit.forbidden.secrets: ${JSON.stringify(s.pattern)} is not a regular expression`);
    }
  }
  const commit: CommitPolicy = {
    identity: c.identity,
    issue: { prefix: c.issue?.prefix ?? "", required: c.issue?.required ?? false },
    trailers,
    coAuthor: c.coAuthor,
    forbidden: { paths: c.forbidden?.paths ?? DEFAULT_FORBIDDEN_PATHS, allow: c.forbidden?.allow ?? DEFAULT_ALLOWED_PATHS, secrets },
  };

  const generators: Generator[] = [];
  for (const g of input.generators ?? []) {
    const id = parseStepId(g.id);
    if (id.kind === "err") {
      bad(`generators: ${id.error}`);
      continue;
    }
    const run = stepOf(g.command, `${g.id} (a function)`);
    const check = g.check !== undefined ? stepOf(g.check, `${g.id} --check (a function)`) : typeof g.command === "function" ? undefined : stepOf([...g.command, "--check"], "");
    if (check === undefined) {
      bad(`generators.${g.id}: a generator that is a function gives its check as well`);
      continue;
    }
    generators.push({ id: id.value, summary: g.summary ?? g.id, run, check, inputs: g.inputs ?? [], outputs: g.outputs, after: [], mixed: g.mixed ?? [] });
  }
  if (!dedupe(generators.map((g) => g.id))) bad("generators: an id is used twice");
  const withAfter: Generator[] = [];
  for (const [i, g] of generators.entries()) {
    const named = input.generators?.[i]?.after ?? [];
    const after = named.flatMap((n) => {
      const found = generators.find((o) => o.id === n);
      if (found === undefined) {
        bad(`generators.${g.id}.after: ${JSON.stringify(n)} is not a generator of this configuration`);
        return [];
      }
      return [found.id];
    });
    withAfter.push({ ...g, after });
  }
  for (const g of withAfter) {
    if (g.outputs.length === 0) bad(`generators.${g.id}: a generator writes something: outputs is not empty`);
    for (const m of g.mixed) if (!g.outputs.includes(m)) bad(`generators.${g.id}.mixed: ${m} is not one of its outputs`);
  }

  const checks: Check[] = [];
  for (const k of input.checks ?? []) {
    const id = parseStepId(k.id);
    if (id.kind === "err") {
      bad(`checks: ${id.error}`);
      continue;
    }
    const code = k.code ?? "E-CHECK-FAILED";
    if (!isProblemCode(code)) bad(`checks.${k.id}.code: ${code} is not a problem code`);
    checks.push({ id: id.value, summary: k.summary ?? k.id, run: stepOf(k.command, `${k.id} (a function)`), code });
  }
  if (!dedupe(checks.map((k) => k.id))) bad("checks: an id is used twice");

  const capabilities: Capabilities = { release: false, newLibrary: false, status: false, prove: false, query: false, ...input.capabilities };
  const needsLibraries = CAPABILITY_NAMES.filter((name) => capabilities[name]);
  const libraries: LibrariesSettings | undefined =
    input.libraries === undefined ? undefined : { folder: input.libraries.folder, specKit: input.libraries.specKit, versionConstants: input.libraries.versionConstants ?? false, declaredDependencies: input.libraries.declaredDependencies ?? false, linker: input.libraries.linker, roleFile: input.libraries.roleFile, docsFile: input.libraries.docsFile };
  if (libraries === undefined && needsLibraries.length > 0) bad(`capabilities ${needsLibraries.join(", ")} need libraries: { folder }, the folder of the library manifests`);
  if (libraries !== undefined && !relative(libraries.folder)) bad("libraries.folder is a folder inside the repository, written with /");

  const h = input.hygiene;
  const hygiene: HygienePolicy | undefined =
    h === undefined
      ? undefined
      : { scope: h.scope, gitSources: (h.gitSources ?? []).map((s) => s.toLowerCase()), pathSegment: h.pathSegment ?? "", sourceMarker: h.sourceMarker ?? "", allow: { paths: h.allow?.paths ?? [], packages: h.allow?.packages ?? [] } };
  if (hygiene !== undefined && !/^@[a-z0-9][a-z0-9._-]*\/$/.test(hygiene.scope)) bad("hygiene.scope is an npm scope with its slash, for example \"@acme/\"");

  const d = input.doctor ?? {};
  const doctor: DoctorPolicy = { minNode: d.minNode, bunPin: d.bunPin, links: d.links, install: d.install ?? "bun install --frozen-lockfile" };

  const docs: DocsSettings | undefined = input.docs === undefined ? undefined : { config: input.docs.config ?? "docs.config.ts", out: input.docs.out ?? "_site", generator: input.docs.generator };
  if (docs !== undefined && (!relative(docs.config) || !relative(docs.out) || (docs.generator !== undefined && !relative(docs.generator)))) bad("docs.config, docs.out and docs.generator are paths inside the repository, written with /");

  if (problems.length > 0 || tierVariable === undefined || readOnlyVariable === undefined) return err(problems);
  return ok({ repo: input.repo, tierVariable, readOnlyVariable, commit, generators: withAfter, checks, capabilities, libraries, hygiene, doctor, docs });
}

/** The verbs a configuration turns on besides the ones every repository has (check, sync, merge, commit, doctor): each capability adds its own. */
export function enabledVerbs(config: Config): readonly VerbId[] {
  const out: VerbId[] = [];
  const capability = (name: keyof Capabilities): void => {
    switch (name) {
      case "release":
        out.push("release plan", "release apply", "release publish");
        return;
      case "newLibrary":
        out.push("new library");
        return;
      case "status":
        out.push("status");
        return;
      case "prove":
        out.push("prove");
        return;
      case "query":
        out.push("query");
        return;
      default:
        absurd(name);
    }
  };
  for (const name of CAPABILITY_NAMES) if (config.capabilities[name]) capability(name);
  if (config.hygiene !== undefined) out.push("hygiene");
  if (config.docs !== undefined) out.push("docs build", "docs serve", "docs check");
  return out;
}
