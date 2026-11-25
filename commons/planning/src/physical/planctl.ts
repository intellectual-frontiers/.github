// Spec: 0005-planning-surfaces FR-003
// Spec: 0005-planning-surfaces FR-004
// Spec: 0005-planning-surfaces FR-006
/**
 * The program `planctl` as Headless' tree (0037-planning FR-032, FR-034, FR-035; commons headless 0003-headless-output, 0010-audience-tiers, 0013-mcp-surface): the verbs `collect`, `show`, `query`, `views`, `confirm`, `plan`
 * and `apply`, each returning a typed outcome that a surface draws, and `mcp`, which serves the same verbs as a tool server. `plan` is the dry run that prints the preview and its hash; `apply` writes exactly the plan of
 * the hash it is given and refuses another, and in check mode (`--check`) prints the hash and ends with the status of something pending where anything would change. The tool server takes its principal from the session it was
 * launched for (`PLANCTL_PRINCIPAL`), makes every caller an agent acting for that person, never reads a principal or a trust from a call, and refuses every call where no principal is established.
 *
 * @remarks
 * The repository is the folder the run started in: the configuration is read from its root and from nowhere else. A person at the command line is a person with the principal of `--principal` or of the configuration; the
 * tool server is an agent with the principal of its session, and an agent cannot confirm a proposal.
 *
 * @example
 * ```ts
 * import { planctlProgram } from "./planctl.ts";
 * // planctlProgram(host).name // "planctl"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { defineReach, problem, type Channel, type TierName, parseTierName, PUBLIC, OPERATOR, type TierLadder } from "@intellectual-frontiers/headless/governance";
import { command, outcomeOf, type ActionTraits, type Command, type Context, type Node, type Outcome, type Program, programOf, type Catalogue } from "@intellectual-frontiers/headless/logical";
import { run as runCli, hostIo } from "@intellectual-frontiers/headless/cli";
import { serve, stdioTransport } from "@intellectual-frontiers/headless/mcp";
import { flag, integerText, value } from "@intellectual-frontiers/terminal/args";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import {
  actorFor,
  type Actor,
  type ActorRole,
  type EventData,
  type Item,
  type ItemKind,
  makeEvent,
  makePatch,
  type Origin,
  type Severity,
  type StateKind,
  describeActorProblem,
  idTime,
  instantOfMs,
  msOfInstant,
  parseDay,
  parseInstant,
  type CloseReason,
  type RunContext,
} from "@intellectual-frontiers/planning/governance";
import {
  canonical,
  contextOf,
  eventIdOfExternal,
  mintEventId,
  type PlanningConfig,
  principalOf,
  type Query,
  requirementMatrix,
  poam,
  responsibility,
  roadmap,
  workOrders,
  blockGraph,
  runQuery,
  type Row,
} from "@intellectual-frontiers/planning/logical";
import { renderJson5, renderMarkdown } from "@intellectual-frontiers/planning/records";
import { applyPatch } from "./source.ts";
import { collect, runClock } from "./collect.ts";
import { type Host, loadConfig, openPlanningStore, openSources, personOfText, policyOf, agentIdOf } from "./world.ts";
import { loadStore, writeEvents, writeOutbox, type PlanningStoreBackend } from "./store.ts";
import type { Source } from "./source.ts";

/** The version of the program. */
export const PLANCTL_VERSION = "0.1.0";

const named = (id: string, standIn: TierName): TierName => {
  const r = parseTierName(id);
  return r.kind === "ok" ? r.value : standIn;
};
/** The tiers: a reader sees what only reads, a writer also what changes the store or a place. */
export const TIERS: { readonly reader: TierName; readonly writer: TierName } = { reader: named("reader", PUBLIC), writer: named("writer", OPERATOR) };
/** The ladder of the program. */
export const LADDER: TierLadder = { ladder: [TIERS.reader, TIERS.writer], default: TIERS.writer };

