/** @module Governance's public surface (spike): imports the engine by package name. */
import { point } from "@intellectual-frontiers/data/engine";

/** A vocabulary term of governance. */
export const vocabulary = point<{ readonly term: string }>("governance.vocabulary");
