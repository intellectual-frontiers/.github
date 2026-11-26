// Spec: 0001-quality-evidence FR-041
/**
 * Attestation by recorded sample (commons 0001-quality-evidence FR-041): a person samples records at random, and what was sampled, the rule and the seed
 * that chose it, the result on each item, the person's name and role and the day are kept as chained records. The seed makes the sample
 * reproducible: anyone given the population and the seed draws the same items (`verifyDraw`).
 *
 * @remarks
 * The rule `hash-ranked/1` ranks each item of the population (sorted, without duplicates) by the SHA-256 of `seed`, a line feed and the item,
 * and takes the first `size` of them; the items are listed sorted. It needs no random generator in the pure code: the randomness is the seed,
 * which a person gives or `freshSeed` makes from the host's random bytes, and which is recorded either way. The population is recorded as its
 * count and the SHA-256 of its sorted items, so a sample cannot be redrawn from another population without the digest saying so.
 *
 * @example
 * ```ts
 * import { drawSample } from "./sample.ts";
 * // const drawn = await drawSample({ population: ["a", "b", "c", "d"], seed: "7f3a", size: 2 });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Sha256, sha256 } from "@intellectual-frontiers/crypto/sha256";
import type { LedgerEvent } from "../pure/ledger.ts";
import { dayOfText } from "../pure/time.ts";
import { type PersonRef, SAMPLE_RULE, type SampleSubject } from "../pure/tier2-events.ts";

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The population as the rule sees it: its items sorted, without duplicates. */
export function normalized(population: readonly string[]): readonly string[] {
  return [...new Set(population)].sort(byText);
}

/** The digest of a population (its sorted items, one on each line). */
export function populationDigest(population: readonly string[]): Promise<Sha256> {
  return sha256(normalized(population).join("\n"));
}

/** A seed made of random bytes, for a person who gives none: 128 bits as hexadecimal. The one place a sample's randomness enters. */
export function freshSeed(random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  return [...random(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** How many items a sample holds: the size given, or the share `ratePermille` of the population rounded up and at least one (FR-044's rate). */
export function sizeOf(count: number, size: number | undefined, ratePermille: number | undefined): Result<number, string> {
  if (count < 1) return err("there is nothing to sample: the population is empty");
  if (size !== undefined) {
    if (!Number.isInteger(size) || size < 1) return err(`a sample holds at least one item, and ${size} is not that`);
    if (size > count) return err(`a sample of ${size} cannot be drawn from ${count} items`);
    return ok(size);
  }
  if (ratePermille === undefined) return err("give the size of the sample or the rate it is drawn at");
  if (!Number.isInteger(ratePermille) || ratePermille < 1 || ratePermille > 1000)
    return err(`a rate is 1 to 1000 in a thousand, and ${ratePermille} is not`);
  return ok(Math.max(1, Math.min(count, Math.ceil((count * ratePermille) / 1000))));
}

/** A sample as drawn. */
export type Drawn = {
  readonly size: number;
  readonly items: readonly string[];
  readonly population: { readonly count: number; readonly sha256: Sha256 };
};

/** What a draw is given. */
export type DrawInput = {
  readonly population: readonly string[];
  readonly seed: string;
  readonly size?: number;
  readonly ratePermille?: number;
};

/** Draws a sample: the items of the population ranked by the SHA-256 of the seed and the item, the first `size` taken, listed sorted (FR-041). */
export async function drawSample(input: DrawInput): Promise<Result<Drawn, string>> {
  if (input.seed.trim() === "") return err("a sample is drawn with a seed, and the seed is recorded");
  const items = normalized(input.population);
  const size = sizeOf(items.length, input.size, input.ratePermille);
  if (size.kind === "err") return size;
  const ranked = await Promise.all(items.map(async (item) => ({ item, key: await sha256(`${input.seed}\n${item}`) })));
  ranked.sort((a, b) => byText(a.key, b.key) || byText(a.item, b.item));
  return ok({
    size: size.value,
    items: ranked
      .slice(0, size.value)
      .map((r) => r.item)
      .sort(byText),
    population: { count: items.length, sha256: await populationDigest(items) },
  });
}

/** The event of a sample drawn. */
export type SampleDrawn = Extract<LedgerEvent, { readonly kind: "sample-drawn" }>;

/**
 * Whether a recorded sample is the one its seed and population give (FR-041): the population is the one the record names (its count and
 * digest), and drawing again gives the items the record lists. The first difference is named.
 */
export async function verifyDraw(event: SampleDrawn, population: readonly string[]): Promise<Result<true, string>> {
  const again = await drawSample({ population, seed: event.seed, size: event.size });
  if (again.kind === "err") return again;
  if (again.value.population.count !== event.population.count)
    return err(`${event.id} records a population of ${event.population.count} and the population has ${again.value.population.count}`);
  if (again.value.population.sha256 !== event.population.sha256) return err(`${event.id} was drawn from another population than this one`);
  if (again.value.items.join("\n") !== [...event.items].sort(byText).join("\n"))
    return err(`${event.id} does not hold the items its seed ${event.seed} gives`);
  return ok(true);
}

/** What `drawEvent` is given. */
export type DrawEventInput = DrawInput & {
  readonly subject: SampleSubject;
  readonly by: PersonRef;
  readonly day: string;
  /** The identifier the sample takes (the next the ledger holds). */
  readonly id: string;
};

/** The event that records a sample drawn: its subject, the rule, the seed, the population's count and digest, the items and the person who drew it. */
export async function drawEvent(input: DrawEventInput): Promise<Result<LedgerEvent, string>> {
  if (input.by.name.trim() === "") return err("a sample is drawn by a named person");
  const drawn = await drawSample(input);
  if (drawn.kind === "err") return drawn;
  const day = dayOfText(input.day);
  if (day.kind === "err") return day;
  return ok({
    kind: "sample-drawn",
    id: input.id,
    subject: input.subject,
    rule: SAMPLE_RULE,
    seed: input.seed,
    population: drawn.value.population,
    size: drawn.value.size,
    items: drawn.value.items,
    by: input.by,
    day: day.value,
    ...(input.ratePermille === undefined || input.size !== undefined ? {} : { ratePermille: input.ratePermille }),
  });
}