/** The problem codes of the program, with what each means. */
export const CATALOGUE: Catalogue = {
  "E-USAGE": { title: "The command line does not fit", what: "A verb was given words, options or operands it does not take.", why: "A typing slip.", fix: "planctl help" },
  "E-CONFIG-LOAD": { title: "The configuration could not be loaded", what: "planning.config.ts is missing at the root of the repository, or importing it failed.", why: "The run was not started at the root of the repository, or the file has an error.", fix: "run planctl at the root of the repository; the file is made with definePlanning" },
  "E-CONFIG-INVALID": { title: "The configuration is not valid", what: "The file exports a value that does not fit its type; the message names the field.", why: "A typing slip in a field, or a field the configuration does not have.", fix: "fix the field the message names" },
  "E-TRUST": { title: "The configuration is not trusted yet", what: "planning.config.ts is TypeScript that runs with your permissions, and this version of it has not been trusted in this repository.", why: "First run here, or the file changed since you trusted it.", fix: "read planning.config.ts, then planctl collect --trust" },
  "E-PRINCIPAL": { title: "No principal is established", what: "An event of an agent, or of a person, needs the person who runs the work, and nothing names one.", why: "A headless run with no principal in the configuration and no argument, or a tool server whose session has none.", fix: "give --principal ID, or set principal in planning.config.ts, or launch the tool server with PLANCTL_PRINCIPAL" },
  "E-NOT-FOUND": { title: "Nothing by that name", what: "The item, the source or the trace asked for is not in the store or the configuration.", why: "A typing slip, or the sources were not collected yet.", fix: "planctl collect, then planctl show" },
  "E-STORE": { title: "The store could not be read or written", what: "The store of events failed.", why: "The folder is not there or refuses the write.", fix: "check the folder of store.place in planning.config.ts" },
  "E-SOURCE": { title: "A source could not be read or written", what: "The place of a source failed, or changed while it was written.", why: "The file changed after it was read, or the place is not there.", fix: "run the command again" },
  "E-PLAN-STALE": { title: "The plan changed", what: "The hash that was given is not the hash of the plan made now.", why: "The place changed between the plan and the apply.", fix: "planctl plan again, read the new plan, then apply with its hash" },
  "E-REFUSED": { title: "The event is refused", what: "The library refused to build the event: an agent with no principal, a confirmation by anything but a person, or a link to itself.", why: "The rules of actors and events of Planning.", fix: "read the message; a person confirms, an agent proposes" },
  "E-CONFLICTS": { title: "A source and the store disagree", what: "A field changed in a place and in the store, and no authority is configured for it.", why: "A change on both sides.", fix: "set the authority of the field in planning.config.ts, or settle it by hand" },
  "P-CHANGES": { title: "The run would change something", what: "In check mode the run found something it would write.", why: "The places or the plan differ from the store.", fix: "planctl collect, or planctl apply with the hash it printed" },
};

const REPORT: ActionTraits = { kind: "report", effect: "read", idempotent: true, dryRun: false, check: false, tier: TIERS.reader, humanOnly: ["trust", "principal"], reach: defineReach({ channels: ["local", "mcp"] as readonly Channel[], readOnly: true, idempotent: true }) };
const CHANGE: ActionTraits = { kind: "action", effect: "mutate", idempotent: true, dryRun: true, check: true, tier: TIERS.writer, humanOnly: ["trust", "principal"], reach: defineReach({ channels: ["local", "mcp"] as readonly Channel[], idempotent: true }) };

const COMMON = {
  trust: flag({ help: "Trust this version of planning.config.ts, which runs with your permissions (a person's flag: the tool server never takes it)." }),
  principal: value({ help: "The person who runs the work, as ID or ID:Name; it overrides the configuration's.", valueName: "ID" }),
} as const;

type Common = { readonly trust: boolean; readonly principal: string | undefined };

/** What a verb works on: the configuration, the store and the sources, and who runs. */
type Open = { readonly root: string; readonly config: PlanningConfig; readonly store: PlanningStoreBackend; readonly sources: readonly Source[]; readonly context: RunContext; readonly host: Host };

const fail = (code: string, message: string, fix?: string): Outcome => outcomeOf(null, { problems: [problem("fail", message, { code, ...(fix === undefined ? {} : { fix }) })] });

async function open(host: Host, o: Common): Promise<Result<Open, Outcome>> {
  const trust = host.channel === "cli" && o.trust;
  const config = await loadConfig(host.cwd, { trust });
  if (config.kind === "err") return err(fail(config.error.code, config.error.message));
  const store = await openPlanningStore(host.cwd, config.value);
  if (store.kind === "err") return err(fail("E-STORE", store.error));
  const sources = await openSources(host.cwd, config.value, host);
  if (sources.kind === "err") return err(fail("E-CONFIG-INVALID", sources.error));
  // who runs: a tool server takes its session and nothing a call says; a command line takes its argument, then the configuration
  const session = host.channel === "mcp" ? personOfText(host.env("PLANCTL_PRINCIPAL")) : undefined;
  const argument = host.channel === "cli" ? personOfText(o.principal) : undefined;
  const context = contextOf({ ...(session === undefined ? {} : { session }), ...(argument === undefined ? {} : { argument }), ...(principalOf(config.value) === undefined ? {} : { configuration: principalOf(config.value) as NonNullable<ReturnType<typeof principalOf>> }) });
  return ok({ root: host.cwd, config: config.value, store: store.value, sources: sources.value, context, host });
}

