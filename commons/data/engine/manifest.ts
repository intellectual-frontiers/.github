// Spec: 0002-engine FR-003, FR-004, FR-008
/**
 * The manifest of an extension (commons data 0002-engine FR-003): one typed value that says what the extension is, what it needs and what it adds. A contribution is
 * made by `contribute(point, value)`, so a value of another type than the point's does not compile (FR-004); an extension that loads only when an event happens is a
 * `lazyExtension` (FR-008).
 *
 * @example
 * ```ts
 * import { contribute, defineExtension, extensionId, point } from "@intellectual-frontiers/data/engine";
 * const terms = point<{ readonly term: string }>("governance.vocabulary");
 * const id = extensionId("privacy");
 * export const privacy = id.kind === "ok" ? defineExtension({ id: id.value, version: "1.0.0", contributes: [contribute(terms, { term: "email" })] }) : undefined;
 * ```
 *
 * @module
 */
import type { Context, Handle } from "./handle.ts";
import type { ExtensionId } from "./id.ts";
import type { ContributionPoint, PointName } from "./point.ts";

/** The version of the engine's contract, raised when the engine breaks a manifest. An extension names the one it was written for. */
export const CONTRACT = 1;

/** The name of an event that starts a lazy extension: a kind and a subject, such as `onDialect:postgres`. */
export type EventName = `${string}:${string}`;

/** What an extension adds to a point, made by `contribute`. */
export interface Contribution {
  readonly point: PointName;
  readonly value: unknown;
}

/**
 * A contribution to a point, typed by it: a value of another type does not compile.
 *
 * @param p - the point
 * @param value - what is contributed
 * @returns the contribution, frozen
 */
export function contribute<T>(p: ContributionPoint<T>, value: T): Contribution {
  return Object.freeze({ point: p.name, value });
}

/** What an extension does when it is activated, with the handles it declared. */
export type Activate = (context: Context) => void | Promise<void>;

/** An extension: a manifest. */
export interface Extension {
  readonly id: ExtensionId;
  readonly version: string;
  /** The version of the engine's contract it was written for. */
  readonly contract: number;
  readonly requires: readonly ExtensionId[];
  readonly contributes: readonly Contribution[];
  readonly uses: readonly Handle<unknown>[];
  readonly activate?: Activate;
}

/** What `defineExtension` is given: only the identifier and the version are required. */
export interface ExtensionInput {
  readonly id: ExtensionId;
  readonly version: string;
  readonly contract?: number;
  readonly requires?: readonly ExtensionId[];
  readonly contributes?: readonly Contribution[];
  readonly uses?: readonly Handle<unknown>[];
  readonly activate?: Activate;
}

/**
 * Makes the manifest of an extension.
 *
 * @param input - what the extension is, needs and adds
 * @returns the manifest, frozen, written for this engine's contract unless said otherwise
 */
export function defineExtension(input: ExtensionInput): Extension {
  return Object.freeze({
    id: input.id,
    version: input.version,
    contract: input.contract ?? CONTRACT,
    requires: Object.freeze([...(input.requires ?? [])]),
    contributes: Object.freeze([...(input.contributes ?? [])]),
    uses: Object.freeze([...(input.uses ?? [])]),
    ...(input.activate === undefined ? {} : { activate: input.activate }),
  });
}

/** An extension that is loaded and activated only when one of its events is fired. */
export interface LazyExtension {
  readonly lazy: true;
  readonly id: ExtensionId;
  readonly version: string;
  readonly contract: number;
  readonly requires: readonly ExtensionId[];
  /** The events that start it. */
  readonly events: readonly EventName[];
  /** Gives the manifest, such as `() => import("./mod.ts").then((m) => m.extension)`. */
  readonly load: () => Promise<Extension>;
}

/** What `lazyExtension` is given. */
export interface LazyInput {
  readonly id: ExtensionId;
  readonly version: string;
  readonly contract?: number;
  readonly requires?: readonly ExtensionId[];
  readonly events: readonly EventName[];
  readonly load: () => Promise<Extension>;
}

/**
 * Makes a lazy entry: what the engine must know before it loads the extension, and how to load it.
 *
 * @param input - the identifier, the events and the loader
 * @returns the entry, frozen
 */
export function lazyExtension(input: LazyInput): LazyExtension {
  return Object.freeze({
    lazy: true,
    id: input.id,
    version: input.version,
    contract: input.contract ?? CONTRACT,
    requires: Object.freeze([...(input.requires ?? [])]),
    events: Object.freeze([...input.events]),
    load: input.load,
  });
}

/** What a project gives `compose`: an extension, or a lazy one. */
export type Entry = Extension | LazyExtension;

/** Whether an entry is lazy. */
export function isLazy(e: Entry): e is LazyExtension {
  return "lazy" in e;
}
