// Spec: 0001-ontologies FR-001
/**
 * What a manager runs for an operation, read from the packaging ontology as typed values (commons 0002-packaging FR-024 to FR-027): for a manager id and an operation, the
 * executable, the environment, whether it needs administrator rights, the command as a list of words, its non-interactive form and whether it was run on a real computer; for a
 * manager, the written form of an exact version and the commands it forbids. A manager dialect (`brew`, `apt`, `winget`, `mise`) asks this module and nothing else: it parses no
 * RDF and copies no template.
 *
 * @remarks
 * A manager is named by a branded value made only by `parseManagerId`, which accepts the identifiers the ontology states and no others; an operation is the closed union
 * {@link Operation}. A command is words, never a shell string, with `{package}`, `{packages}` and `{version}` where the ontology holds them, so that a caller runs it without a
 * shell. `verified` is true only where the ontology's command carries `pm:verifiedOn`; one of origin `memory` or unverified is `verified: false`. Where the ontology states no
 * command, the answer is `not-defined`: nothing here supplies one.
 *
 * @example
 * ```ts
 * import { commandOf, parseManagerId, describeCommandError } from "@intellectual-frontiers/ontology/supply-chain/commands";
 *
 * const brew = parseManagerId("brew");
 * if (brew.kind === "ok") {
 *   const q = commandOf(brew.value, "QueryVersion");
 *   if (q.kind === "ok") console.log(q.value.template); // ["brew", "list", "--versions", "{package}"]
 *   else console.error(describeCommandError(q.error));
 * }
 * ```
 *
 * @limits
 * It reads; it runs nothing and fills no placeholder. That a command is right on a computer is what `pm:verifiedOn` says, and the generator checks the ontology's shape (FR-010).
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Brand } from "@intellectual-frontiers/core";
import type { Named } from "@intellectual-frontiers/rdf";
import { commands, managers, prohibitions } from "./packaging/managers.ts";
import { operations } from "./packaging/packaging.ts";

/** The identifier of a package manager (`apt`, `brew`, `winget`, `mise`): one the ontology states. */
export type ManagerId = Brand<string, "ManagerId">;

/** The operations a dialect asks for, as the ontology names them. */
export const OPERATIONS = ["Install", "QueryVersion", "QueryInstalled", "Refresh"] as const;
/** One operation of a manager: install, the version of an installed package, whether a package is installed, and the refresh of the package index. */
export type Operation = (typeof OPERATIONS)[number];
/** What a command answers: one of the four operations, or the written form of an exact version. */
export type CommandName = Operation | "ExactVersion";
/** A command as words, run without a shell. */
export type Words = readonly string[];
/** A variable a manager's commands run with. */
export type EnvVar = { readonly name: string; readonly value: string };

/** One command of one manager, as the ontology states it. */
export type CommandSpec = {
  readonly manager: ManagerId;
  readonly operation: CommandName;
  /** The program the manager is (`apt-get` for `apt`); the words of a template start with the program of its own form, which may be another (`apt`). */
  readonly executable: string;
  /** The variables the commands of the manager run with; empty where it has none. */
  readonly environment: readonly EnvVar[];
  readonly needsAdministrator: boolean;
  /** The command a person runs, with `{package}`, `{packages}` and `{version}` where names and versions stand. */
  readonly template: Words;
  /** The form a harness runs without a question, where the ontology states one. */
  readonly nonInteractive?: Words;
  /** True only where the command carries `pm:verifiedOn`: it was run on a real computer. */
  readonly verified: boolean;
};

/** A command a manager must never be given, with why. */
export type Prohibition = { readonly template: Words; readonly reason: string };

/** Why a command is not given. */
export type CommandError =
  | { readonly kind: "unknown-manager"; readonly manager: string }
  | { readonly kind: "unknown-operation"; readonly operation: string }
  | { readonly kind: "not-defined"; readonly manager: ManagerId; readonly operation: CommandName }
  | { readonly kind: "malformed"; readonly manager: ManagerId; readonly operation: CommandName; readonly reason: string };

const managerNames: ReadonlyMap<string, ManagerId> = new Map(
  managers.flatMap((m) => (m.values.identifier === "" ? [] : [[m.iri, m.values.identifier as ManagerId] as const])),
);

/** The manager the ontology states under this identifier, or why there is none. */
export function parseManagerId(text: string): Result<ManagerId, CommandError> {
  for (const id of managerNames.values()) if (id === text) return ok(id);
  return err({ kind: "unknown-manager", manager: text });
}

/** The operation of this name (`Install`, `QueryVersion`, `QueryInstalled`, `Refresh`), or why there is none. */
export function parseOperation(text: string): Result<Operation, CommandError> {
  for (const name of OPERATIONS) if (name === text) return ok(name);
  return err({ kind: "unknown-operation", operation: text });
}

/** Every manager the ontology states, by identifier. */
export function managerIds(): readonly ManagerId[] {
  return [...managerNames.values()];
}

/** Every operation a dialect may ask for. */
export function operationNames(): readonly Operation[] {
  return OPERATIONS;
}

/** The individual of the ontology each command name is. */
function individualOf(name: CommandName): Named {
  switch (name) {
    case "Install":
      return operations.Install;
    case "QueryVersion":
      return operations.QueryVersion;
    case "QueryInstalled":
      return operations.QueryInstalled;
    case "Refresh":
      return operations.Refresh;
    case "ExactVersion":
      return operations.InstallExact;
    default:
      return absurd(name);
  }
}

