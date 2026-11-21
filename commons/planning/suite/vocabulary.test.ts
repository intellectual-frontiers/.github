/**
 * The closed lists of Planning (commons planning 0002-planning-core FR-001): each is a union of literals with one registry entry for each case, each entry is a member of the ontology `plan:`, the ontology has
 * no member that is not a case, and a value outside a list is an error value.
 *
 * @module
 */
import {
  actorKinds,
  capabilities,
  closeReasons,
  eventTypes,
  fieldAuthorities,
  itemKinds,
  linkKinds,
  locatorKinds,
  origins,
  principalBases,
  severities,
  states,
  verdicts,
} from "@intellectual-frontiers/ontology/planning";
import { absurd } from "@intellectual-frontiers/core";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import * as v from "@intellectual-frontiers/planning/governance";

const members = (list: object): readonly string[] => Object.keys(list).sort();
const registered = (registry: { readonly [k: string]: { readonly ontology: string } }): readonly string[] => Object.values(registry).map((e) => e.ontology).sort();

proves(["0002-planning-core FR-001"], "each list has one registry entry for each case, and each entry is a member of the ontology plan: that has no other member", () => {
  const pairs = [
    [v.ITEM_KINDS, v.ITEM_KIND_REGISTRY, itemKinds],
    [v.STATE_KINDS, v.STATE_REGISTRY, states],
    [v.CLOSE_REASONS, v.CLOSE_REASON_REGISTRY, closeReasons],
    [v.SEVERITIES, v.SEVERITY_REGISTRY, severities],
    [v.VERDICTS, v.VERDICT_REGISTRY, verdicts],
    [v.LINK_KINDS, v.LINK_KIND_REGISTRY, linkKinds],
    [v.CAPABILITIES, v.CAPABILITY_REGISTRY, capabilities],
    [v.FIELD_AUTHORITIES, v.FIELD_AUTHORITY_REGISTRY, fieldAuthorities],
    [v.ORIGINS, v.ORIGIN_REGISTRY, origins],
    [v.ACTOR_KINDS, v.ACTOR_KIND_REGISTRY, actorKinds],
    [v.LOCATOR_KINDS, v.LOCATOR_KIND_REGISTRY, locatorKinds],
    [v.EVENT_TYPES, v.EVENT_TYPE_REGISTRY, eventTypes],
    [v.PRINCIPAL_BASES, v.PRINCIPAL_BASIS_REGISTRY, principalBases],
  ] as const;
  assertEquals(pairs.length, 13);
  for (const [cases, registry, ontology] of pairs) {
    assertEquals(Object.keys(registry).sort(), [...cases].sort());
    assertEquals(registered(registry), members(ontology));
  }
});

proves(["0002-planning-core FR-001"], "the names another standard gives the cases are the ontology's: the SARIF levels, the iCalendar statuses, the GitHub reasons and the Web Annotation motivation", () => {
  for (const s of v.SEVERITIES) assertEquals(v.SEVERITY_REGISTRY[s].sarifLevel, severities[v.SEVERITY_REGISTRY[s].ontology as keyof typeof severities].values.sarifLevel);
  for (const r of v.CLOSE_REASONS) assertEquals(v.CLOSE_REASON_REGISTRY[r].githubStateReason, closeReasons[v.CLOSE_REASON_REGISTRY[r].ontology as keyof typeof closeReasons].values.githubStateReason);
  for (const s of v.STATE_KINDS) assertEquals(v.STATE_REGISTRY[s].icalStatus, states[v.STATE_REGISTRY[s].ontology as keyof typeof states].values.icalStatus);
  assertEquals(v.ITEM_KIND_REGISTRY.finding.webAnnotationMotivation, itemKinds.Finding.values.webAnnotationMotivation);
  assertEquals(v.SEVERITIES, ["error", "warning", "note"]);
  assertEquals(v.VERDICTS.length, 4);
});

proves(["0002-planning-core FR-001"], "a value outside a list is an error value that names the list, and a case is a value of its list", () => {
  assertEquals(v.severity.parse("warning"), { kind: "ok", value: "warning" });
  for (const bad of ["fatal", "", "Warning", 3, null, undefined, {}]) {
    const r = v.severity.parse(bad);
    assert(r.kind === "err" && r.error.list === "severity" && r.error.expected.length === 3);
  }
  for (const list of [v.itemKind, v.stateKind, v.closeReason, v.verdict, v.linkKind, v.capability, v.fieldAuthority, v.origin, v.actorKind, v.locatorKind, v.eventType, v.principalBasis, v.authorityField]) {
    for (const c of list.cases) assert(list.is(c) && list.parse(c).kind === "ok");
    assert(!list.is("no such case") && list.parse("no such case").kind === "err");
  }
  assertEquals(v.itemKind.cases, ["issue", "task", "todo", "finding"]);
  assertEquals(v.stateKind.cases.length, 5);
  assertEquals(v.eventType.cases.length, 14);
  assertEquals(v.linkKind.cases.length, 4);
  assertEquals(v.locatorKind.cases.length, 3);
});

proves(["0002-planning-core FR-001"], "a switch over a list that misses a case does not compile, and one that handles every case ends in absurd", () => {
  const label = (s: v.Severity): string => {
    switch (s) {
      case "error":
      case "warning":
      case "note":
        return s;
      default:
        return absurd(s);
    }
  };
  assertEquals(label("note"), "note");
  const missing = (s: v.Severity): string => {
    switch (s) {
      case "error":
        return s;
      case "warning":
        return s;
      default:
        // @ts-expect-error the case note is not handled, so the value is not never
        return absurd(s);
    }
  };
  assertEquals(missing("error"), "error");
  // @ts-expect-error a severity outside the three does not compile
  const outside: v.Severity = "fatal";
  assertEquals(outside, "fatal");
  // @ts-expect-error an event type that is not in the union does not compile
  const noEvent: v.EventType = "seen";
  assertEquals(noEvent, "seen");
  // @ts-expect-error a state outside the five does not compile
  const noState: v.StateKind = "done";
  assertEquals(noState, "done");
});
