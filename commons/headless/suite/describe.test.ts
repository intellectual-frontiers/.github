/**
 * Tests of the description of a program (commons headless 0015-describe FR-001 to FR-011): the models of a program, one for each tier of its ladder, with the ids agreed, the three layers, the trace from the action to
 * the verb to each surface, what a tier hides said and not dropped, the dispositions that Kanon's check finds complete, and the problems of the model as findings; with properties over generated programs.
 *
 * @module
 */
import fc from "fast-check";
import { type Disposition, droppedFindings, type ElementId, type LayeredModel, modelFindings, type ModelElement } from "@intellectual-frontiers/kanon";
import { flag, value } from "@intellectual-frontiers/terminal/args";
import { assert, assertEquals, assertStringIncludes, proves, the } from "@intellectual-frontiers/test";
import { ADMINISTRATOR, defineReach, OPERATOR, PUBLIC, type TierName, tierGate } from "../src/governance/mod.ts";
import { branch, command, outcomeOf, placedCommands, programOf, type Program } from "../src/logical/mod.ts";
import { describe, describeChecked, KINDS, layerOf, type Subject } from "../src/describe/mod.ts";
import { served } from "../src/surfaces/mcp/mod.ts";
import { type Json, openApiOf } from "../src/surfaces/rest/mod.ts";

const isRecord = (j: Json | undefined): j is { readonly [key: string]: Json } => typeof j === "object" && j !== null && !Array.isArray(j);
/** The paths of an OpenAPI document. */
const pathKeys = (doc: Json): readonly string[] => {
  const paths = isRecord(doc) ? doc["paths"] : undefined;
  return isRecord(paths) ? Object.keys(paths) : [];
};
/** What a disposition points at, as text, or nothing. */
const targetOf = (d: Disposition): string => (d.outcome === "unexpressed" ? "" : String(d.target));

const reaching = defineReach({ channels: ["local", "mcp", "rest"], readOnly: true, idempotent: true });
const changing = defineReach({ channels: ["local", "mcp", "rest"] });
const destroying = defineReach({ channels: ["local", "mcp", "rest"], confirmation: "flag" });
const said = (name: string) => () => Promise.resolve(outcomeOf({ said: name }, { text: `${name} ran` }));

/** A program with a verb for each way a surface decides, and a plugin that contributed two of them. */
const archon = (): Program =>
  programOf({
    name: "archon",
    summary: "The fleet.",
    version: "1.0.0",
    origins: { "server list": "archon-server", "server restart": "archon-server" },
    catalogue: { "E100-UNREACHABLE": { title: "Unreachable", what: "The host did not answer.", why: "It is down or the network is.", fix: "archon server list", doc: "reach" } },
    children: [
      branch({
        name: "server",
        summary: "Servers.",
        children: [
          command({ name: "list", summary: "List servers.", options: { limit: value({ short: "l", help: "How many." }), all: flag({ short: "a", help: "Include retired." }) }, operands: [{ name: "name", help: "A name.", arity: "optional" }], examples: [{ args: ["--all"], says: "Every server, retired too." }], action: { kind: "report", reach: reaching }, run: said("list") }),
          command({ name: "restart", summary: "Restart a server.", options: { reason: value({ help: "Why." }) }, operands: [{ name: "host", help: "The host.", arity: "one" }], action: { kind: "action", tier: OPERATOR, dryRun: true, reach: changing }, run: said("restart") }),
          command({ name: "wipe", summary: "Wipe a server.", options: {}, action: { kind: "action", effect: "destructive", dryRun: true, tier: ADMINISTRATOR, reach: destroying }, run: said("wipe") }),
          command({ name: "key-set", summary: "Set a key.", options: { passphrase: value({ short: "p", help: "The passphrase." }), label: value({ short: "b", help: "A label." }) }, action: { kind: "action", humanOnly: ["passphrase"], reach: changing }, run: said("key-set") }),
        ],
      }),
      command({ name: "login", summary: "Log a person in.", options: {}, action: { kind: "action", audience: "human", reach: defineReach({ channels: ["local"] }) }, run: said("login") }),
      command({ name: "version-info", summary: "Local only.", options: {}, action: { kind: "report", reach: defineReach({ channels: ["local"], readOnly: true, idempotent: true }) }, run: said("version-info") }),
      command({ name: "bare", summary: "No reach policy.", options: {}, action: { kind: "report" }, run: said("bare") }),
    ],
  });