const role = (host: Host): ActorRole => (host.channel === "mcp" ? { kind: "agent", id: agentIdOf(host.env), name: agentIdOf(host.env) } : { kind: "person" });

function actorOf(o: Open): Result<Actor, Outcome> {
  const a = actorFor(o.context, role(o.host));
  return a.kind === "ok" ? ok(a.value) : err(fail("E-PRINCIPAL", `no principal is established: ${describeActorProblem(a.error)}`, "give --principal ID, or set principal in planning.config.ts, or launch the tool server with PLANCTL_PRINCIPAL"));
}

const lines = (...l: readonly string[]): string => `${l.join("\n")}\n`;
const short = (id: string): string => id.slice(0, 18);

function findItem(items: readonly Item[], word: string): Result<Item, Outcome> {
  const hits = items.filter((i) => i.id === word || i.id.startsWith(word));
  const one = hits[0];
  if (one === undefined) return err(fail("E-NOT-FOUND", `no item ${word}`, "planctl show"));
  return hits.length === 1 ? ok(one) : err(fail("E-NOT-FOUND", `${word} names ${hits.length} items: give more of the id`));
}

const describeItem = (i: Item): string => `${short(i.id)}  ${i.state.kind.padEnd(11)} ${i.kind.padEnd(7)} ${i.title}`;

function itemData(i: Item): unknown {
  return { id: i.id, kind: i.kind, title: i.title, body: i.body, state: i.state.kind, labels: i.labels, assignees: i.assignees, severity: i.severity ?? null, origin: i.origin, external: i.external, links: i.links, events: i.events.length };
}

// ---- verbs

const collectVerb = (host: Host): Command<typeof COMMON> =>
  command({
    name: "collect",
    summary: "Read every source of the configuration, reconcile it with the store and write the events and traces; --dry-run writes nothing and --check says by its status whether anything would change.",
    options: COMMON,
    examples: [{ args: ["--dry-run"], says: "Say what would be written, and write nothing." }, { args: ["--check"], says: "End with the status of something pending where a place and the store differ." }],
    action: CHANGE,
    run: async (args, ctx) => {
      const o = await open(host, args.options);
      if (o.kind === "err") return o.error;
      const store = o.value;
      const done = await collect({ store: store.store, sources: store.sources, policy: policyOf(store.config), wallMs: host.now(), context: store.context, ...(store.config.clock === undefined ? {} : { maxDriftMs: store.config.clock.maxDriftMs }), write: ctx.mode === "apply" }, runClock(store.config.clock?.maxDriftMs, new Uint8Array(await replicaSeed(store.root))));
      if (done.kind === "err") return fail("E-STORE", done.error);
      const c = done.value;
      const text = c.reports.map((r) => `${r.name} ${r.place}: ${r.unread === undefined ? `${r.observations} read, ${r.classes.new} new, ${r.classes.updated} updated, ${r.classes.absent} absent, ${r.events} events${r.conflicts.length > 0 ? `, ${r.conflicts.length} conflicts` : ""}` : `not read: ${r.unread}`}`);
      const problems = [
        ...c.reports.filter((r) => r.unread !== undefined).map((r) => problem("fail", `${r.name} could not be read: ${r.unread}`, { code: "E-SOURCE" })),
        ...c.conflicts.map((k) => problem("warn", k.kind === "field" ? `${k.field} of ${short(k.item)} differs in ${k.source}, in its base and in the store: ${JSON.stringify(k.now)}, ${JSON.stringify(k.base)}, ${JSON.stringify(k.store)}` : `the event ${k.id} exists with two contents in ${k.source}`, { code: "E-CONFLICTS" })),
        ...c.reports.flatMap((r) => r.findings.map((f) => problem("warn", `${r.name}: ${f.path}: ${f.message}`))),
        ...(ctx.mode === "check" && c.changes ? [problem("pending", `${c.events.length} events and ${c.traces.length} traces would be written`, { code: "P-CHANGES", fix: "planctl collect" })] : []),
      ];
      return outcomeOf({ reports: c.reports.map((r) => ({ name: r.name, place: r.place, observations: r.observations, classes: r.classes, events: r.events, conflicts: r.conflicts.length, unread: r.unread ?? null })), events: c.events.length, traces: c.traces.length, written: ctx.mode === "apply" }, { text: lines(...text, `${c.events.length} events, ${c.traces.length} traces ${ctx.mode === "apply" ? "written" : "would be written"}`), problems });
    },
  });

async function replicaSeed(root: string): Promise<readonly number[]> {
  const h = await sha256(root);
  return Array.from({ length: 16 }, (_, i) => Number.parseInt(h.slice(i * 2, i * 2 + 2), 16));
}

