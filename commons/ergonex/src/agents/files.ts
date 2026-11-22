// Spec: 0006-agents FR-012
/**
 * How `agent init` writes a file that is not only its own (commons ergonex 0006-agents FR-012): a block between two marker lines in Markdown, an entry of its own name in JSON, a table of its own name in
 * TOML, and the keys it owns in a settings file; everything else is kept as it was, including what another tool wrote. Every function is pure (text in, text out), so that a run twice changes nothing,
 * and `host/write.ts` writes a file whole beside the old one and renames it over.
 *
 * @example
 * ```ts
 * import { setBlock } from "./files.ts";
 * setBlock("# mine\n", "ergonex", "hello") === setBlock(setBlock("# mine\n", "ergonex", "hello"), "ergonex", "hello"); // true
 * ```
 *
 * @module
 */
const begin = (name: string): string => `<!-- ergonex:begin ${name} -->`;
const end = (name: string): string => `<!-- ergonex:end ${name} -->`;

/** The text with the block `name` set to `body`: replaced where it is, appended where it is not; nothing outside the markers is touched. */
export function setBlock(text: string, name: string, body: string): string {
  const block = `${begin(name)}\n${body.replace(/\n+$/, "")}\n${end(name)}\n`;
  const a = text.indexOf(begin(name));
  const b = text.indexOf(end(name));
  if (a >= 0 && b > a) {
    const tail = text.slice(b + end(name).length).replace(/^\n/, "");
    return `${text.slice(0, a)}${block}${tail}`;
  }
  if (text === "") return block;
  return `${text.replace(/\n*$/, "\n")}\n${block}`;
}

/** The text without the block `name`. */
export function removeBlock(text: string, name: string): string {
  const a = text.indexOf(begin(name));
  const b = text.indexOf(end(name));
  if (a < 0 || b < a) return text;
  return `${text.slice(0, a).replace(/\n+$/, "\n")}${text.slice(b + end(name).length).replace(/^\n/, "")}`;
}

type Json = null | boolean | number | string | readonly Json[] | { readonly [k: string]: Json };
const isObject = (v: unknown): v is { readonly [k: string]: Json } => typeof v === "object" && v !== null && !Array.isArray(v);

/** Where a JSON file could not be merged into: it is not an object, or it does not parse. The file is then left as it is and a person is told. */
export class MergeRefused extends Error {}

function parseObject(text: string, file: string): { readonly [k: string]: Json } {
  if (text.trim() === "") return {};
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    throw new MergeRefused(`${file} is not valid JSON, so it is left as it is`);
  }
  if (!isObject(v)) throw new MergeRefused(`${file} is not a JSON object, so it is left as it is`);
  return v;
}

const dump = (v: Json): string => `${JSON.stringify(v, null, 2)}\n`;

/** `.mcp.json` with `mcpServers.ergonex` set to the server; every other server and key is kept. */
export function setMcpServer(text: string, file: string, name: string, server: { readonly command: string; readonly args: readonly string[] }): string {
  const o = parseObject(text, file);
  const servers = isObject(o["mcpServers"]) ? o["mcpServers"] : {};
  return dump({ ...o, mcpServers: { ...servers, [name]: { command: server.command, args: [...server.args] } } });
}

/** A settings file of Claude Code with `name` in `enabledMcpjsonServers` and a `SessionStart` hook running `command`; a hook is its own when `own` says so, so another tool's `SessionStart` hook is kept. */
export function setClaudeSettings(text: string, file: string, name: string, command: string, own: (hookCommand: string) => boolean, enableProjectServer: boolean): string {
  const o = parseObject(text, file);
  const enabledOld = Array.isArray(o["enabledMcpjsonServers"]) ? o["enabledMcpjsonServers"] : [];
  const enabled = enableProjectServer && !enabledOld.includes(name) ? [...enabledOld, name] : enabledOld;
  const hooks = isObject(o["hooks"]) ? o["hooks"] : {};
  const start: readonly Json[] = Array.isArray(hooks["SessionStart"]) ? hooks["SessionStart"] : [];
  const hasOwn = (g: Json): boolean => isObject(g) && Array.isArray(g["hooks"]) && g["hooks"].some((h) => isObject(h) && typeof h["command"] === "string" && own(h["command"]));
  const entry: Json = { hooks: [{ type: "command", command }] };
  // the group that holds our hook is replaced whole (it is ours), every other group is kept in its place
  let placed = false;
  const next: Json[] = [];
  for (const g of start) {
    if (hasOwn(g)) {
      if (!placed) next.push(entry);
      placed = true;
    } else next.push(g);
  }
  if (!placed) next.push(entry);
  const out: { [k: string]: Json } = { ...o, hooks: { ...hooks, SessionStart: next } };
  if (enableProjectServer || enabledOld.length > 0) out["enabledMcpjsonServers"] = enabled;
  return dump(out);
}

const tomlString = (s: string): string => JSON.stringify(s);

/** `config.toml` of Codex with the table `[mcp_servers.<name>]` set; the table is replaced where it is (also one `codex mcp add` wrote), every other table is kept. */
export function setCodexServer(text: string, name: string, command: string, args: readonly string[], startupTimeoutSec: number): string {
  const header = `[mcp_servers.${name}]`;
  const table = [header, `command = ${tomlString(command)}`, `args = [${args.map(tomlString).join(", ")}]`, `startup_timeout_sec = ${startupTimeoutSec}`, ""].join("\n");
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.trim() === header);
  if (start < 0) return `${text === "" ? "" : `${text.replace(/\n*$/, "\n")}\n`}${table}`;
  let stop = start + 1;
  // the table runs to the next header of any kind: a sub-table (`[mcp_servers.ergonex.env]`, which `codex mcp add --env` writes) is the person's and is kept
  while (stop < lines.length && !/^\s*\[/.test(lines[stop] ?? "")) stop++;
  const before = lines.slice(0, start).join("\n");
  const after = lines.slice(stop).join("\n");
  const tail = after === "" ? "" : `\n${after}`;
  return `${before === "" ? "" : `${before}\n`}${table.replace(/\n$/, "")}\n${tail}`.replace(/\n\n\n+/g, "\n\n");
}

