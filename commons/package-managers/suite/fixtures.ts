/**
 * Made-up managers for the tests: the data of a manager and the commands of the ontology as a function, with no real manager named.
 *
 * @module
 */
import { parseManagerId } from "@intellectual-frontiers/toolchain/governance";
import type { CommandSpec, Operation } from "../src/governance/mod.ts";
import type { CommandSource, ManagerSpec } from "../src/logical/mod.ts";
import { err, ok, type Result } from "@intellectual-frontiers/core";

function must<T>(r: Result<T, string>): T {
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** A made-up manager that needs no rights, writes `pkg@1.2` and says a missing package with the status 3. */
export const FAKE: ManagerSpec = {
  id: "fakepm",
  manager: must(parseManagerId("manager-fakepm")),
  summary: "A made-up manager.",
  guarantees: { pin: "exact", integrity: "hash", scopes: ["user"], platforms: ["linux-x64"], binds: "package", sourceBuild: false },
  versioning: { kind: "joined", joiner: "@" },
  missingExit: 3,
};

/** A made-up manager that needs rights and an environment, writes `pkg=1.2` and has no known missing status. */
export const ADMIN: ManagerSpec = {
  id: "adminpm",
  manager: must(parseManagerId("manager-adminpm")),
  summary: "A made-up manager that needs rights.",
  guarantees: { pin: "release-line", integrity: "signature", scopes: ["system"], platforms: ["linux-x64"], binds: "package", sourceBuild: false },
  versioning: { kind: "joined", joiner: "=" },
  missingExit: undefined,
};

/** The commands of a made-up manager, by name of the manager and the operation; `programs` gives the word that starts each command. */
export function commandsOf(programs: Partial<Record<Operation, string>> = {}): CommandSource {
  return (manager: string, op: Operation): Result<CommandSpec, string> => {
    const defaults = manager === ADMIN.manager ? { Install: "adminpm", QueryInstalled: "adminpm-has", QueryVersion: "adminpm-version", Refresh: "adminpm-refresh" } : { Install: "fakepm", QueryInstalled: "fakepm-has", QueryVersion: "fakepm-version", Refresh: "fakepm-refresh" };
    const word = programs[op] ?? defaults[op];
    if (manager === FAKE.manager) {
      const templates: Record<Operation, string> = { Install: `${word} install {packages}`, QueryInstalled: `${word} {package}`, QueryVersion: `${word} {package}`, Refresh: `${word} update` };
      return ok({ manager, executable: "fakepm", needsAdministrator: false, template: templates[op], verified: false });
    }
    if (manager === ADMIN.manager) {
      if (op === "Refresh") return err(`${manager} has no command for ${op} in the ontology`);
      const templates: Record<Operation, string> = { Install: `${word} install {packages}`, QueryInstalled: `${word} {package}`, QueryVersion: `${word} {package}`, Refresh: "" };
      const install: CommandSpec = { manager, executable: "adminpm", needsAdministrator: true, template: `${word} install {packages}`, nonInteractive: `${word} install -y {packages}`, environment: "ADMINPM_QUIET=1", verified: true };
      const query: CommandSpec = { manager, executable: "adminpm", needsAdministrator: false, template: templates[op], verified: false };
      return ok(op === "Install" ? install : query);
    }
    return err(`${manager} is not a manager of this suite`);
  };
}
