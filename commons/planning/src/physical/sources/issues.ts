// Spec: 0004-planning-sources FR-006
/**
 * The source for the typed issues of a library (0037-planning FR-024): the folder `issues/` as data 0044-issues FR-002 lays it out, one `NNNNN-slug.ts` for each issue, listed in order by `mod.ts`. A file is read
 * without being run: its `issue({ ... })` call is parsed as a literal (strings, numbers, booleans, arrays and objects), so that every field is kept as read in the observation (its severity as the source's own value,
 * priority, size, goals, engines, citations, evidence, links, status and day raised) and the span of the status is known. The status is the one thing written back, as the one replaced value, keeping every other byte.
 *
 * @remarks
 * The status of an issue is a sum whose cases carry what they need: a fixed issue its proof, a duplicate its original, a refused one its reason. A change of status that needs what the event does not carry (a close:
 * the proof, the original or the reason) cannot be written and goes to the outbox; the source writes the reopening (open), a start (in progress, by the actor of the event) and a deferral that names its reason and a day.
 * The `until` of a deferral in these files is free text and the model's may be a day: the text is kept as text (`untilText`) and the day is given where the text is one, so that nothing is lost (decided by the owner on 2026-11-22, commons planning 0004-planning-sources OQ-1).
 *
 * @example
 * ```ts
 * import { parseIssueFile } from "./issues.ts";
 * // parseIssueFile(text) is a Result of the record and the span of its status
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { externalId, type ObservedState, type Observation, type Patch, parseDay, parseInstant, type Raw } from "@intellectual-frontiers/planning/governance";
import { canonical } from "@intellectual-frontiers/planning/logical";
import type { FileLens, FileRead } from "../file-source.ts";
import type { SourceFinding, SourceProblem } from "../source.ts";

/** A value of a literal with the span of its text. */
type Spanned = { readonly value: Raw; readonly start: number; readonly end: number };

/** A parse that stops where the text is not a literal. */
class Stop extends Error {}

