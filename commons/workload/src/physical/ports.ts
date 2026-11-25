// Spec: 0006-workload-split FR-004, FR-005
/**
 * The ports of the executors, whatever the form: what the host provides. A verb is bound by its id to a function of typed inputs, never to a shell string; an agent port gets a question and the type of the answer and nothing that could call a verb;
 * a sink keeps the planning events of a run; a catalog says what a store offers; a workshop port attaches and detaches. Each is small, so that a test provides it as a value.
 *
 * @example
 * ```ts
 * import type { VerbBinding } from "./ports.ts";
 * const binding: VerbBinding = async () => ({ kind: "ok", value: { digests: [], outputs: {} } });
 * ```
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import type { Capability } from "@intellectual-frontiers/anyfs/governance";
import type { EventId, Instant, ItemEvent, ItemId } from "@intellectual-frontiers/planning/governance";
import type { NodeId, OutputSchema, StoreClass } from "@intellectual-frontiers/workload/governance";

/** The inputs of a verb, resolved to values: a store is its reference. */
export type ResolvedInputs = Readonly<Record<string, string | number | boolean>>;

/** What a verb did: the digests of what it read or wrote, what it outputs for later steps, and for a read that asserts, whether it holds. */
export type VerbOutcome = { readonly digests: readonly string[]; readonly outputs: Readonly<Record<string, string | number | boolean>>; readonly holds?: boolean };

/** A verb as the host binds it: typed inputs in, an outcome or a reason out. */
export type VerbBinding = (inputs: ResolvedInputs) => Promise<Result<VerbOutcome, string>>;

/** The bindings of the verbs by id. */
export type VerbBindings = ReadonlyMap<string, VerbBinding>;

/** The agent: it is given a question and the type of the answer, and it returns what it returns; it is given no verb. */
export type AgentPort = { propose(request: { readonly step: NodeId; readonly question: string; readonly output: OutputSchema }): Promise<unknown> };

/** The place the events of a run are kept: the planning events of the work order. */
export type EventSink = { append(event: ItemEvent): Promise<Result<void, string>>; read(item: ItemId): Promise<readonly ItemEvent[]> };

/** What a store offers: its class and the capabilities it has. */
export type StoreOffer = { readonly ref: string; readonly class: StoreClass; readonly capabilities: readonly Capability[] };

/** The stores the host knows. */
export type StoreCatalog = { offer(ref: string): StoreOffer | undefined };

/** The workshop: it attaches and detaches the real store. */
export type WorkshopPort = { attach(ref: string): Promise<Result<void, string>>; detach(ref: string): Promise<Result<void, string>> };

/** The clock and the ids of events, given by the host so that a run is testable. */
export type Source = { now(): Instant; nextEventId(): EventId; instantAfterHours(from: Instant, hours: number): Instant };
