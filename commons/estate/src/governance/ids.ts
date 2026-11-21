// Spec: 0002-estate-governance FR-001
/**
 * The identities of Estate: an asset, a kind of asset and a system that owns a capability, each a branded text made only by its parser, and the closed lists of the states an asset has and the
 * capabilities a state offers.
 *
 * @example
 * ```ts
 * import { parseAssetId } from "./ids.ts";
 * parseAssetId("olympia").kind; // "ok"
 * parseAssetId("Olympia").kind; // "err"
 * ```
 *
 * @module
 */
import { err, ok, type Brand, type Result } from "@intellectual-frontiers/core";

/** The identity of an asset: lower case words and digits joined by hyphens or dots, starting with a letter. */
export type AssetId = Brand<string, "estate asset id">;
/** The kind of an asset (`server`, `workstation`, `network-device`, `cloud-account`, `service`): lower case words joined by hyphens. */
export type AssetKind = Brand<string, "estate asset kind">;
/** A system that owns a capability of an asset (`archon`): lower case words joined by hyphens. */
export type SystemId = Brand<string, "estate system id">;

const word = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const dotted = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

function made<B extends string>(name: string, rule: string, test: RegExp, max: number): (text: string) => Result<Brand<string, B>, string> {
  return (text) => (text.length <= max && test.test(text) ? ok(text as Brand<string, B>) : err(`${JSON.stringify(text)} is not ${name}: ${rule}`));
}

/** An asset id from text: lower case words and digits joined by hyphens or dots, starting with a letter, at most 100 characters. */
export const parseAssetId: (text: string) => Result<AssetId, string> = made<"estate asset id">("an asset id", "lower case words and digits joined by hyphens or dots, starting with a letter", dotted, 100);
/** An asset kind from text: lower case words joined by hyphens, at most 60 characters. */
export const parseAssetKind: (text: string) => Result<AssetKind, string> = made<"estate asset kind">("an asset kind", "lower case words joined by hyphens", word, 60);
/** A system id from text: lower case words joined by hyphens, at most 60 characters. */
export const parseSystemId: (text: string) => Result<SystemId, string> = made<"estate system id">("a system id", "lower case words joined by hyphens", word, 60);

/** How an asset first reached the fleet: `provisioned` (the system installed it), `paired` (a short code paired it), `integration` (an integration or a cloud account brought it), `self` (the controller adopted itself) or `scan` (it was seen on the network and adopted from the list of what was found). */
export const ORIGINS = ["provisioned", "paired", "integration", "self", "scan"] as const;

/**
 * Where an asset came from. Only a managed asset can be `provisioned`; the others reached the fleet as someone else's install.
 *
 * @example
 * ```ts
 * import type { Origin } from "./ids.ts";
 * const origin: Origin = "paired";
 * ```
 */
export type Origin = (typeof ORIGINS)[number];

/** Who installed the operating system of an asset: the system (`provisioned`) or someone else, before the system came (`inherited`). It is derived from the origin and never stored. */
export type Install = "provisioned" | "inherited";

/** The states of an asset: seen and not adopted, observed and checked but never changed, and installed and changed to match what is declared. */
export const STATES = ["discovered", "adopted", "managed"] as const;

/**
 * The state of an asset: `discovered` (seen, not adopted), `adopted` (someone else's install, observed and checked, never changed) or `managed` (changed to match what is declared: installed by the system, or taken over after being adopted).
 *
 * @example
 * ```ts
 * import type { AssetState } from "./ids.ts";
 * const state: AssetState = "adopted";
 * ```
 */
export type AssetState = (typeof STATES)[number];

/** The capabilities an asset may offer. */
export const CAPABILITIES = ["provision", "identity", "plan", "converge", "verify", "observe", "update", "access", "backup", "retire"] as const;

/**
 * One capability an asset may offer: what can be done with it, from observing it to retiring it.
 *
 * @example
 * ```ts
 * import type { Capability } from "./ids.ts";
 * const capability: Capability = "converge";
 * ```
 */
export type Capability = (typeof CAPABILITIES)[number];