const modelOf = (p: Program, tier: TierName): LayeredModel => the(describe(p).find((m) => m.name === `${p.name}-${tier}`), `a model for ${tier}`);
const ids = (m: LayeredModel, kind: string): readonly string[] => m.elements.filter((e) => e.kind === kind).map((e) => e.id);
const byId = (m: LayeredModel, id: string): ModelElement => the(m.elements.find((e) => e.id === id), id);

proves(["0015-describe FR-001"], "describe gives one model for each tier of the ladder, lowest first, with the three layers, pure and deterministic, and describeChecked says why where the name is not an id", () => {
  const p = archon();
  const models = describe(p);
  assertEquals(models.map((m) => m.name), ["archon-public", "archon-operator", "archon-administrator"]);
  assertEquals(models.map((m) => m.library), ["headless", "headless", "headless"]);
  for (const m of models) {
    assertEquals(m.layers.map((l) => l.id), ["governance", "logical", "physical"]);
    assertEquals(m.instances, []);
  }
  assertEquals(describe(archon()), models);
  const checked = describeChecked(p);
  assert(checked.kind === "ok" && checked.value.length === 3);
  const bad = describeChecked(programOf({ name: " odd ", summary: "S.", version: "1.0.0", children: [] }));
  assert(bad.kind === "err" && bad.error[0]?.rule === "describe/program-id");
  assertEquals(describe(programOf({ name: " odd ", summary: "S.", version: "1.0.0", children: [] })), []);
});

proves(["0015-describe FR-002", "0015-describe FR-003"], "every element has the layer of its kind and an id made by the agreed forms: verbs, commands, tools, routes, options and operands", () => {
  const m = modelOf(archon(), ADMINISTRATOR);
  for (const e of m.elements) {
    assert((KINDS as readonly string[]).includes(e.kind), `${e.id}: ${e.kind} is a kind`);
    assertEquals(e.layer, layerOf(KINDS.find((k) => k === e.kind) ?? "action"), e.id);
    assert(e.source.file !== "" && e.source.line >= 1, e.id);
  }
  assertEquals(new Set(m.elements.map((e) => e.id)).size, m.elements.length);
  assertEquals(ids(m, "verb").filter((i) => i.startsWith("headless:archon/server ")), ["headless:archon/server list", "headless:archon/server restart", "headless:archon/server wipe", "headless:archon/server key-set"]);
  assert(ids(m, "cli-command").includes("cli:archon server list"));
  assert(ids(m, "mcp-tool").includes("mcp:archon_server_list"));
  assert(ids(m, "rest-route").includes("rest:GET /v1/server/list"));
  assert(ids(m, "rest-route").includes("rest:POST /v1/server/restart"));
  assert(ids(m, "option").includes("headless:archon/server list#--limit"));
  assert(ids(m, "option").includes("headless:archon/server wipe#--yes"));
  assert(ids(m, "operand").includes("headless:archon/server restart#host"));
  assertEquals(byId(m, "headless:archon/server list#--limit").parent, "headless:archon/server list");
  assertEquals(byId(m, "headless:archon/server list#--limit").properties["short"], "l");
  assertEquals(byId(m, "headless:archon/server restart#host").properties["arity"], "one");
  assertEquals(byId(m, "action:archon/server list").layer, "governance");
  assertEquals(byId(m, "openapi:archon").kind, "openapi-document");
});

