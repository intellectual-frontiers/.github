/**
 * The package of Docs as `tools/pack.ts` makes it, packed once for the tests that look at it (commons 0001-docs FR-004, FR-005).
 *
 * @module
 */
import { type Packed, packLibrary } from "@intellectual-frontiers/libraries/pack";
import { path } from "@intellectual-frontiers/system";

/** The folder of the library. */
export const DOCS = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

let packed: Promise<Packed> | undefined;

/** The packed package: built, inspected and packed, once. */
export const packedDocs = (): Promise<Packed> => (packed ??= packLibrary(DOCS, { types: ["node"], launchers: { "ifc-docs": "src/cli.ts" } }));