/** Characters that make a template shell syntax, a quotation or an escape: a command is words only (FR-006). */
const NOT_WORDS = /['"\\`;|&<>]/;

/**
 * The words of a template, or why it is none: a template that is empty or holds a quotation, an escape or a shell character is refused, because a command is run without a shell.
 *
 * @example
 * ```ts
 * wordsOfTemplate("brew list --versions {package}"); // ok: ["brew", "list", "--versions", "{package}"]
 * wordsOfTemplate("ls | wc"); // err: the template holds a shell character
 * ```
 */
export function wordsOfTemplate(template: string): Result<Words, string> {
  return wordsOf(template);
}

function wordsOf(template: string): Result<Words, string> {
  if (NOT_WORDS.test(template)) return err(`the template ${template} holds a quotation, an escape or a shell character`);
  const out = template.split(/\s+/).filter((w) => w !== "");
  return out.length === 0 ? err("the template is empty") : ok(out);
}

/** The variables of a manager's `environment` (`NAME=value` words), or why they are none. */
function environmentOf(text: string | undefined): Result<readonly EnvVar[], string> {
  if (text === undefined) return ok([]);
  const vars: EnvVar[] = [];
  for (const word of text.split(/\s+/).filter((w) => w !== "")) {
    const at = word.indexOf("=");
    if (at < 1) return err(`the environment word ${word} is not NAME=value`);
    vars.push({ name: word.slice(0, at), value: word.slice(at + 1) });
  }
  return ok(vars);
}

function commandNamed(manager: ManagerId, name: CommandName): Result<CommandSpec, CommandError> {
  const m = managers.find((x) => managerNames.get(x.iri) === manager);
  if (m === undefined) return err({ kind: "unknown-manager", manager });
  const operation = individualOf(name);
  const c = commands.find((x) => x.values.commandOf.iri === m.iri && x.values.operation.iri === operation.iri);
  if (c === undefined) return err({ kind: "not-defined", manager, operation: name });
  const malformed = (reason: string): Result<CommandSpec, CommandError> => err({ kind: "malformed", manager, operation: name, reason });
  const template = wordsOf(c.values.template);
  if (template.kind === "err") return malformed(template.error);
  const quiet = c.values.nonInteractive === undefined ? undefined : wordsOf(c.values.nonInteractive);
  if (quiet?.kind === "err") return malformed(quiet.error);
  const environment = environmentOf(m.values.environment);
  if (environment.kind === "err") return malformed(environment.error);
  return ok({
    manager,
    operation: name,
    executable: m.values.executable,
    environment: environment.value,
    needsAdministrator: m.values.needsAdministrator,
    template: template.value,
    ...(quiet === undefined ? {} : { nonInteractive: quiet.value }),
    verified: c.values.verifiedOn !== undefined,
  });
}

/**
 * The command of a manager for an operation, or why there is none.
 *
 * @example
 * ```ts
 * const apt = parseManagerId("apt");
 * if (apt.kind === "ok") commandOf(apt.value, "Install"); // ok: { executable: "apt-get", environment: [{ name: "DEBIAN_FRONTEND", value: "noninteractive" }], verified: true, ... }
 * ```
 */
export function commandOf(manager: ManagerId, operation: Operation): Result<CommandSpec, CommandError> {
  return commandNamed(manager, operation);
}

/**
 * How a manager writes one package at one exact version (`{package}` and `{version}` in the words), in the shape of {@link commandOf}, or `not-defined` where the ontology states none.
 *
 * @example
 * ```ts
 * const winget = parseManagerId("winget");
 * if (winget.kind === "ok") exactVersionOf(winget.value); // ok: template ["winget", "install", "--exact", "--id", "{package}", "--version", "{version}"], verified: false
 * ```
 */
export function exactVersionOf(manager: ManagerId): Result<CommandSpec, CommandError> {
  return commandNamed(manager, "ExactVersion");
}

/**
 * The commands the ontology forbids for a manager, each with its reason (`pacman -Sy`: a refresh alone leaves a rolling release partly upgraded); none where it forbids none.
 *
 * @example
 * ```ts
 * const pacman = parseManagerId("pacman");
 * if (pacman.kind === "ok") prohibitionsOf(pacman.value)[0]; // { template: ["pacman", "-Sy"], reason: "Refreshing the package list alone ..." }
 * ```
 */
export function prohibitionsOf(manager: ManagerId): readonly Prohibition[] {
  const m = managers.find((x) => managerNames.get(x.iri) === manager);
  if (m === undefined) return [];
  return prohibitions
    .filter((p) => p.values.prohibitionOf.iri === m.iri)
    .map((p) => ({ template: p.values.forbiddenTemplate.split(/\s+/).filter((w) => w !== ""), reason: p.values.definition.value }));
}

/**
 * The sentence a reason is told in.
 *
 * @example
 * ```ts
 * describeCommandError({ kind: "unknown-operation", operation: "Purge" }); // "the reader knows no operation Purge (Install, QueryVersion, QueryInstalled, Refresh)"
 * ```
 */
export function describeCommandError(e: CommandError): string {
  switch (e.kind) {
    case "unknown-manager":
      return `the ontology states no package manager ${e.manager}`;
    case "unknown-operation":
      return `the reader knows no operation ${e.operation} (${OPERATIONS.join(", ")})`;
    case "not-defined":
      return `the ontology states no ${e.operation} command for ${e.manager}`;
    case "malformed":
      return `the ${e.operation} command of ${e.manager} is malformed: ${e.reason}`;
    default:
      return absurd(e);
  }
}