proves(["0015-describe FR-004"], "governance holds the action of each verb with its annotations, the problem codes with their explanation and the exit statuses by name", () => {
  const m = modelOf(archon(), PUBLIC);
  const wipe = byId(m, "action:archon/server wipe");
  assertEquals([wipe.properties["kind"], wipe.properties["effect"], wipe.properties["idempotent"], wipe.properties["tier"], wipe.properties["dryRun"]], ["action", "destructive", false, "administrator", true]);
  assertEquals(wipe.properties["reachConfirmation"], "flag");
  assertEquals(byId(m, "action:archon/bare").properties["reachChannels"], null);
  assertEquals(byId(m, "action:archon/server key-set").properties["humanOnly"], ["passphrase"]);
  const code = byId(m, "problem-code:archon/E100-UNREACHABLE");
  assertEquals(code.definition, "Unreachable: The host did not answer.");
  assertEquals([code.properties["why"], code.properties["fix"], code.properties["doc"]], ["It is down or the network is.", "archon server list", "reach"]);
  assert(ids(m, "problem-code").includes("problem-code:archon/E000-FAILED"), "the generic codes are there");
  assertEquals(byId(m, "outcome:archon/usage").properties["status"], 2);
  assertStringIncludes(byId(m, "outcome:archon/ok").definition, "Status 0");
  assertEquals(ids(m, "outcome").length, 12);
});

proves(["0015-describe FR-005"], "the logical layer holds the program, the verbs with their options, standard ones included, operands and examples, and the plugin that contributed a verb as its parent", () => {
  const m = modelOf(archon(), ADMINISTRATOR);
  const program = byId(m, "headless:archon");
  assertEquals([program.kind, program.properties["version"], program.properties["tiers"]], ["program", "1.0.0", ["public", "operator", "administrator"]]);
  const list = byId(m, "headless:archon/server list");
  assertEquals([list.parent, list.properties["origin"]], ["plugin:archon-server", "archon-server"]);
  assertEquals(list.properties["examples"], ["archon server list --all  # Every server, retired too."]);
  assertEquals(byId(m, "headless:archon/login").parent, "headless:archon");
  assertEquals(byId(m, "plugin:archon-server").properties["verbs"], ["headless:archon/server list", "headless:archon/server restart"]);
  assertEquals(ids(m, "plugin"), ["plugin:archon-server"]);
  const standard = ids(m, "option").filter((i) => i.startsWith("headless:archon/server wipe#"));
  for (const flagName of ["--json", "--quiet", "--dry-run", "--yes"]) assert(standard.includes(`headless:archon/server wipe#${flagName}`), flagName);
  assertEquals(byId(m, "headless:archon/server wipe#--yes").properties["standard"], true);
  assertEquals(byId(m, "headless:archon/server key-set#--passphrase").properties["humanOnly"], true);
  assertEquals(byId(m, "headless:archon/server list#--color").properties["default"], "true");
});

proves(["0015-describe FR-006"], "the problems of the model are findings of the element they are about, and nothing is thrown", () => {
  const p = programOf({
    name: "odd",
    summary: "Odd.",
    version: "1.0.0",
    catalogue: { "E1-X": { title: "X", what: "", why: "Y.", fix: "Z." } },
    children: [
      branch({ name: "help", summary: "A built-in word.", children: [command({ name: "one", summary: "One.", options: { json: flag({ help: "Mine." }) }, action: { kind: "report", humanOnly: ["ghost"] }, run: said("one") })] }),
    ],
  });
  const m = modelOf(p, PUBLIC);
  const rules = m.findings.map((f) => f.rule);
  for (const rule of ["model/built-in-word", "model/reserved-option", "model/human-only-unknown", "describe/catalogue"]) assert(rules.includes(rule), rule);
  const reserved = the(m.findings.find((f) => f.rule === "model/reserved-option"));
  assertEquals(reserved.element, "headless:odd/help one");
  assertStringIncludes(reserved.message, "json");
  assertEquals(the(m.findings.find((f) => f.rule === "model/built-in-word")).element, "headless:odd");
  assertEquals(archon().children.length > 0 && modelOf(archon(), PUBLIC).findings.filter((f) => f.rule.startsWith("describe/")).length, 0);
});

/** The names of the tools and the paths of the routes a model draws. */
const drawn = (m: LayeredModel) => ({
  tools: m.elements.filter((e) => e.kind === "mcp-tool").map((e) => e.name),
  paths: m.elements.filter((e) => e.kind === "rest-route").map((e) => String(e.properties["path"])),
});

