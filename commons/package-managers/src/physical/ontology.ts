// Spec: 0004-package-managers-dialect FR-008
/**
 * The commands of the packaging ontology as the `CommandSource` of the kit: for a manager of Toolchain (`manager-apt`) and an operation, the command the ontology states through its reader, with its
 * words joined by single spaces (the reader refuses any word a shell would read, so the words are the same when the kit splits them again), or the ontology's reason there is none. It holds no
 * template of its own.
 *
 * @example
 * ```ts
 * import { commandsFromOntology } from "./ontology.ts";
 * commandsFromOntology()("manager-apt", "Install"); // a Result of the command of apt
 * ```
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { commandOf, describeCommandError, parseManagerId } from "@intellectual-frontiers/ontology/supply-chain/commands";
import type { CommandSource } from "@intellectual-frontiers/package-managers/logical";

/** The commands of the packaging ontology. */
export function commandsFromOntology(): CommandSource {
  return (manager, operation) => {
    const id = parseManagerId(manager.replace(/^manager-/, ""));
    if (id.kind === "err") return err(describeCommandError(id.error));
    const found = commandOf(id.value, operation);
    if (found.kind === "err") return err(describeCommandError(found.error));
    const c = found.value;
    return ok({
      manager,
      executable: c.executable,
      ...(c.environment === undefined ? {} : { environment: c.environment }),
      needsAdministrator: c.needsAdministrator,
      template: c.template.join(" "),
      ...(c.nonInteractive === undefined ? {} : { nonInteractive: c.nonInteractive.join(" ") }),
      verified: c.verified,
    });
  };
}
