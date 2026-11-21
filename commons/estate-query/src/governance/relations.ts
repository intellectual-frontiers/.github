// Spec: 0002-estate-query-relations FR-001
/**
 * The relations of an estate, as data: each has a name, a sentence, and columns with a type and a sentence. The catalog the guard binds a query to, the help `query tables` prints and the documentation are all made from this one list, so that no relation is described twice.
 *
 * @example
 * ```ts
 * import { RELATIONS, relationNamed } from "./relations.ts";
 * relationNamed("asset")?.columns.map((c) => c.name); // ["id", "kind", "state", "origin", "install"]
 * ```
 *
 * @module
 */

/** The types of a column: whole numbers, text, true or false, and an instant or a day as text in ISO 8601 (which sorts as time does). */
export type ColumnType = "int" | "text" | "bool" | "timestamp";

/** A column of a relation. */
export type Column = { readonly name: string; readonly type: ColumnType; readonly summary: string };

/** A relation of the estate. */
export type Relation = { readonly name: string; readonly summary: string; readonly columns: readonly Column[] };

const c = (name: string, type: ColumnType, summary: string): Column => ({ name, type, summary });

/** Every relation, in the order `query tables` lists them. */
export const RELATIONS: readonly Relation[] = [
  { name: "asset", summary: "One row for each asset of the estate.", columns: [c("id", "text", "The identity of the asset."), c("fleet", "text", "The fleet that declares it; empty where the data does not say."), c("kind", "text", "What it is: server, workstation and so on."), c("state", "text", "discovered, adopted or managed."), c("origin", "text", "Where it came from: provisioned, paired, integration or self; empty where unknown."), c("install", "text", "Who installed its operating system: provisioned or inherited; empty for a discovered asset.")] },
  { name: "capability", summary: "One row for each capability of each asset, offered or not, with its owner or the reason it is not offered.", columns: [c("asset", "text", "The asset."), c("capability", "text", "provision, identity, plan, converge, verify, observe, update, access, backup or retire."), c("offered", "bool", "Whether the state of the asset offers it."), c("owner", "text", "The system that owns it; empty where it is not offered."), c("reason", "text", "Why it is not offered; empty where it is.")] },
  { name: "platform", summary: "The platform an asset is declared to be, for the assets that declare one.", columns: [c("asset", "text", "The asset."), c("family", "text", "debian, rhel, suse or arch."), c("distro", "text", "The ID of its os-release."), c("release", "text", "Its VERSION_ID."), c("arch", "text", "x86_64 or aarch64."), c("ansible", "text", "The ansible-core the fleet pins for it; empty where none is said.")] },
  { name: "declared", summary: "What is declared of an asset, one row for each value (a nested value has a dotted path).", columns: [c("asset", "text", "The asset."), c("path", "text", "The dotted path of the value."), c("value", "text", "The value, as text.")] },
  { name: "attribute", summary: "The attributes an asset states, one row for each (a list has one row for each item).", columns: [c("asset", "text", "The asset."), c("name", "text", "The attribute."), c("value", "text", "The value, as text.")] },
  { name: "endpoint", summary: "One row for each asset of the kind endpoint: where a client reaches a service, with the common service it names and whether it speaks in the clear.", columns: [c("asset", "text", "The asset."), c("scheme", "text", "The protocol spoken."), c("host", "text", "The name or address."), c("port", "int", "The port; the usual one of its service or scheme where none is stated, and 0 where that is not known."), c("path", "text", "The path; empty where none."), c("service", "text", "The common service; empty where none is named."), c("class", "text", "The class of the service in the services catalog; empty where none."), c("exposure", "text", "internet, partner, internal or management; empty where not stated."), c("authentication", "text", "How a client proves who it is; empty where not stated."), c("cleartext", "bool", "Whether it speaks in the clear: by its scheme, or by its service where the scheme says nothing.")] },
  { name: "link", summary: "The links between assets, with their named kinds.", columns: [c("from_asset", "text", "Where it starts."), c("to_asset", "text", "Where it ends."), c("kind", "text", "runs-on, exposes, depends-on, resolves-to, secured-by, client-of or another word.")] },
  { name: "service", summary: "The catalog of common services, to join endpoints to.", columns: [c("name", "text", "The service."), c("transport", "text", "tcp or udp."), c("port", "int", "The usual port."), c("class", "text", "web, management, data, mail, directory, file, name, time or orchestration."), c("cleartext", "bool", "Whether it speaks in the clear on that port.")] },
  { name: "observation", summary: "The latest observation of each asset.", columns: [c("asset", "text", "The asset."), c("at", "timestamp", "When it was observed."), c("source", "text", "What it is attributed to.")] },
  { name: "observed", summary: "What was observed of an asset in its latest observation, one row for each value.", columns: [c("asset", "text", "The asset."), c("path", "text", "The dotted path of the value."), c("value", "text", "The value, as text; a value that looks like a secret is replaced.")] },
  { name: "truth", summary: "The operational truth of each asset: how current its observation is and whether it agrees with what is declared.", columns: [c("asset", "text", "The asset."), c("currency", "text", "fresh, due, stale or never-observed."), c("alignment", "text", "aligned, drifted or not-observed."), c("agrees", "bool", "Whether what is declared and what is observed agree."), c("observed_at", "timestamp", "When it was observed; empty where it never was."), c("source", "text", "What the observation is attributed to; empty where none.")] },
  { name: "policy_result", summary: "The status of each policy for each asset, with the risks accepted taken into account.", columns: [c("asset", "text", "The asset."), c("policy", "text", "The policy."), c("status", "text", "pass, fail, warn, accepted or waiting."), c("detail", "text", "One sentence on why.")] },
  { name: "policy_control", summary: "The controls each policy answers to.", columns: [c("asset", "text", "The asset."), c("policy", "text", "The policy."), c("control", "text", "A control it is evidence for.")] },
  { name: "risk", summary: "The risks accepted for an asset.", columns: [c("asset", "text", "The asset."), c("policy", "text", "The policy whose failure was accepted."), c("reason", "text", "Why."), c("accepted_by", "text", "The person who accepted it."), c("until", "timestamp", "The day it is accepted until.")] },
  { name: "change", summary: "The changes of the tenant's repository, newest first: who, when, what and whether it was signed.", columns: [c("commit", "text", "The commit."), c("at", "timestamp", "When it was made."), c("author", "text", "Who made it."), c("subject", "text", "Its subject line."), c("refs", "text", "The change requests it names (Refs or Closes); empty where it names none."), c("signed", "bool", "Whether it carries a signature (not that the signature is valid: that is for the signers a fleet trusts).")] },
  { name: "approval", summary: "The approvals the tenant keeps: who approved which change of an asset, by the hash of what they approved.", columns: [c("asset", "text", "The asset."), c("kind", "text", "What was approved: manage is the taking over of an adopted machine."), c("approved_by", "text", "The person."), c("plan_hash", "text", "The hash of what they approved."), c("at", "timestamp", "When.")] },
  { name: "violation", summary: "The invariants of the estate that are broken.", columns: [c("invariant", "text", "The invariant."), c("subject", "text", "What breaks it."), c("message", "text", "What is wrong.")] },
];

/** The relation of a name, or nothing. */
export function relationNamed(name: string): Relation | undefined {
  return RELATIONS.find((r) => r.name === name);
}
