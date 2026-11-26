// Spec: 0008-estate-workstations FR-001
/**
 * Tests of the workshop, the workstation and the agent workspace (0008-estate-workstations): the kind and its attributes, the harness tier, where a workshop comes from, how it is adopted and as what, who owns what, the invariants, the capture by role,
 * and the host-file declaration. Every name is made up; the digest is the digest of nothing.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  WORKSHOP_CAPTURE,
  cadenceOf,
  checkAttributes,
  defineAsset,
  defineCapturePolicy,
  defineEstate,
  freshnessWindowMs,
  journalOf,
  kindSpec,
  ownerOf,
  workshopOwners,
  type Asset,
  type CapturePolicy,
} from "../src/governance/mod.ts";
import { checkInvariants, INVARIANT_COVERAGE, moveState, type Violation } from "../src/logical/mod.ts";
import { assetCodec } from "../src/physical/mod.ts";
import { bytes } from "./support.ts";

const DIGEST = `sha256:${"0".repeat(64)}`;
const HASH = `sha256:${"a".repeat(64)}`;
const AGENT = { role: "agent-workspace", disposability: "disposable", isolation: "vm", "os-family": "arch", distro: "arch", omarchy: true, harnesses: ["claude-code", "codex", "herdr"], "agents-policy": DIGEST } as const;

const made = (r: ReturnType<typeof defineAsset>): Asset => {
  assert(r.kind === "ok", r.kind === "err" ? r.error.join("; ") : "");
  return r.value;
};
const refusal = (r: ReturnType<typeof defineAsset>): string => {
  assert(r.kind === "err", "the asset was refused");
  return r.error.join("; ");
};
const ws = (id: string, state: "discovered" | "adopted" | "managed", attributes: Record<string, string | boolean | readonly string[]>, owners: Record<string, string>, origin?: "provisioned" | "paired" | "integration" | "self" | "scan") =>
  defineAsset({ id, kind: "workshop", state, ...(origin === undefined ? {} : { origin }), owners, attributes });

proves(["0008-estate-workstations FR-001", "0008-estate-workstations FR-002"], "a workshop is in the catalog with attributes none of which is required, synthetic-workshop-01 with none is accepted, and Omarchy is a flag on distro arch", () => {
  const spec = kindSpec("workshop");
  assert(spec !== undefined && spec.attributes.every((a) => a.required !== true));
  assertEquals(spec.attributes.map((a) => a.name), ["role", "disposability", "isolation", "os-family", "distro", "omarchy", "harnesses", "agents-policy"]);
  made(defineAsset({ id: "synthetic-workshop-01", kind: "workshop", state: "adopted", origin: "paired", owners: { observe: "desired-os-state", verify: "desired-os-state" } }));
  assertEquals(checkAttributes("workshop", AGENT), []);
  assert(checkAttributes("workshop", { role: "robot" })[0]?.includes("none of agent-workspace, build, test, other") === true);
  assert(checkAttributes("workshop", { isolation: "bare" }).length === 1 && checkAttributes("workshop", { role: "bot" }).length === 1 && checkAttributes("workshop", { "os-family": "beos" }).length === 1);
  assert(checkAttributes("workshop", { distro: "omarchy" })[0]?.includes("none of arch") === true, "omarchy is no distro");
  assert(checkAttributes("workshop", { omarchy: "yes" })[0]?.includes("a boolean") === true);
  assert(checkAttributes("workshop", { harnesses: "codex" })[0]?.includes("list of strings") === true);
  assert(checkAttributes("workshop", { "agents-policy": "sha256:abc" })[0]?.includes("not a digest") === true);
  assert(checkAttributes("workshop", { omarchy: true, distro: "ubuntu" })[0]?.includes("Omarchy workshop is distro arch") === true);
  assert(checkAttributes("workshop", { omarchy: true, "os-family": "debian" })[0]?.includes("os-family arch") === true);
  assert(checkAttributes("workshop", { whatever: "x" })[0]?.includes("has no attribute whatever") === true);
});

proves(["0008-estate-workstations FR-001"], "a workstation is the operator's side: role, os-family, distro and client harnesses, with no agents-policy, disposability or isolation, and runs-on may end at a workshop or a workstation", () => {
  const spec = kindSpec("workstation");
  assert(spec !== undefined && spec.attributes.every((a) => a.required !== true));
  assertEquals(spec.attributes.map((a) => a.name), ["role", "os-family", "distro", "harnesses"]);
  assertEquals(checkAttributes("workstation", { role: "operator", "os-family": "macos", distro: "macos", harnesses: ["claude-code", "codex"] }), []);
  assert(checkAttributes("workstation", { role: "agent-workspace" })[0]?.includes("none of developer, operator, other") === true, "agent-workspace is a role of a workshop");
  for (const name of ["agents-policy", "disposability", "isolation", "omarchy"]) assert(checkAttributes("workstation", { [name]: "disposable" })[0]?.includes(`has no attribute ${name}`) === true, name);
  made(defineAsset({ id: "synthetic-workstation-01", kind: "workstation", state: "adopted", origin: "paired", owners: { observe: "desired-os-state", verify: "desired-os-state" } }));
  const adopted = { state: "adopted", origin: "paired", owners: { observe: "opsfolio", verify: "opsfolio" } } as const;
  const links = [{ from: "codex-on-box", to: "box", kind: "runs-on" }] as const;
  for (const kind of ["workshop", "workstation"] as const) {
    const r = defineEstate({ box: { kind, ...adopted }, "codex-on-box": { kind: "application", ...adopted, attributes: { tier: "agent-harness", harness: "codex" } } }, links);
    assert(r.kind === "ok", r.kind === "err" ? r.error.join("; ") : "");
  }
  const dev = made(defineAsset({ id: "synthetic-workstation-01", kind: "workstation", state: "adopted", origin: "paired", owners: { observe: "opsfolio", verify: "opsfolio" }, attributes: { role: "developer", harnesses: ["codex"] } }));
  assertEquals(violations([dev]), [], "the client harnesses of a workstation are no authority of the estate");
  assertEquals(cadenceOf(policy(), dev), "P1D", "a workstation has no cadence of an agent workspace");
});

proves(["0008-estate-workstations FR-003"], "agent-harness is a tier, a harness is allowed only on that tier, and runs-on joins it to a workshop", () => {
  assertEquals(checkAttributes("application", { tier: "agent-harness", harness: "codex" }), []);
  assert(checkAttributes("application", { tier: "web", harness: "codex" })[0]?.includes("for the tier agent-harness") === true);
  assert(checkAttributes("application", { harness: "codex" })[0]?.includes("for the tier agent-harness") === true);
  assert(checkAttributes("application", { tier: "agent-harness", harness: "gemini" })[0]?.includes("none of claude-code, codex, herdr, other") === true);
  assertEquals(checkAttributes("application", { tier: "web" }), []);
  const adopted = { state: "adopted", origin: "paired", owners: { observe: "opsfolio", verify: "opsfolio" } } as const;
  const ok = defineEstate({ agentbox: { kind: "workshop", ...adopted, attributes: AGENT }, "codex-on-agentbox": { kind: "application", ...adopted, attributes: { tier: "agent-harness", harness: "codex" } } }, [{ from: "codex-on-agentbox", to: "agentbox", kind: "runs-on" }]);
  assert(ok.kind === "ok", ok.kind === "err" ? ok.error.join("; ") : "");
  const bad = defineEstate({ agentbox: { kind: "workshop", ...adopted, attributes: AGENT }, "codex-on-agentbox": { kind: "application", ...adopted, attributes: { tier: "web", harness: "codex" } } }, [{ from: "codex-on-agentbox", to: "agentbox", kind: "runs-on" }]);
  assert(bad.kind === "err" && bad.error.some((m) => m.includes("for the tier agent-harness")));
});

proves(["0008-estate-workstations FR-004", "0008-estate-workstations FR-005"], "no kind is a session, and the catalog only grows: every attribute that existed is still there", () => {
  assert(kindSpec("session") === undefined && kindSpec("agent-session") === undefined);
  const names = (k: string) => kindSpec(k)?.attributes.map((a) => a.name) ?? [];
  for (const [k, kept] of [["application", ["tier", "language", "repository", "image", "handles", "provenance"]], ["endpoint", ["scheme", "host", "port"]]] as const) for (const n of kept) assert(names(k).includes(n), `${k}.${n}`);
  for (const v of ["web", "api", "worker", "batch", "database", "library"]) assertEquals(checkAttributes("application", { tier: v }), []);
});

proves(["0008-estate-workstations FR-006", "0008-estate-workstations FR-007"], "a booted and bootstrapped machine is never provisioned and may be paired, self or scan, and a managed one keeps its origin", () => {
  const owners = workshopOwners({ system: "opsfolio", state: "adopted" });
  assert(refusal(ws("omarchybox", "adopted", AGENT, owners, "provisioned")).includes("only a managed asset can be provisioned"));
  for (const origin of ["paired", "self", "scan", "integration"] as const) made(ws("omarchybox", "adopted", AGENT, owners, origin));
  const paired = made(ws("omarchybox", "adopted", AGENT, owners, "paired"));
  const managed = moveState(paired, "managed", workshopOwners({ system: "opsfolio", state: "managed", disposability: "disposable" }), { by: "a person", planHash: HASH });
  assert(managed.kind === "ok" && managed.value.origin === "paired", "a bootstrapped machine is not an installed operating system");
  assert(managed.kind === "ok" && ownerOf(managed.value, "provision") === undefined, "a machine someone else installed does not offer provision");
  made(ws("labbox", "managed", { ...AGENT, isolation: "container" }, workshopOwners({ system: "opsfolio", state: "managed", disposability: "disposable", provision: "lab" }), "provisioned"));
});

proves(["0008-estate-workstations FR-008", "0008-estate-workstations FR-012"], "a discovered device is adopted as a workshop only with an approval, attributes survive a move, and managing needs the approval of the plan", () => {
  const device = made(defineAsset({ id: "device-aabbccddeeff", kind: "device", state: "discovered", origin: "scan", owners: {} }));
  const owners = workshopOwners({ system: "opsfolio", state: "adopted" });
  const as = { kind: "workshop", approval: { by: "a person", planHash: HASH } };
  const adopted = moveState(device, "adopted", owners, undefined, { as, attributes: AGENT });
  assert(adopted.kind === "ok" && adopted.value.kind === "workshop" && adopted.value.origin === "scan" && adopted.value.attributes?.["role"] === "agent-workspace");
  for (const bad of [{ kind: "workshop", approval: { by: " ", planHash: HASH } }, { kind: "workshop", approval: { by: "a person", planHash: "sha256:xyz" } }]) {
    const r = moveState(device, "adopted", owners, undefined, { as: bad });
    assert(r.kind === "err" && r.error[0]?.includes("only with an approval") === true);
  }
  const refusedKind = moveState(device, "adopted", owners, undefined, { as: { kind: "workshop", approval: { by: "a person", planHash: HASH } }, attributes: { role: "robot" } });
  assert(refusedKind.kind === "err" && refusedKind.error[0]?.includes("none of agent-workspace") === true, "the attributes of the new kind are checked");
  const same = moveState(device, "adopted", owners, undefined, { as: { kind: "device", approval: { by: "a person", planHash: HASH } } });
  assert(same.kind === "err" && same.error[0]?.includes("already a device") === true);
  assert(adopted.kind === "ok");
  const later = moveState(adopted.value, "managed", workshopOwners({ system: "opsfolio", state: "managed", disposability: "disposable" }), { by: "a person", planHash: HASH }, { as });
  assert(later.kind === "err" && later.error[0]?.includes("only when a discovered asset is adopted") === true);
  assert(moveState(adopted.value, "managed", workshopOwners({ system: "opsfolio", state: "managed", disposability: "disposable" })).kind === "err", "no approval, no managing");
  const managed = moveState(adopted.value, "managed", workshopOwners({ system: "opsfolio", state: "managed", disposability: "disposable" }), { by: "a person", planHash: HASH });
  assert(managed.kind === "ok" && managed.value.attributes?.["agents-policy"] === DIGEST && managed.value.attributes["omarchy"] === true, "attributes are kept across the move");
});

proves(["0008-estate-workstations FR-009", "0008-estate-workstations FR-010", "0008-estate-workstations FR-021"], "the system the caller names owns what it carries out, person owns the rest, and the owners make a managed workshop whole", () => {
  assertEquals(workshopOwners({ system: "opsfolio", state: "discovered" }), {});
  assertEquals(workshopOwners({ system: "opsfolio", state: "adopted" }), { observe: "opsfolio", verify: "opsfolio" });
  const m = workshopOwners({ system: "opsfolio", state: "managed", disposability: "disposable", identity: "opsfolio" });
  assertEquals([m.observe, m.verify, m.access, m.plan, m.converge, m.update, m.identity, m.backup, m.retire], ["opsfolio", "opsfolio", "opsfolio", "opsfolio", "opsfolio", "opsfolio", "opsfolio", "person", "opsfolio"]);
  assertEquals(workshopOwners({ system: "opsfolio", state: "managed" }).identity, "person");
  const box = made(ws("agentbox", "managed", { ...AGENT }, workshopOwners({ system: "opsfolio", state: "managed", disposability: "disposable" }), "paired"));
  assertEquals(ownerOf(box, "converge"), "opsfolio");
  assertEquals(ownerOf(box, "backup"), "person");
});

proves(["0008-estate-workstations FR-011"], "retire is a system's only for a disposable workshop, and a persistent one refuses a system with the reason", () => {
  const persistent = { ...AGENT, disposability: "persistent" } as const;
  const bySystem = { ...workshopOwners({ system: "opsfolio", state: "managed", disposability: "disposable" }) };
  assert(refusal(ws("keepbox", "managed", persistent, bySystem, "paired")).includes("a persistent workshop is never retired by a system"));
  made(ws("keepbox", "managed", persistent, workshopOwners({ system: "opsfolio", state: "managed", disposability: "persistent" }), "paired"));
  assert(refusal(ws("keepbox", "managed", persistent, { ...bySystem, retire: "desired-os-state" }, "paired")).includes("owned by desired-os-state"));
  assert(refusal(ws("anybox", "managed", { role: "build" }, bySystem, "paired")).includes("does not say it is disposable"));
  made(ws("anybox", "managed", { role: "build", disposability: "disposable" }, bySystem, "paired"));
  made(ws("anybox", "managed", { role: "build" }, workshopOwners({ system: "opsfolio", state: "managed" }), "paired"));
});

const violations = (assets: readonly Asset[], more: Partial<Parameters<typeof checkInvariants>[0]> = {}): readonly Violation[] => checkInvariants({ assets, observations: [], results: [], ...more });

proves(["0008-estate-workstations FR-013"], "NoAuthorityWithoutScope is checked for a workshop that is an agent workspace or holds harnesses, and for no other kind", () => {
  assertEquals(INVARIANT_COVERAGE.NoAuthorityWithoutScope, "checked");
  const { "agents-policy": _drop, ...unbounded } = AGENT;
  const bad = made(ws("agentbox", "adopted", unbounded, workshopOwners({ system: "opsfolio", state: "adopted" }), "paired"));
  const found = violations([bad]);
  assert(found.length === 1 && found[0]?.invariant === "NoAuthorityWithoutScope" && found[0].subject === "agentbox" && found[0].message.includes("an agent workspace states no agents-policy"));
  const holds = made(ws("devbox", "adopted", { role: "build", harnesses: ["codex"] }, workshopOwners({ system: "opsfolio", state: "adopted" }), "paired"));
  assert(violations([holds])[0]?.message.includes("holds harnesses") === true);
  assertEquals(violations([made(ws("agentbox", "adopted", AGENT, workshopOwners({ system: "opsfolio", state: "adopted" }), "paired"))]), []);
  assertEquals(violations([made(ws("synthetic-workshop-01", "adopted", {}, workshopOwners({ system: "opsfolio", state: "adopted" }), "paired")), made(ws("devbox", "adopted", { role: "build" }, workshopOwners({ system: "opsfolio", state: "adopted" }), "paired"))]), []);
  const server = made(defineAsset({ id: "synthetic-server-02", kind: "server", state: "adopted", origin: "paired", owners: { observe: "desired-os-state", verify: "desired-os-state" } }));
  assertEquals(violations([server]), []);
});

proves(["0008-estate-workstations FR-014"], "a persistent agent workspace is managed only with an approval record, and a disposable one needs none", () => {
  const owners = workshopOwners({ system: "opsfolio", state: "managed", disposability: "persistent" });
  const keep = made(ws("keepbox", "managed", { ...AGENT, disposability: "persistent" }, owners, "paired"));
  const found = violations([keep]);
  assert(found.length === 1 && found[0]?.invariant === "PersistentWorkshopApproved");
  assertEquals(violations([keep], { approvals: [{ asset: "keepbox", by: "a person", planHash: HASH }] }), []);
  assertEquals(violations([keep], { approvals: [{ asset: "keepbox", by: "a person", planHash: "sha256:no" }] }).length, 1);
  assertEquals(violations([keep], { approvals: [{ asset: "otherbox", by: "a person", planHash: HASH }] }).length, 1);
  const throwaway = made(ws("throwbox", "managed", AGENT, workshopOwners({ system: "opsfolio", state: "managed", disposability: "disposable" }), "paired"));
  assertEquals(violations([throwaway]), []);
  const adopted = made(ws("keepbox", "adopted", { ...AGENT, disposability: "persistent" }, workshopOwners({ system: "opsfolio", state: "adopted" }), "paired"));
  assertEquals(violations([adopted]), []);
});

proves(["0008-estate-workstations FR-015", "0008-estate-workstations FR-022"], "what is observed of ambient secrets is their names and never a value, and an observation names its source", () => {
  const box = made(ws("agentbox", "adopted", AGENT, workshopOwners({ system: "opsfolio", state: "adopted" }), "paired"));
  const at = "2026-11-22T10:00:00Z";
  const obs = (agent: Record<string, string[]>, source = "opsfolio probe") => ({ asset: "agentbox", observation: { at, source, state: { agent } } });
  assertEquals(violations([box], { observations: [obs({ "ambient-secret-names": ["APP_GITHUB_TOKEN", "AWS_SECRET_ACCESS_KEY"] })] }), []);
  const leak = violations([box], { observations: [obs({ "ambient-secret-names": ["APP_GITHUB_TOKEN=ghp_notreal"] })] });
  assert(leak.length === 1 && leak[0]?.invariant === "NoSecretValuesObserved" && leak[0].subject === "agentbox");
  assertEquals(violations([box], { observations: [obs({}, " ")] }).map((v) => v.invariant), ["NoEvidenceWithoutAttribution"]);
  assertEquals(violations([box], { observations: [obs({ "ambient-secret-names": [] })] }), []);
});

const policy = (): CapturePolicy => {
  const p = defineCapturePolicy(WORKSHOP_CAPTURE);
  assert(p.kind === "ok", p.kind === "err" ? p.error.join("; ") : "");
  return p.value;
};

proves(["0008-estate-workstations FR-016"], "an agent workspace is due within 15 minutes adopted or managed, a disposable one is journaled as changes and a heartbeat, and it is observed within its window", () => {
  const p = policy();
  const adopted = made(ws("agentbox", "adopted", AGENT, workshopOwners({ system: "opsfolio", state: "adopted" }), "paired"));
  const keep = made(ws("keepbox", "managed", { ...AGENT, disposability: "persistent" }, workshopOwners({ system: "opsfolio", state: "managed", disposability: "persistent" }), "paired"));
  const dev = made(ws("devbox", "adopted", { role: "build" }, workshopOwners({ system: "opsfolio", state: "adopted" }), "paired"));
  assertEquals([cadenceOf(p, adopted), cadenceOf(p, keep), cadenceOf(p, dev), cadenceOf(p, { id: "synthetic-server-02", state: "adopted" })], ["PT15M", "PT15M", "P1D", "P1D"]);
  assertEquals(cadenceOf(p, { id: "printer", state: "discovered" }), undefined);
  const own = defineCapturePolicy({ ...WORKSHOP_CAPTURE, cadence: { perRole: { "agent-workspace": "PT15M" }, perAsset: { agentbox: "PT20M" } } });
  assert(own.kind === "ok" && cadenceOf(own.value, adopted) === "PT20M" && cadenceOf(own.value, keep) === "PT15M", "an asset's own cadence comes before its role's");
  assertEquals(journalOf(p, adopted), { granularity: "changes-and-heartbeat", heartbeat: "PT30M" });
  assertEquals(journalOf(p, keep), { granularity: "every-capture", heartbeat: null });
  assertEquals(freshnessWindowMs(15 * 60_000), 30 * 60_000);
  const now = "2026-11-22T12:00:00Z";
  const obs = (at: string) => ({ asset: "agentbox", observation: { at, source: "opsfolio probe", state: {} } });
  const check = (o: readonly ReturnType<typeof obs>[]) => violations([adopted], { observations: o, freshness: { now, policy: p } });
  assertEquals(check([obs("2026-11-22T11:45:00Z")]), []);
  assertEquals(check([obs("2026-11-22T11:00:00Z"), obs("2026-11-22T11:50:00Z")]), []);
  assertEquals(check([obs("2026-11-22T11:00:00Z")]).map((v) => v.invariant), ["WorkshopObserved"]);
  assert(check([]).some((v) => v.message.includes("never observed")));
  assertEquals(violations([adopted], { observations: [], }), [], "without an instant and a policy freshness is not checked");
  assertEquals(violations([dev], { freshness: { now, policy: p } }), [], "only an agent workspace is held to it");
});

proves(["0008-estate-workstations FR-016"], "the policy of roles refuses what cannot hold: a role that is not a word, a cadence over seven days, a heartbeat longer than the window", () => {
  const reasons = (i: Parameters<typeof defineCapturePolicy>[0]): string => {
    const r = defineCapturePolicy(i);
    assert(r.kind === "err");
    return r.error.join("; ");
  };
  assert(reasons({ cadence: { perRole: { "Agent Workspace": "PT15M" } } }).includes("is not a role"));
  assert(reasons({ cadence: { perRole: { "agent-workspace": "soon" } } }).includes("not a duration"));
  assert(reasons({ cadence: { perRole: { "agent-workspace": "P8D" } } }).includes("longer than seven days"));
  assert(reasons({ journal: { disposable: { granularity: "changes-and-heartbeat", heartbeat: "PT2H" } } }).includes("longer than the freshness window"));
  assert(reasons({ journal: { disposable: { granularity: "changes-and-heartbeat" } } }).includes("needs the heartbeat"));
  assert(reasons({ journal: { disposable: { granularity: "every-capture", heartbeat: "PT10M" } } }).includes("every capture is journaled already"));
  assert(reasons({ journal: { disposable: { granularity: "sometimes" as "every-capture" } } }).includes("not a granularity"));
});

proves(["0008-estate-workstations FR-020"], "the host-file declaration of a workshop is an asset that is written and read back with its attributes", () => {
  const agentbox = { kind: "workshop", state: "adopted", origin: "paired", owners: { observe: "opsfolio", verify: "opsfolio" }, attributes: AGENT } as const;
  const asset = made(defineAsset({ id: "agentbox", ...agentbox }));
  const written = assetCodec.encode(asset);
  assert(written.kind === "ok");
  const text = new TextDecoder().decode(written.value);
  assert(text.includes("agents-policy") && text.includes("omarchy"));
  const back = assetCodec.decode(bytes(text));
  assert(back.kind === "ok" && back.value.value.attributes?.["omarchy"] === true && back.value.value.attributes["distro"] === "arch" && back.value.value.kind === "workshop");
});