async function loaded(o: Open, host: Host) {
  return loadStore(o.store, { clock: runClock(o.config.clock?.maxDriftMs, new Uint8Array(await replicaSeed(o.root))), wallMs: host.now(), policy: policyOf(o.config) });
}

const showVerb = (host: Host): Command<typeof COMMON> =>
  command({
    name: "show",
    summary: "List the items of the store, or show one: its state, text, links, comments and the places it was seen.",
    options: COMMON,
    operands: [{ name: "ITEM", help: "An item id, or the start of one.", arity: "optional" }],
    examples: [{ args: [], says: "List every counted item." }, { args: ["0190"], says: "Show the item whose id starts so." }],
    action: REPORT,
    run: async (args) => {
      const o = await open(host, args.options);
      if (o.kind === "err") return o.error;
      const l = await loaded(o.value, host);
      if (l.kind === "err") return fail("E-STORE", l.error.message);
      const word = args.positionals[0];
      if (word === undefined) {
        const rows = runQuery({ items: l.value.items, traces: l.value.traces }, { from: "items", order: { by: "id" } }).flatMap((r) => (r.kind === "item" ? [r.item] : []));
        return outcomeOf(rows.map(itemData), { text: lines(...rows.map(describeItem), `${rows.length} items`) });
      }
      const item = findItem(l.value.items, word);
      if (item.kind === "err") return item.error;
      const i = item.value;
      const seen = l.value.traces.filter((t) => t.item === i.id);
      const text = lines(describeItem(i), ...(i.body === "" ? [] : [i.body]), ...i.links.map((x) => `  ${x.kind} ${x.to}`), ...i.comments.map((c) => `  comment by ${c.actor.id}: ${c.body}`), ...seen.map((t) => `  seen in ${t.source}: ${t.locator.kind === "file-span" ? `${t.locator.path}:${t.locator.startLine}` : t.locator.kind === "url" ? t.locator.url : t.locator.sha} (${t.presence})`));
      return outcomeOf({ ...(itemData(i) as object), seen: seen.map((t) => ({ source: t.source, locator: t.locator, presence: t.presence })) }, { text });
    },
  });

const QUERY_OPTIONS = {
  ...COMMON,
  state: value({ help: "Only items in this state (proposed, open, in-progress, deferred, closed).", valueName: "STATE" }),
  kind: value({ help: "Only items of this kind (issue, task, todo, finding).", valueName: "KIND" }),
  label: value({ help: "Only items with this label.", valueName: "LABEL" }),
  assignee: value({ help: "Only items assigned to this one.", valueName: "WHO" }),
  severity: value({ help: "Only items of this severity (error, warning, note).", valueName: "LEVEL" }),
  origin: value({ help: "Only items of this origin (declared, derived, inferred).", valueName: "ORIGIN" }),
  proposals: flag({ help: "Count the proposed items too." }),
  limit: value({ parse: integerText, help: "At most this many rows.", valueName: "N" }),
} as const;

const queryVerb = (host: Host): Command<typeof QUERY_OPTIONS> =>
  command({
    name: "query",
    summary: "Ask the items a question: filter by state, kind, label, assignee, severity and origin, with a limit; a proposed item is not counted unless --proposals is given.",
    options: QUERY_OPTIONS,
    examples: [{ args: ["--state", "open", "--label", "bug"], says: "The open items labelled bug." }],
    action: REPORT,
    run: async (args) => {
      const o = await open(host, args.options);
      if (o.kind === "err") return o.error;
      const l = await loaded(o.value, host);
      if (l.kind === "err") return fail("E-STORE", l.error.message);
      const a = args.options;
      const states = ["proposed", "open", "in-progress", "deferred", "closed"] as const satisfies readonly StateKind[];
      const kinds = ["issue", "task", "todo", "finding"] as const satisfies readonly ItemKind[];
      const sevs = ["error", "warning", "note"] as const satisfies readonly Severity[];
      const origins = ["declared", "derived", "inferred"] as const satisfies readonly Origin[];
      const pick = <T extends string>(w: string | undefined, list: readonly T[], what: string): Result<readonly T[] | undefined, Outcome> => {
        if (w === undefined) return ok(undefined);
        const hit = list.find((x) => x === w);
        return hit === undefined ? err(fail("E-USAGE", `${w} is not a ${what}: ${list.join(", ")}`)) : ok([hit]);
      };
      const state = pick(a.state, states, "state");
      const kind = pick(a.kind, kinds, "kind");
      const severity = pick(a.severity, sevs, "severity");
      const origin = pick(a.origin, origins, "origin");
      for (const r of [state, kind, severity, origin]) if (r.kind === "err") return r.error;
      const query: Query = {
        from: "items",
        where: {
          ...(state.kind === "ok" && state.value !== undefined ? { state: state.value } : {}),
          ...(kind.kind === "ok" && kind.value !== undefined ? { kind: kind.value } : {}),
          ...(severity.kind === "ok" && severity.value !== undefined ? { severity: severity.value } : {}),
          ...(origin.kind === "ok" && origin.value !== undefined ? { origin: origin.value } : {}),
          ...(a.label === undefined ? {} : { label: a.label }),
          ...(a.assignee === undefined ? {} : { assignee: a.assignee }),
          ...(a.proposals ? { includeProposed: true } : {}),
        },
        order: { by: "id" },
        ...(a.limit === undefined ? {} : { limit: a.limit }),
      };
      const rows = runQuery({ items: l.value.items, traces: l.value.traces }, query).flatMap((r: Row) => (r.kind === "item" ? [r.item] : []));
      return outcomeOf(rows.map(itemData), { text: lines(...rows.map(describeItem), `${rows.length} items`) });
    },
  });

