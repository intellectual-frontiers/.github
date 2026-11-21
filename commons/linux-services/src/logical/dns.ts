// Spec: 0002-linux-services-profiles FR-007
/**
 * The plan of a DNS zone: from the records wanted and the records found, the ones to create, to update and to remove. A profile removes only what it claims: a record that carries its marker, never the rest of the zone.
 *
 * @example
 * ```ts
 * import { planDns } from "./dns.ts";
 * planDns([{ type: "A", name: "a.example.org", content: "192.0.2.1", ttl: 300, proxied: false }], []).create.length; // 1
 * ```
 *
 * @module
 */
import { MARKER } from "@intellectual-frontiers/linux-services/governance";
import type { DnsRecord } from "@intellectual-frontiers/linux-services/governance";

/** A record as the provider holds it: with its id and its comment. */
export type FoundRecord = DnsRecord & { readonly id: string; readonly comment: string };

/** What a plan changes. */
export type DnsPlan = {
  readonly create: readonly DnsRecord[];
  readonly update: readonly { readonly id: string; readonly record: DnsRecord }[];
  readonly remove: readonly FoundRecord[];
};

const key = (r: DnsRecord) => `${r.type} ${r.name}`;
const same = (a: DnsRecord, b: DnsRecord) => a.content === b.content && a.ttl === b.ttl && a.proxied === b.proxied;

/** The plan to make the zone have the records wanted. A wanted name that is found without the marker is updated (the profile lists its exact name and so claims it); a found record that carries the marker and is not wanted is removed; all others are left. */
export function planDns(wanted: readonly DnsRecord[], found: readonly FoundRecord[]): DnsPlan {
  const create: DnsRecord[] = [];
  const update: { id: string; record: DnsRecord }[] = [];
  const matched = new Set<string>();
  for (const w of wanted) {
    const same_key = found.filter((f) => key(f) === key(w));
    const exact = same_key.find((f) => f.content === w.content);
    const hit = exact ?? same_key.find((f) => f.comment === MARKER);
    if (hit === undefined) {
      create.push(w);
      continue;
    }
    matched.add(hit.id);
    if (!same(w, hit) || hit.comment !== MARKER) update.push({ id: hit.id, record: w });
  }
  const remove = found.filter((f) => f.comment === MARKER && !matched.has(f.id));
  return { create, update, remove };
}

/** Whether a plan changes nothing. */
export const isEmpty = (p: DnsPlan): boolean => p.create.length + p.update.length + p.remove.length === 0;
