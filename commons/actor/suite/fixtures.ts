/**
 * Fixtures: made-up actors with synthetic ids, and the act they take part in.
 *
 * @module
 */
import type { AgentActor, Directive, PersonActor, SystemActor } from "@intellectual-frontiers/actor/governance";

export const person = (n: number): PersonActor => ({ kind: "person", id: `synthetic-person-0${n}` });
export const system: SystemActor = { kind: "system", id: "synthetic-system-01" };
export const agent: AgentActor = { kind: "agent", id: "synthetic-agent-01", model: { name: "synthetic-model-1", assurance: "reported" } };
export const DIGEST = "a".repeat(64);
export const directive = (owner: PersonActor): Directive => ({ id: "work-order-001", version: "1", digest: DIGEST, owner });