proves(["0015-describe FR-007"], "the tools of a model are those the tool server serves for the tier and the routes are the paths of the OpenAPI document, drawn by the reach and the audience", () => {
  const p = archon();
  for (const tier of p.tiers.ladder) {
    const m = modelOf(p, tier);
    const s = served(p, tier);
    assert(s.kind === "ok");
    assertEquals(drawn(m).tools, s.value.map((t) => t.tool.name));
    assertEquals([...drawn(m).paths].sort(), [...pathKeys(openApiOf(p, tier))].sort());
  }
  const publicModel = modelOf(p, PUBLIC);
  assert(!ids(publicModel, "mcp-tool").includes("mcp:archon_login"), "a verb for a person has no tool");
  assert(!ids(publicModel, "mcp-tool").includes("mcp:archon_version_info"), "a verb of the local channel has no tool");
  assert(ids(publicModel, "cli-command").includes("cli:archon login"));
  const tool = byId(publicModel, "mcp:archon_server_list");
  assertEquals([tool.properties["readOnlyHint"], tool.properties["destructiveHint"], tool.properties["inputs"]], [true, false, ["limit", "all", "name"]]);
  const route = byId(publicModel, "rest:GET /v1/server/list");
  assertEquals([route.parent, route.properties["method"], route.properties["operationId"], route.properties["effect"]], ["openapi:archon", "GET", "archon_server_list", "read"]);
  assertEquals(byId(publicModel, "openapi:archon").properties["paths"], drawn(publicModel).paths.length);
});

proves(["0015-describe FR-008", "0015-describe FR-009"], "the trace goes from the action to the verb to each projection, every visible verb traces to a command, and a verb a tier hides is there with no projection and says why", () => {
  const p = archon();
  const publicModel = modelOf(p, PUBLIC);
  const admin = modelOf(p, ADMINISTRATOR);
  for (const m of [publicModel, admin]) {
    const all = new Set(m.elements.map((e) => e.id));
    for (const t of m.trace) {
      assert(all.has(t.from) && all.has(t.to), `${t.from} -> ${t.to}`);
      assertEquals(t.how, "projects to");
    }
    for (const placed of placedCommands(p.children)) {
      const verb = `headless:archon/${placed.id}`;
      assertEquals(m.trace.some((t) => t.from === `action:archon/${placed.id}` && t.to === verb), true, verb);
      const visible = tierGate(p.tiers, placed.facts.tier, m.name.endsWith("public") ? PUBLIC : ADMINISTRATOR).kind === "visible";
      assertEquals(m.trace.some((t) => t.from === verb && t.to === `cli:archon ${placed.id}`), visible, verb);
    }
  }
  assert(admin.trace.some((t) => t.from === "headless:archon/server wipe" && t.to === "mcp:archon_server_wipe"));
  assert(admin.trace.some((t) => t.from === "headless:archon/server wipe" && t.to === "rest:POST /v1/server/wipe"));
  const hidden = byId(publicModel, "headless:archon/server wipe");
  assertEquals(hidden.properties["projections"], []);
  const why = hidden.properties["notProjected"];
  assert(Array.isArray(why) && why.length === 3 && why.every((w) => w.includes("administrator")), "each surface says why");
  assert(!publicModel.elements.some((e) => e.kind !== "verb" && e.kind !== "action" && e.id.includes("server wipe") && e.layer === "physical"));
  const tier = the(publicModel.dispositions.find((d) => d.element === "action:archon/server wipe" && d.annotation === "tier"));
  assert(tier.outcome === "unexpressed");
  assertStringIncludes(tier.reason, "administrator");
  const shown = the(admin.dispositions.find((d) => d.element === "action:archon/server wipe" && d.annotation === "tier"));
  assertEquals([shown.outcome, targetOf(shown)], ["expressed", "cli:archon server wipe"]);
  const login = byId(publicModel, "headless:archon/login").properties["notProjected"];
  assert(Array.isArray(login) && login.some((w) => w.startsWith("mcp: ")) && login.some((w) => w.includes("does not name the mcp channel")));
  const bare = byId(publicModel, "headless:archon/bare").properties["notProjected"];
  assert(Array.isArray(bare) && bare.every((w) => w.includes("no reach policy")));
});

