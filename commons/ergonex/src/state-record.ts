// Spec: 0003-host FR-009
/**
 * The state record (commons 0003-host FR-009 to FR-011): `<home>/.ergonex/state.auto.json`, which holds the path, the SHA-256 and the generator of each generated file as it was written,
 * the hash of the last plan, the version of Ergonex and the day each tool or module outside the catalog was first seen. `ergonex verify` compares the disk with it and it with what the templates give now;
 * `render` and `apply` never overwrite a file whose bytes differ from it.
 *
 * @remarks
 * Pure: it decodes and encodes text and judges what `verify` compares; reading and writing the file is the host layer's. The text is deterministic (keys in order, two spaces, LF, one final
 * newline), so that the record's own hash, which the evidence of a run names, is the same for the same record. The record is data, never trusted: a hash that is not 64 hexadecimal digits is refused.
 *
 * @module
 */
import { type Decoder, formatDecodeError, json, object, record, string, err, ok, type Result } from "@intellectual-frontiers/core";
import { type Sha256, sha256Of } from "@intellectual-frontiers/crypto";
import { dayNumber, type Finding } from "./findings.ts";
import { type GeneratedFile } from "./render.ts";
import { headerText } from "./render.ts";

/** The version of Ergonex the record names. */
export const ERGONEX_VERSION = "0.4.0";

/** Where the state record is, below the root. */
export const STATE_RECORD_PATH = ".ergonex/state.auto.json";

/** One generated file as it was written. */
export type RecordedFile = {
  readonly sha256: Sha256;
  readonly generator: string;
};

/** The state record (`ergonex:StateRecord`). */
export type StateRecord = {
  readonly ergonex: string;
  /** The SHA-256 of the last plan, as `planDigest` gives it; absent before the first apply. */
  readonly plan?: Sha256;
  /** The generated files as written, by path. */
  readonly files: Readonly<Record<string, RecordedFile>>;
  /** The day each tool or module outside the catalog was first seen, by name (never restarted by a later run). */
  readonly firstSeen: Readonly<Record<string, string>>;
};

/** A record with nothing in it, as before the first apply. */
export const EMPTY_RECORD: StateRecord = {
  ergonex: ERGONEX_VERSION,
  files: {},
  firstSeen: {},
};

const hash: Decoder<Sha256> = (input, path = "$") => {
  const s = typeof input === "string" ? sha256Of(input) : undefined;
  return s === undefined
    ? err({
        kind: "decode",
        path,
        expected: "a SHA-256 (64 hexadecimal digits)",
        found: typeof input,
      })
    : ok(s);
};

const day: Decoder<string> = (input, path = "$") =>
  typeof input === "string" && dayNumber(input) !== undefined
    ? ok(input)
    : err({
        kind: "decode",
        path,
        expected: "a day (YYYY-MM-DD)",
        found: typeof input,
      });

const shape = object(
  {
    ergonex: string,
    files: record(object({ sha256: hash, generator: string })),
    firstSeen: record(day),
  },
  { plan: hash },
);

/** The record from its text, or why it cannot be read: a hand-edited or damaged record is told, never guessed. */
export function decodeStateRecord(text: string): Result<StateRecord, string> {
  const r = json(text, shape);
  return r.kind === "ok" ? ok(r.value) : err(formatDecodeError(r.error));
}

/** The record as text: deterministic, with the header of a generated file as `_generated`. */
export function encodeStateRecord(r: StateRecord): string {
  const sorted = <T>(o: Readonly<Record<string, T>>): Record<string, T> =>
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const value = {
    _generated: headerText("ergonex state"),
    ergonex: r.ergonex,
    ...(r.plan === undefined ? {} : { plan: r.plan }),
    files: sorted(r.files),
    firstSeen: sorted(r.firstSeen),
  };
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** The record after a file was written: its path, hash and generator. */
export function withFile(r: StateRecord, file: GeneratedFile, digest: Sha256): StateRecord {
  return {
    ...r,
    files: {
      ...r.files,
      [file.path]: { sha256: digest, generator: file.generator },
    },
  };
}

/** The record after a generated file was removed. */
export function withoutFile(r: StateRecord, path: string): StateRecord {
  return {
    ...r,
    files: Object.fromEntries(Object.entries(r.files).filter(([p]) => p !== path)),
  };
}

/** What `verify` found of one path. */
export type FileFacts = {
  readonly path: string;
  /** The SHA-256 of the bytes on disk; absent where there is no file. */
  readonly onDisk?: Sha256 | undefined;
  /** The SHA-256 the record holds; absent where it holds none. */
  readonly recorded?: Sha256 | undefined;
  /** The SHA-256 of what the templates give now; absent where they give no such file. */
  readonly wanted?: Sha256 | undefined;
};

/**
 * What `ergonex verify` reports (0003-host FR-010): a generated file whose bytes differ from the record is an error (a hand edit); a recorded file that is missing, an `.auto.` file the record does
 * not hold and a file the templates would now write differently (a drift) are each a warning. Nothing is changed. `today` is the day the findings are first seen.
 */
export function verifyFindings(facts: readonly FileFacts[], today: string): readonly Finding[] {
  const out: Finding[] = [];
  for (const f of facts) {
    const at = (ruleId: string, severity: Finding["severity"], message: string): void =>
      void out.push({
        ruleId,
        severity,
        message,
        subject: f.path,
        firstSeen: today,
      });
    if (f.recorded !== undefined && f.onDisk === undefined) {
      at(
        "ergonex/generated-missing",
        "Warning",
        `${f.path} is recorded as written and is not there; run \`ergonex render\` to write it again`,
      );
    } else if (f.recorded !== undefined && f.onDisk !== undefined && f.onDisk !== f.recorded) {
      at(
        "ergonex/generated-edited",
        "Error",
        `${f.path} was edited by hand (its bytes are not the ones recorded); \`ergonex render --force\` replaces it`,
      );
    } else if (f.recorded === undefined && f.onDisk !== undefined) {
      at(
        "ergonex/generated-unrecorded",
        "Warning",
        `${f.path} is a generated file the state record does not hold; run \`ergonex render\` to record it, or remove it`,
      );
    }
    const edited = f.recorded !== undefined && f.onDisk !== undefined && f.onDisk !== f.recorded;
    const missing = f.recorded !== undefined && f.onDisk === undefined;
    if (f.wanted !== undefined && f.onDisk !== f.wanted && !edited && !missing) {
      at(
        "ergonex/generated-drift",
        "Warning",
        f.onDisk === undefined
          ? `${f.path} is not written yet; run \`ergonex render\``
          : `${f.path} would be written differently by the templates now; run \`ergonex render\``,
      );
    }
  }
  return out;
}