const VIEWS_OPTIONS = { ...COMMON, view: value({ help: "roadmap, blocks, requirements, responsibility, poam or work-orders.", valueName: "VIEW", default: "roadmap" }), today: value({ help: "For poam and work-orders: the day a milestone is held to, YYYY-MM-DD (the day of the run where none is given).", valueName: "DAY" }), known: value({ help: "For requirements: the known requirements, separated by commas.", valueName: "LIST" }) } as const;

const viewsVerb = (host: Host): Command<typeof VIEWS_OPTIONS> =>
  command({
    name: "views",
    summary: "Show a view of the items: the roadmap (each item after those that block it), the graph of blocks, the matrix of requirement by item, who is responsible for what their agents did, the plan of action and milestones (poam) or the work orders.",
    options: VIEWS_OPTIONS,
    examples: [{ args: ["--view", "roadmap"], says: "The counted open items, each after the items that block it." }],
    action: REPORT,
    run: async (args) => {
      const o = await open(host, args.options);
      if (o.kind === "err") return o.error;
      const l = await loaded(o.value, host);
      if (l.kind === "err") return fail("E-STORE", l.error.message);
      const items = l.value.items;
      switch (args.options.view) {
        case "roadmap": {
          const r = roadmap(items);
          return r.kind === "err" ? fail("E-USAGE", `the blocks have a cycle: ${r.error.items.map(short).join(", ")}`) : outcomeOf(r.value.map(itemData), { text: lines(...r.value.map(describeItem)) });
        }
        case "blocks": {
          const g = blockGraph(items);
          if (g.kind === "err") return fail("E-USAGE", `the blocks have a cycle: ${g.error.items.map(short).join(", ")}`);
          const rows = [...g.value.entries()].filter(([, v]) => v.blocks.length > 0 || v.blockedBy.length > 0).map(([id, v]) => ({ item: id, blocks: v.blocks, blockedBy: v.blockedBy }));
          return outcomeOf(rows, { text: lines(...rows.map((r) => `${short(r.item)} blocks ${r.blocks.map(short).join(",") || "-"}, blocked by ${r.blockedBy.map(short).join(",") || "-"}`)) });
        }
        case "requirements": {
          const m = requirementMatrix(items, (args.options.known ?? "").split(",").map((s) => s.trim()).filter((s) => s !== ""));
          return outcomeOf(m, { text: lines(...m.rows.map((r) => `${r.requirement}: ${r.items.map(short).join(", ") || "no item"}`), ...m.unknown.map((u) => `${short(u.item)} cites ${u.citation}, which is not a known requirement`)) });
        }
        case "responsibility": {
          const r = responsibility(items);
          return outcomeOf(r, { text: lines(...r.map((p) => `${p.person}: ${p.byAgent.map((a) => `${a.agent} ${a.events} events`).join(", ")}; ${p.proposals.length} waiting`)) });
        }
        case "poam":
        case "work-orders": {
          const parsed = parseDay(args.options.today ?? new Date(host.now()).toISOString().slice(0, 10));
          if (parsed.kind === "err") return fail("E-USAGE", "--today is a day, YYYY-MM-DD");
          if (args.options.view === "poam") {
            const rows = poam(items, parsed.value);
            return outcomeOf(rows, { text: lines(...rows.map((r) => `${r.status} ${short(r.id)} ${r.title} (${r.milestones.length} milestones, scheduled ${r.scheduledCompletion ?? "-"}, controls ${r.controls.join(",") || "-"})`)) });
          }
          const rows = workOrders(items, parsed.value);
          return outcomeOf(rows, { text: lines(...rows.map((r) => `${r.status} ${short(r.id)} ${r.title} (runs ${r.workloads.join(",")}, serves ${r.serves.map(short).join(",") || "-"}, due ${r.due ?? "-"})`)) });
        }
        default:
          return fail("E-USAGE", `${args.options.view} is not a view: roadmap, blocks, requirements, responsibility, poam or work-orders`);
      }
    },
  });