/** A reader of a literal: strings, numbers, true, false, null, arrays and objects, with comments and trailing commas. */
class Reader {
  pos: number;
  readonly text: string;
  constructor(text: string, start: number) {
    this.text = text;
    this.pos = start;
  }
  skip(): void {
    for (;;) {
      const c = this.text.charAt(this.pos);
      if (c === " " || c === "\t" || c === "\n" || c === "\r") this.pos++;
      else if (this.text.startsWith("//", this.pos)) while (this.pos < this.text.length && this.text.charAt(this.pos) !== "\n") this.pos++;
      else if (this.text.startsWith("/*", this.pos)) {
        const end = this.text.indexOf("*/", this.pos + 2);
        if (end === -1) throw new Stop("a comment is not closed");
        this.pos = end + 2;
      } else return;
    }
  }
  string(): string {
    const quote = this.text.charAt(this.pos);
    this.pos++;
    let out = "";
    for (;;) {
      const c = this.text.charAt(this.pos);
      if (c === "" || (quote !== "`" && c === "\n")) throw new Stop("a string is not closed");
      if (c === quote) {
        this.pos++;
        return out;
      }
      if (quote === "`" && c === "$" && this.text.charAt(this.pos + 1) === "{") throw new Stop("a template with a substitution is not a literal");
      if (c === "\\") {
        const n = this.text.charAt(this.pos + 1);
        const map: Readonly<Record<string, string>> = { n: "\n", t: "\t", r: "\r", "\\": "\\", "'": "'", '"': '"', "`": "`", "0": "\0" };
        if (n === "u") {
          const hex = this.text.slice(this.pos + 2, this.pos + 6);
          if (!/^[0-9a-fA-F]{4}$/u.test(hex)) throw new Stop("a bad unicode escape");
          out += String.fromCharCode(Number.parseInt(hex, 16));
          this.pos += 6;
        } else {
          out += map[n] ?? n;
          this.pos += 2;
        }
      } else {
        out += c;
        this.pos++;
      }
    }
  }
  value(): Spanned {
    this.skip();
    const start = this.pos;
    const c = this.text.charAt(this.pos);
    let value: Raw;
    if (c === '"' || c === "'" || c === "`") {
      let s = this.string();
      for (;;) {
        const save = this.pos;
        this.skip();
        if (this.text.charAt(this.pos) !== "+") {
          this.pos = save;
          break;
        }
        this.pos++;
        this.skip();
        const q = this.text.charAt(this.pos);
        if (q !== '"' && q !== "'" && q !== "`") throw new Stop("a string is joined to something that is not a string");
        s += this.string();
      }
      value = s;
    } else if (c === "[") {
      this.pos++;
      const list: Raw[] = [];
      for (;;) {
        this.skip();
        if (this.text.charAt(this.pos) === "]") {
          this.pos++;
          break;
        }
        list.push(this.value().value);
        this.skip();
        if (this.text.charAt(this.pos) === ",") this.pos++;
      }
      value = list;
    } else if (c === "{") {
      value = this.object().value;
    } else {
      const m = /^(?:-?\d+(?:\.\d+)?|true|false|null)/u.exec(this.text.slice(this.pos, this.pos + 40));
      if (m === null) throw new Stop(`not a literal at ${this.pos}`);
      this.pos += m[0].length;
      value = m[0] === "true" ? true : m[0] === "false" ? false : m[0] === "null" ? null : Number(m[0]);
    }
    return { value, start, end: this.pos };
  }
  object(): { readonly value: { readonly [key: string]: Raw }; readonly spans: ReadonlyMap<string, { readonly start: number; readonly end: number }> } {
    this.skip();
    if (this.text.charAt(this.pos) !== "{") throw new Stop("an object was expected");
    this.pos++;
    const value: { [key: string]: Raw } = {};
    const spans = new Map<string, { readonly start: number; readonly end: number }>();
    for (;;) {
      this.skip();
      const c = this.text.charAt(this.pos);
      if (c === "}") {
        this.pos++;
        break;
      }
      let key: string;
      if (c === '"' || c === "'") key = this.string();
      else {
        const m = /^[A-Za-z_$][\w$]*/u.exec(this.text.slice(this.pos, this.pos + 80));
        if (m === null) throw new Stop(`a key was expected at ${this.pos}`);
        key = m[0];
        this.pos += key.length;
      }
      this.skip();
      if (this.text.charAt(this.pos) !== ":") throw new Stop("a shorthand or a method is not a literal");
      this.pos++;
      const v = this.value();
      value[key] = v.value;
      spans.set(key, { start: v.start, end: v.end });
      this.skip();
      if (this.text.charAt(this.pos) === ",") this.pos++;
    }
    return { value, spans };
  }
}

/** The record of an issue file and the span of each of its fields. */
export type IssueRecord = { readonly record: { readonly [key: string]: Raw }; readonly spans: ReadonlyMap<string, { readonly start: number; readonly end: number }> };