/** Every disposition names an element of the model, and Kanon's check finds nothing dropped. */
const accounted = (m: LayeredModel): void => {
  assertEquals(modelFindings(m).map((f) => f.key), []);
  assertEquals(droppedFindings(m).map((f) => f.key), []);
  const all = new Set<ElementId>(m.elements.map((e) => e.id));
  for (const d of m.dispositions) {
    assert(all.has(d.element));
    if (d.outcome !== "unexpressed") assert(all.has(d.target), `${d.element} ${d.annotation} -> ${d.target}`);
  }
};

proves(["0015-describe FR-010"], "every annotation of every action, problem code and exit status ends in a disposition, so that the check of Kanon finds nothing dropped", () => {
  const p = archon();
  for (const m of describe(p)) accounted(m);
  const m = modelOf(p, ADMINISTRATOR);
  const of = (element: string, annotation: string) => the(m.dispositions.find((d) => d.element === element && d.annotation === annotation));
  const dry = of("action:archon/server wipe", "dryRun");
  assertEquals([dry.outcome, targetOf(dry)], ["expressed", "headless:archon/server wipe#--dry-run"]);
  const destroy = of("action:archon/server wipe", "effect");
  assertEquals([destroy.outcome, targetOf(destroy)], ["expressed", "headless:archon/server wipe#--yes"]);
  const reach = of("action:archon/server list", "reachChannels");
  assertEquals([reach.outcome, targetOf(reach)], ["expressed", "mcp:archon_server_list"]);
  assertEquals(of("action:archon/server list", "kind").outcome, "carried");
  assertEquals(of("action:archon/login", "reachChannels").outcome, "carried");
  const none = of("action:archon/bare", "reachChannels");
  assert(none.outcome === "unexpressed" && none.reason.includes("no reach policy"));
  assertEquals(of("problem-code:archon/E100-UNREACHABLE", "fix").outcome, "unexpressed");
});

proves(["0015-describe FR-011"], "where an element is written is what the caller says, and the name of the program or of the plugin and the line 1 where it says nothing", () => {
  const p = archon();
  const m = modelOf(p, PUBLIC);
  assertEquals(byId(m, "headless:archon/server list").source, { file: "archon-server", line: 1 });
  assertEquals(byId(m, "headless:archon/login").source, { file: "archon", line: 1 });
  const asked: Subject[] = [];
  const located = the(
    describe(p, {
      locate: (s) => {
        asked.push(s);
        return s.kind === "verb" ? { file: `src/${s.path.join("-")}.ts`, line: 7 } : undefined;
      },
    })[0],
  );
  assertEquals(byId(located, "headless:archon/server list").source, { file: "src/server-list.ts", line: 7 });
  assertEquals(byId(located, "mcp:archon_server_list").source, { file: "src/server-list.ts", line: 7 });
  assertEquals(byId(located, "headless:archon").source, { file: "archon", line: 1 });
  assert(asked.some((s) => s.kind === "program") && asked.some((s) => s.kind === "problem-code") && asked.some((s) => s.kind === "outcome"));
});

proves(["0015-describe FR-006"], "two verbs that would be one tool are one tool and a finding, never two elements of one id", () => {
  const p = programOf({
    name: "dup",
    summary: "Dup.",
    version: "1.0.0",
    children: [
      branch({ name: "a", summary: "A.", children: [command({ name: "b-c", summary: "One.", options: {}, action: { kind: "report", reach: reaching }, run: said("1") })] }),
      branch({ name: "a-b", summary: "AB.", children: [command({ name: "c", summary: "Two.", options: {}, action: { kind: "report", reach: reaching }, run: said("2") })] }),
    ],
  });
  const m = modelOf(p, PUBLIC);
  assertEquals(ids(m, "mcp-tool"), ["mcp:dup_a_b_c"]);
  assertEquals(m.findings.filter((f) => f.rule === "describe/mcp-name-collision").length, 1);
  accounted(m);
});

