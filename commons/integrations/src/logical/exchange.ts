// Spec: 0006-integrations-exchange FR-010, FR-011, FR-012
/**
 * Acknowledgements, outcomes and the exchange state machine (commons integrations 0006-integrations-exchange): the typed acknowledgements of the standards
 * (X12 TA1 and 999, HL7 ACK, FHIR OperationOutcome) reduced to one status, and the life of a message as a total transition function of a state and an event.
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Instant } from "@intellectual-frontiers/integrations/governance";
import type { Finding } from "./constraints.ts";

/** What an acknowledgement says of what it acknowledges. */
export type AckStatus = "accepted" | "accepted-with-errors" | "rejected";

/** The codes of an HL7 v2 acknowledgement: application (AA, AE, AR) and commit (CA, CE, CR). */
export type Hl7AckCode = "AA" | "AE" | "AR" | "CA" | "CE" | "CR";

/** An acknowledgement or an outcome, by standard. It carries codes and counts and the findings (which hold no value), never a payload. */
export type Acknowledgement =
  | { readonly kind: "x12-ta1"; readonly control: string; readonly status: AckStatus; readonly note: string }
  | { readonly kind: "x12-999"; readonly control: string; readonly groupControl: string; readonly status: AckStatus; readonly errors: number }
  | { readonly kind: "hl7-ack"; readonly control: string; readonly code: Hl7AckCode }
  | { readonly kind: "fhir-operation-outcome"; readonly issues: readonly Finding[] };

/** What an acknowledgement comes to. */
export function statusOf(a: Acknowledgement): AckStatus {
  switch (a.kind) {
    case "x12-ta1":
    case "x12-999":
      return a.status;
    case "hl7-ack":
      switch (a.code) {
        case "AA":
        case "CA":
          return "accepted";
        case "AE":
        case "CE":
          return "accepted-with-errors";
        case "AR":
        case "CR":
          return "rejected";
        default:
          return absurd(a.code);
      }
    case "fhir-operation-outcome":
      return a.issues.some((i) => i.severity === "error") ? "rejected" : a.issues.length > 0 ? "accepted-with-errors" : "accepted";
    default:
      return absurd(a);
  }
}

/** Where a message is in its life. */
export type ExchangeState =
  | { readonly kind: "pending" }
  | { readonly kind: "sent"; readonly attempt: number; readonly at: Instant }
  | { readonly kind: "received"; readonly at: Instant }
  | { readonly kind: "retrying"; readonly attempt: number }
  | { readonly kind: "acknowledged"; readonly status: "accepted" | "accepted-with-errors" }
  | { readonly kind: "rejected"; readonly reason: "nack" | "invalid" }
  | { readonly kind: "abandoned"; readonly attempts: number };

/** What happens to a message. */
export type ExchangeEvent =
  | { readonly kind: "send"; readonly at: Instant }
  | { readonly kind: "receive"; readonly at: Instant }
  | { readonly kind: "ack"; readonly status: AckStatus }
  | { readonly kind: "timeout" }
  | { readonly kind: "retry"; readonly at: Instant }
  | { readonly kind: "invalid" };

/** What the agreement allows. */
export type TransitionPolicy = { readonly maxAttempts: number };

/** An event that does not fit the state it came in. */
export type TransitionError = { readonly kind: "illegal"; readonly from: ExchangeState["kind"]; readonly event: ExchangeEvent["kind"] };

const illegal = (from: ExchangeState, event: ExchangeEvent): Result<ExchangeState, TransitionError> => err({ kind: "illegal", from: from.kind, event: event.kind });

function acked(status: AckStatus): ExchangeState {
  switch (status) {
    case "accepted":
    case "accepted-with-errors":
      return { kind: "acknowledged", status };
    case "rejected":
      return { kind: "rejected", reason: "nack" };
    default:
      return absurd(status);
  }
}

/** The next state: total over every state and every event, an illegal pair giving an error and never throwing. */
export function transition(state: ExchangeState, event: ExchangeEvent, policy: TransitionPolicy): Result<ExchangeState, TransitionError> {
  switch (state.kind) {
    case "pending":
      switch (event.kind) {
        case "send":
          return ok({ kind: "sent", attempt: 1, at: event.at });
        case "receive":
          return ok({ kind: "received", at: event.at });
        case "ack":
        case "timeout":
        case "retry":
        case "invalid":
          return illegal(state, event);
        default:
          return absurd(event);
      }
    case "sent":
      switch (event.kind) {
        case "ack":
          return ok(acked(event.status));
        case "timeout":
          return ok(state.attempt < policy.maxAttempts ? { kind: "retrying", attempt: state.attempt } : { kind: "abandoned", attempts: state.attempt });
        case "send":
        case "receive":
        case "retry":
        case "invalid":
          return illegal(state, event);
        default:
          return absurd(event);
      }
    case "retrying":
      switch (event.kind) {
        case "retry":
          return ok({ kind: "sent", attempt: state.attempt + 1, at: event.at });
        case "send":
        case "receive":
        case "ack":
        case "timeout":
        case "invalid":
          return illegal(state, event);
        default:
          return absurd(event);
      }
    case "received":
      switch (event.kind) {
        case "ack":
          return ok(acked(event.status));
        case "invalid":
          return ok({ kind: "rejected", reason: "invalid" });
        case "send":
        case "receive":
        case "timeout":
        case "retry":
          return illegal(state, event);
        default:
          return absurd(event);
      }
    case "acknowledged":
    case "rejected":
    case "abandoned":
      return illegal(state, event);
    default:
      return absurd(state);
  }
}

/** Whether a state is final: nothing follows it. */
export function isFinal(s: ExchangeState): boolean {
  switch (s.kind) {
    case "acknowledged":
    case "rejected":
    case "abandoned":
      return true;
    case "pending":
    case "sent":
    case "received":
    case "retrying":
      return false;
    default:
      return absurd(s);
  }
}
