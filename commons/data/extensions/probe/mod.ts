/** @module A neutral extension (spike): imports a layer's public surface by package name. */
import { vocabulary } from "@intellectual-frontiers/data/governance";

/** The extension's manifest. */
export const extension = { id: "probe", contributes: [vocabulary.name] } as const;