const confirmVerb = (host: Host): Command<typeof COMMON> =>
  command({
    name: "confirm",
    summary: "Confirm a proposed item as a person: it leaves the state proposed and is counted. An agent cannot confirm.",
    options: COMMON,
    operands: [{ name: "ITEM", help: "The item id, or the start of it.", arity: "one" }],
    examples: [{ args: ["0190"], says: "Confirm the proposed item whose id starts so." }],
    action: CHANGE,
    run: async (args, ctx) => {
      const o = await open(host, args.options);
      if (o.kind === "err") return o.error;
      const l = await loaded(o.value, host);
      if (l.kind === "err") return fail("E-STORE", l.error.message);
      const item = findItem(l.value.items, args.positionals[0] ?? "");
      if (item.kind === "err") return item.error;
      const actor = actorOf(o.value);
      if (actor.kind === "err") return actor.error;
      const id = mintEventId(l.value.clock, host.now());
      const at = instantOfMs(host.now());
      if (id.kind === "err" || at.kind === "err") return fail("E-STORE", "no id could be made");
      const event = makeEvent({ id: id.value.id, item: item.value.id, at: at.value, actor: actor.value }, { type: "confirmed" });
      if (event.kind === "err") return fail("E-REFUSED", event.error.kind === "confirmed-by-a-non-person" ? `${event.error.actor} cannot confirm an item: only a person confirms` : `the event is refused: ${event.error.kind}`);
      if (item.value.state.kind !== "proposed") return outcomeOf({ item: item.value.id, confirmed: false }, { text: lines(`${short(item.value.id)} is not proposed`) });
      if (ctx.mode === "apply") {
        const w = await writeEvents(o.value.store, [event.value]);
        if (w.kind === "err") return fail("E-STORE", w.error.message);
      }
      return outcomeOf({ item: item.value.id, confirmed: ctx.mode === "apply" }, { text: lines(`${ctx.mode === "apply" ? "confirmed" : "would confirm"} ${short(item.value.id)}`) });
    },
  });

const PLAN_OPTIONS = {
  ...COMMON,
  source: value({ help: "The source the change is written to.", valueName: "NAME", required: true }),
  do: value({ help: "The change: close, reopen, comment or start.", valueName: "WHAT", required: true }),
  reason: value({ help: "For close: completed, not-planned or duplicate.", valueName: "REASON", default: "completed" }),
  text: value({ help: "For comment: the text.", valueName: "TEXT" }),
  at: value({ help: "The time of the event, YYYY-MM-DDTHH:MM:SSZ (now where none): the plan printed it, and apply is the plan of that hash only with the same time.", valueName: "TIME" }),
} as const;
const APPLY_OPTIONS = { ...PLAN_OPTIONS, previewHash: value({ help: "The hash of the preview the change is held to: with none it is a dry run.", valueName: "HASH" }) } as const;

type PlanOptions = { readonly source: string; readonly do: string; readonly reason: string; readonly text: string | undefined; readonly at: string | undefined };

function dataOf(o: PlanOptions): Result<EventData, Outcome> {
  switch (o.do) {
    case "close": {
      const reasons = ["completed", "not-planned", "duplicate"] as const satisfies readonly CloseReason[];
      const r = reasons.find((x) => x === o.reason);
      return r === undefined ? err(fail("E-USAGE", `${o.reason} is not a reason: ${reasons.join(", ")}`)) : ok({ type: "closed", reason: r });
    }
    case "reopen":
      return ok({ type: "reopened" });
    case "start":
      return ok({ type: "started" });
    case "comment":
      return o.text === undefined || o.text === "" ? err(fail("E-USAGE", "comment needs --text")) : ok({ type: "commented", body: o.text });
    default:
      return err(fail("E-USAGE", `${o.do} is not a change: close, reopen, comment or start`));
  }
}

