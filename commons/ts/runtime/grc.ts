/**
 * The GRC host (commons 0007-grc FR-022): waivers, risk registers, impact declarations and any other data the caller has a decoder for,
 * loaded from TOML, YAML, JSON or JSON5 files (chosen by the file's extension) with the kernel's parsers and decoders. An error names the
 * file and either where its text stops parsing (line and column) or the path of the value that does not decode (`$.waivers[1].expiresAt`).
 * A list file holds its items either as its top-level array or under one key (`waivers`, `risks`, `declarations`), so TOML, whose top
 * level is a table, writes them as `[[waivers]]`. TOML dates and times are read as their ISO 8601 text, so a TOML offset date-time
 * decodes as an `Instant`. Packs are code (their checks are functions), so a harness defines them in TypeScript and loads a pack's
 * settings with `loadData` and a decoder of its own.
 *
 * @example
 * ```ts
 * import { formatLoadError, loadWaivers } from "./grc.ts";
 * const w = await loadWaivers("grc/waivers.toml");
 * if (w.kind === "err") console.error(formatLoadError(w.error));
 * ```
 *
 * @module
 */
import { absurd } from "../kernel/absurd.ts";
import { type ImpactDeclaration, impactDeclarationDecoder, type RiskInput, riskDecoder } from "../kernel/assess.ts";
import { array, type DecodeError, type Decoder, describe, formatDecodeError } from "../kernel/decode.ts";
import { type Waiver, waiverDecoder } from "../kernel/grc.ts";
import { parseJson5 } from "../kernel/json5.ts";
import { err, ok, type Result } from "../kernel/result.ts";
import { isTomlDateTime, parseToml, type TomlValue } from "../kernel/toml.ts";
import { parseYaml } from "../kernel/yaml.ts";
import { readTextFile } from "./fs.ts";

/** A data file's format. */
export type DataFormat = "toml" | "yaml" | "json" | "json5";

const EXTENSIONS: ReadonlyMap<string, DataFormat> = new Map([
  ["toml", "toml"],
  ["yaml", "yaml"],
  ["yml", "yaml"],
  ["json", "json"],
  ["json5", "json5"],
]);

/** The format of a file by its extension (`.toml`, `.yaml` or `.yml`, `.json`, `.json5`, in any case), or undefined for any other. */
export function formatOf(path: string): DataFormat | undefined {
  const ext = /\.([A-Za-z0-9]+)$/.exec(path)?.[1]?.toLowerCase();
  return ext === undefined ? undefined : EXTENSIONS.get(ext);
}

/** Why a data file could not be loaded, each naming the file. */
export type LoadError =
  | { readonly kind: "read"; readonly file: string; readonly reason: string }
  | { readonly kind: "format"; readonly file: string }
  | {
      readonly kind: "parse";
      readonly file: string;
      readonly format: DataFormat;
      readonly line: number;
      readonly column: number;
      readonly message: string;
    }
  | { readonly kind: "decode"; readonly file: string; readonly error: DecodeError };

/** A load error as one line: `grc/waivers.toml: $.waivers[0].expiresAt: expected ...`. */
export function formatLoadError(e: LoadError): string {
  switch (e.kind) {
    case "read":
      return `${e.file}: cannot read: ${e.reason}`;
    case "format":
      return `${e.file}: not a .toml, .yaml, .yml, .json or .json5 file`;
    case "parse":
      return `${e.file}:${e.line}:${e.column}: not ${e.format.toUpperCase()}: ${e.message}`;
    case "decode":
      return `${e.file}: ${formatDecodeError(e.error)}`;
    default:
      return absurd(e);
  }
}

/** A TOML value as plain data: each date or time its ISO 8601 text. */
function plainToml(v: TomlValue): unknown {
  if (Array.isArray(v)) return v.map(plainToml);
  if (typeof v !== "object") return v;
  if (isTomlDateTime(v)) return v.text;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) out[k] = plainToml(x);
  return out;
}