/** The `issue({ ... })` literal of a file, or why it is not one. */
export function parseIssueFile(text: string): Result<IssueRecord, string> {
  const call = /\bissue\s*\(/u.exec(text);
  if (call === null) return err("it holds no call of issue(...)");
  try {
    const r = new Reader(text, call.index + call[0].length);
    const o = r.object();
    return ok({ record: o.value, spans: o.spans });
  } catch (e) {
    return err(e instanceof Stop ? e.message : "it is not a literal");
  }
}

/** The names a barrel `mod.ts` lists: the files its imports name. */
export function listedBy(barrel: string): readonly string[] {
  return [...barrel.matchAll(/from\s+["']\.\/([^"']+\.ts)["']/gu)].map((m) => m[1] ?? "");
}

const FILE = /(?:^|\/)(\d{5})-([a-z0-9][a-z0-9-]*)\.ts$/u;
const baseOf = (path: string): string => path.split("/").pop() ?? path;

const isRecord = (v: Raw | undefined): v is { readonly [key: string]: Raw } => v !== null && v !== undefined && typeof v === "object" && !Array.isArray(v);

/** The state an issue's status says, and a finding where it cannot be said as a state. */
export function stateOfStatus(status: Raw | undefined): { readonly state: ObservedState; readonly finding?: string; readonly assignee?: string } {
  if (!isRecord(status)) return { state: { kind: "open" }, finding: "the status is not an object" };
  const kind = status["kind"];
  switch (kind) {
    case "open":
      return { state: { kind: "open" } };
    case "in-progress":
      return { state: { kind: "in-progress" }, ...(typeof status["by"] === "string" ? { assignee: status["by"] } : {}) };
    case "fixed":
      return { state: { kind: "closed", reason: "completed" } };
    case "duplicate":
      return { state: { kind: "closed", reason: "duplicate" } };
    case "wont-fix":
    case "not-a-defect":
      return { state: { kind: "closed", reason: "not-planned" } };
    case "deferred": {
      // the day is kept as a day where the text is one; the text is kept as text in every case (decided by the owner on 2026-11-22, 0037-planning OQ-12): nothing is lost, and a text that is no day is an informational finding and not a different state
      const raw = typeof status["until"] === "string" && status["until"].trim() !== "" ? status["until"].trim() : undefined;
      const day = raw === undefined ? undefined : parseDay(raw);
      if (raw === undefined) return { state: { kind: "open" }, finding: "the issue is deferred and gives no until: it is read as open" };
      return day?.kind === "ok"
        ? { state: { kind: "deferred", until: day.value, untilText: raw } }
        : { state: { kind: "deferred", untilText: raw }, finding: `the issue is deferred until ${JSON.stringify(raw)}, which is not a day: it is kept as text, with no day` };
    }
    default:
      return { state: { kind: "open" }, finding: `the status kind ${JSON.stringify(kind ?? null)} is not known` };
  }
}

const text = (v: Raw | undefined): string => (typeof v === "string" ? v : "");
const texts = (v: Raw | undefined): readonly string[] | undefined => (Array.isArray(v) && v.every((x): x is string => typeof x === "string") ? v : undefined);

/** What a configuration of the issues source says. */
export type IssuesConfig = { readonly scope: string };

async function parseFile(scope: string, path: string, source: string): Promise<{ readonly observations: readonly Observation[]; readonly findings: readonly SourceFinding[] }> {
  const name = FILE.exec(path);
  if (name === null) return { observations: [], findings: [] };
  const parsed = parseIssueFile(source);
  if (parsed.kind === "err") return { observations: [], findings: [{ path, message: `cannot be read: ${parsed.error}` }] };
  const r = parsed.value.record;
  const id = r["id"];
  const findings: SourceFinding[] = [];
  if (typeof id !== "number" || String(id).padStart(5, "0") !== name[1]) findings.push({ path, message: `its id ${JSON.stringify(id ?? null)} is not the number its name says (${name[1]})` });
  const st = stateOfStatus(r["status"]);
  if (st.finding !== undefined) findings.push({ path, message: st.finding });
  const raised = typeof r["raised"] === "string" ? parseInstant(`${r["raised"]}T00:00:00Z`) : undefined;
  const ext = externalId("issues", `${scope}:${name[1]}`);
  const applies = r["appliesTo"];
  const engines = isRecord(applies) ? applies["engines"] : undefined;
  const lines = source.split("\n").length;
  const observation: Observation = {
    source: "issues",
    locator: { kind: "file-span", path, startLine: 1, endLine: lines },
    contentHash: await sha256(source),
    fingerprint: await sha256(`issues\u0000${scope}\u0000${name[1]}`),
    content: {
      kind: "issue",
      title: text(r["title"]),
      body: text(r["summary"]),
      labels: [],
      assignees: st.assignee === undefined ? [] : [st.assignee],
      state: st.state,
      origin: "declared",
      external: ext.kind === "ok" ? [ext.value] : [],
      ...(typeof r["severity"] === "string" ? { sourceSeverity: r["severity"] } : {}),
      ...(typeof r["priority"] === "string" ? { priority: r["priority"] } : {}),
      ...(typeof r["size"] === "string" ? { size: r["size"] } : {}),
      ...(texts(r["goals"]) === undefined ? {} : { goals: texts(r["goals"]) ?? [] }),
      ...(engines === "all" ? { engines: ["all"] } : texts(engines) === undefined ? {} : { engines: texts(engines) ?? [] }),
      ...(texts(r["cites"]) === undefined ? {} : { cites: texts(r["cites"]) ?? [] }),
      ...(Array.isArray(r["evidence"]) ? { evidence: r["evidence"].map((e) => canonical(e)) } : {}),
      ...(raised?.kind === "ok" ? { at: raised.value } : {}),
    },
    raw: r,
  };
  return { observations: [observation], findings };
}

function statusText(data: Patch["event"]["data"], by: string): Result<string, SourceProblem> {
  switch (data.type) {
    case "reopened":
      return ok('{ kind: "open" }');
    case "started":
      return ok(`{ kind: "in-progress", by: ${JSON.stringify(by)} }`);
    case "deferred":
      return data.reason === undefined || data.reason.trim() === "" ? err({ kind: "unexpressed", reason: "a deferred issue says why, and the event gives no reason" }) : ok(`{ kind: "deferred", reason: ${JSON.stringify(data.reason)}, until: ${JSON.stringify(data.until)} }`);
    case "closed":
      return err({ kind: "unexpressed", reason: "a closed issue carries its proof, its original or its reason, which the event does not hold" });
    default:
      return err({ kind: "unexpressed", reason: `an issue file is changed by editing it: a ${data.type} event is not written` });
  }
}

function statusOfSource(statusSource: string): Raw | undefined {
  const r = parseIssueFile(`issue({ status: ${statusSource} })`);
  return r.kind === "ok" ? r.value.record["status"] : undefined;
}

function stateKindOf(statusSource: string): string | undefined {
  const status = statusOfSource(statusSource);
  return isRecord(status) && typeof status["kind"] === "string" ? status["kind"] : undefined;
}

function edit(file: FileRead, patch: Patch): Result<string | undefined, SourceProblem> {
  const parsed = parseIssueFile(file.text);
  if (parsed.kind === "err") return err({ kind: "refused", message: `${file.path} cannot be read: ${parsed.error}` });
  const span = parsed.value.spans.get("status");
  if (span === undefined) return err({ kind: "refused", message: `${file.path} has no status` });
  const next = statusText(patch.event.data, patch.event.actor.id);
  if (next.kind === "err") return next;
  const current = file.text.slice(span.start, span.end);
  const kindNow = stateKindOf(current);
  // what the place already says is not a change: an open issue is open, and one in progress is in progress whoever began it
  const readAsOpen = stateOfStatus(statusOfSource(current)).state.kind === "open";
  if ((patch.event.data.type === "reopened" && readAsOpen) || (patch.event.data.type === "started" && kindNow === "in-progress")) return ok(undefined);
  const same = (() => {
    const a = parseIssueFile(`issue({ status: ${current} })`);
    const b = parseIssueFile(`issue({ status: ${next.value} })`);
    return a.kind === "ok" && b.kind === "ok" && canonical(a.value.record["status"]) === canonical(b.value.record["status"]);
  })();
  if (same) return ok(undefined);
  return ok(`${file.text.slice(0, span.start)}${next.value}${file.text.slice(span.end)}`);
}

/** The lens for the folder of the typed issues of the library `scope`. */
export function issuesLens(config: IssuesConfig): FileLens {
  return {
    name: "issues",
    capabilities: ["read", "edit", "close"],
    reads: (path) => FILE.test(path) || baseOf(path) === "mod.ts",
    parse: (path, source) => parseFile(config.scope, path, source),
    edit,
    across: (files) => {
      const barrel = files.find((f) => baseOf(f.path) === "mod.ts");
      if (barrel === undefined) return [{ path: "mod.ts", message: "the folder has no barrel mod.ts that lists its issues" }];
      const listed = listedBy(barrel.text);
      const present = files.filter((f) => FILE.test(f.path)).map((f) => baseOf(f.path));
      return [
        ...present.filter((n) => !listed.includes(n)).map((n): SourceFinding => ({ path: n, message: "the barrel mod.ts does not list this file" })),
        ...listed.filter((n) => !present.includes(n)).map((n): SourceFinding => ({ path: barrel.path, message: `the barrel lists ${n}, which has no file` })),
      ];
    },
  };
}
