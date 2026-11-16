/**
 * Greetings, as `001-greeting` says (FR-001): a name greeted, and nothing else. The site that documents it is built as
 * commons 0011-documentation FR-027 says, and its setup is erga 009-machine-bootstrap's, which is shown as text.
 *
 * @remarks
 * A greeting is one line. See {@link greet} and {@link Greeting}; leaving is 002-farewell.
 *
 * @limits
 * It knows only English.
 *
 * @module
 */

/** A greeting: who is greeted, and the line. */
export interface Greeting {
  /** Who is greeted. */
  readonly name: string;
  /** The line said. */
  readonly line: string;
}

/**
 * The greeting of a name (FR-002).
 *
 * @param name - who is greeted
 * @returns the greeting
 * @example
 * ```ts
 * greet("Ada").line; // "Hello, Ada."
 * ```
 */
export function greet(name: string): Greeting {
  return { name, line: `Hello, ${name}.` };
}
