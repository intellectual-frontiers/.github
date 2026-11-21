// Spec: 0002-planning-core FR-009
/**
 * The one place a brand is put on a value: a smart constructor checks a value and then calls `brand`, so that an id, an instant or a day exists only as the result of its constructor.
 *
 * @module
 */
import type { Brand } from "@intellectual-frontiers/core";

/** A value of `T` named a `B`: the single cast of the library, called only by the function that has validated the value. */
export function brand<T, B extends string>(value: T): Brand<T, B> {
  return value as Brand<T, B>;
}
