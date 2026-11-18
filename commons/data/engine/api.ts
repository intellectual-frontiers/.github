/** @module The engine's public surface (spike). */
import { ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";

/** A contribution point: a named place a layer lets extensions fill. */
export interface ContributionPoint<T> {
  readonly name: string;
  readonly __t?: T;
}

/** Declares a contribution point. */
export const point = <T>(name: string): ContributionPoint<T> => ({ name });

/** Says what the engine is, as a value that can fail. */
export const engineName = (): Result<string, never> => ok("engine");

export { internalSecret } from "./internal.ts";
