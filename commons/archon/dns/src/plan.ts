// Spec: 0002-dns-command FR-002, FR-003
/**
 * The plan of a zone as a person approves it: what changes, and the hash of exactly that. The hash is of the plan as data, so that a plan that changed between the reading and the apply is another hash.
 *
 * @example
 * ```ts
 * import { hashOf } from "./plan.ts";
 * hashOf({ create: [], update: [], remove: [] }); // "sha256:..."
 * ```
 *
 * @module
 */
import { createHash } from "node:crypto";
import { isEmpty, planDns, type DnsPlan } from "@intellectual-frontiers/linux-services/logical";
import type { DnsSubject } from "./config.ts";

const sortBy = <T>(xs: readonly T[], key: (x: T) => string): T[] => [...xs].sort((a, b) => key(a).localeCompare(key(b)));
const rec = (r: { type: string; name: string; content: string; ttl: number; proxied: boolean }) => ({ type: r.type, name: r.name, content: r.content, ttl: r.ttl, proxied: r.proxied });

/** The hash of a plan: of its records, in an order that does not depend on how the provider listed them (the ids of the provider are part of what is changed, so they count). */
export function hashOf(plan: DnsPlan): string {
  const canonical = {
    create: sortBy(plan.create, (r) => `${r.type} ${r.name} ${r.content}`).map(rec),
    update: sortBy(plan.update, (u) => u.id).map((u) => ({ id: u.id, record: rec(u.record) })),
    remove: sortBy(plan.remove, (r) => r.id).map((r) => ({ id: r.id, ...rec(r) })),
  };
  return `sha256:${createHash("sha256").update(JSON.stringify(canonical)).digest("hex")}`;
}

/** The plan of a zone now, and its hash where it changes something. */
export async function planZone(subject: DnsSubject): Promise<{ readonly plan: DnsPlan; readonly hash: string | undefined }> {
  const plan = planDns(subject.wanted, await subject.provider.list());
  return { plan, hash: isEmpty(plan) ? undefined : hashOf(plan) };
}

/** The text a person reads before approving a plan. */
export function describe(plan: DnsPlan, hash: string | undefined): string {
  const line = (sign: string, r: { type: string; name: string; content: string }) => `${sign} ${r.type} ${r.name} ${r.content}`;
  const lines = [...plan.create.map((r) => line("+", r)), ...plan.update.map((u) => line("~", u.record)), ...plan.remove.map((r) => line("-", r))];
  return [`${lines.length} change${lines.length === 1 ? "" : "s"}`, ...lines, hash === undefined ? "the plan is empty" : `plan hash ${hash}`].join("\n");
}