/** A generated program: a verb each with a tier, an audience, an effect and a reach, in the words `v0`, `v1`. */
const verbArbitrary = fc.record({
  tier: fc.constantFrom<"public" | "operator" | "administrator" | "ghost">("public", "operator", "administrator", "ghost"),
  audience: fc.constantFrom<"human" | "machine" | "both">("human", "machine", "both"),
  kind: fc.constantFrom<"report" | "action" | "destructive">("report", "action", "destructive"),
  channels: fc.subarray(["local", "ssh", "mcp", "rest"] as const),
  reach: fc.boolean(),
  nested: fc.boolean(),
  plugin: fc.boolean(),
});

type Verb = {
  readonly tier: "public" | "operator" | "administrator" | "ghost";
  readonly audience: "human" | "machine" | "both";
  readonly kind: "report" | "action" | "destructive";
  readonly channels: readonly ("local" | "ssh" | "mcp" | "rest")[];
  readonly reach: boolean;
  readonly nested: boolean;
  readonly plugin: boolean;
};

const generated = (verbs: readonly Verb[]): Program => {
  const tierOf = (t: string): TierName => (t === "public" ? PUBLIC : t === "operator" ? OPERATOR : t === "administrator" ? ADMINISTRATOR : (t as TierName));
  const nodes = verbs.map((v, i) => {
    const reach = v.reach && v.channels.length > 0 ? defineReach({ channels: v.channels, readOnly: v.kind === "report", idempotent: v.kind === "report" }) : undefined;
    const c = command({
      name: `v${i}`,
      summary: `Verb ${i}.`,
      options: { force: flag({ help: "Force." }) },
      operands: i % 3 === 0 ? [{ name: "target", help: "A target.", arity: "optional" }] : [],
      action: {
        kind: v.kind === "report" ? "report" : "action",
        ...(v.kind === "destructive" ? { effect: "destructive" as const, dryRun: true } : {}),
        audience: v.audience,
        tier: tierOf(v.tier),
        ...(reach === undefined ? {} : { reach }),
      },
      run: said(`v${i}`),
    });
    return v.nested ? branch({ name: `g${i}`, summary: `Group ${i}.`, children: [c] }) : c;
  });
  const origins = Object.fromEntries(verbs.flatMap((v, i) => (v.plugin ? [[v.nested ? `g${i} v${i}` : `v${i}`, "gen-plug"]] : [])));
  return programOf({ name: "gen", summary: "Generated.", version: "1.0.0", children: nodes, origins });
};

proves(["0015-describe FR-001", "0015-describe FR-007", "0015-describe FR-008", "0015-describe FR-010"], "for any generated program, each model has unique ids, a trace between its elements, the tools and routes of the surfaces for its tier, a command for each visible verb and nothing dropped", () => {
  fc.assert(
    fc.property(fc.array(verbArbitrary, { maxLength: 7 }), (verbs) => {
      const p = generated(verbs);
      const models = describe(p);
      assertEquals(models.length, 3);
      assertEquals(describe(p), models);
      for (const m of models) {
        const tier = the(p.tiers.ladder.find((t) => m.name === `gen-${t}`));
        assertEquals(new Set(m.elements.map((e) => e.id)).size, m.elements.length);
        accounted(m);
        for (const t of m.trace) assert(m.elements.some((e) => e.id === t.from) && m.elements.some((e) => e.id === t.to));
        const visible = placedCommands(p.children).filter((x) => tierGate(p.tiers, x.facts.tier, tier).kind === "visible");
        assertEquals([...ids(m, "cli-command")].sort(), visible.map((x) => `cli:gen ${x.id}`).sort());
        for (const x of visible) assert(m.trace.some((t) => t.from === `headless:gen/${x.id}` && t.to === `cli:gen ${x.id}`));
        assertEquals(ids(m, "verb").length, placedCommands(p.children).length);
        const s = served(p, tier);
        assert(s.kind === "ok");
        assertEquals(drawn(m).tools, s.value.map((t) => t.tool.name));
        assertEquals([...drawn(m).paths].sort(), [...pathKeys(openApiOf(p, tier))].sort());
      }
    }),
    { numRuns: 150 },
  );
});