async function planOrApply(host: Host, word: string | undefined, options: Common & PlanOptions & { readonly previewHash?: string | undefined }, ctx: Context, writing: boolean): Promise<Outcome> {
  const o = await open(host, options);
  if (o.kind === "err") return o.error;
  const source = o.value.sources.find((s) => s.name === options.source);
  if (source === undefined) return fail("E-NOT-FOUND", `no source ${options.source} in the configuration`, "planctl show");
  const l = await loaded(o.value, host);
  if (l.kind === "err") return fail("E-STORE", l.error.message);
  const item = findItem(l.value.items, word ?? "");
  if (item.kind === "err") return item.error;
  const trace = l.value.traces.find((t) => t.item === item.value.id && t.source === source.name);
  if (trace === undefined) return fail("E-NOT-FOUND", `${short(item.value.id)} was not seen in ${source.name}`, "planctl collect");
  const data = dataOf(options);
  if (data.kind === "err") return data.error;
  const actor = actorOf(o.value);
  if (actor.kind === "err") return actor.error;
  // the event of a plan is a function of what was asked and when: the same words and time make the same event, so the hash of a plan is the plan that apply writes
  const at = options.at === undefined ? instantOfMs(host.now()) : parseInstant(options.at);
  if (at.kind === "err") return fail("E-USAGE", "--at is a time: YYYY-MM-DDTHH:MM:SSZ");
  // after the last event of the item (ids are ordered by time, and a history is folded in the order of its ids), and the same for the same words and time
  const lastMs = Math.max(0, ...item.value.events.map((e) => idTime(e.id).ms));
  const id = await eventIdOfExternal("planctl", canonical({ item: item.value.id, source: source.name, data: data.value, actor: actor.value.id }), Math.max(msOfInstant(at.value), lastMs + 1));
  if (id.kind === "err") return fail("E-STORE", "no id could be made");
  const event = makeEvent({ id: id.value, item: item.value.id, at: at.value, actor: actor.value }, data.value);
  if (event.kind === "err") return fail("E-REFUSED", `the event is refused: ${event.error.kind}`);
  const patch = makePatch(source.name, source.place, event.value, trace.fingerprint);
  if (patch.kind === "err") return fail("E-USAGE", patch.error.message);
  const hash = writing && ctx.mode === "apply" ? options.previewHash : undefined;
  const applied = await applyPatch(source, patch.value, at.value, hash);
  const again = (h: string): string => `planctl apply ${short(item.value.id)} --source ${source.name} --do ${options.do}${options.do === "close" ? ` --reason ${options.reason}` : ""}${options.text === undefined ? "" : ` --text ${JSON.stringify(options.text)}`} --at ${at.value} --preview-hash ${h}`;
  switch (applied.kind) {
    case "dry-run": {
      const changes = applied.preview.effects.length > 0;
      const text = lines(`${source.name} ${source.place}: ${changes ? `${applied.preview.effects.length} effects` : "nothing to change"}`, ...applied.preview.effects.map((e) => `  ${e.target}: ${e.summary}`), `hash: ${applied.preview.hash}`);
      const pending = ctx.mode === "check" && changes ? [problem("pending", "the plan would change something", { code: "P-CHANGES", fix: again(applied.preview.hash) })] : [];
      return outcomeOf({ preview: applied.preview, changes, written: false }, { text, problems: pending, ...(changes ? { next: [again(applied.preview.hash)] } : {}) });
    }
    case "written": {
      // the change is in the place; the event that made it is in the store with its actor
      const w = await writeEvents(o.value.store, [event.value]);
      if (w.kind === "err") return fail("E-STORE", w.error.message);
      return outcomeOf({ preview: applied.preview, changes: true, written: true }, { text: lines(`written to ${source.name}: ${applied.preview.effects.map((e) => e.target).join(", ")}`) });
    }
    case "stale":
      return fail("E-PLAN-STALE", `the hash ${applied.given} is not the hash of the plan now (${applied.preview.hash}): the place changed since it was read`, again(applied.preview.hash));
    case "outbox": {
      const wrote = ctx.mode === "apply" && writing ? await writeOutbox(o.value.store, [applied.entry]) : ok(0);
      if (wrote.kind === "err") return fail("E-STORE", wrote.error.message);
      const why = applied.entry.waiting.kind === "capability" ? `${source.name} cannot ${applied.entry.waiting.capability}` : applied.entry.waiting.reason;
      return outcomeOf({ outbox: true, why }, { text: lines(`nothing written: ${why}${ctx.mode === "apply" && writing ? "; the patch waits in the outbox" : ""}`) });
    }
    case "failed":
      return fail(applied.problem.kind === "conflict" ? "E-SOURCE" : "E-SOURCE", applied.problem.kind === "unexpressed" ? applied.problem.reason : applied.problem.message);
    default: {
      const never: never = applied;
      return never;
    }
  }
}