/** The line and column (from 1) of a character offset in a text. */
function position(text: string, offset: number): { readonly line: number; readonly column: number } {
  const before = text.slice(0, offset).split("\n");
  return { line: before.length, column: (before[before.length - 1] ?? "").length + 1 };
}

/** A text of a format as plain data, or where it stops being that format; `file` names it in the error. */
export function parseData(text: string, format: DataFormat, file: string): Result<unknown, LoadError> {
  switch (format) {
    case "toml": {
      const r = parseToml(text);
      return r.kind === "ok"
        ? ok(plainToml(r.value))
        : err({ kind: "parse", file, format, line: r.error.line, column: r.error.column, message: r.error.message });
    }
    case "yaml": {
      const r = parseYaml(text);
      return r.kind === "ok"
        ? r
        : err({ kind: "parse", file, format, line: r.error.line, column: r.error.column, message: r.error.message });
    }
    case "json5": {
      const r = parseJson5(text);
      return r.kind === "ok"
        ? r
        : err({ kind: "parse", file, format, line: r.error.line, column: r.error.column, message: r.error.message });
    }
    case "json": {
      try {
        const value: unknown = JSON.parse(text);
        return ok(value);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const at = /position (\d+)/.exec(message);
        const { line, column } = at === null ? { line: 1, column: 1 } : position(text, Number(at[1]));
        return err({ kind: "parse", file, format, line, column, message });
      }
    }
    default:
      return absurd(format);
  }
}

/** A text of a format decoded, or the error naming `file` and where the text or the value goes wrong. */
export function decodeData<T>(text: string, format: DataFormat, file: string, decoder: Decoder<T>): Result<T, LoadError> {
  const parsed = parseData(text, format, file);
  if (parsed.kind === "err") return parsed;
  const r = decoder(parsed.value, "$");
  return r.kind === "ok" ? r : err({ kind: "decode", file, error: r.error });
}

/** A file read, parsed by its extension's format and decoded; or the error naming the file and what went wrong where. */
export async function loadData<T>(path: string, decoder: Decoder<T>): Promise<Result<T, LoadError>> {
  const format = formatOf(path);
  if (format === undefined) return err({ kind: "format", file: path });
  let text: string;
  try {
    text = await readTextFile(path);
  } catch (e) {
    return err({ kind: "read", file: path, reason: e instanceof Error ? e.message : String(e) });
  }
  return decodeData(text.replace(/^\ufeff/, ""), format, path, decoder);
}

/** A list of items decoded from either a top-level array or the array under `key` of a top-level table (`[[key]]` in TOML). */
export function listOf<T>(key: string, item: Decoder<T>): Decoder<readonly T[]> {
  const items = array(item);
  return (input, path = "$") => {
    if (Array.isArray(input)) return items(input, path);
    if (typeof input === "object" && input !== null && key in input) {
      const inner: unknown = Reflect.get(input, key);
      return items(inner, `${path}.${key}`);
    }
    return err({ kind: "decode", path, expected: `an array, or a table with an array \`${key}\``, found: describe(input) });
  };
}

/** The waivers a file holds (a list, or under `waivers`), each refused as `defineWaiver` refuses (no expiry, an expiry before its grant, ...). */
export function loadWaivers(path: string): Promise<Result<readonly Waiver[], LoadError>> {
  return loadData(path, listOf("waivers", waiverDecoder));
}

/** The risks a file holds (a list, or under `risks`), for `riskRegister`. */
export function loadRisks(path: string): Promise<Result<readonly RiskInput[], LoadError>> {
  return loadData(path, listOf("risks", riskDecoder));
}

/** The impact declarations a file holds (a list, or under `declarations`), for `gate`. */
export function loadImpactDeclarations(path: string): Promise<Result<readonly ImpactDeclaration[], LoadError>> {
  return loadData(path, listOf("declarations", impactDeclarationDecoder));
}
