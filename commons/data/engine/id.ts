// Spec: 0002-engine FR-003
/**
 * The identifier of an extension (commons data 0002-engine FR-003): lower-case words joined by `-` or `.`, such as `privacy` or `sql.documentation`. It is a branded
 * string made only by `extensionId`, so that a name that was not checked cannot be used where an identifier is wanted.
 *
 * @module
 */
import { type Brand, err, ok, type Result } from "@intellectual-frontiers/core";

/** The identifier of an extension. */
export type ExtensionId = Brand<string, "ExtensionId">;

/** Why a text is not an identifier. */
export type IdError = { readonly kind: "id"; readonly text: string };

const ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

/**
 * Checks a text as an identifier.
 *
 * @param text - the text
 * @returns the identifier, or the text that is not one
 */
export function extensionId(text: string): Result<ExtensionId, IdError> {
  // the one place a text becomes an ExtensionId: the check above is what makes it one
  return ID.test(text) ? ok(text as ExtensionId) : err({ kind: "id", text });
}