const planVerb = (host: Host): Command<typeof PLAN_OPTIONS> =>
  command({
    name: "plan",
    summary: "Say what a change to one item in one source would write, and the hash of that plan; nothing is written.",
    options: PLAN_OPTIONS,
    operands: [{ name: "ITEM", help: "The item id, or the start of it.", arity: "one" }],
    examples: [{ args: ["0190", "--source", "markdown", "--do", "close"], says: "What closing the item in its Markdown file would change, with the hash to apply it by." }],
    action: REPORT,
    run: (args, ctx) => planOrApply(host, args.positionals[0], args.options, ctx, false),
  });

const applyVerb = (host: Host): Command<typeof APPLY_OPTIONS> =>
  command({
    name: "apply",
    summary: "Write the change of a plan: exactly the plan of the hash given, or a refusal; with no hash it is a dry run, and --check ends with the status of something pending where it would change anything.",
    options: APPLY_OPTIONS,
    operands: [{ name: "ITEM", help: "The item id, or the start of it.", arity: "one" }],
    examples: [{ args: ["0190", "--source", "markdown", "--do", "close", "--preview-hash", "<hash>"], says: "Write the plan that hash names." }],
    action: CHANGE,
    run: (args, ctx) => planOrApply(host, args.positionals[0], args.options, ctx, true),
  });

/** The formats a configuration renders, one rendering for each, of the items of the store. */
export function renderAll(items: readonly Item[], formats: readonly ("markdown" | "json5")[]): readonly { readonly format: string; readonly text: string; readonly unexpressed: readonly string[] }[] {
  return formats.map((f) => {
    const r = f === "markdown" ? renderMarkdown(items) : renderJson5(items);
    return { format: f, text: r.text, unexpressed: r.unexpressed.map((u) => `${u.field}: ${u.reason}`) };
  });
}

const renderVerb = (host: Host): Command<typeof COMMON> =>
  command({
    name: "render",
    summary: "Render the counted items in the formats the configuration names, saying what a format cannot hold.",
    options: COMMON,
    examples: [{ args: [], says: "Print the items in each configured format." }],
    action: REPORT,
    run: async (args) => {
      const o = await open(host, args.options);
      if (o.kind === "err") return o.error;
      const l = await loaded(o.value, host);
      if (l.kind === "err") return fail("E-STORE", l.error.message);
      const out = renderAll(l.value.items.filter((i) => i.state.kind !== "proposed"), o.value.config.render ?? ["markdown"]);
      return outcomeOf(out, { text: out.map((r) => r.text).join("\n") });
    },
  });

/** The tool server refuses every call where no principal is established. */
export function mcpRefusal(env: (name: string) => string | undefined): string | undefined {
  return personOfText(env("PLANCTL_PRINCIPAL")) === undefined ? "no principal is established: launch the tool server with PLANCTL_PRINCIPAL naming the person it acts for" : undefined;
}

/** `planctl` as a Headless program for a host. */
export function planctlProgram(host: Host): Program {
  const verbs: readonly Node[] = [collectVerb(host), showVerb(host), queryVerb(host), viewsVerb(host), renderVerb(host), confirmVerb(host), planVerb(host), applyVerb(host)];
  const mcp = command({
    name: "mcp",
    summary: "Serve the verbs the held tier sees as tools of a tool server on standard input and output, as an agent acting for the person of PLANCTL_PRINCIPAL.",
    options: {},
    examples: [{ args: [], says: "Serve the tools: PLANCTL_PRINCIPAL=ID names the person every call acts for." }],
    action: { ...REPORT, humanOnly: [] },
    run: async () => {
      const refusal = mcpRefusal(host.env);
      if (refusal !== undefined) return fail("E-PRINCIPAL", refusal, "PLANCTL_PRINCIPAL=ID planctl mcp");
      const server = { ...host, channel: "mcp" as const };
      const inner = planctlProgram(server);
      const { sink: _sink, state: _state, ...io } = hostIo();
      await serve({ program: inner, tier: TIERS.writer, mayOnlyRead: (host.env("PLANCTL_READ_ONLY") ?? "") !== "", run: (argv) => runCli(inner, argv, { ...io, tier: TIERS.writer, env: (n) => host.env(n) }) }, stdioTransport());
      return outcomeOf(null);
    },
  });
  return programOf({
    name: "planctl",
    summary: "Planning content from many places as one item each: collect the sources, show and query the items and their views, confirm a proposal, and write a change back to a place in its own form, held to the preview a person saw.",
    version: PLANCTL_VERSION,
    children: [...verbs, mcp],
    envPrefix: "PLANCTL",
    stateApp: "planctl",
    catalogue: CATALOGUE,
    fix: { commands: ["planctl", "git"], own: ["planctl"] },
    secrets: () => [],
    secretKeys: [],
    tiers: LADDER,
  });
}
