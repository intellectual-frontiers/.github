// Spec: 0010-sql-generators FR-001
/**
 * The generators (commons data 0010-sql-generators): diagrams in Mermaid and D2, the data dictionary in Markdown and HTML, row types in Rust and Zod, and the register of personal data and
 * security. `generators` is all of them; `generatorExtensions` is each as an extension of the engine, `sql.generate.<name>`, which a project composes, drops from or adds to.
 *
 * @example
 * ```ts
 * import { generate } from "@intellectual-frontiers/data/sql/physical";
 * import { generators } from "@intellectual-frontiers/data/sql/extensions/generators";
 * const files = generate(schema, { generators });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { contribute, defineExtension, type Extension, extensionId, type IdError } from "@intellectual-frontiers/data/engine";
import { generatorsPoint, type Generator } from "@intellectual-frontiers/data/sql/physical";
import { zod, rust } from "./code.ts";
import { d2, mermaid } from "./diagrams.ts";
import { dictionary, dictionaryHtml } from "./dictionary.ts";
import { register } from "./register.ts";

export { d2, mermaid } from "./diagrams.ts";
export { dictionary, dictionaryHtml } from "./dictionary.ts";
export { rust, zod } from "./code.ts";
export { register } from "./register.ts";

/** Every generator of the library, in the order their files are made. */
export const generators: readonly Generator[] = [mermaid, d2, dictionary, dictionaryHtml, rust, zod, register];

/**
 * The generators as extensions of the engine, one each.
 *
 * @param version - the extensions' version
 * @returns the extensions, or why an identifier is not one
 */
export function generatorExtensions(version = "1.0.0"): Result<readonly Extension[], IdError> {
  const out: Extension[] = [];
  for (const g of generators) {
    const id = extensionId(g.id);
    if (id.kind === "err") return err(id.error);
    out.push(defineExtension({ id: id.value, version, contributes: [contribute(generatorsPoint, g)] }));
  }
  return ok(out);
}
