#!/usr/bin/env node
// @bun
var __defProp = Object.defineProperty;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res, err) => () => {
  if (fn)
    try {
      res = fn(fn = 0);
    } catch (e) {
      err = [e];
    }
  if (err)
    throw err[0];
  return res;
};

// ../ts/kernel/absurd.ts
function absurd(value) {
  throw new Error(`an alternative was not handled: ${JSON.stringify(value)}`);
}

// ../ts/kernel/result.ts
function ok(value) {
  return { kind: "ok", value };
}
function err(error) {
  return { kind: "err", error };
}
var done;
var init_result = __esm(() => {
  done = ok(undefined);
});

// ../ts/kernel/archive.ts
function dosDate(year, month, day) {
  return year - 1980 << 9 | month << 5 | day;
}
var CRC_TABLE, ZIP_EPOCH, NO_PENDING, MAX_META;
var init_archive = __esm(() => {
  init_result();
  CRC_TABLE = Array.from({ length: 256 }, (_, i) => {
    let c = i;
    for (let k = 0;k < 8; k++)
      c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    return c >>> 0;
  });
  ZIP_EPOCH = dosDate(1980, 1, 1);
  NO_PENDING = { pax: new Map, longName: undefined, longLink: undefined };
  MAX_META = 1 << 20;
});

// ../ts/kernel/base64.ts
function fromBase64(text) {
  const t = text.replace(/[\t\n\r ]/g, "");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(t))
    return err("the text is not padded standard base64");
  const s = atob(t);
  const out = new Uint8Array(s.length);
  for (let i = 0;i < s.length; i++)
    out[i] = s.charCodeAt(i);
  return ok(out);
}
var init_base64 = __esm(() => {
  init_result();
});

// ../ts/kernel/args.ts
var init_args = __esm(() => {
  init_result();
});

// ../ts/kernel/decode.ts
function describe(input) {
  if (input === null)
    return "null";
  if (input === undefined)
    return "nothing";
  if (Array.isArray(input))
    return "an array";
  const t = typeof input;
  if (t === "string")
    return `the string ${JSON.stringify(input).slice(0, 60)}`;
  if (t === "object")
    return "an object";
  if (t === "function")
    return "a function";
  if (typeof input === "symbol")
    return "a symbol";
  if (typeof input === "number" || typeof input === "bigint" || typeof input === "boolean")
    return `${t} ${String(input)}`;
  return t;
}
function fail(path, expected, input) {
  return err({ kind: "decode", path, expected, found: describe(input) });
}
function literal(...values) {
  return (input, path = "$") => typeof input === "string" && values.includes(input) ? ok(input) : fail(path, `one of ${values.join(", ")}`, input);
}
function array(element) {
  return (input, path = "$") => {
    if (!Array.isArray(input))
      return fail(path, "an array", input);
    const out = [];
    for (const [i, value] of input.entries()) {
      const r = element(value, `${path}[${i}]`);
      if (r.kind === "err")
        return r;
      out.push(r.value);
    }
    return ok(out);
  };
}
function record(value) {
  return (input, path = "$") => {
    if (!isPlainObject(input))
      return fail(path, "an object", input);
    const out = {};
    for (const key of Object.keys(input)) {
      const r = value(Reflect.get(input, key), `${path}.${key}`);
      if (r.kind === "err")
        return r;
      out[key] = r.value;
    }
    return ok(out);
  };
}
function object(required, optional) {
  return (input, path = "$") => {
    if (!isPlainObject(input))
      return fail(path, "an object", input);
    const out = {};
    for (const [key, decoder] of Object.entries(required)) {
      const r = decoder(Reflect.get(input, key), `${path}.${key}`);
      if (r.kind === "err")
        return r;
      out[key] = r.value;
    }
    for (const [key, decoder] of Object.entries(optional ?? {})) {
      const value = Reflect.get(input, key);
      if (value === undefined)
        continue;
      const r = decoder(value, `${path}.${key}`);
      if (r.kind === "err")
        return r;
      out[key] = r.value;
    }
    return ok(out);
  };
}
function mapDecoder(base, f) {
  return (input, path = "$") => {
    const r = base(input, path);
    return r.kind === "ok" ? ok(f(r.value)) : r;
  };
}
function refine(base, name, valid) {
  return (input, path = "$") => {
    const r = base(input, path);
    if (r.kind === "err")
      return r;
    return valid(r.value) ? ok(r.value) : fail(path, `a ${name}`, input);
  };
}
var string = (input, path = "$") => typeof input === "string" ? ok(input) : fail(path, "a string", input), integer = (input, path = "$") => typeof input === "number" && Number.isInteger(input) ? ok(input) : fail(path, "an integer", input), boolean = (input, path = "$") => typeof input === "boolean" ? ok(input) : fail(path, "a boolean", input), unknownValue = (input) => ok(input), isPlainObject = (input) => typeof input === "object" && input !== null && !Array.isArray(input);
var init_decode = __esm(() => {
  init_result();
});

// ../ts/kernel/grc.ts
function instantOf(text) {
  const m = INSTANT.exec(text.trim());
  if (m === null)
    return;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6]].map((x) => Number(x ?? ""));
  if (y === undefined || mo === undefined || d === undefined || h === undefined || mi === undefined || s === undefined)
    return;
  const ms = Number((m[7] ?? "").padEnd(3, "0").slice(0, 3));
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo) || h > 23 || mi > 59 || s > 59)
    return;
  const zone = (m[8] ?? "Z").toUpperCase();
  let offset = 0;
  if (zone !== "Z") {
    const oh = Number(zone.slice(1, 3));
    const om = Number(zone.slice(4, 6));
    if (oh > 23 || om > 59)
      return;
    offset = (zone.startsWith("-") ? -1 : 1) * (oh * 60 + om) * 60000;
  }
  const date = new Date(0);
  date.setUTCFullYear(y, mo - 1, d);
  date.setUTCHours(h, mi, s, ms);
  return instantFromEpochMs(date.getTime() - offset);
}
function instantFromEpochMs(ms) {
  if (!Number.isFinite(ms))
    return;
  const date = new Date(Math.trunc(ms));
  if (Number.isNaN(date.getTime()))
    return;
  const text = date.toISOString();
  return CANONICAL_INSTANT.test(text) ? text : undefined;
}
function daysInMonth(year, month) {
  const leap = year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
  return month === 2 ? leap ? 29 : 28 : [4, 6, 9, 11].includes(month) ? 30 : 31;
}
function parseDuration(text) {
  const m = DURATION.exec(text);
  if (m === null || text === "P" || text.endsWith("T"))
    return err({ kind: "duration", text });
  const n = (i) => Number((m[i] ?? "0").replace(",", "."));
  return ok({ text, years: n(1), months: n(2), weeks: n(3), days: n(4), hours: n(5), minutes: n(6), seconds: n(7) });
}
function roleOf(text) {
  return ROLE.test(text) ? text : undefined;
}
var INSTANT, CANONICAL_INSTANT, DURATION, ROLE, SEVERITIES, refined = (name, f) => {
  return (input, path = "$") => {
    if (typeof input === "string") {
      const v = f(input);
      if (v !== undefined)
        return ok(v);
    }
    return err({
      kind: "decode",
      path,
      expected: name,
      found: typeof input === "string" ? `the string ${JSON.stringify(input).slice(0, 60)}` : typeof input
    });
  };
}, instantDecoder, roleDecoder, durationDecoder, severityDecoder, waiverInput;
var init_grc = __esm(() => {
  init_decode();
  init_result();
  INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/i;
  CANONICAL_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  DURATION = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/;
  ROLE = /^[a-z][a-z0-9]*(?:[-_./][a-z0-9]+)*$/;
  SEVERITIES = ["info", "low", "medium", "high", "critical"];
  instantDecoder = refined("an ISO 8601 date-time with a zone", instantOf);
  roleDecoder = refined("a role (lower-case words joined by - _ . or /)", roleOf);
  durationDecoder = refined("an ISO 8601 duration", (t) => {
    const r = parseDuration(t);
    return r.kind === "ok" ? r.value : undefined;
  });
  severityDecoder = literal(...SEVERITIES);
  waiverInput = mapDecoder(object({ id: string, control: string, subjects: array(string), reason: string, approvedBy: roleDecoder, grantedAt: instantDecoder }, { expiresAt: instantDecoder }), (w) => w);
});

// ../ts/kernel/assess.ts
var impactDeclarationDecoder, RISK_LEVELS, levelDecoder, riskDecoder;
var init_assess = __esm(() => {
  init_grc();
  init_decode();
  impactDeclarationDecoder = object({ paths: array(string), controls: array(string) });
  RISK_LEVELS = ["very-low", "low", "moderate", "high", "very-high"];
  levelDecoder = literal(...RISK_LEVELS);
  riskDecoder = object({
    id: string,
    title: string,
    likelihood: levelDecoder,
    impact: levelDecoder,
    treatment: literal("accept", "mitigate", "transfer", "avoid"),
    owner: roleDecoder,
    reviewBy: instantDecoder
  }, { description: string, controls: array(string) });
});

// ../ts/kernel/der.ts
var init_der = __esm(() => {
  init_archive();
  init_result();
});

// ../ts/kernel/sha256.ts
function sha256Of(text) {
  const t = text.trim().toLowerCase();
  return SHA256.test(t) ? t : undefined;
}
var SHA256;
var init_sha256 = __esm(() => {
  SHA256 = /^[0-9a-f]{64}$/;
});

// ../ts/kernel/dsse.ts
var utf8, lowerHex = (input, path = "$") => typeof input === "string" && /^(?:[0-9a-f]{2})+$/.test(input) ? ok(input) : err({ kind: "decode", path, expected: "lower-case hexadecimal", found: describe(input) }), resourceDescriptorDecoder, base64Text = (input, path = "$") => typeof input === "string" && fromBase64(input).kind === "ok" ? ok(input) : err({ kind: "decode", path, expected: "standard base64", found: describe(input) }), envelopeDecoder;
var init_dsse = __esm(() => {
  init_base64();
  init_decode();
  init_der();
  init_result();
  init_sha256();
  utf8 = new TextEncoder;
  resourceDescriptorDecoder = object({ name: string, digest: record(lowerHex) }, { uri: string, mediaType: string, annotations: record(unknownValue) });
  envelopeDecoder = object({
    payload: base64Text,
    payloadType: string,
    signatures: array(object({ sig: base64Text }, { keyid: string }))
  });
});

// ../ts/kernel/evidence.ts
var GENESIS, sha256Decoder = (input, path = "$") => {
  const s = typeof input === "string" && /^[0-9a-f]{64}$/.test(input) ? sha256Of(input) : undefined;
  return s === undefined ? err({ kind: "decode", path, expected: "a SHA-256 (64 lower-case hexadecimal digits)", found: typeof input }) : ok(s);
}, ledgerEntryDecoder, manifestDecoder;
var init_evidence = __esm(() => {
  init_archive();
  init_decode();
  init_grc();
  init_result();
  init_sha256();
  GENESIS = "0".repeat(64);
  ledgerEntryDecoder = object({
    seq: refine(integer, "positive", (n) => n >= 1),
    prev: sha256Decoder,
    at: instantDecoder,
    kind: string,
    subject: object({ kind: string, id: string }),
    evidence: sha256Decoder,
    digest: sha256Decoder
  });
  manifestDecoder = object({
    files: array(object({ path: string, size: refine(integer, "size", (n) => n >= 0), sha256: sha256Decoder }))
  });
});

// ../ts/kernel/uuid.ts
function uuidOf(text) {
  const t = text.trim().toLowerCase();
  const bare = t.startsWith("urn:uuid:") ? t.slice("urn:uuid:".length) : t;
  return UUID.test(bare) ? bare : undefined;
}
function constant(text) {
  const u = uuidOf(text);
  if (u === undefined)
    throw new Error(`not a UUID: ${text}`);
  return u;
}
var UUID, NIL_UUID, NAMESPACE_DNS, NAMESPACE_URL, NAMESPACE_OID, NAMESPACE_X500, utf82;
var init_uuid = __esm(() => {
  init_decode();
  init_result();
  init_sha256();
  UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  NIL_UUID = constant("00000000-0000-0000-0000-000000000000");
  NAMESPACE_DNS = constant("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
  NAMESPACE_URL = constant("6ba7b811-9dad-11d1-80b4-00c04fd430c8");
  NAMESPACE_OID = constant("6ba7b812-9dad-11d1-80b4-00c04fd430c8");
  NAMESPACE_X500 = constant("6ba7b814-9dad-11d1-80b4-00c04fd430c8");
  utf82 = new TextEncoder;
});

// ../ts/kernel/attest.ts
var PASSING;
var init_attest = __esm(() => {
  init_assess();
  init_base64();
  init_dsse();
  init_evidence();
  init_grc();
  init_sha256();
  init_uuid();
  PASSING = new Set(["pass"]);
});

// ../ts/kernel/cms.ts
var init_cms = __esm(() => {
  init_base64();
  init_der();
  init_result();
  init_sha256();
});

// ../ts/kernel/cbor.ts
var UTF8;
var init_cbor = __esm(() => {
  init_archive();
  init_der();
  init_result();
  UTF8 = new TextDecoder("utf-8", { fatal: true });
});

// ../ts/kernel/commands.ts
var init_commands = __esm(() => {
  init_args();
  init_result();
});

// ../ts/kernel/cose.ts
var init_cose = __esm(() => {
  init_base64();
  init_cbor();
  init_der();
  init_result();
});

// ../ts/kernel/csv.ts
var init_csv = __esm(() => {
  init_result();
});

// ../ts/kernel/crypt.ts
var init_crypt = () => {};

// ../ts/kernel/glob.ts
var ESCAPE_OUTSIDE, ESCAPE_INSIDE, CLASSES;
var init_glob = __esm(() => {
  init_result();
  ESCAPE_OUTSIDE = new Set(["!", "$", "(", ")", "*", "+", ".", "=", "?", "[", "\\", "^", "{", "|"]);
  ESCAPE_INSIDE = new Set(["-", "\\", "]"]);
  CLASSES = new Map([
    ["alnum", "\\dA-Za-z"],
    ["alpha", "A-Za-z"],
    ["ascii", "\\x00-\\x7F"],
    ["blank", "\\t "],
    ["cntrl", "\\x00-\\x1F\\x7F"],
    ["digit", "\\d"],
    ["graph", "\\x21-\\x7E"],
    ["lower", "a-z"],
    ["print", "\\x20-\\x7E"],
    ["punct", "!-\\/:-@\\[-`{-~"],
    ["space", "\\s\\v"],
    ["upper", "A-Z"],
    ["word", "\\w"],
    ["xdigit", "\\dA-Fa-f"]
  ]);
});

// ../ts/kernel/graph.ts
var init_graph = __esm(() => {
  init_result();
});

// ../ts/kernel/http.ts
var SAFE_METHODS;
var init_http = __esm(() => {
  SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);
});

// ../ts/kernel/json5.ts
var init_json5 = __esm(() => {
  init_result();
});

// ../ts/kernel/md5.ts
var T;
var init_md5 = __esm(() => {
  init_sha256();
  T = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0);
});
// ../ts/kernel/media-types.ts
var init_media_types = () => {};

// ../ts/kernel/semver.ts
var IDENT = "(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)", PART = "(0|[1-9][0-9]*|[xX*])", PARTIAL, ver = (major, minor, patch, pre) => ({
  major,
  minor,
  patch,
  ...pre === undefined ? {} : { pre }
}), at = (op, version) => ({ op, version }), NOTHING;
var init_semver = __esm(() => {
  init_result();
  PARTIAL = new RegExp(`^v?${PART}(?:\\.${PART}(?:\\.${PART}(?:-(${IDENT}(?:\\.${IDENT})*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?)?)?$`);
  NOTHING = [at("<", ver(0, 0, 0, "0"))];
});

// ../ts/kernel/text.ts
var ANSI;
var init_text = __esm(() => {
  init_result();
  ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[A-Za-z]`, "g");
});

// ../ts/kernel/ocsf-types.auto.ts
var init_ocsf_types_auto = () => {};

// ../ts/kernel/ocsf.ts
var init_ocsf = __esm(() => {
  init_grc();
  init_ocsf_types_auto();
  init_ocsf_types_auto();
});

// ../ts/kernel/oscal.ts
var OPEN_OUTCOMES;
var init_oscal = __esm(() => {
  init_assess();
  init_evidence();
  init_grc();
  init_uuid();
  OPEN_OUTCOMES = new Set(["fail", "warn", "gap", "error", "accepted"]);
});

// ../ts/kernel/otel.ts
function parseTraceId(text) {
  if (!TRACE_ID.test(text))
    return err("a trace id is 32 lower-case hexadecimal digits");
  if (ZEROS.test(text))
    return err("a trace id of all zeros is not valid");
  return ok(text);
}
function parseSpanId(text) {
  if (!SPAN_ID.test(text))
    return err("a span id is 16 lower-case hexadecimal digits");
  if (ZEROS.test(text))
    return err("a span id of all zeros is not valid");
  return ok(text);
}
function isTraceStateKey(key) {
  return TRACESTATE_KEY.test(key);
}
function isTraceStateValue(value) {
  return TRACESTATE_VALUE.test(value);
}
function parseTracestate(header) {
  const out = [];
  const seen = new Set;
  for (const raw of header.split(",")) {
    if (out.length >= TRACESTATE_MAX_MEMBERS)
      break;
    const member = raw.replace(/^[ \t]+|[ \t]+$/g, "");
    if (member === "")
      continue;
    const eq = member.indexOf("=");
    if (eq < 0)
      continue;
    const key = member.slice(0, eq);
    const value = member.slice(eq + 1);
    if (!isTraceStateKey(key) || !isTraceStateValue(value) || seen.has(key))
      continue;
    seen.add(key);
    out.push({ key, value });
  }
  return out;
}
function isSeverityNumber(n) {
  return Number.isInteger(n) && n >= 1 && n <= 24;
}
var TRACE_ID, SPAN_ID, ZEROS, SAMPLED = 1, RANDOM = 2, KNOWN_FLAGS, TRACESTATE_MAX_MEMBERS = 32, KEY_CHAR = "[a-z0-9_\\-*/]", TRACESTATE_KEY, TRACESTATE_VALUE, TWO_56, CREDENTIAL_WORDS;
var init_otel = __esm(() => {
  init_base64();
  init_result();
  init_sha256();
  TRACE_ID = /^[0-9a-f]{32}$/;
  SPAN_ID = /^[0-9a-f]{16}$/;
  ZEROS = /^0+$/;
  KNOWN_FLAGS = SAMPLED | RANDOM;
  TRACESTATE_KEY = new RegExp(`^(?:[a-z]${KEY_CHAR}{0,255}|[a-z0-9]${KEY_CHAR}{0,240}@[a-z]${KEY_CHAR}{0,13})$`);
  TRACESTATE_VALUE = /^[\x20-\x2b\x2d-\x3c\x3e-\x7e]{0,255}[\x21-\x2b\x2d-\x3c\x3e-\x7e]$/;
  TWO_56 = 2 ** 56;
  CREDENTIAL_WORDS = new Set(["key", "code", "sig", "pwd", "pass", "session", "sid", "otp", "awsaccesskeyid", "sas", "se", "sp", "sv"]);
});

// ../ts/kernel/otlp.ts
function failure(path, expected, input) {
  return { kind: "decode", path, expected, found: describe(input) };
}
function message(build) {
  return (input, path = "$") => {
    if (typeof input !== "object" || input === null || Array.isArray(input))
      return err(failure(path, "an object", input));
    const read = (key, decoder) => {
      const r = decoder(Reflect.get(input, key), `${path}.${key}`);
      if (r.kind === "err")
        throw new Failure(r.error);
      return r.value;
    };
    const f = {
      req: read,
      opt: (key, decoder, fallback) => {
        const v = Reflect.get(input, key);
        return v === undefined || v === null ? fallback : read(key, decoder);
      }
    };
    try {
      return ok(build(f, path));
    } catch (e) {
      if (e instanceof Failure)
        return err(e.error);
      throw e;
    }
  };
}
function list(element) {
  return (input, path = "$") => {
    if (!Array.isArray(input))
      return err(failure(path, "an array", input));
    const out = [];
    for (const [i, value] of input.entries()) {
      const r = element(value, `${path}[${i}]`);
      if (r.kind === "err")
        return r;
      out.push(r.value);
    }
    return ok(out);
  };
}
function enumeration(names) {
  return (input, path = "$") => {
    if (typeof input === "number" && Number.isInteger(input) && input >= 0 && input < names.length)
      return ok(input);
    if (typeof input === "string") {
      const i = names.indexOf(input);
      if (i >= 0)
        return ok(i);
    }
    return err(failure(path, `one of ${names.join(", ")} or its number`, input));
  };
}
function keyValue(value) {
  return message((f) => ({ key: f.req("key", str), value: f.req("value", value) }));
}
function temporalityOf(n) {
  return n === 1 ? "delta" : "cumulative";
}
var SPAN_KINDS, Failure, str = (input, path = "$") => typeof input === "string" ? ok(input) : err(failure(path, "a string", input)), bool = (input, path = "$") => typeof input === "boolean" ? ok(input) : err(failure(path, "a boolean", input)), int64 = (input, path = "$") => {
  if (typeof input === "number" && Number.isInteger(input))
    return ok(BigInt(input));
  if (typeof input === "string" && /^-?[0-9]+$/.test(input))
    return ok(BigInt(input));
  return err(failure(path, "a 64-bit integer (a number or a decimal string)", input));
}, count = (input, path = "$") => {
  const r = int64(input, path);
  if (r.kind === "err")
    return r;
  return r.value >= 0n && r.value <= BigInt(Number.MAX_SAFE_INTEGER) ? ok(Number(r.value)) : err(failure(path, "a count", input));
}, double = (input, path = "$") => {
  if (typeof input === "number")
    return ok(input);
  if (input === "NaN")
    return ok(NaN);
  if (input === "Infinity")
    return ok(Infinity);
  if (input === "-Infinity")
    return ok(-Infinity);
  return err(failure(path, "a double", input));
}, bytes = (input, path = "$") => {
  if (typeof input !== "string")
    return err(failure(path, "base64", input));
  const r = fromBase64(input);
  return r.kind === "ok" ? r : err(failure(path, "base64", input));
}, traceId = (input, path = "$") => {
  const r = typeof input === "string" ? parseTraceId(input.toLowerCase()) : err("");
  return r.kind === "ok" ? r : err(failure(path, "a trace id (32 hexadecimal digits, not all zeros)", input));
}, spanId = (input, path = "$") => {
  const r = typeof input === "string" ? parseSpanId(input.toLowerCase()) : err("");
  return r.kind === "ok" ? r : err(failure(path, "a span id (16 hexadecimal digits, not all zeros)", input));
}, spanKindEnum, statusCodeEnum, temporalityEnum, SEVERITY_NAMES, severityEnum = (input, path = "$") => {
  const r = enumeration(SEVERITY_NAMES)(input, path);
  if (r.kind === "err")
    return r;
  return isSeverityNumber(r.value) ? ok(r.value) : err(failure(path, "a severity number from 1 to 24", input));
}, decodeAnyValue = (input, path = "$") => {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return err(failure(path, "an AnyValue object", input));
  const has = (key) => {
    const v = Reflect.get(input, key);
    return v !== undefined && v !== null;
  };
  const at = (key) => Reflect.get(input, key);
  if (has("stringValue"))
    return str(at("stringValue"), `${path}.stringValue`);
  if (has("boolValue"))
    return bool(at("boolValue"), `${path}.boolValue`);
  if (has("intValue"))
    return int64(at("intValue"), `${path}.intValue`);
  if (has("doubleValue"))
    return double(at("doubleValue"), `${path}.doubleValue`);
  if (has("bytesValue"))
    return bytes(at("bytesValue"), `${path}.bytesValue`);
  if (has("arrayValue"))
    return message((f) => f.opt("values", list(decodeAnyValue), []))(at("arrayValue"), `${path}.arrayValue`);
  if (has("kvlistValue")) {
    return message((f) => {
      const out = {};
      for (const kv of f.opt("values", list(keyValue(decodeAnyValue)), [])) {
        Object.defineProperty(out, kv.key, { value: kv.value, enumerable: true, writable: true, configurable: true });
      }
      return out;
    })(at("kvlistValue"), `${path}.kvlistValue`);
  }
  return err(failure(path, "an AnyValue holding a value", input));
}, decodeAttributeValue = (input, path = "$") => {
  const r = decodeAnyValue(input, path);
  if (r.kind === "err")
    return r;
  const v = r.value;
  if (typeof v !== "object" || v instanceof Uint8Array)
    return ok(v);
  if (Array.isArray(v)) {
    const values = v;
    if (values.every((e) => typeof e === "string"))
      return ok(values.filter((e) => typeof e === "string"));
    if (values.every((e) => typeof e === "boolean"))
      return ok(values.filter((e) => typeof e === "boolean"));
    if (values.every((e) => typeof e === "bigint"))
      return ok(values.filter((e) => typeof e === "bigint"));
    if (values.every((e) => typeof e === "number"))
      return ok(values.filter((e) => typeof e === "number"));
  }
  return err(failure(path, "an attribute value (a primitive or a homogeneous array of primitives)", input));
}, decodeAttributes = (input, path = "$") => {
  const r = list(keyValue(decodeAttributeValue))(input, path);
  if (r.kind === "err")
    return r;
  const out = {};
  for (const kv of r.value)
    Object.defineProperty(out, kv.key, { value: kv.value, enumerable: true, writable: true, configurable: true });
  return ok(out);
}, resource, scope, event, link, status, optionalSpanId = (input, path = "$") => input === "" ? ok(undefined) : spanId(input, path), decodeSpan, optionalTraceId = (input, path = "$") => input === "" ? ok(undefined) : traceId(input, path), decodeLogRecord, numberPoint, histogramPoint, decodeMetric;
var init_otlp = __esm(() => {
  init_base64();
  init_decode();
  init_otel();
  init_result();
  SPAN_KINDS = ["internal", "server", "client", "producer", "consumer"];
  Failure = class Failure extends Error {
    error;
    constructor(error) {
      super(error.path);
      this.error = error;
    }
  };
  spanKindEnum = enumeration([
    "SPAN_KIND_UNSPECIFIED",
    "SPAN_KIND_INTERNAL",
    "SPAN_KIND_SERVER",
    "SPAN_KIND_CLIENT",
    "SPAN_KIND_PRODUCER",
    "SPAN_KIND_CONSUMER"
  ]);
  statusCodeEnum = enumeration(["STATUS_CODE_UNSET", "STATUS_CODE_OK", "STATUS_CODE_ERROR"]);
  temporalityEnum = enumeration([
    "AGGREGATION_TEMPORALITY_UNSPECIFIED",
    "AGGREGATION_TEMPORALITY_DELTA",
    "AGGREGATION_TEMPORALITY_CUMULATIVE"
  ]);
  SEVERITY_NAMES = ["SEVERITY_NUMBER_UNSPECIFIED"].concat(["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"].flatMap((r) => ["", "2", "3", "4"].map((n) => `SEVERITY_NUMBER_${r}${n}`)));
  resource = message((f) => ({ attributes: f.opt("attributes", decodeAttributes, {}) }));
  scope = message((f) => {
    const version = f.opt("version", str, undefined);
    const attributes = f.opt("attributes", decodeAttributes, undefined);
    return {
      name: f.opt("name", str, ""),
      ...version === undefined ? {} : { version },
      ...attributes === undefined ? {} : { attributes }
    };
  });
  event = message((f) => ({
    name: f.opt("name", str, ""),
    time: f.opt("timeUnixNano", int64, 0n),
    attributes: f.opt("attributes", decodeAttributes, {}),
    droppedAttributesCount: f.opt("droppedAttributesCount", count, 0)
  }));
  link = message((f) => ({
    traceId: f.req("traceId", traceId),
    spanId: f.req("spanId", spanId),
    traceState: parseTracestate(f.opt("traceState", str, "")),
    traceFlags: f.opt("flags", count, 0) & 255,
    attributes: f.opt("attributes", decodeAttributes, {}),
    droppedAttributesCount: f.opt("droppedAttributesCount", count, 0)
  }));
  status = message((f) => {
    const code = f.opt("code", statusCodeEnum, 0);
    if (code === 1)
      return { kind: "ok" };
    if (code === 2)
      return { kind: "error", message: f.opt("message", str, "") };
    return { kind: "unset" };
  });
  decodeSpan = message((f) => {
    const parentSpanId = f.opt("parentSpanId", optionalSpanId, undefined);
    const kind = f.opt("kind", spanKindEnum, 1);
    return {
      name: f.opt("name", str, ""),
      context: {
        traceId: f.req("traceId", traceId),
        spanId: f.req("spanId", spanId),
        traceFlags: f.opt("flags", count, 0) & 255,
        traceState: parseTracestate(f.opt("traceState", str, "")),
        isRemote: false
      },
      ...parentSpanId === undefined ? {} : { parentSpanId },
      kind: SPAN_KINDS[kind - 1] ?? "internal",
      startTime: f.opt("startTimeUnixNano", int64, 0n),
      endTime: f.opt("endTimeUnixNano", int64, 0n),
      attributes: f.opt("attributes", decodeAttributes, {}),
      events: f.opt("events", list(event), []),
      links: f.opt("links", list(link), []),
      status: f.opt("status", status, { kind: "unset" }),
      droppedAttributesCount: f.opt("droppedAttributesCount", count, 0),
      droppedEventsCount: f.opt("droppedEventsCount", count, 0),
      droppedLinksCount: f.opt("droppedLinksCount", count, 0)
    };
  });
  decodeLogRecord = message((f) => {
    const body = f.opt("body", decodeAnyValue, undefined);
    const traceFlags = f.opt("flags", count, undefined);
    const tid = f.opt("traceId", optionalTraceId, undefined);
    const sid = f.opt("spanId", optionalSpanId, undefined);
    const eventName = f.opt("eventName", str, undefined);
    return {
      time: f.opt("timeUnixNano", int64, 0n),
      observedTime: f.opt("observedTimeUnixNano", int64, 0n),
      severityNumber: f.req("severityNumber", severityEnum),
      severityText: f.opt("severityText", str, ""),
      ...body === undefined ? {} : { body },
      attributes: f.opt("attributes", decodeAttributes, {}),
      droppedAttributesCount: f.opt("droppedAttributesCount", count, 0),
      ...eventName === undefined ? {} : { eventName },
      ...tid === undefined ? {} : { traceId: tid },
      ...sid === undefined ? {} : { spanId: sid },
      ...traceFlags === undefined ? {} : { traceFlags: traceFlags & 255 }
    };
  });
  numberPoint = message((f, path) => {
    const asInt = f.opt("asInt", int64, undefined);
    const asDouble = f.opt("asDouble", double, undefined);
    const value = asInt ?? asDouble;
    if (value === undefined)
      throw new Failure(failure(`${path}.asDouble`, "asInt or asDouble", undefined));
    return {
      attributes: f.opt("attributes", decodeAttributes, {}),
      startTime: f.opt("startTimeUnixNano", int64, 0n),
      time: f.opt("timeUnixNano", int64, 0n),
      value
    };
  });
  histogramPoint = message((f, path) => {
    const sum = f.opt("sum", double, undefined);
    const min = f.opt("min", double, undefined);
    const max = f.opt("max", double, undefined);
    const bounds = f.opt("explicitBounds", list(double), []);
    const bucketCounts = f.opt("bucketCounts", list(count), []);
    if (bucketCounts.length !== 0 && bucketCounts.length !== bounds.length + 1) {
      throw new Failure(failure(`${path}.bucketCounts`, `${bounds.length + 1} bucket counts`, bucketCounts.length));
    }
    return {
      attributes: f.opt("attributes", decodeAttributes, {}),
      startTime: f.opt("startTimeUnixNano", int64, 0n),
      time: f.opt("timeUnixNano", int64, 0n),
      count: f.opt("count", count, 0),
      ...sum === undefined ? {} : { sum },
      ...min === undefined ? {} : { min },
      ...max === undefined ? {} : { max },
      bounds,
      bucketCounts
    };
  });
  decodeMetric = message((f, path) => {
    const head = { name: f.opt("name", str, ""), description: f.opt("description", str, ""), unit: f.opt("unit", str, "") };
    const sum = f.opt("sum", message((g) => ({
      kind: "sum",
      points: g.opt("dataPoints", list(numberPoint), []),
      temporality: temporalityOf(g.opt("aggregationTemporality", temporalityEnum, 2)),
      monotonic: g.opt("isMonotonic", bool, false)
    })), undefined);
    if (sum !== undefined)
      return { ...head, data: sum };
    const gauge = f.opt("gauge", message((g) => ({ kind: "gauge", points: g.opt("dataPoints", list(numberPoint), []) })), undefined);
    if (gauge !== undefined)
      return { ...head, data: gauge };
    const histogram = f.opt("histogram", message((g) => ({
      kind: "histogram",
      points: g.opt("dataPoints", list(histogramPoint), []),
      temporality: temporalityOf(g.opt("aggregationTemporality", temporalityEnum, 2))
    })), undefined);
    if (histogram !== undefined)
      return { ...head, data: histogram };
    throw new Failure(failure(`${path}.sum`, "a sum, a gauge or a histogram", undefined));
  });
});

// ../ts/kernel/palette.ts
var ESC;
var init_palette = __esm(() => {
  ESC = String.fromCharCode(27);
});

// ../ts/kernel/png.ts
var MAX_PIXELS, COLOUR_TYPES, PRECISION_BITS, ONE;
var init_png = __esm(() => {
  init_archive();
  init_result();
  MAX_PIXELS = 2 ** 24;
  COLOUR_TYPES = new Map([
    [0, { samples: 1, depths: [1, 2, 4, 8, 16], name: "greyscale" }],
    [2, { samples: 3, depths: [8, 16], name: "RGB" }],
    [3, { samples: 1, depths: [1, 2, 4, 8], name: "palette" }],
    [4, { samples: 2, depths: [8, 16], name: "greyscale with alpha" }],
    [6, { samples: 4, depths: [8, 16], name: "RGBA" }]
  ]);
  PRECISION_BITS = 32 - 8 - 2;
  ONE = 2 ** PRECISION_BITS;
});

// ../ts/kernel/rdf-term.ts
function parseIri(text) {
  for (let at = 0;at < text.length; at++) {
    if (text.charCodeAt(at) <= 32 || FORBIDDEN.has(text.charAt(at)))
      return err({ kind: "forbidden-character", text, at });
  }
  if (!SCHEME.test(text))
    return err({ kind: "not-absolute", text });
  return ok(text);
}
function formatIriError(e) {
  switch (e.kind) {
    case "not-absolute":
      return `${JSON.stringify(e.text)} is not an absolute IRI: it has no scheme`;
    case "forbidden-character":
      return `${JSON.stringify(e.text)} is not an IRI: the character at ${e.at} may not be in one`;
    default:
      return absurd(e);
  }
}
function checked(text) {
  const r = parseIri(text);
  if (r.kind === "err")
    throw new RdfFault(formatIriError(r.error));
  return r.value;
}
function named(iri) {
  return { kind: "named", iri };
}
function namespace(prefix, iri) {
  if (!PREFIX.test(prefix))
    throw new RdfFault(`${JSON.stringify(prefix)} is not a prefix`);
  return { prefix, iri: checked(iri) };
}
function iriIn(ns, local) {
  return checked(`${ns.iri}${local}`);
}
function vocabulary(ns, terms) {
  const out = {};
  for (const local of Object.keys(terms))
    out[local] = { kind: "named", iri: iriIn(ns, local), curie: `${ns.prefix}:${local}` };
  return out;
}
var SCHEME, FORBIDDEN, RdfFault, PREFIX, XSD = "http://www.w3.org/2001/XMLSchema#", XSD_STRING, XSD_INTEGER, XSD_BOOLEAN, RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", ESCAPES;
var init_rdf_term = __esm(() => {
  init_result();
  SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;
  FORBIDDEN = new Set([...'<>"{}|^`\\']);
  RdfFault = class RdfFault extends Error {
    constructor(message) {
      super(message);
      this.name = "RdfFault";
    }
  };
  PREFIX = /^(?:[A-Za-z][A-Za-z0-9_-]*)?$/;
  XSD_STRING = `${XSD}string`;
  XSD_INTEGER = `${XSD}integer`;
  XSD_BOOLEAN = `${XSD}boolean`;
  ESCAPES = new Map([
    ["\b", "\\b"],
    ["\t", "\\t"],
    [`
`, "\\n"],
    ["\f", "\\f"],
    ["\r", "\\r"],
    ['"', "\\\""],
    ["\\", "\\\\"]
  ]);
});

// ../ts/kernel/rdf-vocabularies.ts
var RDF, rdf, RDFS, rdfs, OWL, owl, XSD2, xsd, SKOS, skos, DCTERMS, dcterms, PROV, prov, SH, sh;
var init_rdf_vocabularies = __esm(() => {
  init_rdf_term();
  RDF = namespace("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
  rdf = vocabulary(RDF, {
    type: "rdf:Property",
    first: "rdf:Property",
    rest: "rdf:Property",
    value: "rdf:Property",
    Property: "rdfs:Class",
    List: "rdfs:Class",
    nil: "rdf:List",
    langString: "rdfs:Datatype"
  });
  RDFS = namespace("rdfs", "http://www.w3.org/2000/01/rdf-schema#");
  rdfs = vocabulary(RDFS, {
    Resource: "rdfs:Class",
    Class: "rdfs:Class",
    Datatype: "rdfs:Class",
    Literal: "rdfs:Class",
    label: "rdf:Property",
    comment: "rdf:Property",
    domain: "rdf:Property",
    range: "rdf:Property",
    subClassOf: "rdf:Property",
    subPropertyOf: "rdf:Property",
    seeAlso: "rdf:Property",
    isDefinedBy: "rdf:Property"
  });
  OWL = namespace("owl", "http://www.w3.org/2002/07/owl#");
  owl = vocabulary(OWL, {
    Ontology: "rdfs:Class",
    Class: "rdfs:Class",
    ObjectProperty: "rdfs:Class",
    DatatypeProperty: "rdfs:Class",
    AnnotationProperty: "rdfs:Class",
    NamedIndividual: "rdfs:Class",
    Thing: "rdfs:Class",
    versionInfo: "rdf:Property",
    versionIRI: "rdf:Property",
    imports: "rdf:Property",
    sameAs: "rdf:Property",
    equivalentClass: "rdf:Property"
  });
  XSD2 = namespace("xsd", "http://www.w3.org/2001/XMLSchema#");
  xsd = vocabulary(XSD2, {
    string: "rdfs:Datatype",
    boolean: "rdfs:Datatype",
    integer: "rdfs:Datatype",
    nonNegativeInteger: "rdfs:Datatype",
    positiveInteger: "rdfs:Datatype",
    decimal: "rdfs:Datatype",
    double: "rdfs:Datatype",
    date: "rdfs:Datatype",
    dateTime: "rdfs:Datatype",
    duration: "rdfs:Datatype",
    anyURI: "rdfs:Datatype",
    language: "rdfs:Datatype"
  });
  SKOS = namespace("skos", "http://www.w3.org/2004/02/skos/core#");
  skos = vocabulary(SKOS, {
    Concept: "rdfs:Class",
    ConceptScheme: "rdfs:Class",
    Collection: "rdfs:Class",
    inScheme: "rdf:Property",
    hasTopConcept: "rdf:Property",
    topConceptOf: "rdf:Property",
    prefLabel: "rdf:Property",
    altLabel: "rdf:Property",
    definition: "rdf:Property",
    notation: "rdf:Property",
    broader: "rdf:Property",
    narrower: "rdf:Property",
    related: "rdf:Property",
    note: "rdf:Property",
    scopeNote: "rdf:Property",
    example: "rdf:Property"
  });
  DCTERMS = namespace("dcterms", "http://purl.org/dc/terms/");
  dcterms = vocabulary(DCTERMS, {
    identifier: "rdf:Property",
    title: "rdf:Property",
    description: "rdf:Property",
    source: "rdf:Property",
    license: "rdf:Property",
    created: "rdf:Property",
    modified: "rdf:Property",
    date: "rdf:Property",
    creator: "rdf:Property",
    publisher: "rdf:Property",
    isPartOf: "rdf:Property",
    hasPart: "rdf:Property",
    references: "rdf:Property",
    conformsTo: "rdf:Property",
    Standard: "rdfs:Class"
  });
  PROV = namespace("prov", "http://www.w3.org/ns/prov#");
  prov = vocabulary(PROV, {
    Entity: "rdfs:Class",
    Activity: "rdfs:Class",
    Agent: "rdfs:Class",
    Person: "rdfs:Class",
    Organization: "rdfs:Class",
    SoftwareAgent: "rdfs:Class",
    wasGeneratedBy: "rdf:Property",
    wasDerivedFrom: "rdf:Property",
    wasAttributedTo: "rdf:Property",
    wasAssociatedWith: "rdf:Property",
    wasInformedBy: "rdf:Property",
    actedOnBehalfOf: "rdf:Property",
    used: "rdf:Property",
    startedAtTime: "rdf:Property",
    endedAtTime: "rdf:Property",
    generatedAtTime: "rdf:Property",
    atLocation: "rdf:Property",
    value: "rdf:Property"
  });
  SH = namespace("sh", "http://www.w3.org/ns/shacl#");
  sh = vocabulary(SH, {
    NodeShape: "rdfs:Class",
    PropertyShape: "rdfs:Class",
    targetClass: "rdf:Property",
    property: "rdf:Property",
    path: "rdf:Property",
    datatype: "rdf:Property",
    class: "rdf:Property",
    node: "rdf:Property",
    minCount: "rdf:Property",
    maxCount: "rdf:Property",
    pattern: "rdf:Property",
    in: "rdf:Property",
    order: "rdf:Property",
    name: "rdf:Property",
    description: "rdf:Property"
  });
});

// ../ts/kernel/rdf-schema.ts
function rangeOf(kind, words) {
  return words === undefined ? { kind } : { kind, words };
}
function one(property, r) {
  return { property, range: r, cardinality: "one" };
}
function optional(property, r) {
  return { property, range: r, cardinality: "optional" };
}
function many(property, r) {
  return { property, range: r, cardinality: "many" };
}
function isValue(x) {
  return typeof x === "string" || typeof x === "number" || typeof x === "boolean" || typeof x === "object" && x !== null && "kind" in x;
}
function valuesIn(x) {
  if (x === undefined)
    return [];
  if (Array.isArray(x))
    return x.filter(isValue);
  return isValue(x) ? [x] : [];
}
function classSchema(cls, fields) {
  const klass = named(cls.iri);
  return {
    class: klass,
    curie: cls.curie,
    fields,
    make: (subject, values) => {
      const own = values;
      const statements = [{ predicate: named(RDF_TYPE), objects: [klass] }];
      for (const [name, f] of Object.entries(fields)) {
        const objects = valuesIn(own[name]);
        if (objects.length === 0)
          continue;
        statements.push(f.range.words === undefined ? { predicate: f.property, objects } : { predicate: f.property, objects, words: f.range.words });
      }
      const made = { ...named(subject.iri), class: klass, values, statements };
      return made;
    }
  };
}
var range, OwlOntology, OwlClass, PROPERTY, ObjectProperty, DatatypeProperty, ConceptSchemeSchema, ConceptSchema;
var init_rdf_schema = __esm(() => {
  init_rdf_term();
  init_rdf_vocabularies();
  range = {
    string: rangeOf("string"),
    langString: rangeOf("lang"),
    text: rangeOf("text"),
    boolean: rangeOf("boolean"),
    integer: rangeOf("integer"),
    ref: () => rangeOf("ref"),
    oneOf: (words) => rangeOf("string", words)
  };
  OwlOntology = classSchema(owl.Ontology, {
    label: optional(rdfs.label, range.langString),
    comment: optional(rdfs.comment, range.langString),
    description: optional(dcterms.description, range.langString),
    versionInfo: optional(owl.versionInfo, range.string),
    versionIri: optional(owl.versionIRI, range.ref())
  });
  OwlClass = classSchema(owl.Class, {
    label: optional(rdfs.label, range.langString),
    comment: optional(rdfs.comment, range.langString),
    subClassOf: many(rdfs.subClassOf, range.ref()),
    definition: optional(skos.definition, range.langString)
  });
  PROPERTY = {
    label: optional(rdfs.label, range.langString),
    comment: optional(rdfs.comment, range.langString),
    domain: optional(rdfs.domain, range.ref()),
    range: optional(rdfs.range, range.ref()),
    definition: optional(skos.definition, range.langString)
  };
  ObjectProperty = classSchema(owl.ObjectProperty, PROPERTY);
  DatatypeProperty = classSchema(owl.DatatypeProperty, PROPERTY);
  ConceptSchemeSchema = classSchema(skos.ConceptScheme, {
    prefLabel: one(skos.prefLabel, range.langString),
    definition: optional(skos.definition, range.langString)
  });
  ConceptSchema = classSchema(skos.Concept, {
    inScheme: one(skos.inScheme, range.ref()),
    notation: one(skos.notation, range.string),
    prefLabel: one(skos.prefLabel, range.langString),
    definition: optional(skos.definition, range.langString)
  });
});

// ../ts/kernel/rdf-write.ts
var init_rdf_write = __esm(() => {
  init_rdf_term();
});

// ../ts/kernel/rdf.ts
var init_rdf = __esm(() => {
  init_rdf_term();
  init_rdf_vocabularies();
  init_rdf_schema();
  init_rdf_write();
});

// ../ts/kernel/signals.ts
var ATTRIBUTE_TYPES;
var init_signals = __esm(() => {
  init_base64();
  init_otel();
  init_otlp();
  init_result();
  ATTRIBUTE_TYPES = new Set([
    "string",
    "boolean",
    "int",
    "double",
    "bytes",
    "string[]",
    "boolean[]",
    "int[]",
    "double[]"
  ]);
});

// ../ts/kernel/width.ts
var ESC2, BEL, ESCAPE, segmenter, SGR, RESET;
var init_width = __esm(() => {
  ESC2 = String.fromCharCode(27);
  BEL = String.fromCharCode(7);
  ESCAPE = new RegExp(`${ESC2}(?:\\[[0-?]*[ -/]*[@-~]?|[\\]PX^_][^${BEL}${ESC2}]*(?:${BEL}|${ESC2}\\\\)?|[ -/]*[0-~]|)`, "g");
  segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  SGR = new RegExp(`^${ESC2}\\[([0-9;:]*)m$`);
  RESET = `${ESC2}[0m`;
});

// ../ts/kernel/render.ts
var ESC3, CONTROL;
var init_render = __esm(() => {
  init_otel();
  init_otlp();
  init_palette();
  init_signals();
  init_width();
  ESC3 = String.fromCharCode(27);
  CONTROL = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}-${String.fromCharCode(159)}]`, "g");
});

// ../ts/kernel/xml.ts
var FORBIDDEN2;
var init_xml = __esm(() => {
  init_result();
  FORBIDDEN2 = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(11, 12)}${String.fromCharCode(14)}-${String.fromCharCode(31)}\\ufffe\\uffff]`, "g");
});

// ../ts/kernel/schedule.ts
var init_schedule = __esm(() => {
  init_result();
  init_xml();
});

// ../ts/kernel/trace.ts
var init_trace = () => {};

// ../ts/kernel/layers.ts
var init_layers = __esm(() => {
  init_glob();
  init_trace();
});

// ../ts/kernel/sigv4.ts
var UNSIGNED_HEADERS, encoder;
var init_sigv4 = __esm(() => {
  init_sha256();
  UNSIGNED_HEADERS = new Set(["authorization", "connection", "expect", "user-agent", "x-amzn-trace-id", "traceparent", "tracestate"]);
  encoder = new TextEncoder;
});

// ../ts/kernel/test-record.ts
var init_test_record = __esm(() => {
  init_decode();
  init_grc();
  init_otel();
  init_otlp();
  init_result();
  init_sha256();
});

// ../ts/kernel/yaml.ts
var init_yaml = __esm(() => {
  init_result();
});

// ../ts/kernel/test-report.ts
var STYLE;
var init_test_report = __esm(() => {
  init_decode();
  init_dsse();
  init_evidence();
  init_grc();
  init_oscal();
  init_otel();
  init_otlp();
  init_result();
  init_uuid();
  init_xml();
  init_test_record();
  init_yaml();
  STYLE = "body{font:15px/1.5 system-ui,sans-serif;margin:2rem auto;max-width:72rem;padding:0 1rem;color:#1b1b1b;background:#fff}" + "table{border-collapse:collapse;margin:.5rem 0;width:100%}th,td{border:1px solid #c8c8c8;padding:.25rem .5rem;text-align:left;vertical-align:top;overflow-wrap:anywhere}" + "th{background:#f0f0f0}h1{font-size:1.6rem}h2{font-size:1.2rem;margin-top:2rem}" + "@media (prefers-color-scheme:dark){body{color:#e8e8e8;background:#161616}th{background:#2a2a2a}th,td{border-color:#444}}";
});

// ../ts/kernel/toml.ts
var CONTROL2;
var init_toml = __esm(() => {
  init_result();
  CONTROL2 = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(8, 10)}-${String.fromCharCode(31, 127)}]`);
});

// ../ts/kernel/ts-literal.ts
var init_ts_literal = __esm(() => {
  init_result();
});
// ../ts/kernel/vt.ts
var init_vt = __esm(() => {
  init_width();
});

// ../ts/kernel/webauthn.ts
var clientData, kind, extensionResults;
var init_webauthn = __esm(() => {
  init_base64();
  init_cbor();
  init_cose();
  init_decode();
  init_result();
  clientData = object({ type: string, challenge: string, origin: string }, { crossOrigin: boolean, topOrigin: string });
  kind = literal("public-key");
  extensionResults = record(unknownValue);
});

// ../ts/kernel/mod.ts
var init_mod = __esm(() => {
  init_archive();
  init_base64();
  init_args();
  init_assess();
  init_attest();
  init_cms();
  init_cbor();
  init_commands();
  init_cose();
  init_csv();
  init_crypt();
  init_decode();
  init_der();
  init_dsse();
  init_evidence();
  init_glob();
  init_grc();
  init_graph();
  init_http();
  init_json5();
  init_md5();
  init_media_types();
  init_result();
  init_semver();
  init_sha256();
  init_text();
  init_ocsf();
  init_oscal();
  init_otel();
  init_otlp();
  init_palette();
  init_png();
  init_rdf();
  init_render();
  init_schedule();
  init_layers();
  init_signals();
  init_sigv4();
  init_test_record();
  init_test_report();
  init_trace();
  init_toml();
  init_ts_literal();
  init_uuid();
  init_vt();
  init_webauthn();
  init_width();
  init_xml();
  init_yaml();
});

// governance/annotation.ts
function annotationKind(name, about) {
  return Object.freeze({ name, about: Object.freeze([...about]) });
}
function annotate(kind, value) {
  return Object.freeze({ kind: kind.name, about: kind.about, value });
}
function annotationsOf(element, kind) {
  return element.annotations.filter((a) => a.kind === kind.name).map((a) => a.value);
}

// governance/codelist.ts
function codeList(name, spec) {
  return Object.freeze({
    kind: "codelist",
    name,
    definition: spec.definition ?? "",
    codes: spec.codes,
    annotations: Object.freeze([...spec.annotations ?? []])
  });
}

// governance/issue.ts
var init_issue = () => {};

// governance/names.ts
function words(name) {
  return (name.match(WORD) ?? []).map((w) => w.toLowerCase());
}
var NAME, WORD;
var init_names = __esm(() => {
  NAME = /^[a-z][a-zA-Z0-9]*$/;
  WORD = /[A-Z]+(?![a-z])|[A-Z]?[a-z]+|[0-9]+/g;
});

// governance/id.ts
var made = (text) => text, domainId = (domain) => made(domain), conceptId = (domain, concept) => made(`${domain}/${concept}`), attributeId = (domain, concept, attribute) => made(`${domain}/${concept}.${attribute}`), relationshipId = (domain, concept, relationship) => made(`${domain}/${concept}>${relationship}`), codeListId = (domain, list) => made(`${domain}/list:${list}`), codeId = (domain, list, code) => made(`${domain}/list:${list}.${code}`);
var init_id = __esm(() => {
  init_names();
});

// governance/model.ts
function attribute2(type, options = {}) {
  return Object.freeze({
    kind: "attribute",
    type,
    multiplicity: options.multiplicity ?? "required",
    definition: options.definition ?? "",
    annotations: Object.freeze([...options.annotations ?? []])
  });
}
function relationship(to, options) {
  return Object.freeze({
    kind: "relationship",
    to,
    cardinality: options.cardinality,
    definition: options.definition ?? "",
    annotations: Object.freeze([...options.annotations ?? []])
  });
}
function concept(name, spec) {
  return Object.freeze({
    kind: "concept",
    name,
    definition: spec.definition ?? "",
    attributes: spec.attributes,
    relationships: spec.relationships ?? {},
    identifiedBy: Object.freeze([...spec.identifiedBy]),
    annotations: Object.freeze([...spec.annotations ?? []])
  });
}
function resolve(target) {
  return typeof target === "function" ? target() : target;
}
function domain(name, spec) {
  const errors = [];
  const concepts = spec.concepts;
  const codeLists = spec.codeLists ?? [];
  const checkName = (element, text) => {
    if (!NAME.test(text))
      errors.push({ kind: "name", element, name: text });
  };
  const checkAnnotations = (element, kind, annotations) => {
    for (const a of annotations)
      if (!a.about.includes(kind))
        errors.push({ kind: "annotation", element, annotation: a.kind, about: a.about });
  };
  checkName(domainId(name), name);
  checkAnnotations(domainId(name), "domain", spec.annotations ?? []);
  const seenConcepts = new Set;
  for (const c of concepts) {
    const cid = conceptId(name, c.name);
    checkName(cid, c.name);
    if (seenConcepts.has(c.name))
      errors.push({ kind: "duplicate", element: cid });
    seenConcepts.add(c.name);
    checkAnnotations(cid, "concept", c.annotations);
    for (const [key, a] of Object.entries(c.attributes)) {
      const aid = attributeId(name, c.name, key);
      checkName(aid, key);
      checkAnnotations(aid, "attribute", a.annotations);
      if (a.type.kind === "vector" && (!Number.isInteger(a.type.dimensions) || a.type.dimensions < 1))
        errors.push({ kind: "dimensions", element: aid, dimensions: a.type.dimensions });
      if (a.type.kind === "code" && !codeLists.includes(a.type.list))
        errors.push({ kind: "unresolved", from: aid, to: a.type.list.name, what: "codelist" });
    }
    for (const [key, r] of Object.entries(c.relationships)) {
      const rid = relationshipId(name, c.name, key);
      checkName(rid, key);
      checkAnnotations(rid, "relationship", r.annotations);
      if (key in c.attributes)
        errors.push({ kind: "duplicate", element: rid });
      const target = resolve(r.to);
      if (!concepts.includes(target))
        errors.push({ kind: "unresolved", from: rid, to: target.name, what: "concept" });
    }
    if (c.identifiedBy.length === 0)
      errors.push({ kind: "identifier", concept: cid, why: "missing" });
    for (const key of c.identifiedBy) {
      const a = c.attributes[key];
      const r = c.relationships[key];
      if (a !== undefined) {
        if (a.multiplicity !== "required")
          errors.push({ kind: "identifier", concept: cid, attribute: key, why: "not-required" });
      } else if (r !== undefined) {
        if (r.cardinality !== "one")
          errors.push({ kind: "identifier", concept: cid, attribute: key, why: "not-required" });
      } else
        errors.push({ kind: "identifier", concept: cid, attribute: key, why: "unknown" });
    }
  }
  const seenLists = new Set;
  for (const l of codeLists) {
    const lid = codeListId(name, l.name);
    checkName(lid, l.name);
    if (seenLists.has(l.name))
      errors.push({ kind: "duplicate", element: lid });
    seenLists.add(l.name);
    checkAnnotations(lid, "codelist", l.annotations);
    for (const code of Object.keys(l.codes))
      checkName(codeId(name, l.name, code), code);
  }
  if (errors.length > 0)
    return err(errors);
  return ok(Object.freeze({
    kind: "domain",
    name,
    definition: spec.definition ?? "",
    concepts,
    codeLists,
    annotations: Object.freeze([...spec.annotations ?? []])
  }));
}
var membersOf = (c) => [...Object.keys(c.attributes), ...Object.keys(c.relationships)];
var init_model = __esm(() => {
  init_mod();
  init_id();
  init_names();
});

// governance/module.ts
function ordered(modules) {
  const errors = [];
  const by = new Map;
  for (const m of modules) {
    if (by.has(m.name))
      errors.push({ kind: "duplicate-module", module: m.name });
    by.set(m.name, m);
  }
  for (const m of modules)
    for (const r of m.requires)
      if (!by.has(r))
        errors.push({ kind: "missing", module: m.name, requires: r });
  if (errors.length > 0)
    return err(errors);
  const out = [];
  const done = new Set;
  const path = [];
  const visit = (m) => {
    if (done.has(m.name))
      return;
    if (path.includes(m.name)) {
      errors.push({ kind: "cycle", modules: [...path.slice(path.indexOf(m.name)), m.name] });
      done.add(m.name);
      return;
    }
    path.push(m.name);
    for (const r of m.requires)
      visit(by.get(r));
    path.pop();
    done.add(m.name);
    out.push(m);
  };
  for (const m of modules)
    visit(m);
  return errors.length > 0 ? err(errors) : ok(out);
}
function composeModules(name, spec, modules) {
  const order = ordered(modules);
  if (order.kind === "err")
    return order;
  const errors = [];
  const concepts = [];
  const codeLists = [];
  const conceptOwner = new Map;
  const listOwner = new Map;
  const ownerOfConcept = new Map;
  const ownerOfList = new Map;
  for (const m of order.value) {
    for (const c of m.concepts) {
      const first = conceptOwner.get(c.name);
      if (first !== undefined && !(ownerOfConcept.get(c) === first))
        errors.push({ kind: "duplicate-element", name: c.name, what: "concept", modules: [first, m.name] });
      else if (first === undefined) {
        conceptOwner.set(c.name, m.name);
        ownerOfConcept.set(c, m.name);
        concepts.push(c);
      }
    }
    for (const l of m.codeLists) {
      const first = listOwner.get(l.name);
      if (first !== undefined && !(ownerOfList.get(l) === first))
        errors.push({ kind: "duplicate-element", name: l.name, what: "codelist", modules: [first, m.name] });
      else if (first === undefined) {
        listOwner.set(l.name, m.name);
        ownerOfList.set(l, m.name);
        codeLists.push(l);
      }
    }
  }
  const reach = new Map;
  const by = new Map(order.value.map((m) => [m.name, m]));
  const closure = (m) => {
    const have = reach.get(m.name);
    if (have !== undefined)
      return have;
    const s = new Set([m.name]);
    reach.set(m.name, s);
    for (const r of m.requires)
      for (const x of closure(by.get(r)))
        s.add(x);
    return s;
  };
  for (const m of order.value) {
    const may = closure(m);
    for (const c of m.concepts) {
      const refs = [
        ...Object.values(c.relationships).map((r) => ({ to: typeof r.to === "function" ? r.to() : r.to, list: undefined, label: "" })),
        ...Object.values(c.attributes).flatMap((a) => a.type.kind === "code" ? [{ to: undefined, list: a.type.list, label: "" }] : [])
      ];
      for (const r of refs) {
        const owner = r.to !== undefined ? ownerOfConcept.get(r.to) : r.list !== undefined ? ownerOfList.get(r.list) : undefined;
        const what = r.to?.name ?? r.list?.name ?? "";
        if (owner !== undefined && !may.has(owner))
          errors.push({ kind: "undeclared-dependency", module: m.name, concept: c.name, refersTo: what, in: owner });
      }
    }
  }
  if (errors.length > 0)
    return err(errors);
  const d = domain(name, { ...spec.definition === undefined ? {} : { definition: spec.definition }, concepts, codeLists, ...spec.annotations === undefined ? {} : { annotations: spec.annotations } });
  return d.kind === "err" ? err([{ kind: "domain", errors: d.error }]) : d;
}
function withRequired(all, wanted) {
  const by = new Map(all.map((m) => [m.name, m]));
  const errors = [];
  const picked = new Map;
  const take = (n, from) => {
    if (picked.has(n))
      return;
    const m = by.get(n);
    if (m === undefined) {
      errors.push(from === undefined ? { kind: "unknown-module", module: n } : { kind: "missing", module: from, requires: n });
      return;
    }
    picked.set(n, m);
    for (const r of m.requires)
      take(r, m.name);
  };
  for (const n of wanted)
    take(n);
  if (errors.length > 0)
    return err(errors);
  return ordered([...picked.values()]);
}
var defineModule = (spec) => Object.freeze({
  kind: "module",
  name: spec.name,
  definition: spec.definition ?? "",
  requires: Object.freeze([...spec.requires ?? []]),
  concepts: Object.freeze([...spec.concepts]),
  codeLists: Object.freeze([...spec.codeLists ?? []])
}), moduleOf = (d, requires = []) => defineModule({ name: d.name, definition: d.definition, requires, concepts: d.concepts, codeLists: d.codeLists });
var init_module = __esm(() => {
  init_mod();
  init_model();
});

// governance/datatype.ts
var text = (options = {}) => Object.freeze(options.max === undefined ? { kind: "text" } : { kind: "text", max: options.max }), integer3 = () => Object.freeze({ kind: "integer" }), boolean2 = () => Object.freeze({ kind: "boolean" }), date = () => Object.freeze({ kind: "date" }), instant = () => Object.freeze({ kind: "instant" }), identifier = () => Object.freeze({ kind: "identifier" }), codeOf2 = (list) => Object.freeze({ kind: "code", list }), structured = () => Object.freeze({ kind: "structured" }), binary = () => Object.freeze({ kind: "binary" });
var init_datatype = __esm(() => {
  init_mod();
});

// governance/elements.ts
function elementsOf(d) {
  const out = [{ id: domainId(d.name), kind: "domain", name: d.name, definition: d.definition, annotations: d.annotations }];
  for (const c of d.concepts) {
    const cid = conceptId(d.name, c.name);
    out.push({ id: cid, kind: "concept", name: c.name, definition: c.definition, parent: domainId(d.name), annotations: c.annotations });
    for (const [key, a] of Object.entries(c.attributes)) {
      out.push({
        id: attributeId(d.name, c.name, key),
        kind: "attribute",
        name: key,
        definition: a.definition,
        parent: cid,
        annotations: a.annotations
      });
    }
    for (const [key, r] of Object.entries(c.relationships)) {
      out.push({
        id: relationshipId(d.name, c.name, key),
        kind: "relationship",
        name: key,
        definition: r.definition,
        parent: cid,
        annotations: r.annotations
      });
    }
  }
  for (const l of d.codeLists) {
    const lid = codeListId(d.name, l.name);
    out.push({ id: lid, kind: "codelist", name: l.name, definition: l.definition, parent: domainId(d.name), annotations: l.annotations });
    for (const [key, code] of Object.entries(l.codes)) {
      out.push({
        id: codeId(d.name, l.name, key),
        kind: "code",
        name: key,
        definition: code.definition ?? code.label,
        parent: lid,
        annotations: []
      });
    }
  }
  return out;
}
var init_elements = __esm(() => {
  init_id();
  init_model();
});

// engine/handle.ts
var init_handle = __esm(() => {
  init_mod();
});

// engine/manifest.ts
function contribute(p, value) {
  return Object.freeze({ point: p.name, value });
}
function defineExtension(input) {
  return Object.freeze({
    id: input.id,
    version: input.version,
    contract: input.contract ?? CONTRACT,
    requires: Object.freeze([...input.requires ?? []]),
    contributes: Object.freeze([...input.contributes ?? []]),
    uses: Object.freeze([...input.uses ?? []]),
    ...input.activate === undefined ? {} : { activate: input.activate }
  });
}
var CONTRACT = 1;

// engine/compose.ts
var init_compose = __esm(() => {
  init_mod();
  init_handle();
});

// engine/id.ts
function extensionId(text) {
  return ID.test(text) ? ok(text) : err({ kind: "id", text });
}
var ID;
var init_id2 = __esm(() => {
  init_mod();
  ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
});

// engine/point.ts
function point(name) {
  return Object.freeze({ name });
}

// engine/api.ts
var init_api = __esm(() => {
  init_compose();
  init_handle();
  init_id2();
});

// governance/vocabulary.ts
var finding2 = (rule, element, message, severity = "warning") => ({
  rule,
  element,
  message,
  severity
}), vocabularyPoint;
var init_vocabulary = __esm(() => {
  init_api();
  init_mod();
  vocabularyPoint = point("governance.vocabulary");
});

// governance/lint.ts
var init_lint = __esm(() => {
  init_elements();
  init_vocabulary();
});

// governance/vocabularies/dpv.auto.ts
var PD_NAMESPACE = "https://w3id.org/dpv/pd#", pd;
var init_dpv_auto = __esm(() => {
  pd = {
    Accent: { label: "Accent", kind: "PersonalData" },
    AccountIdentifier: { label: "Account Identifier", kind: "PersonalData" },
    Acquaintance: { label: "Acquaintance", kind: "PersonalData" },
    Age: { label: "Age", kind: "PersonalData" },
    AgeExact: { label: "Age Exact", kind: "PersonalData" },
    AgeRange: { label: "Age Range", kind: "PersonalData" },
    ApartmentOwned: { label: "Apartment Owned", kind: "PersonalData" },
    Association: { label: "Association", kind: "PersonalData" },
    Attitude: { label: "Attitude", kind: "PersonalData" },
    Authenticating: { label: "Authenticating", kind: "PersonalData" },
    AuthenticationHistory: { label: "Authentication History", kind: "PersonalData" },
    BankAccount: { label: "Bank Account", kind: "PersonalData" },
    Behavioural: { label: "Behavioural", kind: "PersonalData" },
    Biometric: { label: "Biometric", kind: "SpecialCategoryPersonalData" },
    BirthCountry: { label: "Birth Country", kind: "PersonalData" },
    BirthDate: { label: "Birth Date", kind: "PersonalData" },
    BirthPlace: { label: "Birth Place", kind: "PersonalData" },
    BloodType: { label: "Blood Type", kind: "SpecialCategoryPersonalData" },
    BrowserFingerprint: { label: "Browser Fingerprint", kind: "PersonalData" },
    BrowserHistory: { label: "Browser History", kind: "PersonalData" },
    BrowsingBehaviour: { label: "Browsing Behaviour", kind: "PersonalData" },
    BrowsingReferral: { label: "Browsing Referral", kind: "PersonalData" },
    CallLog: { label: "Call Log", kind: "PersonalData" },
    CarOwned: { label: "Car Owned", kind: "PersonalData" },
    Character: { label: "Character", kind: "PersonalData" },
    Citizenship: { label: "Citizenship", kind: "PersonalData" },
    City: { label: "City", kind: "PersonalData" },
    Communication: { label: "Communication", kind: "PersonalData" },
    CommunicationsMetadata: { label: "Communications Metadata", kind: "PersonalData" },
    Connection: { label: "Connection", kind: "PersonalData" },
    Contact: { label: "Contact", kind: "PersonalData" },
    Country: { label: "Country", kind: "PersonalData" },
    Credit: { label: "Credit", kind: "PersonalData" },
    CreditCapacity: { label: "Credit Capacity", kind: "PersonalData" },
    CreditCardNumber: { label: "Credit Card Number", kind: "PersonalData" },
    CreditRecord: { label: "Credit Record", kind: "PersonalData" },
    CreditScore: { label: "Credit Score", kind: "PersonalData" },
    CreditStanding: { label: "Credit Standing", kind: "PersonalData" },
    CreditWorthiness: { label: "Credit Worthiness", kind: "PersonalData" },
    Criminal: { label: "Criminal", kind: "PersonalData" },
    CriminalCharge: { label: "Criminal Charge", kind: "PersonalData" },
    CriminalConviction: { label: "Criminal Conviction", kind: "PersonalData" },
    CriminalOffence: { label: "Criminal Offence", kind: "PersonalData" },
    CriminalPardon: { label: "Criminal Pardon", kind: "PersonalData" },
    CurrentEmployment: { label: "Current Employment", kind: "PersonalData" },
    CurrentLocation: { label: "Current Location", kind: "PersonalData" },
    DNACode: { label: "DNA Code", kind: "SpecialCategoryPersonalData" },
    Demeanour: { label: "Demeanour", kind: "PersonalData" },
    Demographic: { label: "Demographic", kind: "PersonalData" },
    DeviceApplications: { label: "Device Applications", kind: "PersonalData" },
    DeviceBased: { label: "Device Based", kind: "PersonalData" },
    DeviceOperatingSystem: { label: "Device Operating System", kind: "PersonalData" },
    DeviceSoftware: { label: "Device Software", kind: "PersonalData" },
    Dialect: { label: "Dialect", kind: "PersonalData" },
    DigitalFingerprint: { label: "Digital Fingerprint", kind: "PersonalData" },
    Disability: { label: "Disability", kind: "SpecialCategoryPersonalData" },
    DisciplinaryAction: { label: "Disciplinary Action", kind: "PersonalData" },
    Dislike: { label: "Dislike", kind: "PersonalData" },
    Divorce: { label: "Divorce", kind: "PersonalData" },
    Domicile: { label: "Domicile", kind: "PersonalData" },
    DrugTestResult: { label: "Drug Test Result", kind: "SpecialCategoryPersonalData" },
    Education: { label: "Education", kind: "PersonalData" },
    EducationExperience: { label: "Education Experience", kind: "PersonalData" },
    EducationQualification: { label: "Education Qualification", kind: "PersonalData" },
    EducationTraining: { label: "Education Training", kind: "PersonalData" },
    EmailAddress: { label: "Email Address", kind: "PersonalData" },
    EmailAddressPersonal: { label: "Email Address Personal", kind: "PersonalData" },
    EmailAddressWork: { label: "Email Address Work", kind: "PersonalData" },
    EmailContent: { label: "Email Content", kind: "PersonalData" },
    Emotion: { label: "Emotion", kind: "PersonalData" },
    EmploymentHistory: { label: "Employment History", kind: "PersonalData" },
    EthnicOrigin: { label: "Ethnic Origin", kind: "SpecialCategoryPersonalData" },
    Ethnicity: { label: "Ethnicity", kind: "PersonalData" },
    External: { label: "External", kind: "PersonalData" },
    FacialExpression: { label: "Facial Expression", kind: "SpecialCategoryPersonalData" },
    FacialPrint: { label: "Facial Print", kind: "SpecialCategoryPersonalData" },
    Family: { label: "Family", kind: "PersonalData" },
    FamilyHealthHistory: { label: "Family Health History", kind: "SpecialCategoryPersonalData" },
    FamilyStructure: { label: "Family Structure", kind: "PersonalData" },
    Favourite: { label: "Favourite", kind: "PersonalData" },
    FavouriteColour: { label: "Favourite Colour", kind: "PersonalData" },
    FavouriteFood: { label: "Favourite Food", kind: "PersonalData" },
    FavouriteMusic: { label: "Favourite Music", kind: "PersonalData" },
    Fetish: { label: "Fetish", kind: "SpecialCategoryPersonalData" },
    Financial: { label: "Financial", kind: "PersonalData" },
    FinancialAccount: { label: "Financial Account", kind: "PersonalData" },
    FinancialAccountNumber: { label: "Financial Account Number", kind: "PersonalData" },
    FinancialStatus: { label: "Financial Status", kind: "PersonalData" },
    Fingerprint: { label: "Fingerprint", kind: "SpecialCategoryPersonalData" },
    Friend: { label: "Friend", kind: "PersonalData" },
    GPSCoordinate: { label: "GPS Coordinate", kind: "PersonalData" },
    Gender: { label: "Gender", kind: "PersonalData" },
    GeneralReputation: { label: "General Reputation", kind: "PersonalData" },
    Genetic: { label: "Genetic", kind: "SpecialCategoryPersonalData" },
    Geographic: { label: "Geographic", kind: "PersonalData" },
    GroupMembership: { label: "Group Membership", kind: "PersonalData" },
    GroupProfile: { label: "Group Profile", kind: "PersonalData" },
    HairColour: { label: "Hair Colour", kind: "PersonalData" },
    Health: { label: "Health", kind: "SpecialCategoryPersonalData" },
    HealthHistory: { label: "Health History", kind: "SpecialCategoryPersonalData" },
    HealthRecord: { label: "Health Record", kind: "SpecialCategoryPersonalData" },
    Height: { label: "Height", kind: "PersonalData" },
    Historical: { label: "Historical", kind: "PersonalData" },
    HomeLocation: { label: "Home Place", kind: "PersonalData" },
    HouseNumber: { label: "House Number", kind: "PersonalData" },
    HouseOwned: { label: "House Owned", kind: "PersonalData" },
    Household: { label: "Household", kind: "PersonalData" },
    IPAddress: { label: "IP Address", kind: "PersonalData" },
    Identifier: { label: "Identifier", kind: "PersonalData" },
    Identifying: { label: "Identifying", kind: "PersonalData" },
    Income: { label: "Income", kind: "PersonalData" },
    IncomeBracket: { label: "Income Bracket", kind: "PersonalData" },
    IndividualHealthHistory: { label: "Individual Health History", kind: "SpecialCategoryPersonalData" },
    IndividualProfile: { label: "Individual Profile", kind: "PersonalData" },
    Insurance: { label: "Insurance", kind: "PersonalData" },
    Intention: { label: "Intention", kind: "PersonalData" },
    Interaction: { label: "Interaction", kind: "PersonalData" },
    Interest: { label: "Interest", kind: "PersonalData" },
    Internal: { label: "Internal", kind: "PersonalData" },
    Job: { label: "Job", kind: "PersonalData" },
    KnowledgeBelief: { label: "Knowledge and Beliefs", kind: "PersonalData" },
    Language: { label: "Language", kind: "PersonalData" },
    LifeHistory: { label: "Life History", kind: "PersonalData" },
    Like: { label: "Like", kind: "PersonalData" },
    LinkClicked: { label: "Link Clicked", kind: "PersonalData" },
    LoanRecord: { label: "Loan Record", kind: "PersonalData" },
    Locality: { label: "Locality", kind: "PersonalData" },
    Location: { label: "Location", kind: "PersonalData" },
    MACAddress: { label: "MAC Address", kind: "PersonalData" },
    MaritalStatus: { label: "Marital Status", kind: "PersonalData" },
    Marriage: { label: "Marriage", kind: "PersonalData" },
    MedicalHealth: { label: "Medical Health", kind: "SpecialCategoryPersonalData" },
    MentalHealth: { label: "Mental Health", kind: "SpecialCategoryPersonalData" },
    Mood: { label: "Mood", kind: "PersonalData" },
    Name: { label: "Name", kind: "PersonalData" },
    Nationality: { label: "Nationality", kind: "PersonalData" },
    OfficialID: { label: "Official ID", kind: "PersonalData" },
    Offspring: { label: "Offspring", kind: "PersonalData" },
    Opinion: { label: "Opinion", kind: "PersonalData" },
    Ownership: { label: "Ownership", kind: "PersonalData" },
    PINCode: { label: "PIN Code", kind: "PersonalData" },
    Parent: { label: "Parent", kind: "PersonalData" },
    Passport: { label: "Passport", kind: "PersonalData" },
    Password: { label: "Password", kind: "PersonalData" },
    PastEmployment: { label: "Past Employment", kind: "PersonalData" },
    PaymentCard: { label: "Payment Card", kind: "PersonalData" },
    PaymentCardExpiry: { label: "Payment Card Expiry", kind: "PersonalData" },
    PaymentCardNumber: { label: "Payment Card Number", kind: "PersonalData" },
    PerformanceAtWork: { label: "Performance at Work", kind: "PersonalData" },
    PersonalDocuments: { label: "Personal Documents", kind: "PersonalData" },
    PersonalPossession: { label: "Personal Possession", kind: "PersonalData" },
    Personality: { label: "Personality", kind: "PersonalData" },
    PhilosophicalBelief: { label: "Philosophical Belief", kind: "SpecialCategoryPersonalData" },
    PhysicalAddress: { label: "Physical Address", kind: "PersonalData" },
    PhysicalCharacteristic: { label: "Physical Characteristic", kind: "PersonalData" },
    PhysicalHealth: { label: "Physical Health", kind: "SpecialCategoryPersonalData" },
    PhysicalTrait: { label: "Physical Trait", kind: "PersonalData" },
    Picture: { label: "Picture", kind: "PersonalData" },
    Piercing: { label: "Piercing", kind: "PersonalData" },
    PoliticalAffiliation: { label: "Political Affiliation", kind: "SpecialCategoryPersonalData" },
    PoliticalOpinion: { label: "Political Opinion", kind: "SpecialCategoryPersonalData" },
    PostalCode: { label: "Postal Code", kind: "PersonalData" },
    Preference: { label: "Preference", kind: "PersonalData" },
    Prescription: { label: "Prescription", kind: "SpecialCategoryPersonalData" },
    PrivacyPreference: { label: "Privacy Preference", kind: "PersonalData" },
    Proclivity: { label: "Proclivity", kind: "SpecialCategoryPersonalData" },
    Professional: { label: "Professional", kind: "PersonalData" },
    ProfessionalCertification: { label: "Professional Certification", kind: "PersonalData" },
    ProfessionalEvaluation: { label: "Professional Evaluation", kind: "PersonalData" },
    ProfessionalExperience: { label: "Professional Experience", kind: "PersonalData" },
    ProfessionalInterview: { label: "Professional Interview", kind: "PersonalData" },
    ProfessionalTraining: { label: "Professional Training", kind: "PersonalData" },
    Profile: { label: "Profile", kind: "PersonalData" },
    PublicLife: { label: "Public Life", kind: "PersonalData" },
    PubliclyAvailableSocialMedia: { label: "Publicly Available Social Media", kind: "PersonalData" },
    Purchase: { label: "Purchase", kind: "PersonalData" },
    PurchasesAndSpendingHabit: { label: "Purchases and Spending Habit", kind: "PersonalData" },
    Race: { label: "Race", kind: "SpecialCategoryPersonalData" },
    Reference: { label: "Reference", kind: "PersonalData" },
    Region: { label: "Region", kind: "PersonalData" },
    Relationship: { label: "Relationship", kind: "PersonalData" },
    Reliability: { label: "Reliability", kind: "PersonalData" },
    Religion: { label: "Religion", kind: "SpecialCategoryPersonalData" },
    ReligiousBelief: { label: "Religious Belief", kind: "SpecialCategoryPersonalData" },
    Residency: { label: "Residency", kind: "PersonalData" },
    Retina: { label: "Retina", kind: "SpecialCategoryPersonalData" },
    RoomNumber: { label: "Room Number", kind: "PersonalData" },
    Salary: { label: "Salary", kind: "PersonalData" },
    Sale: { label: "Sale", kind: "PersonalData" },
    School: { label: "School", kind: "PersonalData" },
    SecretText: { label: "Secret Text", kind: "PersonalData" },
    ServiceConsumptionBehaviour: { label: "Service Consumption Behaviour", kind: "PersonalData" },
    Sexual: { label: "Sexual", kind: "SpecialCategoryPersonalData" },
    SexualHistory: { label: "Sexual History", kind: "SpecialCategoryPersonalData" },
    SexualPreference: { label: "Sexual Preference", kind: "SpecialCategoryPersonalData" },
    Sibling: { label: "Sibling", kind: "PersonalData" },
    SkinTone: { label: "Skin Tone", kind: "PersonalData" },
    Social: { label: "Social", kind: "PersonalData" },
    SocialBehaviour: { label: "Social Behaviour", kind: "PersonalData" },
    SocialMedia: { label: "Social Media", kind: "PersonalData" },
    SocialMediaCommunication: { label: "Social Media Communication", kind: "PersonalData" },
    SocialNetwork: { label: "Social Network", kind: "PersonalData" },
    SocialStatus: { label: "Social Status", kind: "PersonalData" },
    Street: { label: "Street", kind: "PersonalData" },
    TVViewingBehaviour: { label: "TV Viewing Behaviour", kind: "PersonalData" },
    Tattoo: { label: "Tattoo", kind: "PersonalData" },
    Tax: { label: "Tax", kind: "PersonalData" },
    TechnicalKnowledge: { label: "Technical Knowledge", kind: "PersonalData" },
    TelephoneNumber: { label: "Telephone Number", kind: "PersonalData" },
    Thought: { label: "Thought", kind: "PersonalData" },
    Tracking: { label: "Tracking", kind: "PersonalData" },
    TradeUnionMembership: { label: "Trade Union Membership", kind: "SpecialCategoryPersonalData" },
    Transaction: { label: "Transaction", kind: "PersonalData" },
    Transactional: { label: "Transactional", kind: "PersonalData" },
    TravelHistory: { label: "Travel History", kind: "PersonalData" },
    UID: { label: "UID", kind: "PersonalData" },
    UserAgent: { label: "User agent", kind: "PersonalData" },
    Username: { label: "Username", kind: "PersonalData" },
    VehicalLicenseNumber: { label: "Vehicle License Number", kind: "PersonalData" },
    VehicalLicenseRegistration: { label: "Vehicle License Registration", kind: "PersonalData" },
    Vehicle: { label: "Vehicle", kind: "PersonalData" },
    VehicleLicense: { label: "Vehicle License", kind: "PersonalData" },
    VehicleUsage: { label: "Vehicle Usage", kind: "PersonalData" },
    VoiceCommunicationRecording: { label: "Voice Communication Recording", kind: "PersonalData" },
    VoiceMail: { label: "Voice Mail", kind: "PersonalData" },
    Vulnerability: { label: "Vulnerability", kind: "SensitivePersonalData" },
    Weight: { label: "Weight", kind: "PersonalData" },
    WorkEnvironment: { label: "Work Environment", kind: "PersonalData" },
    WorkExperience: { label: "Work Experience", kind: "PersonalData" },
    WorkHistory: { label: "Work History", kind: "PersonalData" },
    WorkLocation: { label: "Work Place", kind: "PersonalData" }
  };
});

// governance/vocabularies/privacy.ts
var exports_privacy = {};
__export(exports_privacy, {
  dpvClassOf: () => dpvClassOf,
  dpvIri: () => dpvIri,
  pd: () => pd,
  personal: () => personal,
  vocabulary: () => vocabulary2
});
var personal, dpvClassOf = (term) => pd[term].kind, dpvIri = (term) => `${PD_NAMESPACE}${term}`, vocabulary2;
var init_privacy = __esm(() => {
  init_elements();
  init_dpv_auto();
  init_vocabulary();
  init_dpv_auto();
  personal = annotationKind("privacy.personal", ["concept", "attribute"]);
  vocabulary2 = {
    id: "privacy",
    kinds: [personal],
    rules: [
      {
        id: "privacy/category-missing",
        describe: "Personal data that names no category of DPV-PD.",
        check: (d) => elementsOf(d).filter((e) => annotationsOf(e, personal).some((p) => p.category === undefined)).map((e) => finding2("privacy/category-missing", e.id, `${e.name} holds personal data and names no category of DPV-PD`))
      },
      {
        id: "privacy/purpose-missing",
        describe: "Personal data held for no stated purpose.",
        check: (d) => elementsOf(d).filter((e) => annotationsOf(e, personal).some((p) => (p.purposes ?? []).length === 0)).map((e) => finding2("privacy/purpose-missing", e.id, `${e.name} holds personal data and states no purpose for it`))
      }
    ]
  };
});

// governance/vocabularies/security.ts
var exports_security = {};
__export(exports_security, {
  RANK: () => RANK,
  access: () => access,
  classification: () => classification,
  mask: () => mask,
  scope: () => scope2,
  vocabulary: () => vocabulary3
});
var classification, access, scope2, mask, RANK, classOf = (e) => annotationsOf(e, classification)[0], vocabulary3;
var init_security = __esm(() => {
  init_elements();
  init_privacy();
  init_vocabulary();
  classification = annotationKind("security.classification", [
    "domain",
    "concept",
    "attribute",
    "relationship",
    "codelist"
  ]);
  access = annotationKind("security.access", ["concept", "attribute"]);
  scope2 = annotationKind("security.scope", ["attribute"]);
  mask = annotationKind("security.mask", ["attribute"]);
  RANK = { public: 0, internal: 1, confidential: 2, restricted: 3 };
  vocabulary3 = {
    id: "security",
    kinds: [classification, access, scope2, mask],
    rules: [
      {
        id: "security/scope-multiple",
        describe: "A concept with more than one attribute that partitions its data.",
        check: (d) => elementsOf(d).filter((e) => e.kind === "concept").flatMap((c) => {
          const scoped = elementsOf(d).filter((e) => e.parent === c.id && annotationsOf(e, scope2).length > 0);
          return scoped.length > 1 ? [
            finding2("security/scope-multiple", c.id, `the concept ${c.name} has ${scoped.length} scopes: ${scoped.map((s) => s.name).join(", ")}`, "error")
          ] : [];
        })
      },
      {
        id: "security/restricted-no-access",
        describe: "Restricted data that says nobody may read or write it.",
        check: (d) => {
          const all = elementsOf(d);
          return all.filter((e) => classOf(e) === "restricted").filter((e) => annotationsOf(e, access).length === 0 && !(all.find((p) => p.id === e.parent) ?? { annotations: [] }).annotations.some((a) => a.kind === access.name)).map((e) => finding2("security/restricted-no-access", e.id, `${e.name} is restricted and has no access rule, on itself or on its concept`));
        }
      },
      {
        id: "security/personal-unprotected",
        describe: "Personal data that is not classified confidential or restricted.",
        check: (d) => {
          const all = elementsOf(d);
          return all.filter((e) => annotationsOf(e, personal).length > 0).filter((e) => {
            const own = classOf(e) ?? classOf(all.find((p) => p.id === e.parent) ?? { annotations: [] });
            return own === undefined || RANK[own] < RANK.confidential;
          }).map((e) => finding2("security/personal-unprotected", e.id, `${e.name} holds personal data and is not classified confidential or restricted`));
        }
      }
    ]
  };
});

// governance/operation.ts
function operation(name, spec) {
  const input = Object.fromEntries(Object.entries(spec.input).map(([k, v]) => [k, Object.freeze(typeof v === "string" ? { type: v, optional: false } : { type: v.type, optional: v.optional ?? false })]));
  return Object.freeze({
    kind: "operation",
    name,
    spec: Object.freeze({ ...spec, writes: spec.writes ?? [], emits: spec.emits ?? [] }),
    input: Object.freeze(input)
  });
}
var init_operation = __esm(() => {
  init_id();
  init_vocabulary();
  init_security();
});

// governance/vocabularies/docs.ts
var exports_docs = {};
__export(exports_docs, {
  example: () => example,
  note: () => note,
  synonym: () => synonym,
  vocabulary: () => vocabulary4
});
var synonym, example, note, vocabulary4;
var init_docs = __esm(() => {
  synonym = annotationKind("docs.synonym", ["concept", "attribute", "codelist"]);
  example = annotationKind("docs.example", ["concept", "attribute"]);
  note = annotationKind("docs.note", ["domain", "concept", "attribute", "relationship", "codelist"]);
  vocabulary4 = { id: "docs", kinds: [synonym, example, note], rules: [] };
});

// governance/vocabularies/lifecycle.ts
var exports_lifecycle = {};
__export(exports_lifecycle, {
  renamedFrom: () => renamedFrom,
  since: () => since,
  vocabulary: () => vocabulary5
});
var renamedFrom, since, vocabulary5;
var init_lifecycle = __esm(() => {
  init_elements();
  init_names();
  init_vocabulary();
  renamedFrom = annotationKind("lifecycle.renamedFrom", ["concept", "attribute"]);
  since = annotationKind("lifecycle.since", ["concept", "attribute", "relationship", "codelist"]);
  vocabulary5 = {
    id: "lifecycle",
    kinds: [renamedFrom, since],
    rules: [
      {
        id: "lifecycle/renamed-from-name",
        describe: "A `renamedFrom` that is not a name, or is the element's own.",
        check: (d) => elementsOf(d).flatMap((e) => annotationsOf(e, renamedFrom).flatMap((old) => !NAME.test(old) ? [
          finding2("lifecycle/renamed-from-name", e.id, `${e.name} was renamed from ${JSON.stringify(old)}, which is not a name`, "error")
        ] : old === e.name ? [finding2("lifecycle/renamed-from-name", e.id, `${e.name} was renamed from itself`, "error")] : []))
      }
    ]
  };
});

// governance/vocabularies/ownership.ts
var exports_ownership = {};
__export(exports_ownership, {
  owner: () => owner,
  steward: () => steward,
  vocabulary: () => vocabulary6
});
var owner, steward, vocabulary6;
var init_ownership = __esm(() => {
  init_elements();
  init_vocabulary();
  owner = annotationKind("ownership.owner", ["domain", "concept", "codelist"]);
  steward = annotationKind("ownership.steward", ["domain", "concept", "codelist"]);
  vocabulary6 = {
    id: "ownership",
    kinds: [owner, steward],
    rules: [
      {
        id: "ownership/owner-missing",
        describe: "A concept with no owner where its domain has none.",
        check: (d) => {
          const all = elementsOf(d);
          const domainOwned = all.some((e) => e.kind === "domain" && annotationsOf(e, owner).length > 0);
          return domainOwned ? [] : all.filter((e) => e.kind === "concept" && annotationsOf(e, owner).length === 0).map((e) => finding2("ownership/owner-missing", e.id, `the concept ${e.name} has no owner, and its domain has none`));
        }
      }
    ]
  };
});

// governance/vocabularies/quality.ts
var exports_quality = {};
__export(exports_quality, {
  appendOnly: () => appendOnly,
  atMost: () => atMost,
  audited: () => audited,
  defaultValue: () => defaultValue,
  deprecated: () => deprecated,
  differs: () => differs,
  openness: () => openness,
  pattern: () => pattern,
  range: () => range2,
  retention: () => retention,
  transitions: () => transitions,
  unique: () => unique,
  vocabulary: () => vocabulary7
});
function defaultFindings(domain, c) {
  const out = [];
  for (const [key, a] of Object.entries(c.attributes)) {
    for (const v of annotationsOf(a, defaultValue)) {
      const t = a.type;
      const at = attributeId(domain, c.name, key);
      const bad = (why) => void out.push(finding2("quality/default-invalid", at, `the default ${JSON.stringify(v)} of ${key} ${why}`, "error"));
      switch (t.kind) {
        case "text":
        case "identifier":
        case "date":
        case "instant":
          if (typeof v !== "string")
            bad("is not text");
          break;
        case "integer":
          if (typeof v !== "number" || !Number.isInteger(v))
            bad("is not a whole number");
          break;
        case "decimal":
          if (typeof v !== "number")
            bad("is not a number");
          break;
        case "boolean":
          if (typeof v !== "boolean")
            bad("is not true or false");
          break;
        case "code":
          if (typeof v !== "string" || !(v in t.list.codes))
            bad(`is not a code of ${t.list.name}`);
          break;
        case "structured":
        case "binary":
        case "vector":
          bad("is not possible for this datatype");
          break;
        default:
          return absurd(t);
      }
    }
  }
  return out;
}
var pattern, range2, retention, deprecated, defaultValue, unique, differs, audited, appendOnly, transitions, atMost, openness, valid = (source) => {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}, vocabulary7;
var init_quality = __esm(() => {
  init_mod();
  init_elements();
  init_id();
  init_model();
  init_vocabulary();
  pattern = annotationKind("quality.pattern", ["attribute"]);
  range2 = annotationKind("quality.range", ["attribute"]);
  retention = annotationKind("quality.retention", ["concept", "attribute"]);
  deprecated = annotationKind("quality.deprecated", ["concept", "attribute", "relationship", "codelist"]);
  defaultValue = annotationKind("quality.default", ["attribute"]);
  unique = annotationKind("quality.unique", ["concept"]);
  differs = annotationKind("quality.differs", ["concept"]);
  audited = annotationKind("quality.audited", ["domain", "concept"]);
  appendOnly = annotationKind("quality.appendOnly", ["concept"]);
  transitions = annotationKind("quality.transitions", ["attribute"]);
  atMost = annotationKind("quality.atMost", ["concept"]);
  openness = annotationKind("quality.openness", ["codelist"]);
  vocabulary7 = {
    id: "quality",
    kinds: [pattern, range2, retention, deprecated, defaultValue, unique, differs, audited, openness, appendOnly, transitions, atMost],
    rules: [
      {
        id: "quality/pattern-invalid",
        describe: "A pattern that is not a regular expression.",
        check: (d) => elementsOf(d).flatMap((e) => annotationsOf(e, pattern).filter((p) => !valid(p)).map((p) => finding2("quality/pattern-invalid", e.id, `"${p}" is not a regular expression`, "error")))
      },
      {
        id: "quality/range-inverted",
        describe: "A range whose minimum is above its maximum.",
        check: (d) => elementsOf(d).flatMap((e) => annotationsOf(e, range2).filter((r) => r.min !== undefined && r.max !== undefined && r.min > r.max).map((r) => finding2("quality/range-inverted", e.id, `the minimum ${r.min} is above the maximum ${r.max}`, "error")))
      },
      {
        id: "quality/retention-invalid",
        describe: "A retention that is not a positive whole number of days.",
        check: (d) => elementsOf(d).flatMap((e) => annotationsOf(e, retention).filter((r) => !Number.isInteger(r.days) || r.days <= 0).map((r) => finding2("quality/retention-invalid", e.id, `${r.days} is not a positive whole number of days`, "error")))
      },
      {
        id: "quality/member-unknown",
        describe: "A member named in unique or differs that the concept does not have.",
        check: (d) => d.concepts.flatMap((c) => {
          const has = new Set(membersOf(c));
          const named = [...annotationsOf(c, unique).flatMap((u) => u.members), ...annotationsOf(c, differs).flatMap((x) => x.members)];
          return named.filter((m) => !has.has(m)).map((m) => finding2("quality/member-unknown", conceptId(d.name, c.name), `the concept ${c.name} has no member ${m}`, "error"));
        })
      },
      {
        id: "quality/invariant-member-unknown",
        describe: "A member named in appendOnly's chain or in atMost that the concept does not have, or a transition between codes that the attribute's list does not have.",
        check: (d) => d.concepts.flatMap((c) => {
          const has = new Set(membersOf(c));
          const out = [];
          const at = conceptId(d.name, c.name);
          for (const a of annotationsOf(c, appendOnly))
            if (a.chain !== undefined) {
              for (const m of [a.chain.hash, a.chain.previous, a.chain.sequence])
                if (!has.has(m))
                  out.push(finding2("quality/invariant-member-unknown", at, `the chain of ${c.name} names ${m}, which it does not have`, "error"));
            }
          for (const a of annotationsOf(c, atMost))
            for (const m of [a.member, a.other])
              if (!has.has(m))
                out.push(finding2("quality/invariant-member-unknown", at, `atMost of ${c.name} names ${m}, which it does not have`, "error"));
          for (const [key, attr] of Object.entries(c.attributes))
            for (const tr of annotationsOf(attr, transitions)) {
              if (attr.type.kind !== "code") {
                out.push(finding2("quality/invariant-member-unknown", attributeId(d.name, c.name, key), `transitions are for a code attribute, and ${key} is not one`, "error"));
                continue;
              }
              const codes = new Set(Object.keys(attr.type.list.codes));
              for (const [from, tos] of Object.entries(tr.allowed))
                for (const code of [from, ...tos])
                  if (!codes.has(code))
                    out.push(finding2("quality/invariant-member-unknown", attributeId(d.name, c.name, key), `${code} is not a code of the list of ${key}`, "error"));
            }
          return out;
        })
      },
      {
        id: "quality/default-invalid",
        describe: "A default that does not fit its attribute's datatype, or is not a code of its list.",
        check: (d) => d.concepts.flatMap((c) => defaultFindings(d.name, c))
      },
      {
        id: "quality/deprecated-no-replacement",
        describe: "An element deprecated with nothing to replace it.",
        check: (d) => elementsOf(d).filter((e) => annotationsOf(e, deprecated).some((x) => x.replacedBy === undefined)).map((e) => finding2("quality/deprecated-no-replacement", e.id, `${e.name} is deprecated and names no replacement`))
      }
    ]
  };
});

// governance/vocabularies/requirements.ts
var exports_requirements = {};
__export(exports_requirements, {
  CITATION: () => CITATION,
  cites: () => cites,
  requirementsOf: () => requirementsOf,
  vocabulary: () => vocabulary8
});
function requirementsOf(d) {
  const out = new Map;
  for (const e of elementsOf(d)) {
    for (const list of annotationsOf(e, cites))
      for (const c of list)
        out.set(c, [...out.get(c) ?? [], e.id]);
  }
  return out;
}
var cites, CITATION, vocabulary8;
var init_requirements = __esm(() => {
  init_elements();
  init_vocabulary();
  cites = annotationKind("requirements.cites", [
    "domain",
    "concept",
    "attribute",
    "relationship",
    "codelist"
  ]);
  CITATION = /^\d{4}-[a-z][a-z0-9]*(?:-[a-z0-9]+)* FR-\d{3}$/;
  vocabulary8 = {
    id: "requirements",
    kinds: [cites],
    rules: [
      {
        id: "requirements/uncited",
        describe: "A concept that cites no requirement.",
        check: (d) => elementsOf(d).filter((e) => e.kind === "concept" && annotationsOf(e, cites).flat().length === 0).map((e) => finding2("requirements/uncited", e.id, `the concept ${e.name} cites no requirement`))
      },
      {
        id: "requirements/malformed",
        describe: "A citation that is not of the form NNNN-slug FR-nnn.",
        check: (d) => elementsOf(d).flatMap((e) => annotationsOf(e, cites).flat().filter((c) => !CITATION.test(c)).map((c) => finding2("requirements/malformed", e.id, `"${c}" is not of the form NNNN-slug FR-nnn`, "error")))
      }
    ]
  };
});

// governance/vocabularies/usage.ts
var exports_usage = {};
__export(exports_usage, {
  lookup: () => lookup,
  vocabulary: () => vocabulary9
});
var lookup, vocabulary9;
var init_usage = __esm(() => {
  init_id();
  init_model();
  init_vocabulary();
  lookup = annotationKind("usage.lookup", ["concept"]);
  vocabulary9 = {
    id: "usage",
    kinds: [lookup],
    rules: [
      {
        id: "usage/member-unknown",
        describe: "A lookup that names a member the concept does not have.",
        check: (d) => d.concepts.flatMap((c) => {
          const has = new Set(membersOf(c));
          return annotationsOf(c, lookup).flatMap((l) => l.members).filter((m) => !has.has(m)).map((m) => finding2("usage/member-unknown", conceptId(d.name, c.name), `a lookup of the concept ${c.name} names ${m}, which it does not have`, "error"));
        })
      }
    ]
  };
});

// governance/vocabularies/mod.ts
var exports_mod = {};
__export(exports_mod, {
  defaultVocabularies: () => defaultVocabularies,
  docs: () => exports_docs,
  lifecycle: () => exports_lifecycle,
  ownership: () => exports_ownership,
  privacy: () => exports_privacy,
  quality: () => exports_quality,
  requirements: () => exports_requirements,
  security: () => exports_security,
  usage: () => exports_usage
});
var defaultVocabularies;
var init_mod2 = __esm(() => {
  init_docs();
  init_lifecycle();
  init_ownership();
  init_privacy();
  init_quality();
  init_requirements();
  init_security();
  init_usage();
  defaultVocabularies = [
    vocabulary4,
    vocabulary8,
    vocabulary2,
    vocabulary3,
    vocabulary6,
    vocabulary7,
    vocabulary9,
    vocabulary5
  ];
});

// governance/api.ts
var init_api2 = __esm(() => {
  init_issue();
  init_module();
  init_datatype();
  init_elements();
  init_id();
  init_lint();
  init_operation();
  init_names();
  init_model();
  init_vocabulary();
  init_mod2();
  init_mod2();
});

// sql/logical/schema.ts
function carriedOf(element, kind) {
  return annotationsOf({ annotations: element.governance }, kind);
}
var made2 = (text) => text, schemaId = (domain) => made2(`schema:${domain}`), tableId = (table) => made2(`table:${table.join(".")}`), columnId = (table, column) => made2(`column:${table.join(".")}/${column.join(".")}`), valueSetId = (name) => made2(`valueset:${name.join(".")}`), constraintId = (kind, name) => made2(`${kind}:${name.join(".")}`), sameWords = (a, b) => a.length === b.length && a.every((w, i) => w === b[i]);
var init_schema = __esm(() => {
  init_api2();
});

// sql/logical/project.ts
function referenceWords(relationship, target, key) {
  const t = words(target);
  const begins = key.length >= t.length && t.every((w, i) => key[i] === w);
  return [...relationship === target ? [] : words(relationship), ...begins ? key : [...t, ...key]];
}
function normalizedProjection(options = {}) {
  const carried = new Set([
    ...defaultVocabularies.flatMap((v) => v.kinds.map((k) => k.name)).filter((n) => !EXPRESSED.has(n)),
    ...options.carry ?? []
  ]);
  return (d) => project(d, carried);
}
function project(d, carriedKinds) {
  const errors = [];
  const expressed = new Map;
  const carriers = new Map;
  const express = (el, index, ...ids) => void expressed.set(`${el}|${index}`, [...expressed.get(`${el}|${index}`) ?? [], ...ids]);
  const carry = (el, ...ids) => void carriers.set(el, [...carriers.get(el) ?? [], ...ids]);
  const annotated = (el, kind) => el.annotations.flatMap((a, index) => a.kind === kind ? [{ index, value: a.value }] : []);
  const keys = new Map;
  const stack = [];
  const keyOf = (c) => {
    const known = keys.get(c.name);
    if (known !== undefined)
      return known;
    if (stack.includes(c.name)) {
      errors.push({ kind: "identity", concept: conceptId(d.name, c.name), why: "cycle" });
      return [];
    }
    stack.push(c.name);
    const out = [];
    for (const m of c.identifiedBy) {
      const a = c.attributes[m];
      const r = c.relationships[m];
      if (a !== undefined)
        out.push({ name: attributeColumnWords(m, a), type: typeOf(a.type) });
      else if (r !== undefined)
        for (const k of keyOf(resolve(r.to)))
          out.push({ name: referenceWords(m, resolve(r.to).name, k.name), type: k.type });
    }
    stack.pop();
    keys.set(c.name, out);
    return out;
  };
  const attributeColumnWords = (key, a) => a.type.kind === "code" && openness2(a.type.list) === "open" ? [...words(a.type.list.name), "code"] : words(key);
  const referencesOf = (key, r) => {
    const target = resolve(r.to);
    return keyOf(target).map((k) => ({ name: referenceWords(key, target.name, k.name), target: k.name, type: k.type }));
  };
  const tables = [];
  const valueSets = [];
  const closedChecks = new Map;
  for (const l of d.codeLists) {
    const lid = codeListId(d.name, l.name);
    const rows = Object.entries(l.codes).map(([code, spec]) => ({
      code,
      label: spec.label,
      description: spec.definition ?? null
    }));
    if (openness2(l) === "open") {
      const name = words(l.name);
      const col = (n, nullable, comment) => ({
        id: columnId(name, [n]),
        from: lid,
        name: [n],
        type: { kind: "text" },
        nullable,
        comment,
        governance: [],
        role: "code"
      });
      const t = {
        id: tableId(name),
        from: lid,
        name,
        comment: l.definition,
        role: "code",
        columns: [
          col("code", false, "The code other tables point to: a short word that does not change"),
          col("label", false, "What a person is shown for the code"),
          col("description", true, "What the code means, where the label is not enough")
        ],
        primaryKey: [["code"]],
        foreignKeys: [],
        uniques: [],
        checks: [],
        indexes: [],
        rows,
        governance: l.annotations
      };
      tables.push(t);
      carry(lid, t.id);
      for (const o of annotated(l, quality8.openness.name))
        express(lid, o.index, t.id);
    } else {
      const vs = {
        id: valueSetId(words(l.name)),
        from: lid,
        name: words(l.name),
        comment: l.definition,
        codes: rows,
        governance: l.annotations
      };
      valueSets.push(vs);
      carry(lid, vs.id);
    }
  }
  const auditOf = (c) => {
    const own = annotated(c, quality8.audited.name)[0];
    if (own !== undefined)
      return { element: conceptId(d.name, c.name), index: own.index, removal: own.value.removal };
    const inherited = annotated(d, quality8.audited.name)[0];
    return inherited === undefined ? undefined : { element: domainId(d.name), index: inherited.index, removal: inherited.value.removal };
  };
  const concept = (c) => {
    const cid = conceptId(d.name, c.name);
    const tname = words(c.name);
    const columns = [];
    const foreignKeys = [];
    const uniques = [];
    const checks = [];
    const indexes = [];
    const extra = [];
    const columnsOfMember = new Map;
    const identifying = new Set(c.identifiedBy);
    const fk = (from, cols, table, refs) => {
      const name = [...tname, ...cols.flat(), "fk"];
      foreignKeys.push({ id: constraintId("fk", name), from, name, columns: cols, references: { table, columns: refs } });
    };
    const addAttribute = (key, a) => {
      const aid = attributeId(d.name, c.name, key);
      if (a.multiplicity === "many") {
        const name = [...tname, ...words(key)];
        const owner = keyOf(c).map((k) => ({ name: referenceWords(c.name, c.name, k.name), target: k.name, type: k.type }));
        const valueColumn = {
          id: columnId(name, words(key)),
          from: aid,
          name: words(key),
          type: typeOf(a.type),
          nullable: false,
          comment: a.definition,
          governance: a.annotations,
          role: "attribute"
        };
        const cols = [
          ...owner.map((o) => ({
            id: columnId(name, o.name),
            from: cid,
            name: o.name,
            type: o.type,
            nullable: false,
            comment: c.definition,
            governance: [],
            role: "reference"
          })),
          valueColumn
        ];
        const pk = cols.map((x) => x.name);
        const fname = [...name, ...owner.flatMap((o) => o.name), "fk"];
        extra.push({
          id: tableId(name),
          from: aid,
          name,
          comment: a.definition,
          role: "values",
          columns: cols,
          primaryKey: pk,
          foreignKeys: [
            {
              id: constraintId("fk", fname),
              from: aid,
              name: fname,
              columns: owner.map((o) => o.name),
              references: { table: tname, columns: owner.map((o) => o.target) }
            }
          ],
          uniques: [],
          checks: [],
          indexes: [],
          governance: a.annotations
        });
        carry(aid, tableId(name));
        return;
      }
      const name = attributeColumnWords(key, a);
      const def = annotated(a, quality8.defaultValue.name)[0];
      const dflt = def === undefined ? undefined : a.type.kind === "code" ? { kind: "code", name: String(def.value) } : { kind: "literal", value: def.value };
      const col = {
        id: columnId(tname, name),
        from: aid,
        name,
        type: typeOf(a.type),
        nullable: a.multiplicity === "optional",
        ...dflt === undefined ? {} : { default: dflt },
        comment: a.definition,
        governance: a.annotations,
        role: a.type.kind === "code" && openness2(a.type.list) === "open" ? "reference" : "attribute"
      };
      columns.push(col);
      columnsOfMember.set(key, [name]);
      carry(aid, col.id);
      if (def !== undefined)
        express(aid, def.index, col.id);
      if (a.type.kind === "code") {
        const list = a.type.list;
        if (openness2(list) === "open")
          fk(aid, [name], words(list.name), [["code"]]);
        else {
          const cname = [...tname, ...name, "ck"];
          checks.push({
            id: constraintId("ck", cname),
            from: aid,
            name: cname,
            expression: { kind: "oneOf", column: name, codes: Object.keys(list.codes) }
          });
          closedChecks.set(list.name, [...closedChecks.get(list.name) ?? [], constraintId("ck", cname)]);
        }
      }
      for (const r of annotated(a, quality8.range.name)) {
        const v = r.value;
        const cname = [...tname, ...name, "range", "ck"];
        checks.push({
          id: constraintId("ck", cname),
          from: aid,
          name: cname,
          expression: {
            kind: "range",
            column: name,
            ...v.min === undefined ? {} : { min: v.min },
            ...v.max === undefined ? {} : { max: v.max }
          }
        });
        express(aid, r.index, constraintId("ck", cname));
      }
      for (const p of annotated(a, quality8.pattern.name)) {
        const cname = [...tname, ...name, "pattern", "ck"];
        checks.push({
          id: constraintId("ck", cname),
          from: aid,
          name: cname,
          expression: { kind: "pattern", column: name, pattern: String(p.value) }
        });
        express(aid, p.index, constraintId("ck", cname));
      }
    };
    const addRelationship = (key, r) => {
      const rid = relationshipId(d.name, c.name, key);
      const target = resolve(r.to);
      if (r.cardinality === "many") {
        const name = [...tname, ...words(key)];
        const owner = keyOf(c).map((k) => ({ name: referenceWords(c.name, c.name, k.name), target: k.name, type: k.type }));
        const far = referencesOf(key, r);
        const cols = [...owner, ...far].map((o) => ({
          id: columnId(name, o.name),
          from: rid,
          name: o.name,
          type: o.type,
          nullable: false,
          comment: r.definition,
          governance: [],
          role: "reference"
        }));
        const ownerFk = [...name, ...owner.flatMap((o) => o.name), "fk"];
        const farFk = [...name, ...far.flatMap((o) => o.name), "fk"];
        extra.push({
          id: tableId(name),
          from: rid,
          name,
          comment: r.definition,
          role: "junction",
          columns: cols,
          primaryKey: cols.map((x) => x.name),
          foreignKeys: [
            {
              id: constraintId("fk", ownerFk),
              from: rid,
              name: ownerFk,
              columns: owner.map((o) => o.name),
              references: { table: tname, columns: owner.map((o) => o.target) }
            },
            {
              id: constraintId("fk", farFk),
              from: rid,
              name: farFk,
              columns: far.map((o) => o.name),
              references: { table: words(target.name), columns: far.map((o) => o.target) }
            }
          ],
          uniques: [],
          checks: [],
          indexes: [],
          governance: r.annotations
        });
        carry(rid, tableId(name));
        return;
      }
      const refs = referencesOf(key, r);
      const cols = refs.map((o) => ({
        id: columnId(tname, o.name),
        from: rid,
        name: o.name,
        type: o.type,
        nullable: r.cardinality === "optional",
        comment: r.definition,
        governance: r.annotations,
        role: "reference"
      }));
      columns.push(...cols);
      columnsOfMember.set(key, cols.map((x) => x.name));
      carry(rid, ...cols.map((x) => x.id));
      if (cols.length > 0)
        fk(rid, cols.map((x) => x.name), words(target.name), refs.map((x) => x.target));
    };
    for (const m of c.identifiedBy) {
      const a = c.attributes[m];
      const r = c.relationships[m];
      if (a !== undefined)
        addAttribute(m, a);
      else if (r !== undefined)
        addRelationship(m, r);
    }
    for (const [key, a] of Object.entries(c.attributes))
      if (!identifying.has(key))
        addAttribute(key, a);
    for (const [key, r] of Object.entries(c.relationships))
      if (!identifying.has(key))
        addRelationship(key, r);
    const columnsFor = (member) => columnsOfMember.get(member);
    const memberColumns = (member, why, single) => {
      if (!membersOf(c).includes(member)) {
        errors.push({ kind: "member", concept: cid, member, why: "unknown" });
        return;
      }
      const cols = columnsFor(member);
      if (cols === undefined || cols.length === 0) {
        errors.push({ kind: "member", concept: cid, member, why: "not-a-column" });
        return;
      }
      if (single && cols.length !== 1) {
        errors.push({ kind: "member", concept: cid, member, why });
        return;
      }
      return cols;
    };
    for (const u of annotated(c, quality8.unique.name)) {
      const cols = u.value.members.flatMap((m) => memberColumns(m, "not-a-column", false) ?? []);
      const name = [...tname, ...cols.flat(), "uq"];
      uniques.push({ id: constraintId("uq", name), from: cid, name, columns: cols });
      express(cid, u.index, constraintId("uq", name));
    }
    for (const x of annotated(c, quality8.differs.name)) {
      const v = x.value;
      const pair = v.members.map((m) => memberColumns(m, "not-one-column", true)?.[0]);
      const [a, b] = pair;
      if (a === undefined || b === undefined)
        continue;
      const name = [...tname, ...words(v.name), "ck"];
      checks.push({ id: constraintId("ck", name), from: cid, name, expression: { kind: "differs", columns: [a, b] } });
      express(cid, x.index, constraintId("ck", name));
    }
    for (const l of annotated(c, usage5.lookup.name)) {
      const cols = l.value.members.flatMap((m) => memberColumns(m, "not-a-column", false) ?? []);
      const name = [...tname, ...cols.flat(), "idx"];
      indexes.push({ id: constraintId("ix", name), from: cid, name, columns: cols });
      express(cid, l.index, constraintId("ix", name));
    }
    const audit = auditOf(c);
    if (audit !== undefined) {
      const moment = (n, comment, nullable, now) => ({
        id: columnId(tname, n),
        from: audit.element,
        name: n,
        type: { kind: "timestamp", zone: true },
        nullable,
        ...now ? { default: { kind: "now" } } : {},
        comment,
        governance: [],
        role: "audit"
      });
      const who = (n, comment) => ({
        id: columnId(tname, n),
        from: audit.element,
        name: n,
        type: { kind: "text" },
        nullable: true,
        comment,
        governance: [],
        role: "audit"
      });
      const made = [
        moment(["created", "at"], "When the row was made", false, true),
        who(["created", "by"], "Who made the row"),
        moment(["updated", "at"], "When the row was last changed", true, false),
        who(["updated", "by"], "Who last changed the row"),
        ...audit.removal === "mark" ? [
          moment(["deleted", "at"], "When the row was marked as removed", true, false),
          who(["deleted", "by"], "Who marked the row as removed")
        ] : []
      ];
      columns.push(...made);
      express(audit.element, audit.index, ...made.map((x) => x.id));
    }
    const t = {
      id: tableId(tname),
      from: cid,
      name: tname,
      comment: c.definition,
      role: "concept",
      columns,
      primaryKey: keyOf(c).map((k) => k.name),
      foreignKeys,
      uniques,
      checks,
      indexes,
      governance: c.annotations
    };
    tables.push(t, ...extra);
    carry(cid, t.id);
  };
  for (const c of d.concepts)
    concept(c);
  const seenTables = new Map;
  const seenConstraints = new Map;
  for (const t of tables) {
    const key = t.name.join(".");
    const first = seenTables.get(key);
    if (first !== undefined)
      errors.push({ kind: "collision", what: "table", name: t.name, first, second: t.from });
    else
      seenTables.set(key, t.from);
    const seenColumns = new Map;
    for (const c of t.columns) {
      const k = c.name.join(".");
      const f = seenColumns.get(k);
      if (f !== undefined)
        errors.push({ kind: "collision", what: "column", name: c.name, table: t.name, first: f, second: c.from });
      else
        seenColumns.set(k, c.from);
    }
    for (const x of [...t.foreignKeys, ...t.uniques, ...t.checks, ...t.indexes]) {
      const k = x.name.join(".");
      const f = seenConstraints.get(k);
      if (f !== undefined)
        errors.push({ kind: "collision", what: "constraint", name: x.name, table: t.name, first: f, second: x.from });
      else
        seenConstraints.set(k, x.from);
    }
  }
  if (errors.length > 0)
    return err(errors);
  const closedOf = new Map(d.codeLists.map((l) => [codeListId(d.name, l.name), l.name]));
  const flow = [];
  const schema = schemaId(d.name);
  for (const e of elementsOf(d)) {
    e.annotations.forEach((a, index) => {
      const key = `${e.id}|${index}`;
      const made = expressed.get(key);
      if (EXPRESSED.has(a.kind)) {
        const listName = closedOf.get(e.id);
        const ids = a.kind === quality8.openness.name && listName !== undefined && made === undefined ? closedChecks.get(listName) ?? [] : made;
        flow.push(ids === undefined ? {
          element: e.id,
          index,
          annotation: a.kind,
          disposition: "unexpressed",
          logical: [],
          note: "the projection knows the kind and made nothing of it"
        } : { element: e.id, index, annotation: a.kind, disposition: "expressed", logical: ids });
      } else if (carriedKinds.has(a.kind)) {
        flow.push({
          element: e.id,
          index,
          annotation: a.kind,
          disposition: "carried",
          logical: e.kind === "domain" ? [schema] : carriers.get(e.id) ?? []
        });
      } else
        flow.push({
          element: e.id,
          index,
          annotation: a.kind,
          disposition: "unexpressed",
          logical: [],
          note: "the projection knows nothing of this kind"
        });
    });
  }
  return ok({
    schema: { id: schema, from: domainId(d.name), domain: d.name, comment: d.definition, tables, valueSets, governance: d.annotations },
    flow
  });
}
function projectDomain(domain, projection = normalized) {
  return projection(domain);
}
var quality8, usage5, EXPRESSED, typeOf = (t) => {
  switch (t.kind) {
    case "text":
      return t.max === undefined ? { kind: "text" } : { kind: "text", max: t.max };
    case "identifier":
    case "code":
      return { kind: "text" };
    case "integer":
      return { kind: "integer" };
    case "decimal":
      return {
        kind: "decimal",
        ...t.precision === undefined ? {} : { precision: t.precision },
        ...t.scale === undefined ? {} : { scale: t.scale }
      };
    case "boolean":
      return { kind: "boolean" };
    case "date":
      return { kind: "date" };
    case "instant":
      return { kind: "timestamp", zone: true };
    case "structured":
      return { kind: "json" };
    case "binary":
      return { kind: "bytes" };
    case "vector":
      return { kind: "vector", dimensions: t.dimensions };
  }
}, openness2 = (l) => annotationsOf(l, quality8.openness)[0] ?? "closed", normalized;
var init_project = __esm(() => {
  init_mod();
  init_api2();
  init_schema();
  ({ quality: quality8, usage: usage5 } = exports_mod);
  EXPRESSED = new Set([
    quality8.defaultValue.name,
    quality8.unique.name,
    quality8.differs.name,
    quality8.audited.name,
    quality8.openness.name,
    quality8.range.name,
    quality8.pattern.name,
    usage5.lookup.name
  ]);
  normalized = normalizedProjection();
});

// sql/logical/api.ts
var projectionPoint;
var init_api3 = __esm(() => {
  init_api();
  init_project();
  init_schema();
  projectionPoint = point("logical.projection");
});

// sql/physical/case.ts
function naming(names = snake, codes = names) {
  return { names, codes };
}
function writeCode(n, code) {
  return n.codes === "name" ? code : n.codes.write(words(code));
}
var snake, caseStylePoint;
var init_case = __esm(() => {
  init_api();
  init_api2();
  snake = { name: "snake", write: (w) => w.join("_") };
  caseStylePoint = point("physical.caseStyle");
});

// sql/physical/qualify.ts
var qualified = (dialect, schema, name) => schema === undefined ? dialect.quote(name) : `${dialect.quote(schema)}.${dialect.quote(name)}`;

// sql/physical/express.ts
function writeNames(schema, dialect, naming, errors, inSchema) {
  const qualifier = inSchema !== undefined && dialect.features.includes("schemas") ? inSchema : undefined;
  const prefix = inSchema !== undefined && qualifier === undefined ? words(inSchema) : [];
  const tableWords = (w) => prefix.length === 0 ? w : [...prefix, ...w];
  const write = (w, element) => {
    const name = naming.names.write(w);
    if (name.length > dialect.maxName)
      errors.push({ kind: "length", element, name, max: dialect.maxName });
    return name;
  };
  const tables = new Map;
  const columns = new Map;
  const constraints = new Map;
  const seenTables = new Map;
  const seenConstraints = new Map;
  for (const t of schema.tables) {
    const tn = write(tableWords(t.name), t.id);
    tables.set(t.id, tn);
    const other = seenTables.get(tn);
    if (other !== undefined)
      errors.push({ kind: "collision", name: tn, first: other, second: t.id });
    else
      seenTables.set(tn, t.id);
    const seenColumns = new Map;
    for (const c of t.columns) {
      const cn = write(c.name, c.id);
      columns.set(c.id, cn);
      const o = seenColumns.get(cn);
      if (o !== undefined)
        errors.push({ kind: "collision", name: cn, table: tn, first: o, second: c.id });
      else
        seenColumns.set(cn, c.id);
    }
    for (const x of [...t.foreignKeys, ...t.uniques, ...t.checks, ...t.indexes]) {
      const xn = write(x.name, x.id);
      constraints.set(x.id, xn);
      const o = seenConstraints.get(xn);
      if (o !== undefined)
        errors.push({ kind: "collision", name: xn, table: tn, first: o, second: x.id });
      else
        seenConstraints.set(xn, x.id);
    }
  }
  return {
    qualifier,
    tables,
    columns,
    constraints,
    table: (id) => tables.get(id),
    column: (id) => columns.get(id),
    constraint: (id) => constraints.get(id),
    ref: (id) => qualified(dialect, qualifier, tables.get(id) ?? ""),
    qualify: (name) => qualified(dialect, qualifier, prefix.length === 0 ? name : naming.names.write([...prefix, ...words(name)])),
    tableName: (name) => prefix.length === 0 ? name : naming.names.write([...prefix, ...words(name)]),
    refWords: (t) => qualified(dialect, qualifier, naming.names.write(tableWords(t)))
  };
}
function expressor(dialect, naming, names, errors) {
  const q = (n) => dialect.quote(n);
  const list = (ws) => ws.map((w) => q(naming.names.write(w))).join(", ");
  const defaultOf = (d) => {
    switch (d.kind) {
      case "literal":
        return dialect.literal(d.value);
      case "now":
        return dialect.now;
      case "code":
        return dialect.literal(writeCode(naming, d.name));
    }
  };
  const checkOf = (c) => {
    const e = c.expression;
    const col = (w) => q(naming.names.write(w));
    switch (e.kind) {
      case "differs":
        return `${col(e.columns[0])} <> ${col(e.columns[1])}`;
      case "oneOf":
        return `${col(e.column)} IN (${e.codes.map((x) => dialect.literal(writeCode(naming, x))).join(", ")})`;
      case "range": {
        const parts = [
          ...e.min === undefined ? [] : [`${col(e.column)} >= ${dialect.literal(e.min)}`],
          ...e.max === undefined ? [] : [`${col(e.column)} <= ${dialect.literal(e.max)}`]
        ];
        return parts.join(" AND ");
      }
      case "pattern": {
        if (dialect.pattern === undefined) {
          errors.push({ kind: "unsupported", element: c.id, why: `${dialect.name} has no regular expression to check a pattern with` });
          return;
        }
        return dialect.pattern(col(e.column), e.pattern);
      }
    }
  };
  return {
    list,
    defaultOf,
    checkOf,
    columnLine: (t, c, inlineKey = true) => {
      const key = inlineKey && t.primaryKey.length === 1 && t.primaryKey[0]?.join(".") === c.name.join(".");
      return `${q(names.columns.get(c.id) ?? "")} ${dialect.type(c.type)}${c.nullable ? "" : " NOT NULL"}${c.default === undefined ? "" : ` DEFAULT ${defaultOf(c.default)}`}${key ? " PRIMARY KEY" : ""}`;
    },
    fkClause: (f) => `CONSTRAINT ${q(names.constraints.get(f.id) ?? "")} FOREIGN KEY (${list(f.columns)}) REFERENCES ${names.refWords(f.references.table)} (${list(f.references.columns)})`,
    uniqueClause: (u) => `CONSTRAINT ${q(names.constraints.get(u.id) ?? "")} UNIQUE (${list(u.columns)})`,
    checkClause: (c) => {
      const expr = checkOf(c);
      return expr === undefined ? undefined : `CONSTRAINT ${q(names.constraints.get(c.id) ?? "")} CHECK (${expr})`;
    }
  };
}
var init_express = __esm(() => {
  init_api2();
  init_case();
});

// sql/physical/upsert.ts
function upsert(dialect, table, columns, key, rows, schema) {
  const q = (n) => dialect.quote(n);
  const set = columns.filter((c) => !key.includes(c)).map((c) => `${q(c)} = excluded.${q(c)}`);
  const values = rows.map((r) => `(${r.map((v) => dialect.literal(v)).join(", ")})`);
  return `INSERT INTO ${qualified(dialect, schema, table)} (${columns.map(q).join(", ")}) VALUES
${values.join(`,
`)}
ON CONFLICT (${key.map(q).join(", ")}) DO ${set.length === 0 ? "NOTHING" : `UPDATE SET ${set.join(", ")}`};`;
}
var init_upsert = () => {};

// sql/physical/statement.ts
var GROUPS, tableClausesPoint, statementsPoint;
var init_statement = __esm(() => {
  init_api();
  GROUPS = ["setup", "table", "constraint", "index", "data", "view", "routine", "documentation", "policy"];
  tableClausesPoint = point("physical.tableClauses");
  statementsPoint = point("physical.statements");
});

// sql/physical/bind.ts
function bind(schema, options) {
  const { dialect } = options;
  const naming2 = options.naming ?? naming();
  const errors = [];
  const q = (name) => dialect.quote(name);
  const names = writeNames(schema, dialect, naming2, errors, options.schema);
  const { tables, columns, constraints } = names;
  const written = names;
  const x = expressor(dialect, naming2, names, errors);
  const { list, columnLine, fkClause } = x;
  const columnOf = (t, c) => columnLine(t, c);
  const used = [];
  for (const t of schema.tables)
    for (const c of t.columns) {
      const why = dialect.unsupported?.(c.type);
      if (why !== undefined)
        errors.push({ kind: "unsupported", element: c.id, why });
      else if (!used.some((u) => JSON.stringify(u) === JSON.stringify(c.type)))
        used.push(c.type);
    }
  const byName = new Map(schema.tables.map((t) => [t.name.join("."), t]));
  const order = [];
  const state = new Map;
  const cyclic = new Set;
  const visit = (t, path) => {
    const key = t.name.join(".");
    const s = state.get(key);
    if (s === "done")
      return;
    if (s === "visiting") {
      for (const p of path.slice(path.indexOf(key)))
        cyclic.add(p);
      return;
    }
    state.set(key, "visiting");
    for (const f of t.foreignKeys) {
      const target = byName.get(f.references.table.join("."));
      if (target !== undefined && target !== t)
        visit(target, [...path, key]);
    }
    state.set(key, "done");
    order.push(t);
  };
  for (const t of schema.tables)
    visit(t, []);
  const breakable = dialect.features.includes("add-constraint");
  if (cyclic.size > 0 && !breakable)
    errors.push({ kind: "cycle", tables: [...cyclic].map((k) => naming2.names.write(byName.get(k)?.name ?? [])) });
  const deferred = (f, t) => breakable && cyclic.has(t.name.join(".")) && cyclic.has(f.references.table.join(".")) && f.references.table.join(".") !== t.name.join(".");
  const statements = [];
  if (names.qualifier !== undefined)
    statements.push({ group: "setup", origin: "core", sql: `CREATE SCHEMA IF NOT EXISTS ${q(names.qualifier)};`, of: [] });
  for (const sql of dialect.setup?.(used) ?? [])
    statements.push({ group: "setup", origin: "core", sql, of: [] });
  const context = {
    schema,
    dialect,
    naming: naming2,
    written,
    ...options.schema === undefined ? {} : { schemaName: options.schema }
  };
  for (const t of order) {
    const lines = t.columns.map((c) => columnOf(t, c));
    if (t.primaryKey.length > 1)
      lines.push(`PRIMARY KEY (${list(t.primaryKey)})`);
    for (const f of t.foreignKeys)
      if (!deferred(f, t))
        lines.push(fkClause(f));
    for (const u of t.uniques)
      lines.push(x.uniqueClause(u));
    for (const c of t.checks) {
      const clause = x.checkClause(c);
      if (clause !== undefined)
        lines.push(clause);
    }
    const clauses = [];
    for (const clause of options.tableClauses ?? []) {
      const r = clause(context, t);
      if (r.kind === "err")
        errors.push(...r.error);
      else if (r.value !== undefined)
        clauses.push(r.value);
    }
    statements.push({
      group: "table",
      origin: "core",
      sql: `CREATE TABLE IF NOT EXISTS ${names.ref(t.id)} (
${lines.map((l) => `${indent}${l}`).join(`,
`)}
)${clauses.map((c) => ` ${c}`).join("")};`,
      of: [
        t.id,
        ...t.columns.map((c) => c.id),
        ...t.foreignKeys.filter((f) => !deferred(f, t)).map((f) => f.id),
        ...t.uniques.map((u) => u.id),
        ...t.checks.map((c) => c.id)
      ]
    });
    for (const f of t.foreignKeys) {
      if (deferred(f, t))
        statements.push({
          group: "constraint",
          origin: "core",
          sql: `ALTER TABLE ${names.ref(t.id)} ADD ${fkClause(f)};`,
          of: [f.id]
        });
    }
  }
  for (const t of order) {
    for (const i of t.indexes) {
      statements.push({
        group: "index",
        origin: "core",
        sql: `CREATE INDEX IF NOT EXISTS ${q(constraints.get(i.id) ?? "")} ON ${names.ref(t.id)} (${list(i.columns)});`,
        of: [i.id]
      });
    }
  }
  for (const t of order) {
    if (t.rows === undefined || t.rows.length === 0)
      continue;
    const columnNames = t.columns.map((c) => columns.get(c.id) ?? "");
    const key = t.primaryKey.map((k) => naming2.names.write(k));
    const rows = t.rows.map((r) => [writeCode(naming2, r.code), r.label, r.description]);
    statements.push({
      group: "data",
      origin: "core",
      sql: upsert(dialect, tables.get(t.id) ?? "", columnNames, key, rows, names.qualifier),
      of: [t.id]
    });
  }
  for (const source of options.sources ?? []) {
    const r = source(context);
    if (r.kind === "err")
      errors.push(...r.error);
    else
      statements.push(...r.value.map((st) => ({ ...st, origin: "extension" })));
  }
  if (errors.length > 0)
    return err(errors);
  const ordered = GROUPS.flatMap((g) => statements.filter((s) => s.group === g));
  return ok({
    dialect: dialect.name,
    naming: { names: naming2.names.name, codes: naming2.codes === "name" ? "name" : naming2.codes.name },
    statements: ordered
  });
}
var indent = "    ";
var init_bind = __esm(() => {
  init_mod();
  init_case();
  init_express();
  init_upsert();
  init_statement();
});

// sql/physical/dialect.ts
function standardLiteral(value) {
  if (value === null)
    return "NULL";
  if (typeof value === "boolean")
    return value ? "TRUE" : "FALSE";
  if (typeof value === "number")
    return String(value);
  return `'${value.replaceAll("'", "''")}'`;
}
function dialectExtension(d, version = "1.0.0") {
  const id = extensionId(`sql.dialect.${d.name}`);
  return id.kind === "err" ? err(id.error) : ok(defineExtension({ id: id.value, version, contributes: [contribute(dialectPoint, d)] }));
}
var quoteName = (name) => `"${name.replaceAll('"', '""')}"`, dialectPoint;
var init_dialect = __esm(() => {
  init_mod();
  init_api();
  dialectPoint = point("physical.dialect");
});

// sql/physical/generate.ts
var generatorsPoint;
var init_generate = __esm(() => {
  init_mod();
  init_api();
  init_case();
  generatorsPoint = point("physical.generators");
});
// sql/physical/enforcement.ts
function enforcementOf(dialect) {
  const has = (m) => {
    switch (m) {
      case "check":
      case "foreign-key":
      case "unique":
      case "transactional-ddl":
        return true;
      case "trigger":
        return dialect.features.includes("triggers");
      case "routine":
        return dialect.features.includes("routines");
      case "row-security":
        return dialect.features.includes("row-security");
      case "grant":
        return dialect.features.includes("grants");
      case "event-trigger":
        return dialect.features.includes("event-triggers");
      case "advisory-lock":
        return dialect.advisory !== undefined;
    }
  };
  const can = ALL.filter(has);
  const tier = has("trigger") && has("routine") && has("row-security") && has("grant") ? "full" : has("trigger") ? "standard" : "basic";
  return {
    tier,
    can,
    cannot: ALL.filter((m) => !has(m)).map((mechanism) => ({ mechanism, because: `${dialect.name} has no ${mechanism.replace("-", " ")} that the library can use` }))
  };
}
function where(dialect, need) {
  const e = enforcementOf(dialect);
  const can = (m) => e.can.includes(m);
  switch (need) {
    case "append-only":
    case "status-moves":
    case "column-cap":
    case "hash-chain":
      return can("trigger") ? { by: "database", via: "a trigger" } : { by: "application", via: `${dialect.name} has no triggers: the operations runtime refuses it` };
    case "row-isolation":
      return can("row-security") ? { by: "database", via: "row-level security" } : { by: "application", via: `${dialect.name} has no row-level security: the application filters by scope` };
    case "least-privilege":
      return can("grant") ? { by: "database", via: "roles and grants" } : { by: "application", via: `${dialect.name} has no roles: access is the application's` };
    case "no-weakening":
      return can("event-trigger") ? { by: "database", via: "an event trigger" } : { by: "application", via: `${dialect.name} has no event triggers: a change is guarded by the lifecycle's runner` };
    case "single-runner":
      return can("advisory-lock") ? { by: "database", via: "an advisory lock" } : { by: "application", via: `${dialect.name} has one writer at a time` };
  }
}
var ALL;
var init_enforcement = __esm(() => {
  ALL = ["check", "foreign-key", "unique", "trigger", "routine", "row-security", "grant", "event-trigger", "transactional-ddl", "advisory-lock"];
});

// sql/physical/refs.ts
var init_refs = __esm(() => {
  init_api2();
  init_express();
});

// sql/physical/api.ts
var init_api4 = __esm(() => {
  init_bind();
  init_case();
  init_dialect();
  init_generate();
  init_express();
  init_enforcement();
  init_refs();
  init_upsert();
  init_statement();
});

// sql/lifecycle/change.ts
function diff(from, to) {
  const old = from?.tables ?? [];
  const renames = [];
  const dropC = [];
  const columnsC = [];
  const created = [];
  const addC = [];
  const rowsC = [];
  const dropped = [];
  const matched = new Map;
  const taken = new Set;
  for (const t of to.tables) {
    const m = old.find((o) => !taken.has(o) && same(o.words, t.words));
    if (m !== undefined) {
      matched.set(t, m);
      taken.add(m);
    }
  }
  for (const t of to.tables) {
    if (matched.has(t) || t.renamedFrom === undefined)
      continue;
    const m = old.find((o) => !taken.has(o) && same(o.words, t.renamedFrom ?? []));
    if (m !== undefined) {
      matched.set(t, m);
      taken.add(m);
    }
  }
  for (const t of to.tables) {
    const o = matched.get(t);
    if (o === undefined) {
      created.push({ kind: "createTable", key: `createTable:${w(t.words)}`, table: t });
      continue;
    }
    if (o.name !== t.name || !same(o.words, t.words))
      renames.push({
        kind: "renameTable",
        key: `renameTable:${w(o.words)}>${w(t.words)}`,
        fromWords: o.words,
        toWords: t.words,
        fromName: o.name,
        toName: t.name
      });
    const tr = ref(t);
    const cm = new Map;
    const ct = new Set;
    for (const c of t.columns) {
      const m = o.columns.find((x) => !ct.has(x) && same(x.words, c.words));
      if (m !== undefined) {
        cm.set(c, m);
        ct.add(m);
      }
    }
    for (const c of t.columns) {
      if (cm.has(c) || c.renamedFrom === undefined)
        continue;
      const m = o.columns.find((x) => !ct.has(x) && same(x.words, c.renamedFrom ?? []));
      if (m !== undefined) {
        cm.set(c, m);
        ct.add(m);
      }
    }
    for (const c of t.columns) {
      const m = cm.get(c);
      const base = `${w(t.words)}.${w(c.words)}`;
      if (m === undefined) {
        columnsC.push({ kind: "addColumn", key: `addColumn:${base}`, table: tr, column: c });
        continue;
      }
      if (m.name !== c.name || !same(m.words, c.words))
        renames.push({ kind: "renameColumn", key: `renameColumn:${w(t.words)}.${w(m.words)}>${w(c.words)}`, table: tr, from: m, to: c });
      if (m.type !== c.type)
        columnsC.push({ kind: "alterType", key: `alterType:${base}`, table: tr, from: m, to: c });
      if (m.nullable !== c.nullable)
        columnsC.push({ kind: "alterNullable", key: `alterNullable:${base}`, table: tr, from: m, to: c });
      if (m.default !== c.default)
        columnsC.push({ kind: "alterDefault", key: `alterDefault:${base}`, table: tr, from: m, to: c });
    }
    for (const m of o.columns)
      if (!ct.has(m))
        columnsC.push({ kind: "dropColumn", key: `dropColumn:${w(t.words)}.${w(m.words)}`, table: tr, column: m });
    const pk = (s) => s.primaryKey.map((n) => w(s.columns.find((c) => c.name === n)?.words ?? [n]));
    if (!same(pk(o), pk(t)))
      columnsC.push({ kind: "alterPrimaryKey", key: `alterPrimaryKey:${w(t.words)}`, table: tr, from: o.primaryKey, to: t.primaryKey });
    if (o.clause !== t.clause)
      columnsC.push({ kind: "alterClause", key: `alterClause:${w(t.words)}`, table: tr, from: o.clause, to: t.clause });
    const sig = (c) => `${c.kind}|${c.signature}`;
    const oc = new Map(o.constraints.map((c) => [sig(c), c]));
    const tc = new Map(t.constraints.map((c) => [sig(c), c]));
    for (const [s, c] of oc) {
      const n = tc.get(s);
      if (n === undefined)
        dropC.push({ kind: "dropConstraint", key: `dropConstraint:${w(t.words)}:${c.kind}:${c.name}`, table: tr, constraint: c });
      else if (n.name !== c.name)
        dropC.push({
          kind: "renameConstraint",
          key: `renameConstraint:${w(t.words)}:${c.kind}:${c.name}>${n.name}`,
          table: tr,
          from: c,
          to: n
        });
    }
    for (const [s, c] of tc)
      if (!oc.has(s))
        addC.push({ kind: "addConstraint", key: `addConstraint:${w(t.words)}:${c.kind}:${c.name}`, table: tr, constraint: c });
    const before = new Map(o.rows.map((r) => [r.code, r]));
    const changed = t.rows.filter((r) => {
      const b = before.get(r.code);
      return b === undefined || b.label !== r.label || b.description !== r.description;
    });
    if (changed.length > 0)
      rowsC.push({
        kind: "upsertRows",
        key: `upsertRows:${w(t.words)}`,
        table: tr,
        rows: changed,
        before: changed.flatMap((r) => before.get(r.code) ?? [])
      });
    const keep = new Set(t.rows.map((r) => r.code));
    const gone = o.rows.filter((r) => !keep.has(r.code));
    if (gone.length > 0)
      rowsC.push({ kind: "removeRows", key: `removeRows:${w(t.words)}`, table: tr, rows: gone });
  }
  for (const o of old)
    if (!taken.has(o))
      dropped.push({ kind: "dropTable", key: `dropTable:${w(o.words)}`, table: o });
  return [...renames, ...dropC, ...columnsC, ...created, ...addC, ...rowsC, ...dropped];
}
function applyChange(state, change) {
  switch (change.kind) {
    case "renameTable":
      return mapTable(state, change.fromWords, (t) => ({ ...t, words: change.toWords, name: change.toName }));
    case "renameColumn":
      return mapTable(state, change.table.words, (t) => mapColumn(t, change.from.words, (c) => ({ ...c, words: change.to.words, name: change.to.name })));
    case "dropConstraint":
      return mapTable(state, change.table.words, (t) => ({
        ...t,
        constraints: t.constraints.filter((c) => !sameConstraint(c, change.constraint))
      }));
    case "renameConstraint":
      return mapTable(state, change.table.words, (t) => ({
        ...t,
        constraints: t.constraints.map((c) => sameConstraint(c, change.from) ? change.to : c)
      }));
    case "addColumn":
      return mapTable(state, change.table.words, (t) => ({ ...t, columns: [...t.columns, change.column] }));
    case "dropColumn":
      return mapTable(state, change.table.words, (t) => ({ ...t, columns: t.columns.filter((c) => !same(c.words, change.column.words)) }));
    case "alterType":
      return mapTable(state, change.table.words, (t) => mapColumn(t, change.from.words, (c) => ({ ...c, type: change.to.type })));
    case "alterNullable":
      return mapTable(state, change.table.words, (t) => mapColumn(t, change.from.words, (c) => ({ ...c, nullable: change.to.nullable })));
    case "alterDefault":
      return mapTable(state, change.table.words, (t) => mapColumn(t, change.from.words, (c) => {
        const { default: _d, ...rest } = c;
        return change.to.default === undefined ? rest : { ...rest, default: change.to.default };
      }));
    case "alterPrimaryKey":
      return mapTable(state, change.table.words, (t) => ({ ...t, primaryKey: change.to }));
    case "alterClause":
      return mapTable(state, change.table.words, (t) => {
        const { clause: _c, ...rest } = t;
        return change.to === undefined ? rest : { ...rest, clause: change.to };
      });
    case "createTable":
      return { ...state, tables: [...state.tables, change.table] };
    case "addConstraint":
      return mapTable(state, change.table.words, (t) => ({ ...t, constraints: [...t.constraints, change.constraint] }));
    case "upsertRows":
      return mapTable(state, change.table.words, (t) => {
        const keep = new Map(t.rows.map((r) => [r.code, r]));
        for (const r of change.rows)
          keep.set(r.code, r);
        return { ...t, rows: [...keep.values()] };
      });
    case "removeRows":
      return mapTable(state, change.table.words, (t) => {
        const gone = new Set(change.rows.map((r) => r.code));
        return { ...t, rows: t.rows.filter((r) => !gone.has(r.code)) };
      });
    case "dropTable":
      return { ...state, tables: state.tables.filter((t) => !same(t.words, change.table.words)) };
  }
}
var same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]), w = (x) => x.join("."), ref = (t) => ({ words: t.words, name: t.name }), mapTable = (s, words, fn) => ({
  ...s,
  tables: s.tables.map((t) => same(t.words, words) ? fn(t) : t)
}), mapColumn = (t, words, fn) => ({
  ...t,
  columns: t.columns.map((c) => same(c.words, words) ? fn(c) : c)
}), sameConstraint = (a, b) => a.kind === b.kind && a.signature === b.signature;

// sql/lifecycle/hash.ts
function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const length = bytes.length;
  const padded = new Uint8Array(length + 9 + 63 >> 6 << 6);
  padded.set(bytes);
  padded[length] = 128;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(length * 8 / 4294967296));
  view.setUint32(padded.length - 4, length * 8 >>> 0);
  const h = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
  const w = new Uint32Array(64);
  for (let off = 0;off < padded.length; off += 64) {
    for (let i = 0;i < 16; i++)
      w[i] = view.getUint32(off + i * 4);
    for (let i = 16;i < 64; i++) {
      const a = w[i - 15] ?? 0;
      const b = w[i - 2] ?? 0;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ a >>> 3;
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ b >>> 10;
      w[i] = (w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1 | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0;i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = e & f ^ ~e & g;
      const t1 = hh + s1 + ch + (K[i] ?? 0) + (w[i] ?? 0) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = a & b ^ a & c ^ b & c;
      const t2 = s0 + maj | 0;
      hh = g;
      g = f;
      f = e;
      e = d + t1 | 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 | 0;
    }
    h[0] = (h[0] ?? 0) + a | 0;
    h[1] = (h[1] ?? 0) + b | 0;
    h[2] = (h[2] ?? 0) + c | 0;
    h[3] = (h[3] ?? 0) + d | 0;
    h[4] = (h[4] ?? 0) + e | 0;
    h[5] = (h[5] ?? 0) + f | 0;
    h[6] = (h[6] ?? 0) + g | 0;
    h[7] = (h[7] ?? 0) + hh | 0;
  }
  return Array.from(h, (x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}
function canonical(value) {
  if (value === null || typeof value !== "object")
    return JSON.stringify(value) ?? "null";
  if (Array.isArray(value))
    return `[${value.map((v) => canonical(v)).join(",")}]`;
  const entries = Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}
var K, rotr = (x, n) => x >>> n | x << 32 - n, hashOf = (value) => sha256Hex(canonical(value));
var init_hash = __esm(() => {
  K = new Uint32Array([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
});

// sql/lifecycle/ledger.ts
function verifyChain(entries) {
  let previous = GENESIS2;
  for (const [i, e] of entries.entries()) {
    if (e.seq !== i + 1)
      return { seq: e.seq, why: "seq" };
    const { chain, ...rest } = e;
    if (chain !== chainOf(previous, rest))
      return { seq: e.seq, why: "chain" };
    previous = chain;
  }
  return;
}
var GENESIS2, chainOf = (previous, entry) => hashOf({
  previous,
  seq: entry.seq,
  kind: entry.kind,
  key: entry.key,
  name: entry.name,
  from: entry.from,
  to: entry.to,
  hash: entry.hash,
  appliedAt: entry.appliedAt,
  appliedBy: entry.appliedBy
});
var init_ledger = __esm(() => {
  init_hash();
  GENESIS2 = "0".repeat(64);
});

// sql/lifecycle/state.ts
function snapshotOf(schema, options) {
  const { dialect } = options;
  const naming2 = options.naming ?? naming();
  const errors = [];
  const names = writeNames(schema, dialect, naming2, errors, options.schema);
  const x = expressor(dialect, naming2, names, errors);
  const written = (w) => naming2.names.write(w);
  const context = { schema, dialect, naming: naming2, written: names, ...options.schema === undefined ? {} : { schemaName: options.schema } };
  const tables = schema.tables.map((t) => {
    const tn = names.tables.get(t.id) ?? "";
    const columns = t.columns.map((c) => {
      const old = carriedOf(c, lifecycle.renamedFrom)[0];
      return {
        id: c.id,
        words: c.name,
        name: names.columns.get(c.id) ?? "",
        type: dialect.type(c.type),
        nullable: c.nullable,
        ...c.default === undefined ? {} : { default: x.defaultOf(c.default) },
        ...old === undefined ? {} : { renamedFrom: words(old) }
      };
    });
    const constraints = [];
    for (const f of t.foreignKeys)
      constraints.push({
        id: f.id,
        kind: "foreignKey",
        name: names.constraints.get(f.id) ?? "",
        signature: `fk:${f.columns.map((c) => c.join(".")).join(",")}>${f.references.table.join(".")}(${f.references.columns.map((c) => c.join(".")).join(",")})`,
        text: x.fkClause(f)
      });
    for (const u of t.uniques)
      constraints.push({
        id: u.id,
        kind: "unique",
        name: names.constraints.get(u.id) ?? "",
        signature: `uq:${u.columns.map((c) => c.join(".")).join(",")}`,
        text: x.uniqueClause(u)
      });
    for (const c of t.checks) {
      const clause = x.checkClause(c);
      if (clause !== undefined)
        constraints.push({
          id: c.id,
          kind: "check",
          name: names.constraints.get(c.id) ?? "",
          signature: `ck:${x.checkOf(c) ?? ""}`,
          text: clause
        });
    }
    for (const i of t.indexes)
      constraints.push({
        id: i.id,
        kind: "index",
        name: names.constraints.get(i.id) ?? "",
        signature: `ix:${i.columns.map((c) => c.join(".")).join(",")}`,
        text: x.list(i.columns)
      });
    let clause;
    for (const k of options.tableClauses ?? []) {
      const r = k(context, t);
      if (r.kind === "err")
        errors.push(...r.error);
      else if (r.value !== undefined)
        clause = clause === undefined ? r.value : `${clause} ${r.value}`;
    }
    const old = carriedOf(t, lifecycle.renamedFrom)[0];
    return {
      id: t.id,
      words: t.name,
      name: tn,
      columns,
      primaryKey: t.primaryKey.map(written),
      constraints,
      rows: (t.rows ?? []).map((r) => ({ code: writeCode(naming2, r.code), label: r.label, description: r.description })),
      ...clause === undefined ? {} : { clause },
      ...old === undefined ? {} : { renamedFrom: words(old) }
    };
  });
  if (errors.length > 0)
    return { kind: "err", error: errors };
  return {
    kind: "ok",
    value: {
      format: 1,
      dialect: dialect.name,
      naming: { names: naming2.names.name, codes: naming2.codes === "name" ? "name" : naming2.codes.name },
      ...names.qualifier === undefined ? {} : { qualifier: names.qualifier },
      tables
    }
  };
}
function canonicalState(state) {
  return {
    format: state.format,
    dialect: state.dialect,
    naming: state.naming,
    qualifier: state.qualifier,
    tables: order2(state.tables, (t) => t.words.join(".")).map((t) => ({
      words: t.words,
      name: t.name,
      primaryKey: t.primaryKey,
      clause: t.clause,
      columns: order2(t.columns, (c) => c.words.join(".")).map((c) => ({
        words: c.words,
        name: c.name,
        type: c.type,
        nullable: c.nullable,
        default: c.default
      })),
      constraints: order2(t.constraints, constraintKey).map((c) => ({ kind: c.kind, name: c.name, signature: c.signature })),
      rows: order2(t.rows, (r) => r.code)
    }))
  };
}
var lifecycle, emptyState = (dialect, naming, qualifier) => ({
  format: 1,
  dialect,
  naming,
  ...qualifier === undefined ? {} : { qualifier },
  tables: []
}), order2 = (xs, key) => [...xs].sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0), constraintKey = (c) => `${c.kind}|${c.signature}|${c.name}`, stateHash = (state) => hashOf(canonicalState(state));
var init_state = __esm(() => {
  init_api2();
  init_api3();
  init_api4();
  init_hash();
  ({ lifecycle } = exports_mod);
});

// sql/lifecycle/plan.ts
function plan(from, schema, desired, options = {}) {
  const { dialect } = desired;
  const naming2 = desired.naming ?? naming();
  const errors = [];
  const snap = snapshotOf(schema, {
    dialect,
    naming: naming2,
    ...desired.schema === undefined ? {} : { schema: desired.schema },
    ...desired.tableClauses === undefined ? {} : { tableClauses: desired.tableClauses }
  });
  if (snap.kind === "err")
    return err([{ kind: "write", errors: snap.error }]);
  const to = snap.value;
  const bound = bind(schema, {
    dialect,
    naming: naming2,
    ...desired.schema === undefined ? {} : { schema: desired.schema },
    ...desired.sources === undefined ? {} : { sources: desired.sources },
    ...desired.tableClauses === undefined ? {} : { tableClauses: desired.tableClauses }
  });
  if (bound.kind === "err")
    return err([{ kind: "write", errors: bound.error }]);
  if (from !== undefined && from.dialect !== to.dialect)
    return err([{ kind: "dialect", from: from.dialect, to: to.dialect }]);
  if (from !== undefined && from.qualifier !== to.qualifier)
    return err([{ kind: "schema", from: from.qualifier, to: to.qualifier }]);
  const start = from ?? emptyState(to.dialect, to.naming, to.qualifier);
  const order = new Map;
  bound.value.statements.forEach((s, i) => {
    if (s.origin === "core" && s.group === "table" && s.of[0] !== undefined && !order.has(s.of[0]))
      order.set(s.of[0], i);
  });
  const changes = [...diff(from, to)];
  const rank = (c) => c.kind === "createTable" ? order.get(c.table.id) ?? 0 : 0;
  changes.sort((a, b) => a.kind === "createTable" && b.kind === "createTable" ? rank(a) - rank(b) : 0);
  const names = writeNames(schema, dialect, naming2, [], desired.schema);
  const x = expressor(dialect, naming2, names, []);
  const context = { dialect, naming: naming2, schema };
  const between = [];
  {
    let s = start;
    for (const c of changes) {
      const next = applyChange(s, c);
      between.push({ before: s, after: next });
      s = next;
    }
  }
  const q = (n) => dialect.quote(n);
  const tableByWords = (words) => schema.tables.find((t) => sameWords(t.name, words));
  const idOfTable = (words) => {
    const t = tableByWords(words);
    return t === undefined ? [] : [t.id];
  };
  const stmt = (group, sql, of) => ({ group, origin: "core", sql, of });
  const can = (f) => dialect.features.includes(f);
  const make = (c) => {
    const T = (t) => qualified(dialect, to.qualifier, t.name);
    const QI = (n) => qualified(dialect, to.qualifier, n);
    const sql = (...parts) => `${parts.join(" ")};`;
    const cols = (c2) => c2.text;
    switch (c.kind) {
      case "renameTable":
        return {
          class: "safe",
          reversibility: "lossless",
          up: [stmt("table", sql("ALTER TABLE", QI(c.fromName), "RENAME TO", q(c.toName)), idOfTable(c.toWords))],
          down: [stmt("table", sql("ALTER TABLE", QI(c.toName), "RENAME TO", q(c.fromName)), idOfTable(c.toWords))],
          of: idOfTable(c.toWords)
        };
      case "renameColumn":
        return {
          class: "safe",
          reversibility: "lossless",
          up: [stmt("table", sql("ALTER TABLE", T(c.table), "RENAME COLUMN", q(c.from.name), "TO", q(c.to.name)), [c.to.id])],
          down: [
            stmt("table", sql("ALTER TABLE", T(c.table), "RENAME COLUMN", q(c.to.name), "TO", q(c.from.name)), [c.to.id])
          ],
          of: [c.to.id]
        };
      case "dropConstraint": {
        const k = c.constraint;
        const of = [k.id];
        if (k.kind === "index")
          return {
            class: "safe",
            reversibility: "lossless",
            up: [stmt("index", sql("DROP INDEX", QI(k.name)), of)],
            down: [stmt("index", sql("CREATE INDEX IF NOT EXISTS", q(k.name), "ON", T(c.table), `(${cols(k)})`), of)],
            of
          };
        if (!can("add-constraint"))
          return { manualNeeded: `${dialect.name} cannot drop a constraint in place: the table must be made again` };
        return {
          class: "safe",
          reversibility: "lossless",
          up: [stmt("constraint", sql("ALTER TABLE", T(c.table), "DROP CONSTRAINT", q(k.name)), of)],
          down: [stmt("constraint", sql("ALTER TABLE", T(c.table), "ADD", k.text), of)],
          of
        };
      }
      case "renameConstraint": {
        const of = [c.to.id];
        if (c.from.kind === "index")
          return can("add-constraint") ? {
            class: "safe",
            reversibility: "lossless",
            up: [stmt("index", sql("ALTER INDEX", QI(c.from.name), "RENAME TO", q(c.to.name)), of)],
            down: [stmt("index", sql("ALTER INDEX", QI(c.to.name), "RENAME TO", q(c.from.name)), of)],
            of
          } : {
            class: "safe",
            reversibility: "lossless",
            up: [
              stmt("index", sql("DROP INDEX", QI(c.from.name)), of),
              stmt("index", sql("CREATE INDEX IF NOT EXISTS", q(c.to.name), "ON", T(c.table), `(${cols(c.to)})`), of)
            ],
            down: [
              stmt("index", sql("DROP INDEX", QI(c.to.name)), of),
              stmt("index", sql("CREATE INDEX IF NOT EXISTS", q(c.from.name), "ON", T(c.table), `(${cols(c.from)})`), of)
            ],
            of
          };
        if (!can("add-constraint"))
          return {
            class: "safe",
            reversibility: "lossless",
            up: [],
            down: [],
            of,
            why: "the name is only a name: the engine keeps the one it has"
          };
        return {
          class: "safe",
          reversibility: "lossless",
          up: [stmt("constraint", sql("ALTER TABLE", T(c.table), "RENAME CONSTRAINT", q(c.from.name), "TO", q(c.to.name)), of)],
          down: [stmt("constraint", sql("ALTER TABLE", T(c.table), "RENAME CONSTRAINT", q(c.to.name), "TO", q(c.from.name)), of)],
          of
        };
      }
      case "addColumn": {
        const t = tableByWords(c.table.words);
        const lc = t?.columns.find((k) => sameWords(k.name, c.column.words));
        if (t === undefined || lc === undefined)
          return { manualNeeded: "the column is not in the schema" };
        const refusal = dialect.addColumnRefusal?.({
          type: lc.type,
          nullable: lc.nullable,
          ...lc.default === undefined ? {} : { default: lc.default }
        });
        if (refusal !== undefined)
          return { manualNeeded: refusal };
        const required = !lc.nullable && lc.default === undefined;
        const of = [lc.id];
        return {
          class: required ? "data-dependent" : "safe",
          ...required ? { why: "the rows that are there have no value for a required column" } : {},
          reversibility: "lossless",
          up: [stmt("table", sql("ALTER TABLE", T(c.table), "ADD COLUMN", x.columnLine(t, lc, false)), of)],
          down: [stmt("table", sql("ALTER TABLE", T(c.table), "DROP COLUMN", q(c.column.name)), of)],
          of
        };
      }
      case "dropColumn":
        return {
          class: "destructive",
          why: `the values of ${c.table.name}.${c.column.name} are lost`,
          reversibility: "irreversible",
          up: [stmt("table", sql("ALTER TABLE", T(c.table), "DROP COLUMN", q(c.column.name)), [c.column.id])],
          of: [c.column.id]
        };
      case "alterType":
        return {
          manualNeeded: `the type of ${c.table.name}.${c.to.name} changes from ${c.from.type} to ${c.to.type}: it may lose data, so a person writes the step`
        };
      case "alterNullable": {
        if (!can("alter-column"))
          return { manualNeeded: `${dialect.name} cannot change whether a column may be null in place: the table must be made again` };
        const of = [c.to.id];
        const set = (nullable) => sql("ALTER TABLE", T(c.table), "ALTER COLUMN", q(c.to.name), nullable ? "DROP NOT NULL" : "SET NOT NULL");
        return {
          class: c.to.nullable ? "safe" : "data-dependent",
          ...c.to.nullable ? {} : { why: "the rows that are there may hold no value" },
          reversibility: "lossless",
          up: [stmt("table", set(c.to.nullable), of)],
          down: [stmt("table", set(c.from.nullable), of)],
          of
        };
      }
      case "alterDefault": {
        if (!can("alter-column"))
          return { manualNeeded: `${dialect.name} cannot change a default in place: the table must be made again` };
        const of = [c.to.id];
        const set = (d) => sql("ALTER TABLE", T(c.table), "ALTER COLUMN", q(c.to.name), d === undefined ? "DROP DEFAULT" : `SET DEFAULT ${d}`);
        return {
          class: "safe",
          reversibility: "lossless",
          up: [stmt("table", set(c.to.default), of)],
          down: [stmt("table", set(c.from.default), of)],
          of
        };
      }
      case "alterPrimaryKey":
        return {
          manualNeeded: `the primary key of ${c.table.name} changes from (${c.from.join(", ")}) to (${c.to.join(", ")}): a person writes the step`
        };
      case "alterClause":
        return {
          manualNeeded: `the clause of ${c.table.name} changes from ${c.from ?? "none"} to ${c.to ?? "none"}: a person writes the step`
        };
      case "createTable": {
        const ids = new Set([c.table.id, ...c.table.columns.map((k) => k.id), ...c.table.constraints.map((k) => k.id)]);
        const mine = bound.value.statements.filter((s) => s.origin === "core" && s.group !== "setup" && s.of.some((id) => ids.has(id)));
        return {
          class: "safe",
          reversibility: "lossless",
          up: mine.map((s) => ({ group: s.group, origin: "core", sql: s.sql, of: s.of })),
          down: [stmt("table", sql("DROP TABLE", QI(c.table.name)), [c.table.id])],
          of: [c.table.id]
        };
      }
      case "addConstraint": {
        const k = c.constraint;
        const of = [k.id];
        if (k.kind === "index")
          return {
            class: "safe",
            reversibility: "lossless",
            up: [stmt("index", sql("CREATE INDEX IF NOT EXISTS", q(k.name), "ON", T(c.table), `(${cols(k)})`), of)],
            down: [stmt("index", sql("DROP INDEX", QI(k.name)), of)],
            of
          };
        if (!can("add-constraint"))
          return { manualNeeded: `${dialect.name} cannot add a constraint to a table that exists: the table must be made again` };
        return {
          class: "data-dependent",
          why: "the rows that are there may not meet it",
          reversibility: "lossless",
          up: [stmt("constraint", sql("ALTER TABLE", T(c.table), "ADD", k.text), of)],
          down: [stmt("constraint", sql("ALTER TABLE", T(c.table), "DROP CONSTRAINT", q(k.name)), of)],
          of
        };
      }
      case "upsertRows": {
        const t = to.tables.find((k) => sameWords(k.words, c.table.words));
        if (t === undefined)
          return { manualNeeded: "the table is not in the state wanted" };
        const colNames = t.columns.map((k) => k.name);
        const key = t.primaryKey;
        const tuple = (r) => [r.code, r.label, r.description];
        const added = c.rows.filter((r) => !c.before.some((b) => b.code === r.code));
        const of = idOfTable(c.table.words);
        return {
          class: "safe",
          reversibility: "lossless",
          up: [stmt("data", upsert(dialect, c.table.name, colNames, key, c.rows.map(tuple), to.qualifier), of)],
          down: [
            ...added.length === 0 ? [] : [
              stmt("data", sql("DELETE FROM", T(c.table), "WHERE", q(key[0] ?? ""), "IN", `(${added.map((r) => dialect.literal(r.code)).join(", ")})`), of)
            ],
            ...c.before.length === 0 ? [] : [stmt("data", upsert(dialect, c.table.name, colNames, key, c.before.map(tuple), to.qualifier), of)]
          ],
          of
        };
      }
      case "removeRows": {
        const t = from?.tables.find((k) => sameWords(k.words, c.table.words));
        const key = t?.primaryKey[0] ?? "code";
        const of = idOfTable(c.table.words);
        return {
          class: "destructive",
          why: `the codes ${c.rows.map((r) => r.code).join(", ")} of ${c.table.name} are removed`,
          reversibility: "lossless",
          up: [
            stmt("data", sql("DELETE FROM", T(c.table), "WHERE", q(key), "IN", `(${c.rows.map((r) => dialect.literal(r.code)).join(", ")})`), of)
          ],
          down: [
            stmt("data", upsert(dialect, c.table.name, t?.columns.map((k) => k.name) ?? [], t?.primaryKey ?? [], c.rows.map((r) => [r.code, r.label, r.description])), of)
          ],
          of
        };
      }
      case "dropTable":
        return {
          class: "destructive",
          why: `the table ${c.table.name} and its rows are lost`,
          reversibility: "irreversible",
          up: [stmt("table", sql("DROP TABLE", QI(c.table.name)), [c.table.id])],
          of: [c.table.id]
        };
    }
  };
  const nameOf = (c) => {
    switch (c.kind) {
      case "renameTable":
        return `rename table ${c.fromName} to ${c.toName}`;
      case "renameColumn":
        return `rename column ${c.table.name}.${c.from.name} to ${c.to.name}`;
      case "dropConstraint":
        return `drop ${c.constraint.kind} ${c.constraint.name} of ${c.table.name}`;
      case "renameConstraint":
        return `rename ${c.from.kind} ${c.from.name} of ${c.table.name} to ${c.to.name}`;
      case "addColumn":
        return `add column ${c.table.name}.${c.column.name}`;
      case "dropColumn":
        return `drop column ${c.table.name}.${c.column.name}`;
      case "alterType":
        return `change the type of ${c.table.name}.${c.to.name}`;
      case "alterNullable":
        return `${c.to.nullable ? "allow" : "refuse"} null in ${c.table.name}.${c.to.name}`;
      case "alterDefault":
        return `change the default of ${c.table.name}.${c.to.name}`;
      case "alterPrimaryKey":
        return `change the primary key of ${c.table.name}`;
      case "alterClause":
        return `change the clause of ${c.table.name}`;
      case "createTable":
        return `create table ${c.table.name}`;
      case "addConstraint":
        return `add ${c.constraint.kind} ${c.constraint.name} to ${c.table.name}`;
      case "upsertRows":
        return `load the rows of ${c.table.name}`;
      case "removeRows":
        return `remove rows of ${c.table.name}`;
      case "dropTable":
        return `drop table ${c.table.name}`;
    }
  };
  const handWritten = (of, guard) => (s) => ({
    ...stmt("table", s.trim().endsWith(";") ? s.trim() : `${s.trim()};`, of),
    ...guard === undefined ? {} : { guard }
  });
  const manual = new Map((options.manual ?? []).map((m) => [m.resolves, m]));
  const used = new Set;
  const drafts = [];
  for (const [index, c] of changes.entries()) {
    const sc = { ...context, ...between[index] ?? { before: start, after: start } };
    let made = make(c);
    if ("manualNeeded" in made && options.fallback !== undefined && !manual.has(c.key)) {
      const f = options.fallback(c, made.manualNeeded, sc);
      if (f !== undefined)
        made = f;
    }
    const base = { kind: c.kind, key: c.key, name: nameOf(c) };
    const m = manual.get(c.key);
    if (m !== undefined) {
      used.add(c.key);
      const of = "of" in made ? made.of : [];
      let written = {
        ...base,
        name: m.name,
        class: "manual",
        why: "written by a person",
        reversibility: m.down === undefined ? "irreversible" : "lossless",
        up: m.up.map(handWritten(of, m.guard)),
        ...m.down === undefined ? {} : { down: m.down.map(handWritten(of, m.guard)) },
        ...m.guard === undefined ? {} : { idempotency: "guarded" },
        change: c,
        of,
        manual: true
      };
      for (const t of options.transforms ?? [])
        written = t(written, sc);
      if (options.requireIdempotent === true && written.idempotency === "ledger-only")
        errors.push({ kind: "not-idempotent", key: written.key, name: written.name });
      drafts.push({ change: c, draft: written });
      continue;
    }
    if ("manualNeeded" in made) {
      errors.push({ kind: "manual", key: c.key, name: base.name, why: made.manualNeeded });
      continue;
    }
    let draft = { ...base, ...made, change: c, manual: false };
    for (const t of options.transforms ?? [])
      draft = t(draft, sc);
    if (draft.class === "destructive" && options.allow?.destructive !== true)
      errors.push({ kind: "refused", key: c.key, name: base.name, class: draft.class, why: draft.why ?? "it loses data" });
    if (options.requireIdempotent === true && draft.idempotency === "ledger-only")
      errors.push({ kind: "not-idempotent", key: draft.key, name: draft.name });
    drafts.push({ change: c, draft });
  }
  for (const k of manual.keys())
    if (!used.has(k))
      errors.push({ kind: "unresolved", resolves: k });
  const toHash = stateHash(to);
  const steps = [];
  let state = start;
  let at = stateHash(state);
  const fromHash = at;
  drafts.forEach(({ draft, change }, i) => {
    state = applyChange(state, change);
    const last = i === drafts.length - 1;
    const next = stateHash(last ? { ...state, naming: to.naming } : state);
    const id = stepIdOf({ from: at, to: next, key: draft.key, up: draft.up, verify: draft.verify });
    steps.push({ ...draft, id, from: at, to: next });
    at = next;
  });
  if (errors.length === 0 && at !== toHash && !(drafts.length === 0 && stateHash({ ...start, naming: to.naming }) === toHash))
    errors.push({ kind: "inconsistent", expected: toHash, got: at });
  if (errors.length > 0)
    return err(errors);
  const units = new Map;
  for (const s of bound.value.statements) {
    if (!(s.origin === "extension" || s.group === "setup"))
      continue;
    const key = `${s.group}:${s.of.join(",")}`;
    const unit = units.get(key) ?? { statements: [], of: new Set };
    unit.statements.push(s);
    for (const id of s.of)
      unit.of.add(id);
    units.set(key, unit);
  }
  const repeatable = [...units].map(([key, u]) => ({
    key,
    hash: hashOf(u.statements.map((x) => x.sql)),
    statements: u.statements,
    of: [...u.of]
  }));
  return ok({ dialect: dialect.name, from: fromHash, to: toHash, steps, repeatable });
}
var stepIdOf = (s) => hashOf({ from: s.from, to: s.to, key: s.key, up: s.up.map((x) => [x.sql, x.guard]), verify: s.verify }), fallbackPoint, transformPoint;
var init_plan = __esm(() => {
  init_mod();
  init_api();
  init_api3();
  init_api4();
  init_hash();
  init_state();
  fallbackPoint = point("lifecycle.fallback");
  transformPoint = point("lifecycle.transform");
});

// sql/lifecycle/run.ts
async function readLedger(driver, dialect, table = LEDGER) {
  const rows = await driver.query(`SELECT * FROM ${dialect.quote(table)} ORDER BY ${dialect.quote("seq")}`);
  return rows.map((r) => ({
    seq: Number(r["seq"]),
    kind: String(r["kind"]),
    key: String(r["key"]),
    name: String(r["name"]),
    from: String(r["from_state"]),
    to: String(r["to_state"]),
    hash: String(r["hash"]),
    chain: String(r["chain"]),
    appliedAt: String(r["applied_at"]),
    appliedBy: String(r["applied_by"])
  }));
}
var LEDGER = "lifecycle_ledger";
var init_run = __esm(() => {
  init_mod();
  init_ledger();
  init_plan();
});

// sql/lifecycle/api.ts
var init_api5 = __esm(() => {
  init_hash();
  init_ledger();
  init_plan();
  init_run();
  init_state();
});

// models/identity/codes.ts
var exports_codes = {};
__export(exports_codes, {
  actorKind: () => actorKind,
  assuranceLevel: () => assuranceLevel,
  auditOutcome: () => auditOutcome,
  authMethod: () => authMethod,
  challengePurpose: () => challengePurpose,
  claimMethod: () => claimMethod,
  claimStatus: () => claimStatus,
  createdVia: () => createdVia,
  credentialKind: () => credentialKind,
  credentialStatus: () => credentialStatus,
  decision: () => decision,
  domainPolicy: () => domainPolicy,
  groupSource: () => groupSource,
  invitationStatus: () => invitationStatus,
  loginOutcome: () => loginOutcome,
  membershipSource: () => membershipSource,
  membershipStatus: () => membershipStatus,
  mfaRequirement: () => mfaRequirement,
  otpAlgorithm: () => otpAlgorithm,
  passwordAlgorithm: () => passwordAlgorithm,
  principalKind: () => principalKind,
  principalStatus: () => principalStatus,
  revokedReason: () => revokedReason,
  sessionStatus: () => sessionStatus,
  unlockMode: () => unlockMode,
  useStatus: () => useStatus,
  verificationMethod: () => verificationMethod
});

// models/identity-access/codes.ts
var exports_codes2 = {};
__export(exports_codes2, {
  assignmentStatus: () => assignmentStatus,
  assignmentVia: () => assignmentVia,
  entitlementSource: () => entitlementSource,
  riskLevel: () => riskLevel,
  roleKind: () => roleKind,
  separationKind: () => separationKind,
  sideEffect: () => sideEffect
});

// sql/cli/main.ts
import { existsSync as existsSync7 } from "node:fs";
import { resolve as resolve2 } from "node:path";

// sql/cli/config.ts
init_mod();
init_api2();

// models/arca/party.ts
init_api2();
var { ownership, privacy, quality, requirements, security, usage } = exports_mod;
var held = (category, ...purposes) => annotate(privacy.personal, { category, purposes });
var cites2 = (...frs) => annotate(requirements.cites, frs.map((fr) => `0004-arca ${fr}`));
var confidential = annotate(security.classification, "confidential");
var open = annotate(quality.openness, "open");
var closed = annotate(quality.openness, "closed");
var partyKind = codeList("partyKind", {
  definition: "The kinds of party: a person or an organization",
  codes: {
    person: { label: "Person", definition: "A human being" },
    organization: { label: "Organization", definition: "A company, agency, club or any other body" }
  },
  annotations: [open, cites2("FR-006")]
});
var partyRoleKind = codeList("partyRoleKind", {
  definition: "The roles a party may play, such as customer, supplier or employee",
  codes: {
    customer: { label: "Customer", definition: "Buys from the business" },
    supplier: { label: "Supplier", definition: "Sells to the business" },
    employee: { label: "Employee", definition: "Works for the business under a contract of employment" },
    contact: { label: "Contact", definition: "Speaks for another party" }
  },
  annotations: [open, cites2("FR-006")]
});
var partyRelationKind = codeList("partyRelationKind", {
  definition: "The ways one party may be related to another",
  codes: {
    employedBy: { label: "Employed by", definition: "A person works for an organization" },
    memberOf: { label: "Member of", definition: "A party belongs to an organization" },
    subsidiaryOf: { label: "Subsidiary of", definition: "An organization is controlled by another" }
  },
  annotations: [open, cites2("FR-006")]
});
var partyIdentifierKind = codeList("partyIdentifierKind", {
  definition: "The kinds of identifier a party may hold",
  codes: {
    taxNumber: { label: "Tax number", definition: "A number a tax authority issued" },
    passportNumber: { label: "Passport number", definition: "The number of a passport a state issued" },
    companyRegistration: { label: "Company registration", definition: "The number a register of companies issued" }
  },
  annotations: [open, cites2("FR-006")]
});
var contactMedium = codeList("contactMedium", {
  definition: "The media by which a party may be reached over a network",
  codes: { email: { label: "Email" }, telephone: { label: "Telephone" }, web: { label: "Web" } },
  annotations: [closed, cites2("FR-006")]
});
var addressPurpose = codeList("addressPurpose", {
  definition: "What a postal address is used for: where a party lives, works, is billed or receives deliveries",
  codes: { home: { label: "Home" }, work: { label: "Work" }, billing: { label: "Billing" }, delivery: { label: "Delivery" } },
  annotations: [closed, cites2("FR-006")]
});
var party = concept("party", {
  definition: "Anyone or anything a business deals with as one, whether a person or an organization",
  attributes: {
    partyId: attribute2(identifier(), { definition: "What identifies the party, made by the application when the party is created" }),
    kind: attribute2(codeOf2(partyKind), { definition: "Whether the party is a person or an organization" }),
    displayName: attribute2(text(), {
      definition: "The name the party is shown by, whatever its parts are",
      annotations: [held("Name", "show who the party is")]
    })
  },
  identifiedBy: ["partyId"],
  annotations: [confidential, cites2("FR-002", "FR-003", "FR-005")]
});
var person = concept("person", {
  definition: "A party who is a human being; what is true of a person and not of every party",
  attributes: {
    givenName: attribute2(text(), {
      definition: "The name a person is given, as they write it",
      annotations: [held("Name", "address the person by name")]
    }),
    familyName: attribute2(text(), {
      definition: "The name a person shares with their family, as they write it",
      annotations: [held("Name", "address the person by name")]
    }),
    birthDate: attribute2(date(), {
      definition: "The day the person was born",
      multiplicity: "optional",
      annotations: [held("BirthDate", "know the person's age and what they may do")]
    })
  },
  identifiedBy: ["party"],
  relationships: { party: relationship(party, { cardinality: "one", definition: "The party the person is" }) },
  annotations: [
    confidential,
    cites2("FR-002", "FR-003", "FR-005", "FR-008"),
    annotate(usage.lookup, { members: ["familyName", "givenName"] })
  ]
});
var organization = concept("organization", {
  definition: "A party that is a company, an agency, a club or any other body",
  attributes: {
    legalName: attribute2(text(), { definition: "The name the organization is registered under" }),
    foundedOn: attribute2(date(), { definition: "The day the organization was founded", multiplicity: "optional" })
  },
  identifiedBy: ["party"],
  relationships: { party: relationship(party, { cardinality: "one", definition: "The party the organization is" }) },
  annotations: [cites2("FR-002", "FR-003")]
});
var partyRole = concept("partyRole", {
  definition: "A role a party plays for a time: the same party may be a customer and a supplier at once",
  attributes: {
    partyRoleId: attribute2(identifier(), { definition: "What identifies this playing of a role" }),
    kind: attribute2(codeOf2(partyRoleKind), { definition: "The role played" }),
    validFrom: attribute2(date(), { definition: "The first day the party played the role" }),
    validTo: attribute2(date(), {
      definition: "The last day the party played the role; empty while they still do",
      multiplicity: "optional"
    })
  },
  identifiedBy: ["partyRoleId"],
  relationships: { party: relationship(party, { cardinality: "one", definition: "The party who plays the role" }) },
  annotations: [cites2("FR-002", "FR-008"), annotate(usage.lookup, { members: ["party", "kind"] })]
});
var partyRelation = concept("partyRelation", {
  definition: "A relation between two parties for a time, read from the first to the second: Ada is employed by Analytical Engines",
  attributes: {
    partyRelationId: attribute2(identifier(), { definition: "What identifies the relation" }),
    kind: attribute2(codeOf2(partyRelationKind), { definition: "The way the first party is related to the second" }),
    validFrom: attribute2(date(), { definition: "The first day the relation held" }),
    validTo: attribute2(date(), { definition: "The last day the relation held; empty while it still does", multiplicity: "optional" })
  },
  identifiedBy: ["partyRelationId"],
  relationships: {
    from: relationship(party, { cardinality: "one", definition: "The party the relation is read from" }),
    to: relationship(party, { cardinality: "one", definition: "The party the relation is read to" })
  },
  annotations: [
    cites2("FR-002", "FR-008"),
    annotate(quality.differs, { name: "partiesDiffer", members: ["from", "to"] }),
    annotate(usage.lookup, { members: ["from"] }),
    annotate(usage.lookup, { members: ["to"] })
  ]
});
var partyIdentifier = concept("partyIdentifier", {
  definition: "An identifier a party holds, as someone else issued it: a tax number, a passport number; a party holds one of a kind once",
  attributes: {
    partyIdentifierId: attribute2(identifier(), { definition: "What identifies the identifier as Arca keeps it" }),
    kind: attribute2(codeOf2(partyIdentifierKind), { definition: "The kind of identifier" }),
    identifier: attribute2(text(), {
      definition: "The identifier itself, as it was issued",
      annotations: [held("Identifier", "identify the party to authorities and counterparties")]
    }),
    issuedBy: attribute2(text(), { definition: "Who issued the identifier", multiplicity: "optional" })
  },
  identifiedBy: ["partyIdentifierId"],
  relationships: { party: relationship(party, { cardinality: "one", definition: "The party who holds the identifier" }) },
  annotations: [confidential, cites2("FR-002", "FR-005", "FR-008"), annotate(quality.unique, { members: ["party", "kind"] })]
});
var electronicContact = concept("electronicContact", {
  definition: "A way to reach a party over a network: an email address, a telephone number, a web address",
  attributes: {
    electronicContactId: attribute2(identifier(), { definition: "What identifies the contact point" }),
    medium: attribute2(codeOf2(contactMedium), { definition: "Whether this is an email address, a telephone number or a web address" }),
    address: attribute2(text(), { definition: "The address or number itself", annotations: [held("Contact", "reach the party")] }),
    isPrimary: attribute2(boolean2(), {
      definition: "Whether this is the first way to try for its medium",
      annotations: [annotate(quality.defaultValue, false)]
    })
  },
  identifiedBy: ["electronicContactId"],
  relationships: { party: relationship(party, { cardinality: "one", definition: "The party reached this way" }) },
  annotations: [confidential, cites2("FR-002", "FR-005", "FR-008"), annotate(usage.lookup, { members: ["party", "medium"] })]
});
var addressPart = (definition, optional = false) => attribute2(text(), {
  definition,
  multiplicity: optional ? "optional" : "required",
  annotations: [held("PhysicalAddress", "reach the party by post", "find where the party is")]
});
var postalAddress = concept("postalAddress", {
  definition: "A place a party receives post or may be visited",
  attributes: {
    postalAddressId: attribute2(identifier(), { definition: "What identifies the address" }),
    purpose: attribute2(codeOf2(addressPurpose), {
      definition: "What the address is used for: where the party lives, is billed or receives deliveries"
    }),
    line1: addressPart("The first line: usually the building and the street"),
    line2: addressPart("The second line, where there is one", true),
    locality: addressPart("The town or city"),
    region: addressPart("The state, province or county, where the country uses one", true),
    postalCode: addressPart("The postal code, where the country uses one", true),
    countryCode: attribute2(text({ max: 2 }), {
      definition: "The country, as its two-letter ISO 3166-1 code",
      annotations: [held("Country", "address the party")]
    })
  },
  identifiedBy: ["postalAddressId"],
  relationships: { party: relationship(party, { cardinality: "one", definition: "The party found at the address" }) },
  annotations: [confidential, cites2("FR-002", "FR-005", "FR-008"), annotate(usage.lookup, { members: ["party"] })]
});
var partyDomain = domain("arcaParty", {
  definition: "The people and organizations a business deals with, how they relate, what roles they play, how they are identified and how they are reached",
  concepts: [party, person, organization, partyRole, partyRelation, partyIdentifier, electronicContact, postalAddress],
  codeLists: [partyKind, partyRoleKind, partyRelationKind, partyIdentifierKind, contactMedium, addressPurpose],
  annotations: [annotate(ownership.owner, "arca"), annotate(quality.audited, { removal: "mark" }), cites2("FR-001", "FR-007")]
});
// models/arca-tenancy/tenancy.ts
init_api2();
var { quality: quality2, requirements: requirements2, security: security2, usage: usage2 } = exports_mod;
var cites3 = (...frs) => annotate(requirements2.cites, frs.map((fr) => `0029-arca-tenancy ${fr}`));
var internal = annotate(security2.classification, "internal");
var tenantKind = codeList("tenantKind", {
  definition: "What a tenant is in the hierarchy of boundaries",
  codes: {
    platform: { label: "Platform", definition: "The vendor's own boundary, the root of every other" },
    reseller: { label: "Reseller", definition: "A business that serves businesses of its own on the platform" },
    business: { label: "Business", definition: "A business that is a customer of the platform" },
    consumerPool: { label: "Consumer pool", definition: "The consumers of a business, kept apart from its staff and from other businesses' consumers" }
  },
  annotations: [annotate(quality2.openness, "closed"), cites3("FR-002")]
});
var tenantStatus = codeList("tenantStatus", {
  definition: "Where a tenant is in its life",
  codes: {
    active: { label: "Active", definition: "In use" },
    suspended: { label: "Suspended", definition: "Held: nothing may be done in it, and nothing is lost" },
    closed: { label: "Closed", definition: "Ended: kept only as long as its data is" }
  },
  annotations: [annotate(quality2.openness, "closed"), cites3("FR-002")]
});
var isolation = codeList("isolation", {
  definition: "How much of the platform a tenant has to itself",
  codes: {
    shared: { label: "Shared", definition: "Its rows are kept apart from others' by its scope, in tables others use too" },
    dedicated: { label: "Dedicated", definition: "Its data is kept in a place of its own" }
  },
  annotations: [annotate(quality2.openness, "closed"), cites3("FR-002")]
});
var tenant = concept("tenant", {
  definition: "A boundary that separates one customer's data from another's, in a hierarchy of boundaries",
  attributes: {
    tenantId: attribute2(identifier(), { definition: "What identifies the tenant, made by the application when it is created" }),
    kind: attribute2(codeOf2(tenantKind), { definition: "What the tenant is in the hierarchy" }),
    slug: attribute2(text(), { definition: "The short name the tenant is addressed by, unique among tenants" }),
    displayName: attribute2(text(), { definition: "The name the tenant is shown by" }),
    ancestry: attribute2(text(), {
      definition: "The path of the tenant's parents from the root, kept by the operation that moves a tenant, so that a subtree is one query"
    }),
    status: attribute2(codeOf2(tenantStatus), { definition: "Where the tenant is in its life" }),
    isolation: attribute2(codeOf2(isolation), { definition: "How much of the platform the tenant has to itself" }),
    createdAt: attribute2(instant(), { definition: "When the tenant was made" })
  },
  identifiedBy: ["tenantId"],
  relationships: {
    organization: relationship(organization, {
      cardinality: "optional",
      definition: "The organization the tenant is for; a pool of consumers has none"
    }),
    parent: relationship(() => tenant, { cardinality: "optional", definition: "The tenant this one is under; the root has none" })
  },
  annotations: [
    internal,
    cites3("FR-001", "FR-002", "FR-003"),
    annotate(quality2.unique, { members: ["slug"] }),
    annotate(quality2.differs, { name: "tenant_not_its_own_parent", members: ["tenantId", "parent"] }),
    annotate(usage2.lookup, { members: ["parent"] })
  ]
});
var tenancyModule = defineModule({
  name: "arcaTenancy",
  definition: "The boundaries that separate one customer's data from another's, and their hierarchy",
  requires: [partyDomain.kind === "ok" ? partyDomain.value.name : "arcaParty"],
  concepts: [tenant],
  codeLists: [tenantKind, tenantStatus, isolation]
});
// models/identity/mod.ts
init_api2();

// models/identity/kit.ts
init_api2();
var { quality: quality3, requirements: requirements3, security: security3, usage: usage3, privacy: privacy2 } = exports_mod;
var citing = (spec) => (...frs) => annotate(requirements3.cites, frs.map((fr) => `${spec} ${fr}`));
var cites4 = citing("0030-identity");
var restricted = annotate(security3.classification, "restricted");
var confidential2 = annotate(security3.classification, "confidential");
var internal2 = annotate(security3.classification, "internal");
var keep = (days) => annotate(quality3.retention, { days });
var held2 = (category, ...purposes) => annotate(privacy2.personal, { category, purposes });
var unique2 = (...members) => annotate(quality3.unique, { members });
var lookup2 = (...members) => annotate(usage3.lookup, { members });
var req = (type, definition, ...annotations) => attribute2(type, { definition, annotations });
var opt = (type, definition, ...annotations) => attribute2(type, { definition, multiplicity: "optional", annotations });
var many2 = (type, definition, ...annotations) => attribute2(type, { definition, multiplicity: "many", annotations });
var key = (what) => attribute2(identifier(), { definition: `What identifies ${what}, made by the application` });
var one2 = (to, definition) => relationship(to, { cardinality: "one", definition });
var maybe = (to, definition) => relationship(to, { cardinality: "optional", definition });
var list2 = (name, definition, codes, open = false) => codeList(name, {
  definition,
  codes: Object.fromEntries(Object.entries(codes).map(([code, d]) => [
    code,
    { label: code.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()), definition: d }
  ])),
  annotations: [annotate(quality3.openness, open ? "open" : "closed"), annotate(requirements3.cites, ["0032-identity-principals FR-003"])]
});

// models/identity/codes.ts
var principalKind = list2("principalKind", "What can be granted a role, own a key or act", {
  user: "A person who signs in",
  machine: "A service, a workload, a pipeline or an integration: a program that acts for itself",
  device: "A managed endpoint, a server or a thing: hardware that has an identity",
  agent: "An AI agent: software that decides for itself what to do, and is accountable to an owner",
  group: "A set of principals, granted what its members are"
});
var principalStatus = list2("principalStatus", "Where a principal is in its life", {
  pending: "Made, and not yet usable",
  active: "In use, and able to act",
  suspended: "Held by an administrator, with nothing lost",
  disabled: "Switched off: it can do nothing, and its credentials and delegations stop working",
  deleted: "Ended, with what is personal erased and the record kept for the audit trail"
});
var decision = list2("decision", "What an authorization decision was", { allow: "It was allowed", deny: "It was refused" });
var createdVia = list2("createdVia", "How a user account came to be", {
  invited: "By an invitation that was accepted",
  selfSignup: "By the person signing up",
  directory: "By a directory that pushed it",
  federated: "By signing in through an identity provider for the first time",
  admin: "By an administrator"
});
var membershipStatus = list2("membershipStatus", "Where a membership is", {
  invited: "Offered and not yet accepted",
  active: "In force, and the user is a member",
  suspended: "Held by an administrator, and nothing is lost",
  removed: "Ended, and the user is no longer a member"
});
var membershipSource = list2("membershipSource", "How a user came to be a member of a tenant", {
  invited: "By an invitation that was accepted",
  directory: "Pushed by a directory",
  domainCapture: "Captured by the tenant's verified domain",
  selfJoin: "Joined on their own",
  admin: "Added by an administrator"
});
var groupSource = list2("groupSource", "Where a group is kept", { local: "Made and kept here", directory: "Kept by a directory and mirrored here" });
var credentialKind = list2("credentialKind", "What a principal proves itself with", {
  password: "A secret the person remembers",
  passkey: "A key pair held by the person's device, signed with by WebAuthn",
  totp: "A code made from a shared secret and the time",
  securityKey: "A hardware key",
  smsOtp: "A code sent by text message",
  emailOtp: "A code sent by email",
  recoveryCode: "A code kept for when the other ways are lost",
  pushDevice: "A device that is asked to approve",
  apiKey: "A random secret that a program presents, kept as a keyed hash",
  clientSecret: "A secret that an OAuth client presents, kept as a hash",
  keyPair: "A key pair, of which only the public half is kept",
  certificate: "A certificate, of which only the public half is kept",
  workloadAttestation: "What a platform says of the workload that runs"
}, true);
var credentialStatus = list2("credentialStatus", "Where a credential is", { active: "In use, and trusted", revoked: "Ended by a person or a policy", expired: "Ended by time" });
var passwordAlgorithm = list2("passwordAlgorithm", "How a password is hashed", { argon2id: "The memory-hard Argon2id hash", scrypt: "The memory-hard scrypt hash", bcrypt: "The bcrypt hash", pbkdf2: "The PBKDF2 key derivation" }, true);
var otpAlgorithm = list2("otpAlgorithm", "The hash a one-time code is made with", { sha1: "The SHA-1 hash, the default of authenticator apps", sha256: "The SHA-256 hash", sha512: "The SHA-512 hash" });
var challengePurpose = list2("challengePurpose", "What a challenge is for", {
  login: "Signing in",
  emailVerification: "Proving an address is the person's",
  passwordReset: "Choosing a new password",
  magicLink: "Signing in by a link",
  stepUp: "Proving again before something that matters",
  passkeyRegistration: "Registering a passkey",
  passkeyAuthentication: "Signing in with a passkey"
});
var loginOutcome = list2("loginOutcome", "How a sign-in attempt ended", {
  success: "It succeeded",
  wrongSecret: "The secret was wrong",
  unknownUser: "There was no such user",
  locked: "The account was locked",
  mfaFailed: "The second factor failed",
  blocked: "A policy refused it"
});
var sessionStatus = list2("sessionStatus", "Where a session is", { active: "In use, and valid", expired: "Ended by time", revoked: "Ended by a person or a policy", signedOut: "Ended by the user" });
var assuranceLevel = list2("assuranceLevel", "How sure a session is of who it is for, in the sense of NIST SP 800-63B", {
  aal1: "One factor",
  aal2: "Two factors",
  aal3: "Two factors, one a hardware key"
});
var authMethod = list2("authMethod", "How a session was authenticated", {
  password: "By a password",
  passkey: "By a passkey",
  totp: "By a one-time code",
  federated: "Through an identity provider",
  recoveryCode: "By a recovery code",
  magicLink: "By a link"
});
var revokedReason = list2("revokedReason", "Why a session ended early", {
  user: "The user ended it",
  admin: "An administrator ended it",
  reuseDetected: "A refresh token was used twice",
  policy: "A policy ended it",
  passwordChange: "The password was changed",
  risk: "A risk signal ended it"
});
var invitationStatus = list2("invitationStatus", "Where an invitation is", { pending: "Sent, and waiting to be taken up", accepted: "Taken up by the person invited", expired: "Left until it ran out", revoked: "Withdrawn" });
var claimMethod = list2("claimMethod", "How a domain is proved to be a tenant's", { dnsTxt: "By a DNS TXT record", httpFile: "By a file on the domain's site", email: "By an email to an address of the domain" });
var claimStatus = list2("claimStatus", "Where a claim on a domain is", { pending: "Waiting to be proved", failed: "Not proved", expired: "Left until it ran out" });
var domainPolicy = list2("domainPolicy", "What a verified domain makes of those who sign in with it", {
  none: "Nothing follows from it",
  captureUsers: "Their accounts join the tenant",
  enforceSso: "They must sign in through the tenant's identity provider"
});
var unlockMode = list2("unlockMode", "How a locked account is freed", { timer: "By time passing", admin: "By an administrator", selfService: "By the user proving who they are" });
var mfaRequirement = list2("mfaRequirement", "Whether a second factor is needed", { none: "Never asked for", optional: "Asked for if the user chooses to", required: "Always asked for", adaptive: "Asked for when the risk calls for it" });
var actorKind = list2("actorKind", "What did something", { user: "A person acting for themselves", machine: "A program", device: "A device", agent: "An AI agent", system: "The platform itself, with no one acting", impersonator: "A person acting as another, with leave" });
var auditOutcome = list2("auditOutcome", "How something that was tried ended", { success: "It was done", failure: "It failed", denied: "It was refused" });
var verificationMethod = list2("verificationMethod", "How an address was proved to be a person's", {
  emailLink: "By a link sent to it",
  otp: "By a code sent to it",
  directoryAsserted: "By the directory it came from",
  admin: "By an administrator"
});
var useStatus = list2("useStatus", "Whether a thing is in use", { active: "In use, and applied", retired: "No longer applied, and kept for the record" });

// models/identity/concepts.ts
init_api2();
var { quality: quality4 } = exports_mod;
var principal = concept("principal", {
  definition: "Anyone or anything that can be granted a role, own a key or act: a person, a machine, a device, an AI agent or a group",
  attributes: {
    principalId: key("the principal"),
    kind: req(codeOf2(principalKind), "Whether the principal is a user, a machine, a device, an agent or a group"),
    displayName: opt(text(), "The name the principal is shown by", held2("Name", "show who did something")),
    status: req(codeOf2(principalStatus), "Where the principal is in its life; making it disabled denies everything it could do, at once", annotate(quality4.transitions, {
      allowed: { pending: ["active", "disabled", "deleted"], active: ["suspended", "disabled", "deleted"], suspended: ["active", "disabled", "deleted"], disabled: ["active", "deleted"], deleted: [] }
    })),
    statusReason: opt(text(), "Why the principal is in the status it is in"),
    statusChangedAt: req(instant(), "When the principal's status last changed"),
    createdAt: req(instant(), "When the principal was made")
  },
  identifiedBy: ["principalId"],
  relationships: {
    tenant: maybe(tenant, "The tenant that owns the principal; empty for a user who joins tenants by membership"),
    owner: maybe(() => principal, "The person or group accountable for the principal; required of a machine, a device and an agent by the operation that makes them")
  },
  annotations: [
    confidential2,
    citing("0032-identity-principals")("FR-001", "FR-002"),
    annotate(quality4.differs, { name: "principal_not_its_own_owner", members: ["principalId", "owner"] }),
    lookup2("kind", "status"),
    lookup2("owner")
  ]
});
var userAccount = concept("userAccount", {
  definition: "A person's way in: who signs in, and where it stands",
  attributes: {
    loginIdentifier: req(text(), "What the user signs in by, unique within its home tenant", held2("Username", "let the user sign in")),
    createdVia: req(codeOf2(createdVia), "How the account came to be"),
    lockedUntil: opt(instant(), "Until when the account is locked, where it is"),
    lastAuthenticatedAt: opt(instant(), "When the user last proved who they are"),
    locale: opt(text(), "The language the user wants to be spoken to in"),
    timeZone: opt(text(), "The time zone the user's times are shown in")
  },
  identifiedBy: ["principal"],
  relationships: {
    principal: one2(principal, "The principal the account is"),
    person: one2(person, "The person the account is for"),
    homeTenant: maybe(tenant, "The tenant whose pool of users it is in; empty for a user who joins tenants by membership"),
    primaryEmail: maybe(electronicContact, "The address the user is written to")
  },
  annotations: [confidential2, cites4("FR-001", "FR-002"), unique2("homeTenant", "loginIdentifier"), lookup2("person")]
});
var contactVerification = concept("contactVerification", {
  definition: "The proof that an address is a person's",
  attributes: {
    contactVerificationId: key("the verification"),
    verifiedAt: req(instant(), "When the address was proved to be the person's"),
    method: req(codeOf2(verificationMethod), "How it was proved")
  },
  identifiedBy: ["contactVerificationId"],
  relationships: { contact: one2(electronicContact, "The address that was proved") },
  annotations: [confidential2, cites4("FR-001"), unique2("contact")]
});
var membership = concept("membership", {
  definition: "A user's place in a tenant",
  attributes: {
    membershipId: key("the membership"),
    status: req(codeOf2(membershipStatus), "Where the membership is"),
    source: req(codeOf2(membershipSource), "How the user came to be a member"),
    joinedAt: opt(instant(), "When the user became a member"),
    removedAt: opt(instant(), "When the membership ended")
  },
  identifiedBy: ["membershipId"],
  relationships: { userAccount: one2(userAccount, "The user"), tenant: one2(tenant, "The tenant") },
  annotations: [confidential2, cites4("FR-001", "FR-002"), unique2("userAccount", "tenant"), lookup2("tenant")]
});
var userGroup = concept("userGroup", {
  definition: "A set of principals that is granted what its members are",
  attributes: {
    name: req(text(), "What the group is called, unique within its tenant"),
    source: req(codeOf2(groupSource), "Where the group is kept"),
    externalId: opt(text(), "What a directory calls the group, where it keeps it")
  },
  identifiedBy: ["principal"],
  relationships: { principal: one2(principal, "The principal the group is"), tenant: one2(tenant, "The tenant the group is in") },
  annotations: [internal2, cites4("FR-001"), unique2("tenant", "name")]
});
var groupMember = concept("groupMember", {
  definition: "A principal's place in a group: a user, or another group",
  attributes: { addedAt: req(instant(), "When the principal was added") },
  identifiedBy: ["group", "member"],
  relationships: { group: one2(userGroup, "The group"), member: one2(principal, "The user or the group that is a member") },
  annotations: [internal2, cites4("FR-001"), lookup2("member")]
});
var credential = concept("credential", {
  definition: "What a principal proves itself with; the secret is in the kind of credential",
  attributes: {
    credentialId: key("the credential"),
    kind: req(codeOf2(credentialKind), "What sort of proof it is"),
    status: req(codeOf2(credentialStatus), "Where it is"),
    label: opt(text(), "What the person calls it"),
    createdAt: req(instant(), "When it was made"),
    lastUsedAt: opt(instant(), "When it was last used"),
    revokedAt: opt(instant(), "When it ended, where it did")
  },
  identifiedBy: ["credentialId"],
  relationships: { principal: one2(principal, "Whose it is") },
  annotations: [restricted, cites4("FR-005", "FR-007"), lookup2("principal")]
});
var passwordCredential = concept("passwordCredential", {
  definition: "A password, kept only as a hash that carries its algorithm, its parameters and its salt",
  attributes: {
    hash: req(text(), "The hash in the PHC string form; never the password, never reversible"),
    algorithm: req(codeOf2(passwordAlgorithm), "How it was hashed"),
    changedAt: req(instant(), "When the password was set"),
    mustChange: req(boolean2(), "Whether the user must choose another at the next sign-in")
  },
  identifiedBy: ["credential"],
  relationships: { credential: one2(credential, "The credential it is") },
  annotations: [restricted, cites4("FR-005", "FR-007")]
});
var passkey = concept("passkey", {
  definition: "A passkey: the public half of a key pair whose private half never leaves the person's device",
  attributes: {
    credentialIdValue: req(binary(), "What the authenticator calls the key, unique"),
    publicKey: req(binary(), "The public key, in COSE form"),
    signCount: req(integer3(), "How many times the authenticator says it has signed"),
    aaguid: opt(text(), "What kind of authenticator it is"),
    transports: many2(text(), "How the authenticator can be reached"),
    backupEligible: req(boolean2(), "Whether the key can be backed up"),
    backedUp: req(boolean2(), "Whether it has been"),
    userVerified: req(boolean2(), "Whether the person was verified when it was made"),
    attestationFormat: opt(text(), "The form of the proof of what made it")
  },
  identifiedBy: ["credential"],
  relationships: { credential: one2(credential, "The credential it is") },
  annotations: [restricted, cites4("FR-005", "FR-007"), unique2("credentialIdValue")]
});
var otpSecret = concept("otpSecret", {
  definition: "The secret of a one-time-code factor, kept as ciphertext under a key held outside the database",
  attributes: {
    secretCiphertext: req(binary(), "The secret, encrypted: the server must make codes from it, so it cannot be only hashed"),
    keyReference: req(text(), "Names the key that encrypted it"),
    algorithm: req(codeOf2(otpAlgorithm), "The hash the codes are made with"),
    digits: req(integer3(), "How many digits a code has"),
    periodSeconds: req(integer3(), "How long a code lasts"),
    lastUsedStep: opt(integer3(), "The time step of the last code taken, so that none is taken twice")
  },
  identifiedBy: ["credential"],
  relationships: { credential: one2(credential, "The credential it is") },
  annotations: [restricted, cites4("FR-005", "FR-007")]
});
var recoveryCode = concept("recoveryCode", {
  definition: "A code kept for when the other ways are lost, kept as a hash and used once",
  attributes: { hash: req(text(), "The hash of the code"), usedAt: opt(instant(), "When it was used") },
  identifiedBy: ["credential"],
  relationships: { credential: one2(credential, "The credential it is") },
  annotations: [restricted, cites4("FR-005", "FR-007")]
});
var challenge = concept("challenge", {
  definition: "Something a person is asked to prove, once: a reset link, a magic link, a code or a passkey challenge, kept as a hash",
  attributes: {
    challengeId: key("the challenge"),
    purpose: req(codeOf2(challengePurpose), "What it is for"),
    secretHash: req(text(), "The hash of what was sent"),
    attempts: req(integer3(), "How many times it was tried"),
    maxAttempts: req(integer3(), "How many times it may be"),
    expiresAt: req(instant(), "When it stops being valid"),
    consumedAt: opt(instant(), "When it was used")
  },
  identifiedBy: ["challengeId"],
  relationships: {
    principal: maybe(principal, "Who it is for, where that is known"),
    destination: maybe(electronicContact, "Where it was sent")
  },
  annotations: [restricted, keep(1), cites4("FR-005", "FR-007")]
});
var loginAttempt = concept("loginAttempt", {
  definition: "A sign-in attempt, kept for lockout and for risk, with the identifier hashed so that an unknown user leaves nothing personal",
  attributes: {
    loginAttemptId: key("the attempt"),
    loginIdentifierHash: req(text(), "The identifier, hashed with a pepper"),
    ip: req(text(), "Where it came from", held2("IPAddress", "limit guessing and spot abuse")),
    outcome: req(codeOf2(loginOutcome), "How it ended"),
    at: req(instant(), "When it was")
  },
  identifiedBy: ["loginAttemptId"],
  relationships: { principal: maybe(principal, "Who it was for, where that is known") },
  annotations: [confidential2, keep(30), cites4("FR-005", "FR-007"), lookup2("loginIdentifierHash", "at")]
});
var knownBrowser = concept("knownBrowser", {
  definition: "A browser or app that a principal signs in from, recognised by a hash of what it says it is",
  attributes: {
    knownBrowserId: key("the browser"),
    fingerprintHash: req(text(), "A hash of what the browser says it is", held2("BrowserFingerprint", "recognise a device the user has used")),
    label: opt(text(), "What the person calls it"),
    firstSeenAt: req(instant(), "When it was first seen"),
    lastSeenAt: req(instant(), "When it was last seen"),
    trustedUntil: opt(instant(), "Until when it is trusted not to be asked for a second factor")
  },
  identifiedBy: ["knownBrowserId"],
  relationships: { principal: one2(principal, "Whose it is") },
  annotations: [confidential2, keep(180), cites4("FR-006")]
});
var loginSession = concept("loginSession", {
  definition: "A principal's being signed in, from a device, for a time",
  attributes: {
    sessionId: key("the session"),
    authenticatedAt: req(instant(), "When the principal proved who they are"),
    lastSeenAt: req(instant(), "When the session was last used"),
    idleExpiresAt: req(instant(), "When it ends if it is not used"),
    absoluteExpiresAt: req(instant(), "When it ends whatever"),
    assuranceLevel: req(codeOf2(assuranceLevel), "How sure it is of who it is for"),
    authMethods: many2(codeOf2(authMethod), "How it was authenticated"),
    federatedProvider: opt(text(), "The identity provider it was signed in through, where it was"),
    ip: req(text(), "Where it came from", held2("IPAddress", "spot a session used from somewhere new")),
    userAgent: req(text(), "What the browser says it is", held2("UserAgent", "show the user where they are signed in")),
    status: req(codeOf2(sessionStatus), "Where the session is"),
    revokedAt: opt(instant(), "When it was ended early"),
    revokedReason: opt(codeOf2(revokedReason), "Why it was ended early"),
    stepUpAt: opt(instant(), "When the principal last proved who they are again")
  },
  identifiedBy: ["sessionId"],
  relationships: {
    principal: one2(principal, "Who is signed in"),
    tenant: maybe(tenant, "The tenant the session is working in"),
    knownBrowser: maybe(knownBrowser, "The browser or app it is on")
  },
  annotations: [confidential2, keep(90), cites4("FR-006"), lookup2("principal", "status")]
});
var refreshToken = concept("refreshToken", {
  definition: "A token that renews a session, kept as a hash, used once and replaced by the next one of its family",
  attributes: {
    refreshTokenId: key("the token"),
    familyId: req(identifier(), "What every token rotated from one issue shares, so that a reuse ends them all"),
    tokenHash: req(text(), "The hash of the token"),
    issuedAt: req(instant(), "When it was made"),
    expiresAt: req(instant(), "When it stops being valid"),
    usedAt: opt(instant(), "When it was exchanged for the next"),
    revokedAt: opt(instant(), "When it was ended early")
  },
  identifiedBy: ["refreshTokenId"],
  relationships: {
    session: one2(loginSession, "The session it renews"),
    replacedBy: maybe(() => refreshToken, "The token that took its place")
  },
  annotations: [restricted, keep(30), cites4("FR-006", "FR-007"), unique2("tokenHash"), lookup2("familyId")]
});
var invitation = concept("invitation", {
  definition: "An invitation to join a tenant",
  attributes: {
    invitationId: key("the invitation"),
    email: req(text(), "The address it was sent to", held2("EmailAddress", "invite the person")),
    tokenHash: req(text(), "The hash of the secret in the link"),
    status: req(codeOf2(invitationStatus), "Where it is"),
    expiresAt: req(instant(), "When it stops being valid"),
    acceptedAt: opt(instant(), "When it was taken up"),
    message: opt(text(), "What the inviter wrote")
  },
  identifiedBy: ["invitationId"],
  relationships: {
    tenant: one2(tenant, "The tenant the person is invited to"),
    invitedBy: one2(principal, "Who invited"),
    acceptedBy: maybe(userAccount, "Who took it up")
  },
  annotations: [restricted, cites4("FR-008"), lookup2("tenant", "email")]
});
var domainClaim = concept("domainClaim", {
  definition: "A claim on a domain, waiting to be proved",
  attributes: {
    domainClaimId: key("the claim"),
    domain: req(text(), "The domain claimed"),
    challengeValue: req(text(), "What is to be published to prove it; public by design"),
    method: req(codeOf2(claimMethod), "How it is to be proved"),
    status: req(codeOf2(claimStatus), "Where it is"),
    requestedAt: req(instant(), "When it was asked for"),
    expiresAt: req(instant(), "When it stops being valid")
  },
  identifiedBy: ["domainClaimId"],
  relationships: { tenant: one2(tenant, "The tenant that claims it") },
  annotations: [internal2, cites4("FR-008")]
});
var verifiedDomain = concept("verifiedDomain", {
  definition: "A domain that a tenant has proved to be its own, and what that means for those who sign in with it",
  attributes: {
    verifiedDomainId: key("the domain"),
    domain: req(text(), "The domain, unique across every tenant"),
    verifiedAt: req(instant(), "When it was proved"),
    policy: req(codeOf2(domainPolicy), "What it means for those who sign in with it"),
    lastCheckedAt: opt(instant(), "When it was last checked still to be the tenant's")
  },
  identifiedBy: ["verifiedDomainId"],
  relationships: { tenant: one2(tenant, "The tenant it is proved for") },
  annotations: [internal2, cites4("FR-008"), unique2("domain")]
});
var scoped = { tenant: maybe(tenant, "The tenant the policy is for; empty for the platform's, which a tenant's replaces") };
var passwordPolicy = concept("passwordPolicy", {
  definition: "The rules for passwords",
  attributes: {
    passwordPolicyId: key("the policy"),
    minLength: req(integer3(), "The fewest characters"),
    maxLength: req(integer3(), "The most characters"),
    requireBreachCheck: req(boolean2(), "Whether a password is refused that is known from a breach"),
    historyCount: req(integer3(), "How many earlier passwords may not be used again"),
    maxAgeDays: opt(integer3(), "After how many days a password must change; empty, in line with NIST SP 800-63B"),
    allowedAlgorithms: many2(codeOf2(passwordAlgorithm), "The algorithms a hash may use")
  },
  identifiedBy: ["passwordPolicyId"],
  relationships: scoped,
  annotations: [internal2, cites4("FR-009")]
});
var lockoutPolicy = concept("lockoutPolicy", {
  definition: "The rules for locking an account after failed sign-ins",
  attributes: {
    lockoutPolicyId: key("the policy"),
    failedAttempts: req(integer3(), "How many failures lock it"),
    windowMinutes: req(integer3(), "The time they are counted in"),
    lockMinutes: req(integer3(), "How long it stays locked"),
    unlockMode: req(codeOf2(unlockMode), "How it is freed")
  },
  identifiedBy: ["lockoutPolicyId"],
  relationships: scoped,
  annotations: [internal2, cites4("FR-009")]
});
var sessionPolicy = concept("sessionPolicy", {
  definition: "The rules for sessions",
  attributes: {
    sessionPolicyId: key("the policy"),
    idleMinutes: req(integer3(), "How long a session lasts unused"),
    absoluteMinutes: req(integer3(), "How long it lasts at most"),
    concurrentSessionLimit: opt(integer3(), "How many a principal may have at once"),
    bindToDevice: req(boolean2(), "Whether a session is tied to the device it began on"),
    stepUpMinutes: req(integer3(), "How long a second proof counts for")
  },
  identifiedBy: ["sessionPolicyId"],
  relationships: scoped,
  annotations: [internal2, cites4("FR-009")]
});
var mfaPolicy = concept("mfaPolicy", {
  definition: "The rules for second factors",
  attributes: {
    mfaPolicyId: key("the policy"),
    requirement: req(codeOf2(mfaRequirement), "Whether a second factor is needed"),
    allowedKinds: many2(codeOf2(credentialKind), "The factors that may be used"),
    graceDays: req(integer3(), "How long a user may go without one when it becomes required"),
    rememberDeviceDays: req(integer3(), "How long a device is trusted not to be asked"),
    requiredForRoles: many2(text(), "The roles whose holders must always use one, by key")
  },
  identifiedBy: ["mfaPolicyId"],
  relationships: scoped,
  annotations: [internal2, cites4("FR-009")]
});
var auditEvent = concept("auditEvent", {
  definition: "Something that was done, or tried, kept in a chain of hashes so that it cannot be changed without showing",
  attributes: {
    auditEventId: key("the event"),
    sequence: req(integer3(), "Which event of the trail it is, counted from one: each follows the one before it, so that none is left out and none is put between"),
    occurredAt: req(instant(), "When it happened"),
    actorKind: req(codeOf2(actorKind), "What did it: a person, a machine, a device, an agent, the platform or someone acting as another"),
    decision: opt(codeOf2(decision), "What the decision was, for an event that records one"),
    delegationKey: opt(text(), "The delegation it was done under; not a reference, so that the trail outlives it"),
    runKey: opt(text(), "The run of an agent it was done in; not a reference, so that the trail outlives it"),
    traceId: opt(text(), "The trace it is part of"),
    chain: opt(structured(), "The principals between the person accountable and the actor, root first"),
    policyRefs: opt(structured(), "The roles, policies and grants that decided"),
    action: req(text(), "What was done, named `subject.verb`; each module adds its own"),
    outcome: req(codeOf2(auditOutcome), "How it ended"),
    targetConcept: opt(text(), "The kind of thing it was done to"),
    targetKey: opt(text(), "The thing it was done to; a loose reference, so that the trail outlives what it names"),
    sessionKey: opt(text(), "The session it was done in; not a reference, because sessions are purged"),
    requestId: opt(text(), "The request it was part of"),
    ip: opt(text(), "Where it came from", held2("IPAddress", "investigate what happened")),
    userAgent: opt(text(), "What the client says it is", held2("UserAgent", "investigate what happened")),
    reason: opt(text(), "Why, where a reason was given"),
    detail: opt(structured(), "What else matters, with no secret in it"),
    previousHash: req(text(), "The hash of the event before it in the chain"),
    eventHash: req(text(), "The hash of this event and the one before")
  },
  identifiedBy: ["auditEventId"],
  relationships: {
    tenant: maybe(tenant, "The tenant it was in"),
    actor: maybe(principal, "Who did it, where a principal did"),
    onBehalfOf: maybe(principal, "The person or group accountable at the root of the chain the actor acted in")
  },
  annotations: [
    restricted,
    keep(365),
    cites4("FR-010"),
    unique2("eventHash"),
    unique2("sequence"),
    annotate(quality4.appendOnly, { chain: { hash: "eventHash", previous: "previousHash", sequence: "sequence", genesis: "genesis" } }),
    lookup2("occurredAt")
  ]
});
var concepts = [
  principal,
  userAccount,
  contactVerification,
  membership,
  userGroup,
  groupMember,
  credential,
  passwordCredential,
  passkey,
  otpSecret,
  recoveryCode,
  challenge,
  loginAttempt,
  knownBrowser,
  loginSession,
  refreshToken,
  invitation,
  domainClaim,
  verifiedDomain,
  passwordPolicy,
  lockoutPolicy,
  sessionPolicy,
  mfaPolicy,
  auditEvent
];

// models/identity/mod.ts
var identityModule = defineModule({
  name: "identity",
  definition: "Who may do what, and how they prove it",
  requires: ["arcaParty", "arcaTenancy"],
  concepts,
  codeLists: Object.values(exports_codes)
});

// models/identity-abac/mod.ts
init_api2();

// models/identity-access/mod.ts
init_api2();

// models/identity-access/codes.ts
var roleKind = list2("roleKind", "Whether a role is the platform's or a tenant's", { system: "Made by the platform and the same for every tenant", custom: "Made by a tenant" });
var riskLevel = list2("riskLevel", "How much harm a permission can do if it is misused", {
  low: "Little harm, and easily undone",
  medium: "Some harm",
  high: "Serious harm, or access to personal data",
  critical: "Harm that cannot be undone, or that reaches many tenants"
});
var sideEffect = list2("sideEffect", "What using a permission does", {
  none: "Nothing that outlasts the call",
  read: "Reads data",
  write: "Changes data that can be changed back",
  external: "Does something outside the system",
  irreversible: "Does something that cannot be undone"
});
var assignmentStatus = list2("assignmentStatus", "Where a role assignment is", { active: "In force", revoked: "Ended by a person or a policy", expired: "Ended by time" });
var assignmentVia = list2("assignmentVia", "How a role came to be assigned", {
  direct: "By an administrator",
  privilegedGrant: "By a time-boxed privileged grant",
  directory: "By a directory that maps groups to roles",
  invitation: "By accepting an invitation"
});
var separationKind = list2("separationKind", "How a separation of duties is held", { static: "No principal may hold the roles together, at any time" }, true);
var entitlementSource = list2("entitlementSource", "Where a tenant's entitlement comes from", { plan: "A plan it is on", contract: "An agreement", grant: "Given by the platform" }, true);

// models/identity-access/concepts.ts
init_api2();
var cites5 = citing("0033-identity-access");
var { quality: quality5 } = exports_mod;
var permission = concept("permission", {
  definition: "A thing that can be done, named by its resource and its action",
  attributes: {
    permissionId: key("the permission"),
    permissionKey: req(text(), "The permission as `resource:action`, unique"),
    definition: req(text(), "What the permission lets a principal do"),
    ownerModule: req(text(), "The module that registered the permission"),
    riskLevel: req(codeOf2(riskLevel), "How much harm it can do if it is misused"),
    sideEffect: req(codeOf2(sideEffect), "What using it does"),
    appliesTo: many2(codeOf2(principalKind), "The kinds of principal that may hold it; every kind where none is said"),
    featureKey: opt(text(), "The feature a tenant must be entitled to for the permission to count")
  },
  identifiedBy: ["permissionId"],
  annotations: [internal2, cites5("FR-001"), unique2("permissionKey"), lookup2("riskLevel")]
});
var accessRole = concept("accessRole", {
  definition: "A set of permissions that is granted together, and that may inherit those of other roles",
  attributes: {
    roleId: key("the role"),
    roleKey: req(text(), "The role's short name, unique within its tenant"),
    name: req(text(), "What the role is called"),
    kind: req(codeOf2(roleKind), "Whether the platform or a tenant made it"),
    definition: req(text(), "What a holder of the role does"),
    appliesTo: many2(codeOf2(principalKind), "The kinds of principal that may hold it; people, machines and groups where none is said"),
    isPrivileged: req(boolean2(), "Whether it is a role that an agent may never hold, and that needs a time-boxed grant where privileged access is composed"),
    status: req(codeOf2(useStatus), "Whether the role is in use")
  },
  identifiedBy: ["roleId"],
  relationships: { tenant: maybe(tenant, "The tenant that made the role; empty for a role of the platform, usable in every tenant") },
  annotations: [internal2, cites5("FR-001"), unique2("tenant", "roleKey")]
});
var roleInheritance = concept("roleInheritance", {
  definition: "A role that inherits another: whoever holds the senior role holds what the junior role holds",
  attributes: {},
  identifiedBy: ["senior", "junior"],
  relationships: { senior: one2(accessRole, "The role that inherits"), junior: one2(accessRole, "The role that is inherited") },
  annotations: [internal2, cites5("FR-001"), annotate(quality5.differs, { name: "role_not_its_own_junior", members: ["senior", "junior"] })]
});
var rolePermission = concept("rolePermission", {
  definition: "A permission that a role holds",
  attributes: {},
  identifiedBy: ["role", "permission"],
  relationships: { role: one2(accessRole, "The role"), permission: one2(permission, "The permission") },
  annotations: [internal2, cites5("FR-001")]
});
var separationRule = concept("separationRule", {
  definition: "A rule that no principal may hold too many of a set of roles together",
  attributes: {
    separationRuleId: key("the rule"),
    name: req(text(), "What the rule is called"),
    kind: req(codeOf2(separationKind), "How the separation is held"),
    limitCount: req(integer3(), "How many of the roles together are too many: two for the classic pair"),
    status: req(codeOf2(useStatus), "Whether the rule is applied")
  },
  identifiedBy: ["separationRuleId"],
  relationships: { tenant: maybe(tenant, "The tenant the rule is for; empty for the platform's") },
  annotations: [internal2, cites5("FR-002")]
});
var separationRuleRole = concept("separationRuleRole", {
  definition: "A role that a separation rule is about",
  attributes: {},
  identifiedBy: ["rule", "role"],
  relationships: { rule: one2(separationRule, "The rule"), role: one2(accessRole, "The role") },
  annotations: [internal2, cites5("FR-002")]
});
var roleAssignment = concept("roleAssignment", {
  definition: "A role granted to a principal of any kind, in a tenant, perhaps for one resource and for a time",
  attributes: {
    roleAssignmentId: key("the grant"),
    resourceType: opt(text(), "The kind of the one resource the grant is limited to, where it is"),
    resourceId: opt(text(), "The one resource the grant is limited to, where it is"),
    validFrom: req(instant(), "When the grant starts"),
    validTo: opt(instant(), "When the grant ends, where it does"),
    reason: opt(text(), "Why it was granted"),
    status: req(codeOf2(assignmentStatus), "Where the grant is"),
    revokedAt: opt(instant(), "When it was ended early"),
    via: req(codeOf2(assignmentVia), "How it came to be"),
    assignmentKey: req(text(), "A hash of the principal, the role, the tenant and the resource, unique, so that a grant is not made twice where the resource is empty")
  },
  identifiedBy: ["roleAssignmentId"],
  relationships: {
    principal: one2(principal, "Who holds the role"),
    role: one2(accessRole, "The role"),
    tenant: one2(tenant, "The tenant the grant is in"),
    grantedBy: one2(principal, "Who granted it")
  },
  annotations: [confidential2, cites5("FR-003"), unique2("assignmentKey"), lookup2("principal", "tenant"), lookup2("role")]
});
var entitlement = concept("entitlement", {
  definition: "What a tenant may use, as distinct from what a principal may do",
  attributes: {
    entitlementId: key("the entitlement"),
    featureKey: req(text(), "The feature the tenant may use"),
    limitValue: opt(integer3(), "How much of it, where it is limited"),
    validFrom: req(instant(), "When it starts"),
    validTo: opt(instant(), "When it ends, where it does"),
    source: req(codeOf2(entitlementSource), "Where it comes from")
  },
  identifiedBy: ["entitlementId"],
  relationships: { tenant: one2(tenant, "The tenant") },
  annotations: [internal2, cites5("FR-004"), lookup2("tenant", "featureKey")]
});
var invitationRole = concept("invitationRole", {
  definition: "A role that an invitation grants when it is accepted",
  attributes: {},
  identifiedBy: ["invitation", "role"],
  relationships: { invitation: one2(invitation, "The invitation"), role: one2(accessRole, "The role") },
  annotations: [internal2, cites5("FR-003")]
});
var concepts3 = [permission, accessRole, roleInheritance, rolePermission, separationRule, separationRuleRole, roleAssignment, entitlement, invitationRole];

// models/identity-access/mod.ts
var identityAccessModule = defineModule({
  name: "identityAccess",
  definition: "Role-based access for every kind of principal",
  requires: ["identity"],
  concepts: concepts3,
  codeLists: Object.values(exports_codes2)
});

// models/identity-abac/mod.ts
var cites6 = citing("0034-identity-abac");
var attributeCategory = list2("attributeCategory", "What an attribute is an attribute of", { subject: "The principal that acts", resource: "The thing acted on", environment: "The circumstances of the request", action: "What is being done" });
var attributeValueType = list2("attributeValueType", "The type of the values of an attribute", { text: "Free text", integer: "A whole number", boolean: "True or false", instant: "A point in time", textSet: "A set of texts" });
var attributeSource = list2("attributeSource", "Where the values of an attribute come from", { stored: "Kept here", request: "Given with the request", posture: "Reported by a device's posture", directory: "Pushed by a directory", derived: "Computed from others" });
var sensitivityLevel = list2("sensitivityLevel", "How sensitive the values of an attribute are", { public: "Anyone may see them", internal: "Staff may", confidential: "Those who need them may", restricted: "Very few may" });
var policyEffect = list2("policyEffect", "What a policy decides", { allow: "Allows what it matches", deny: "Refuses what it matches, whatever else allows it" });
var obligation = list2("obligation", "What must happen before an allowed action is done", { none: "Nothing", stepUp: "The principal proves who they are again", approval: "A person approves it" });
var expressionLanguage = list2("expressionLanguage", "The language a condition is written in", { expr: "The library's own closed expression tree", cedar: "The Cedar policy language", cel: "The Common Expression Language", rego: "Open Policy Agent's Rego language" }, true);
var attributeDefinition = concept("attributeDefinition", {
  definition: "An attribute that decisions may use, with its type, where its values come from and how old they may be",
  attributes: {
    attributeDefinitionId: key("the attribute"),
    attributeKey: req(text(), "The attribute as `category.name`, unique"),
    category: req(codeOf2(attributeCategory), "What it is an attribute of"),
    valueType: req(codeOf2(attributeValueType), "The type of its values"),
    source: req(codeOf2(attributeSource), "Where its values come from"),
    subjectKinds: many2(codeOf2(principalKind), "The kinds of principal it applies to; every kind where none is said"),
    resourceType: opt(text(), "The kind of resource it applies to"),
    sensitivity: req(codeOf2(sensitivityLevel), "How sensitive its values are"),
    freshnessSeconds: opt(integer3(), "How old a stored value may be before it reads as unknown"),
    definition: req(text(), "What the attribute means"),
    status: req(codeOf2(useStatus), "Whether the attribute is in use")
  },
  identifiedBy: ["attributeDefinitionId"],
  relationships: { tenant: maybe(tenant, "The tenant that defined it; empty for the platform's") },
  annotations: [internal2, cites6("FR-001"), unique2("attributeKey")]
});
var principalAttribute = concept("principalAttribute", {
  definition: "A value of an attribute for a principal of any kind",
  attributes: {
    value: req(structured(), "The value, of the type the definition says"),
    validFrom: req(instant(), "When the value starts to hold"),
    validTo: opt(instant(), "When it stops, where it does"),
    updatedAt: req(instant(), "When it was last asserted")
  },
  identifiedBy: ["principal", "definition"],
  relationships: {
    principal: one2(principal, "The principal"),
    definition: one2(attributeDefinition, "The attribute"),
    assertedBy: maybe(principal, "Who asserted it, where a principal did")
  },
  annotations: [confidential2, cites6("FR-002")]
});
var resourceAttribute = concept("resourceAttribute", {
  definition: "A value of an attribute for a resource",
  attributes: {
    resourceAttributeId: key("the value"),
    resourceType: req(text(), "The kind of resource"),
    resourceId: req(text(), "The resource"),
    value: req(structured(), "The value, of the type the definition says"),
    updatedAt: req(instant(), "When it was last asserted"),
    valueKey: req(text(), "A hash of the tenant, the resource and the attribute, unique, so that a resource has one value of an attribute")
  },
  identifiedBy: ["resourceAttributeId"],
  relationships: { tenant: one2(tenant, "The tenant the resource is in"), definition: one2(attributeDefinition, "The attribute") },
  annotations: [internal2, cites6("FR-002"), unique2("valueKey"), lookup2("resourceType", "resourceId")]
});
var accessPolicy = concept("accessPolicy", {
  definition: "A rule of attribute-based access: a condition over attributes that allows or refuses an action; a refusal always wins",
  attributes: {
    accessPolicyId: key("the policy"),
    name: req(text(), "What the policy is called"),
    definition: req(text(), "What the policy is for"),
    effect: req(codeOf2(policyEffect), "What it decides"),
    appliesTo: opt(codeOf2(principalKind), "The kind of principal it is about; every kind where it is empty"),
    actionPattern: req(text(), "The permission it is about: exact, or a prefix ending `*`"),
    resourceType: opt(text(), "The kind of resource it is about"),
    expression: req(text(), "When it applies, written in its language"),
    expressionLanguage: req(codeOf2(expressionLanguage), "The language of the condition"),
    obligation: req(codeOf2(obligation), "What must happen before an allowed action is done"),
    priority: req(integer3(), "The order policies are evaluated and explained in; a refusal wins whatever it is"),
    status: req(codeOf2(useStatus), "Whether it is applied"),
    version: req(integer3(), "Which version of the policy this is"),
    validFrom: opt(instant(), "When it starts to apply"),
    validTo: opt(instant(), "When it stops"),
    policyKey: req(text(), "A hash of the tenant, the name and the version, unique")
  },
  identifiedBy: ["accessPolicyId"],
  relationships: {
    tenant: maybe(tenant, "The tenant it is for; empty for the platform's"),
    scopePrincipal: maybe(principal, "The principal or group it is scoped to"),
    requiresRole: maybe(accessRole, "A role a principal must also hold for the policy to allow"),
    permission: maybe(permission, "The permission it is about, where it is about exactly one")
  },
  annotations: [internal2, cites6("FR-003"), unique2("policyKey"), lookup2("actionPattern")]
});
var concepts5 = [attributeDefinition, principalAttribute, resourceAttribute, accessPolicy];
var identityAbacModule = defineModule({
  name: "identityAbac",
  definition: "Attribute-based access for every kind of principal",
  requires: ["identityAccess"],
  concepts: concepts5,
  codeLists: [attributeCategory, attributeValueType, attributeSource, sensitivityLevel, policyEffect, obligation, expressionLanguage]
});

// models/identity-agent/mod.ts
init_api2();

// models/identity-delegation/mod.ts
init_api2();
init_api2();
var cites7 = citing("0039-identity-delegation");
var delegationStatus = list2("delegationStatus", "Where a delegation is", { active: "In force", revoked: "Ended by a person, or by the end of the delegation above it", expired: "Ended by time" });
var delegation = concept("delegation", {
  definition: "One principal acting on behalf of another, for a time and for some permissions, never more than the one above it",
  attributes: {
    delegationId: key("the delegation"),
    depth: req(integer3(), "How many delegations are above it: none for the first"),
    purpose: req(text(), "What it is for"),
    resourceType: opt(text(), "The kind of the one resource it is limited to"),
    resourceId: opt(text(), "The resource it is limited to: exact, or a prefix ending `*`"),
    expression: opt(text(), "An extra condition; the conditions of the delegations above it hold too, so a delegation can only add"),
    expressionLanguage: opt(codeOf2(expressionLanguage), "The language of the condition"),
    redelegable: req(boolean2(), "Whether the delegate may pass it on"),
    maxDepth: req(integer3(), "How many more delegations may be added below it; less than the one above it"),
    validFrom: req(instant(), "When it starts"),
    expiresAt: req(instant(), "When it ends: a delegation always ends, and never after the one above it"),
    status: req(codeOf2(delegationStatus), "Where it is", annotate(exports_quality.transitions, { allowed: { active: ["revoked", "expired"], revoked: [], expired: [] } })),
    revokedAt: opt(instant(), "When it was ended early"),
    revokeReason: opt(text(), "Why it was ended early")
  },
  identifiedBy: ["delegationId"],
  relationships: {
    tenant: one2(tenant, "The tenant it is in"),
    delegator: one2(principal, "Who passes on what they hold"),
    delegate: one2(principal, "Who acts on their behalf"),
    parent: maybe(() => delegation, "The delegation it was made under, where it was made under one"),
    root: maybe(() => delegation, "The first delegation of the chain, where it is not itself the first"),
    revokedBy: maybe(principal, "Who ended it early")
  },
  annotations: [
    confidential2,
    keep(365),
    cites7("FR-001"),
    annotate(exports_quality.differs, { name: "delegator_not_delegate", members: ["delegator", "delegate"] }),
    lookup2("delegate", "status"),
    lookup2("parent"),
    lookup2("root")
  ]
});
var delegationPermission = concept("delegationPermission", {
  definition: "A permission that a delegation passes on: a subset of what the delegator held, and of what the delegation above it passed on",
  attributes: {},
  identifiedBy: ["delegation", "permission"],
  relationships: { delegation: one2(delegation, "The delegation"), permission: one2(permission, "The permission") },
  annotations: [confidential2, cites7("FR-002")]
});
var concepts6 = [delegation, delegationPermission];
var identityDelegationModule = defineModule({ name: "identityDelegation", definition: "One principal acting on behalf of another, with attenuation", requires: ["identityAccess", "identityAbac"], concepts: concepts6, codeLists: [delegationStatus] });

// models/identity-agent/mod.ts
init_api2();

// models/identity-agent/operations.ts
init_api2();
var opt2 = (type) => ({ type, optional: true });
var delegate = operation("delegate", {
  checkedBy: "the caller is the delegator or may act for them, and the root is asked again",
  definition: "Passes on some of what one principal may do to another, for a time, never more than the delegator holds and never more than the delegation above it passes on",
  kind: "command",
  input: { tenant: "text", delegator: "text", delegate: "text", parent: opt2("text"), purpose: "text", permissions: "textList", resourceType: opt2("text"), resourceId: opt2("text"), expression: opt2("text"), redelegable: "boolean", maxDepth: "integer", expiresAt: "instant" },
  reads: ["delegation", "delegationPermission", "permission", "principal"],
  writes: ["delegation", "delegationPermission"],
  emits: ["delegation.created"],
  runsAs: "service",
  idempotent: false,
  serves: "0039-identity-delegation FR-001"
});
var revokeDelegation = operation("revokeDelegation", {
  checkedBy: "the caller owns the delegation or may revoke it",
  definition: "Ends a delegation and every delegation below it, at once",
  kind: "command",
  input: { delegation: "text", revokedBy: "text", reason: "text" },
  reads: ["delegation"],
  writes: ["delegation"],
  emits: ["delegation.revoked"],
  runsAs: "service",
  idempotent: true,
  serves: "0039-identity-delegation FR-001"
});
var recordToolCall = operation("recordToolCall", {
  checkedBy: "the decision engine allows the agent the tool, under its delegation, and its budgets have room",
  definition: "Decides and records a call of a tool by an agent in a run: allowed only if the agent holds the tool, the delegation allows it, the run's budget has room, and a person has approved it where it is risky",
  kind: "command",
  input: { run: "text", tool: "text", callIndex: "integer", argsHash: "text", argsSummary: opt2("text"), resourceType: opt2("text"), resourceId: opt2("text"), approval: opt2("text") },
  reads: ["agentRun", "agentVersion", "agent", "agentTool", "toolGrant", "permission", "principal", "delegation", "delegationPermission", "accessRole", "roleAssignment", "roleInheritance", "rolePermission", "groupMember", "accessPolicy", "principalAttribute", "attributeDefinition", "resourceAttribute", "entitlement", "relationTuple", "permissionRelation"],
  writes: ["toolCall", "agentBudget", "approvalRequest"],
  emits: ["tool.called"],
  runsAs: "service",
  idempotent: false,
  serves: "0040-identity-agent FR-004"
});
var decideApproval = operation("decideApproval", {
  checkedBy: "the decider answers for the agent and may do the thing themselves",
  definition: "A person approves or refuses one action of an agent; only a person decides, and only one who may do the action themselves",
  kind: "command",
  input: { approvalRequest: "text", decidedBy: "text", approve: "boolean", reason: opt2("text") },
  reads: ["approvalRequest", "agentRun", "agent", "principal", "delegation", "roleAssignment"],
  writes: ["approvalRequest"],
  emits: ["approval.decided"],
  runsAs: "service",
  idempotent: false,
  serves: "0040-identity-agent FR-004"
});
var killAgent = operation("killAgent", {
  checkedBy: "the caller answers for the agent or may switch it off",
  definition: "Switches an agent off: it can do nothing, its runs stop, its delegations end, its credentials are revoked and what waits for approval is cancelled, in one transaction",
  kind: "command",
  input: { agent: "text", by: "text", reason: "text" },
  reads: ["principal", "agentRun", "delegation", "credential", "approvalRequest"],
  writes: ["principal", "agentRun", "delegation", "credential", "approvalRequest"],
  emits: ["agent.killed"],
  runsAs: "service",
  idempotent: true,
  serves: "0040-identity-agent FR-001"
});

// models/identity-agent/mod.ts
var cites8 = citing("0040-identity-agent");
var { quality: quality6 } = exports_mod;
var autonomyLevel = list2("autonomyLevel", "How much an agent may do without a person", { observe: "It may only read", suggest: "It may propose, and a person acts", actWithApproval: "It may act, and a person approves what is risky", autonomous: "It may act within its grants and budgets" });
var versionStatus = list2("versionStatus", "Where a version of an agent is", { candidate: "Made, not yet approved", approved: "Approved to run", active: "Running in production", retired: "No longer used", revoked: "Pulled: no run may start on it" });
var runStatus = list2("runStatus", "Where a run of an agent is", { running: "Running", succeeded: "Ended well", failed: "Ended badly", cancelled: "Stopped by its caller", killed: "Stopped by the kill switch", expired: "Ended because its time was up" });
var toolApproval = list2("toolApproval", "Whether a tool grant needs approval", { inherit: "As the risk of the tool and the agent's threshold say", always: "Every call needs approval" });
var callDecision = list2("callDecision", "What was decided about a tool call", { allowed: "It was allowed", denied: "It was refused", approvalRequired: "It waits for a person", budgetExceeded: "It would exceed a budget" });
var callStatus = list2("callStatus", "Where a tool call is", { requested: "Asked for", running: "Running", succeeded: "Ended well", failed: "Ended badly" });
var meter = list2("meter", "What a budget counts", { toolCalls: "Calls of tools", tokens: "Tokens of a model", costMicros: "Cost, in millionths of a currency unit", writes: "Calls that change something" });
var windowKind = list2("windowKind", "How long a budget lasts", { run: "One run", hour: "An hour", day: "A day of 24 hours", month: "A month", lifetime: "For good" });
var approvalStatus = list2("approvalStatus", "Where a request for approval is", { pending: "Waiting for a person", approved: "Approved, and not yet used", denied: "Refused", expired: "Left until it ran out", cancelled: "Withdrawn", consumed: "Approved and used once" });
var approverRule = list2("approverRule", "Who may approve", { owner: "The agent's owner", delegator: "The person the agent acts for", roleHolder: "A holder of a named role" });
var agent = concept("agent", {
  definition: "A program that decides for itself what to do, accountable to an owner and limited by its level of autonomy",
  attributes: {
    autonomy: req(codeOf2(autonomyLevel), "How much it may do without a person"),
    purpose: req(text(), "What it is for"),
    framework: opt(text(), "What it is built with"),
    frameworkVersion: opt(text(), "The version of what it is built with"),
    provider: opt(text(), "Who runs it"),
    cardUrl: opt(text(), "Where its agent card is published"),
    approvalThreshold: req(codeOf2(riskLevel), "The risk at or above which its calls need an approval"),
    maxDelegationDepth: req(integer3(), "How many delegations deep it may act"),
    maxConcurrentRuns: opt(integer3(), "How many runs it may have at once")
  },
  identifiedBy: ["principal"],
  relationships: { principal: one2(principal, "The principal the agent is"), sponsor: maybe(principal, "Who answers for its business use, where that is not its owner") },
  annotations: [confidential2, cites8("FR-001")]
});
var agentVersion = concept("agentVersion", {
  definition: "A version of an agent: which model, which prompt and which tools, pinned, so that a bad one can be pulled from every run",
  attributes: {
    agentVersionId: key("the version"),
    versionLabel: req(text(), "What the version is called, unique for its agent"),
    modelProvider: req(text(), "Who makes the model"),
    modelName: req(text(), "The model"),
    modelVersion: req(text(), "The pinned snapshot of the model, never an alias that moves"),
    promptHash: req(text(), "A hash of the system prompt; the prompt is not kept here"),
    toolManifestHash: req(text(), "A hash of the tools it is given"),
    codeRef: opt(text(), "The commit of its code"),
    status: req(codeOf2(versionStatus), "Where the version is", annotate(quality6.transitions, { allowed: { candidate: ["approved", "revoked"], approved: ["active", "retired", "revoked"], active: ["retired", "revoked"], retired: ["revoked"], revoked: [] } })),
    approvedAt: opt(instant(), "When it was approved"),
    createdAt: req(instant(), "When it was made"),
    versionKey: req(text(), "A hash of the agent and the label, unique")
  },
  identifiedBy: ["agentVersionId"],
  relationships: { agent: one2(agent, "The agent"), approvedBy: maybe(principal, "Who approved it") },
  annotations: [internal2, cites8("FR-002"), unique2("versionKey")]
});
var agentTool = concept("agentTool", {
  definition: "A tool that agents may be granted: what it is called, the permission a call needs, how risky it is",
  attributes: {
    agentToolId: key("the tool"),
    name: req(text(), "What the tool is called, unique within its tenant"),
    definition: req(text(), "What it does"),
    serverAudience: opt(text(), "The server or API it is on"),
    riskLevel: req(codeOf2(riskLevel), "How much harm it can do"),
    sideEffect: req(codeOf2(sideEffect), "What it does"),
    argsSchemaHash: opt(text(), "A hash of the schema of its arguments"),
    status: req(codeOf2(useStatus), "Whether it is in use")
  },
  identifiedBy: ["agentToolId"],
  relationships: { tenant: maybe(tenant, "The tenant it is for; empty for the platform's"), permission: one2(permission, "The permission a call needs: one path for tools, APIs and screens") },
  annotations: [internal2, cites8("FR-003"), unique2("name"), lookup2("tenant")]
});
var toolGrant = concept("toolGrant", {
  definition: "A tool that an agent has been granted, perhaps with a condition on its calls, never more than the agent's owner may do",
  attributes: {
    expression: opt(text(), "A condition on a call, over its arguments"),
    approval: req(codeOf2(toolApproval), "Whether a call needs approval"),
    maxCallsPerRun: opt(integer3(), "How many calls a run may make"),
    validTo: opt(instant(), "When the grant ends"),
    status: req(codeOf2(useStatus), "Whether the grant is applied")
  },
  identifiedBy: ["agent", "tool"],
  relationships: { agent: one2(agent, "The agent"), tool: one2(agentTool, "The tool"), grantedBy: one2(principal, "Who granted it") },
  annotations: [confidential2, cites8("FR-003")]
});
var agentRun = concept("agentRun", {
  definition: "One task of an agent, in one version, perhaps under a delegation, perhaps started by another run",
  attributes: {
    runId: key("the run"),
    startedAt: req(instant(), "When it started"),
    endedAt: opt(instant(), "When it ended"),
    status: req(codeOf2(runStatus), "Where it is", annotate(quality6.transitions, { allowed: { running: ["succeeded", "failed", "cancelled", "killed", "expired"], succeeded: [], failed: [], cancelled: [], killed: [], expired: [] } })),
    traceId: opt(text(), "The trace it is part of"),
    purpose: opt(text(), "What it is for"),
    inputHash: opt(text(), "A hash of its input")
  },
  identifiedBy: ["runId"],
  relationships: {
    agent: one2(agent, "The agent"),
    version: one2(agentVersion, "The version it runs"),
    tenant: one2(tenant, "The tenant it runs in"),
    initiator: maybe(principal, "Who started it"),
    delegation: maybe(delegation, "The delegation it acts under"),
    parentRun: maybe(() => agentRun, "The run that started it, for a sub-agent")
  },
  annotations: [confidential2, keep(365), cites8("FR-004"), lookup2("agent", "status")]
});
var toolCall = concept("toolCall", {
  definition: "A call of a tool in a run: what was decided, and a hash of its arguments, never the arguments",
  attributes: {
    toolCallId: key("the call"),
    callIndex: req(integer3(), "Which call of the run it is"),
    decision: req(codeOf2(callDecision), "What was decided about it"),
    status: req(codeOf2(callStatus), "Where it is"),
    argsHash: req(text(), "A hash of its arguments"),
    argsSummary: opt(text(), "What it asked for, redacted by the caller, never the raw arguments"),
    resourceType: opt(text(), "The kind of resource it was about"),
    resourceId: opt(text(), "The resource it was about"),
    resultHash: opt(text(), "A hash of its result"),
    denyReason: opt(text(), "Why it was refused"),
    policyRefs: opt(structured(), "The roles, policies and grants that decided"),
    tokensIn: opt(integer3(), "Tokens sent to the model"),
    tokensOut: opt(integer3(), "Tokens received from the model"),
    costMicros: opt(integer3(), "What it cost, in millionths of a currency unit"),
    requestedAt: req(instant(), "When it was asked for"),
    completedAt: opt(instant(), "When it ended"),
    callKey: req(text(), "A hash of the run and the index, unique")
  },
  identifiedBy: ["toolCallId"],
  relationships: { run: one2(agentRun, "The run"), tool: one2(agentTool, "The tool"), approval: maybe(() => approvalRequest, "The approval it was given") },
  annotations: [confidential2, keep(365), cites8("FR-004"), unique2("callKey"), lookup2("run")]
});
var agentBudget = concept("agentBudget", {
  definition: "What an agent, under a delegation or in a run, may spend of a meter in a window; it cannot be exceeded",
  attributes: {
    budgetId: key("the budget"),
    meter: req(codeOf2(meter), "What it counts"),
    windowKind: req(codeOf2(windowKind), "How long it lasts"),
    limitValue: req(integer3(), "How much may be spent"),
    used: req(integer3(), "How much has been"),
    windowStart: req(instant(), "When the window began"),
    version: req(integer3(), "Which update it has had, so that two updates cannot both win"),
    status: req(codeOf2(useStatus), "Whether the budget is applied"),
    budgetKey: req(text(), "A hash of the agent, the delegation, the run, the meter and the window, unique")
  },
  identifiedBy: ["budgetId"],
  relationships: { agent: one2(agent, "The agent"), delegation: maybe(delegation, "The delegation it is for"), run: maybe(agentRun, "The run it is for") },
  annotations: [internal2, cites8("FR-004"), unique2("budgetKey"), annotate(quality6.atMost, { member: "used", other: "limitValue" })]
});
var approvalRequest = concept("approvalRequest", {
  definition: "A request for a person to approve one action of an agent, bound to a hash of its arguments, usable once",
  attributes: {
    approvalRequestId: key("the request"),
    actionKey: req(text(), "The permission the action needs"),
    resourceType: opt(text(), "The kind of resource it is about"),
    resourceId: opt(text(), "The resource it is about"),
    argsHash: req(text(), "A hash of the arguments, so that an approval is for exactly this call"),
    summary: req(text(), "What will happen, redacted"),
    riskLevel: req(codeOf2(riskLevel), "How risky it is"),
    approverRule: req(codeOf2(approverRule), "Who may approve"),
    status: req(codeOf2(approvalStatus), "Where the request is", annotate(quality6.transitions, { allowed: { pending: ["approved", "denied", "expired", "cancelled"], approved: ["consumed", "expired", "cancelled"], denied: [], expired: [], cancelled: [], consumed: [] } })),
    requestedAt: req(instant(), "When it was asked for"),
    expiresAt: req(instant(), "When it stops being valid"),
    decidedAt: opt(instant(), "When it was decided"),
    decisionReason: opt(text(), "Why it was decided so"),
    consumedAt: opt(instant(), "When it was used")
  },
  identifiedBy: ["approvalRequestId"],
  relationships: {
    run: one2(agentRun, "The run"),
    agent: one2(principal, "The agent that asks"),
    approverRole: maybe(accessRole, "The role whose holders may approve, where the rule says so"),
    decidedBy: maybe(principal, "The person who decided")
  },
  annotations: [confidential2, keep(365), cites8("FR-004"), lookup2("run", "status")]
});
var concepts7 = [agent, agentVersion, agentTool, toolGrant, agentRun, toolCall, agentBudget, approvalRequest];
var identityAgentModule = defineModule({
  name: "identityAgent",
  definition: "AI agents: provenance, tools, runs, budgets and approvals",
  requires: ["identityDelegation"],
  concepts: concepts7,
  codeLists: [autonomyLevel, versionStatus, runStatus, toolApproval, callDecision, callStatus, meter, windowKind, approvalStatus, approverRule]
});

// models/identity-device/mod.ts
init_api2();

// models/identity-pki/mod.ts
init_api2();
var cites9 = citing("0036-identity-pki");
var trustAnchorKind = list2("trustAnchorKind", "What a trust anchor is", { x509: "A certificate authority's certificate", jwks: "A set of public keys published at an address" });
var trustAnchor = concept("trustAnchor", {
  definition: "What certificates and keys are checked against: a certificate authority, or a set of public keys",
  attributes: {
    trustAnchorId: key("the trust anchor"),
    trustDomain: req(text(), "The domain of trust it anchors, such as a SPIFFE trust domain"),
    kind: req(codeOf2(trustAnchorKind), "What it is"),
    material: req(text(), "The public certificate, or the address of the public keys; public by nature"),
    notAfter: opt(instant(), "When it stops being trusted"),
    status: req(codeOf2(useStatus), "Whether it is trusted")
  },
  identifiedBy: ["trustAnchorId"],
  relationships: { tenant: maybe(tenant, "The tenant it is for; empty for the platform's") },
  annotations: [internal2, cites9("FR-001")]
});
var certificate = concept("certificate", {
  definition: "A certificate that a principal proves itself with: only the public half is kept",
  attributes: {
    fingerprint: req(text(), "The SHA-256 thumbprint of the certificate, unique; it is also the value mutual TLS binds a token to"),
    serial: req(text(), "The certificate's serial number"),
    subjectName: req(text(), "The name the certificate is for"),
    sanUri: opt(text(), "The identifier in the certificate's alternative name, such as a SPIFFE ID"),
    sanDns: many2(text(), "The domain names in the certificate's alternative name"),
    notBefore: req(instant(), "When the certificate starts to be valid"),
    notAfter: req(instant(), "When it stops"),
    keyAlgorithm: req(text(), "The algorithm of its key"),
    revokedReason: opt(text(), "Why it was revoked, where it was")
  },
  identifiedBy: ["credential"],
  relationships: { credential: one2(credential, "The credential it is"), issuer: maybe(trustAnchor, "The anchor that vouches for it") },
  annotations: [restricted, cites9("FR-002"), unique2("fingerprint"), lookup2("notAfter")]
});
var concepts8 = [trustAnchor, certificate];
var identityPkiModule = defineModule({ name: "identityPki", definition: "Public-key credentials", requires: ["identity"], concepts: concepts8, codeLists: [trustAnchorKind] });

// models/identity-device/mod.ts
var cites10 = citing("0038-identity-device");
var deviceKind = list2("deviceKind", "What kind of device it is", { laptop: "A laptop", phone: "A phone", tablet: "A tablet", server: "A server", iot: "A thing with a network connection", other: "Something else" });
var platform = list2("platform", "What a device runs", { windows: "Windows", macos: "Apple's macOS", linux: "Linux, of any distribution", ios: "Apple's iOS", android: "Android", other: "Something else" }, true);
var managementState = list2("managementState", "How far an organization manages a device", { unmanaged: "Not known to the organization", registered: "Known, and not managed", managed: "Managed by the organization", retired: "No longer in use" });
var ownership2 = list2("ownership", "Whose a device is", { corporate: "The organization's", personal: "The person's own", shared: "Shared by several people" });
var attestationKind = list2("attestationKind", "What a device proves about itself", { tpm: "A trusted platform module's quote", platformAttestation: "The platform's attestation", webauthnAttestation: "A WebAuthn authenticator's attestation", spiffeNode: "A SPIFFE node attestation", cloudInstance: "A cloud instance's identity document", mdmEnrollment: "An enrollment in device management" });
var attestationResult = list2("attestationResult", "How an attestation was judged", { passed: "It passed", failed: "It failed", unknown: "It could not be judged" });
var postureSource = list2("postureSource", "What reported a device's posture", { mdm: "Device management", edr: "Endpoint detection and response", agent: "An agent on the device", manual: "A person" });
var compliance = list2("compliance", "Whether a device meets what is asked of it", { compliant: "It does", noncompliant: "It does not", unknown: "It is not known whether it does" });
var device = concept("device", {
  definition: "Hardware that has an identity and an owner: an endpoint, a server or a thing",
  attributes: {
    deviceKind: req(codeOf2(deviceKind), "What kind of device it is"),
    platform: req(codeOf2(platform), "What it runs"),
    hardwareHash: req(text(), "A hash of its serial number or hardware identifier", held2("DeviceBased", "tell one device from another")),
    label: opt(text(), "What it is called"),
    managementState: req(codeOf2(managementState), "How far it is managed"),
    ownership: req(codeOf2(ownership2), "Whose it is"),
    enrolledAt: req(instant(), "When it was enrolled"),
    lastSeenAt: opt(instant(), "When it was last seen"),
    trustedUntil: opt(instant(), "Until when it is trusted without a fresh attestation")
  },
  identifiedBy: ["principal"],
  relationships: { principal: one2(principal, "The principal the device is") },
  annotations: [confidential2, cites10("FR-001"), lookup2("hardwareHash")]
});
var deviceAttestation = concept("deviceAttestation", {
  definition: "What a device proved about itself, and how it was judged",
  attributes: {
    deviceAttestationId: key("the attestation"),
    kind: req(codeOf2(attestationKind), "What was proved"),
    evidenceHash: req(text(), "A hash of the evidence; the evidence is kept by the verifier"),
    verifier: req(text(), "What judged it"),
    result: req(codeOf2(attestationResult), "How it was judged"),
    attestedAt: req(instant(), "When it was judged"),
    expiresAt: req(instant(), "When it stops counting"),
    nonceHash: req(text(), "A hash of the nonce the device was challenged with")
  },
  identifiedBy: ["deviceAttestationId"],
  relationships: { device: one2(device, "The device") },
  annotations: [confidential2, keep(90), cites10("FR-002"), lookup2("device", "attestedAt")]
});
var devicePosture = concept("devicePosture", {
  definition: "How a device was doing when it last reported; after its time is up it reads as unknown, never as compliant",
  attributes: {
    devicePostureId: key("the report"),
    source: req(codeOf2(postureSource), "What reported it"),
    compliance: req(codeOf2(compliance), "Whether the device meets what is asked of it"),
    osVersion: opt(text(), "The version of what it runs"),
    diskEncrypted: opt(boolean2(), "Whether its storage is encrypted"),
    screenLock: opt(boolean2(), "Whether it locks its screen"),
    firewall: opt(boolean2(), "Whether its firewall is on"),
    jailbroken: opt(boolean2(), "Whether it has been broken out of its platform's protections"),
    edrActive: opt(boolean2(), "Whether endpoint detection is running"),
    patchAgeDays: opt(integer3(), "How many days old its latest patch is"),
    riskScore: opt(integer3(), "A score from its reporter"),
    details: opt(structured(), "What else was reported"),
    reportedAt: req(instant(), "When it was reported"),
    validUntil: req(instant(), "When the report stops counting")
  },
  identifiedBy: ["devicePostureId"],
  relationships: { device: one2(device, "The device") },
  annotations: [confidential2, keep(30), cites10("FR-003"), lookup2("device", "reportedAt")]
});
var deviceSession = concept("deviceSession", {
  definition: "A session of a person that is on a device, so that a decision about the person can use the device's posture",
  attributes: { boundAt: req(instant(), "When the session was bound to the device") },
  identifiedBy: ["device", "session"],
  relationships: { device: one2(device, "The device"), session: one2(loginSession, "The session") },
  annotations: [confidential2, keep(90), cites10("FR-003")]
});
var concepts9 = [device, deviceAttestation, devicePosture, deviceSession];
var identityDeviceModule = defineModule({
  name: "identityDevice",
  definition: "Device identities: endpoints, servers and things",
  requires: [identityPkiModule.name],
  concepts: concepts9,
  codeLists: [deviceKind, platform, managementState, ownership2, attestationKind, attestationResult, postureSource, compliance]
});

// models/identity-machine/mod.ts
init_api2();
var cites11 = citing("0037-identity-machine");
var machineKind = list2("machineKind", "What kind of program a machine is", { service: "A service that others call", workload: "A workload that a platform runs", pipeline: "A pipeline that builds or deploys", integration: "An integration with another system", bot: "A bot that acts on a schedule or an event" });
var environment = list2("environment", "Where a machine runs", { production: "Production", staging: "Staging", development: "Development", test: "Testing, with nothing real in it" }, true);
var issuerKind = list2("issuerKind", "What vouches for a workload", { spiffe: "A SPIFFE trust domain", kubernetes: "A Kubernetes cluster", oidc: "An OpenID Connect issuer", cloud: "A cloud provider's workload identity", mtls: "A certificate" });
var machine = concept("machine", {
  definition: "A program that acts for itself, with a person or a group accountable for it",
  attributes: {
    machineKind: req(codeOf2(machineKind), "What kind of program it is"),
    purpose: req(text(), "What it is for"),
    environment: opt(codeOf2(environment), "Where it runs"),
    isBreakGlass: req(boolean2(), "Whether it is an account kept for emergencies, whose every use is reviewed"),
    maxCredentialDays: opt(integer3(), "The longest a credential of the machine may live"),
    reviewBy: opt(instant(), "When the machine must next be reviewed by its owner")
  },
  identifiedBy: ["principal"],
  relationships: { principal: one2(principal, "The principal the machine is") },
  annotations: [confidential2, cites11("FR-001"), lookup2("reviewBy")]
});
var workloadIdentity = concept("workloadIdentity", {
  definition: "What a platform vouches for about a workload, so that a machine proves itself by it instead of by a secret",
  attributes: {
    workloadIdentityId: key("the binding"),
    issuerKind: req(codeOf2(issuerKind), "What vouches for it"),
    issuer: req(text(), "The issuer"),
    subject: req(text(), "The workload's name for the issuer: a SPIFFE ID, a service account, a subject, a thumbprint"),
    trustDomain: opt(text(), "The trust domain"),
    audience: opt(text(), "The audience the proof must be for"),
    selectors: many2(text(), "What must all match, as SPIRE's selectors do"),
    status: req(codeOf2(useStatus), "Whether the binding is applied"),
    bindingKey: req(text(), "A hash of the issuer and the subject, unique")
  },
  identifiedBy: ["workloadIdentityId"],
  relationships: { machine: one2(machine, "The machine the workload is") },
  annotations: [confidential2, cites11("FR-002"), unique2("bindingKey")]
});
var apiKey = concept("apiKey", {
  definition: "A random secret that a program presents, kept as a keyed hash and shown once, never wider in authority than its owner",
  attributes: {
    prefix: req(text(), "The part that is not secret, by which the key is found, unique"),
    secretHash: req(text(), "The keyed hash of the secret"),
    scopes: many2(text(), "The permissions the key may use: the owner's, narrowed to these"),
    allowedCidrs: many2(text(), "The networks it may be used from"),
    lastUsedAt: opt(instant(), "When it was last used")
  },
  identifiedBy: ["credential"],
  relationships: { credential: one2(credential, "The credential it is"), rotatedFrom: maybe(() => apiKey, "The key it replaced") },
  annotations: [restricted, cites11("FR-003"), unique2("prefix")]
});
var keyCredential = concept("keyCredential", {
  definition: "A public key that a principal proves itself with by signing; the private half is never kept",
  attributes: {
    publicJwk: req(structured(), "The public key as a JSON Web Key"),
    thumbprint: req(text(), "The RFC 7638 thumbprint of the key, unique; it is also what a proof of possession binds a token to"),
    algorithm: req(text(), "The signing algorithm")
  },
  identifiedBy: ["credential"],
  relationships: { credential: one2(credential, "The credential it is") },
  annotations: [restricted, cites11("FR-003"), unique2("thumbprint")]
});
var concepts10 = [machine, workloadIdentity, apiKey, keyCredential];
var identityMachineModule = defineModule({
  name: "identityMachine",
  definition: "Machine identities: services, workloads, pipelines and integrations",
  requires: [identityPkiModule.name],
  concepts: concepts10,
  codeLists: [machineKind, environment, issuerKind]
});

// models/identity-rebac/mod.ts
init_api2();
var cites12 = citing("0035-identity-rebac");
var authorizationModel = concept("authorizationModel", {
  definition: "The definition of a relationship-based access model: its object types, relations, rewrites and caveats",
  attributes: {
    authorizationModelId: key("the model"),
    version: req(integer3(), "Which version of the model this is"),
    definition: req(structured(), "The types, relations, rewrites and caveats"),
    status: req(codeOf2(useStatus), "Whether it is in use")
  },
  identifiedBy: ["authorizationModelId"],
  relationships: { tenant: maybe(tenant, "The tenant it is for; empty for the platform's") },
  annotations: [internal2, cites12("FR-001")]
});
var relationTuple = concept("relationTuple", {
  definition: "A fact of relationship-based access: this subject has this relation to this object, perhaps under a caveat and until a time",
  attributes: {
    relationTupleId: key("the fact"),
    tupleKey: req(text(), "A hash of the tenant, the object, the relation and the subject, unique, so that a fact is not recorded twice"),
    objectType: req(text(), "The kind of the object"),
    objectId: req(text(), "The object"),
    relation: req(text(), "The relation"),
    subjectType: req(text(), "The kind of the subject: a kind of principal, or a kind of object"),
    subjectId: req(text(), "The subject"),
    subjectRelation: opt(text(), "The relation of the subject that is meant, where a set is"),
    caveat: opt(text(), "The name of a caveat of the model that must hold"),
    caveatContext: opt(structured(), "The values the caveat is given"),
    expiresAt: opt(instant(), "When the fact stops holding"),
    createdAt: req(instant(), "When the fact was recorded")
  },
  identifiedBy: ["relationTupleId"],
  relationships: { tenant: one2(tenant, "The tenant the fact is in") },
  annotations: [internal2, cites12("FR-001"), unique2("tupleKey"), lookup2("objectType", "objectId", "relation"), lookup2("subjectType", "subjectId")]
});
var permissionRelation = concept("permissionRelation", {
  definition: "What holding a relation on an object of a type grants: the join between relationships and the permissions every kind of access shares",
  attributes: { objectType: req(text(), "The kind of object"), relation: req(text(), "The relation that grants the permission") },
  identifiedBy: ["permission", "objectType"],
  relationships: { permission: one2(permission, "The permission granted") },
  annotations: [internal2, cites12("FR-002")]
});
var concepts11 = [authorizationModel, relationTuple, permissionRelation];
var identityRebacModule = defineModule({ name: "identityRebac", definition: "Relationship-based access", requires: ["identityAccess"], concepts: concepts11, codeLists: [] });

// models/issues/mod.ts
init_api2();
var { quality: quality7, requirements: requirements4, security: security4, usage: usage4 } = exports_mod;
var spec = "0045-issues-model";
var cites13 = (...frs) => annotate(requirements4.cites, frs.map((f) => `${spec} ${f}`));
var internal3 = annotate(security4.classification, "internal");
var lookup3 = (...members) => annotate(usage4.lookup, { members });
var unique3 = (...members) => annotate(quality7.unique, { members });
var keep2 = (days) => annotate(quality7.retention, { days });
var list3 = (name, definition, codes) => codeList(name, {
  definition,
  codes: Object.fromEntries(Object.entries(codes).map(([code, d]) => [code, { label: code.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()), definition: d }])),
  annotations: [annotate(quality7.openness, "closed"), cites13("FR-001")]
});
var severity = list3("issueSeverity", "How bad an issue is", { critical: "Breaks a promise", high: "Weakens a promise", medium: "Costs something", low: "Minor" });
var priority = list3("issuePriority", "When it is to be done", { p1: "Before the next release", p2: "The release after", p3: "When convenient" });
var size = list3("issueSize", "How much work the fix is", { xs: "Hours", s: "A day", m: "A few days", l: "A week or more", xl: "A project" });
var statusKind = list3("issueStatusKind", "Where an issue is", {
  open: "To be done",
  inProgress: "Being done",
  fixed: "Done, with a proof",
  wontFix: "Will not be done, with a reason",
  notADefect: "Not a defect, with a reason",
  duplicate: "Another issue says the same",
  deferred: "Later, with a reason"
});
var presence = list3("issuePresence", "Whether the code still has the issue", { present: "It is in the code", withdrawn: "It is no longer in the code" });
var evidenceKind = list3("issueEvidenceKind", "What kind of evidence", { commit: "A commit", test: "A test", spec: "A specification", file: "A place in a file", review: "A review" });
var linkKind = list3("issueLinkKind", "How two issues are related", { blocks: "One must be done first", relates: "They touch the same thing", causedBy: "One is the cause of the other" });
var goal = list3("issueGoal", "What the library is meant to be", { g1: "Reliable", g2: "Secure", g3: "Type safe", g4: "Portable", g5: "Verifiable", g6: "Usable", g7: "Evolvable", g8: "Operable" });
var syncOutcome = list3("issueSyncOutcome", "What a synchronisation did", { synced: "Records were changed", unchanged: "The records already matched" });
var key2 = (what) => attribute2(identifier(), { definition: `What identifies ${what}` });
var req2 = (t, definition) => attribute2(t, { definition });
var opt3 = (t, definition) => attribute2(t, { definition, multiplicity: "optional" });
var one3 = (to, definition) => relationship(to, { cardinality: "one", definition });
var issue2 = concept("issue", {
  definition: "One known weakness of a library or a module, as the code of the repository says it",
  attributes: {
    issueId: key2("the issue: its scope and number"),
    scope: req2(text(), "The library or module it is of, by its path"),
    number: req2(integer3(), "Its number within the scope"),
    slug: req2(text(), "Its name in words joined by hyphens"),
    title: req2(text(), "What it is, in a line"),
    summary: req2(text(), "What is wrong and why it matters"),
    severity: req2(codeOf2(severity), "How bad it is"),
    priority: req2(codeOf2(priority), "When it is to be done"),
    size: req2(codeOf2(size), "How much work the fix is"),
    statusKind: req2(codeOf2(statusKind), "Where it is"),
    statusReason: opt3(text(), "Why, for a status that needs a reason"),
    statusProof: opt3(text(), "What shows it is done, for one that is fixed"),
    duplicateOf: opt3(integer3(), "The number of the issue it duplicates"),
    appliesToAll: req2(boolean2(), "Whether it is about every engine; where not, the engines are listed"),
    raised: req2(text(), "The day it was raised"),
    contentHash: req2(text(), "A hash of what the code says of it, so that a change is seen"),
    presence: req2(codeOf2(presence), "Whether the code still has it"),
    syncedAt: req2(instant(), "When a synchronisation last wrote it")
  },
  identifiedBy: ["issueId"],
  relationships: {},
  annotations: [internal3, keep2(3650), cites13("FR-002"), unique3("scope", "number"), lookup3("scope", "statusKind", "priority")]
});
var child2 = (name, definition, attributes, ...more) => concept(name, {
  definition,
  attributes: { [`${name}Id`]: key2(`the ${definition.toLowerCase()}`), ...attributes },
  identifiedBy: [`${name}Id`],
  relationships: { issue: one3(issue2, "The issue it is of") },
  annotations: [internal3, keep2(3650), cites13("FR-002"), lookup3("issue"), ...more]
});
var issueGoal = child2("issueGoal", "A goal an issue is held against", { goal: req2(codeOf2(goal), "The goal") }, unique3("issue", "goal"));
var issueEngine = child2("issueEngine", "An engine an issue is about", { engine: req2(text(), "The engine, as a dialect is named") }, unique3("issue", "engine"));
var issueEvidence = child2("issueEvidence", "A piece of evidence of an issue", {
  position: req2(integer3(), "Its place among the evidence"),
  kind: req2(codeOf2(evidenceKind), "What kind"),
  reference: req2(text(), "A sha, a test's file and title, a specification, a place in a file or a review")
});
var issueLink = concept("issueLink", {
  definition: "How an issue is related to another of its scope",
  attributes: { issueLinkId: key2("the link"), kind: req2(codeOf2(linkKind), "How they are related") },
  identifiedBy: ["issueLinkId"],
  relationships: { issue: one3(issue2, "The issue"), target: one3(issue2, "The issue it is related to") },
  annotations: [internal3, keep2(3650), cites13("FR-002"), lookup3("issue", "target")]
});
var issueSync = concept("issueSync", {
  definition: "One synchronisation of the records with the code, kept as a ledger",
  attributes: {
    issueSyncId: key2("the synchronisation"),
    scope: req2(text(), "The scope synchronised"),
    sourceHash: req2(text(), "A hash of the issues of the code at the time"),
    ranAt: req2(instant(), "When it ran"),
    outcome: req2(codeOf2(syncOutcome), "What it did"),
    inserted: req2(integer3(), "How many records it added"),
    updated: req2(integer3(), "How many it changed"),
    withdrawn: req2(integer3(), "How many it marked as no longer in the code"),
    reopened: req2(integer3(), "How many that were withdrawn it brought back")
  },
  identifiedBy: ["issueSyncId"],
  relationships: {},
  annotations: [internal3, keep2(3650), cites13("FR-003"), lookup3("scope")]
});
var issuesModule = defineModule({
  name: "issues",
  definition: "The issues a repository keeps as code, as records",
  requires: [],
  concepts: [issue2, issueGoal, issueEngine, issueEvidence, issueLink, issueSync],
  codeLists: [severity, priority, size, statusKind, presence, evidenceKind, linkKind, goal, syncOutcome]
});

// sql/cli/config.ts
init_api3();
var modelNames = [
  "arcaParty",
  "arcaTenancy",
  "identity",
  "identityAccess",
  "identityAbac",
  "identityRebac",
  "identityPki",
  "identityMachine",
  "identityDevice",
  "identityDelegation",
  "identityAgent",
  "issues"
];
function settingsOf(given) {
  const errors = [];
  for (const m of given.models)
    if (!modelNames.includes(m))
      errors.push({ kind: "model", name: m });
  const schema = given.schema ?? "arca";
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema))
    errors.push({ kind: "schema", name: schema });
  if (given.models.length === 0)
    errors.push({ kind: "model", name: "(none)" });
  if (errors.length > 0)
    return err(errors);
  return ok({
    schema,
    models: given.models,
    invariants: given.invariants ?? true,
    guard: given.guard ?? true,
    seal: given.seal ?? false,
    unmanaged: given.unmanaged ?? "drop",
    ledgerTable: given.ledgerTable ?? "lifecycle_ledger"
  });
}
var party3 = () => {
  if (partyDomain.kind === "err")
    throw new Error("the party model is not valid");
  return moduleOf(partyDomain.value);
};
var allModules = () => [
  party3(),
  tenancyModule,
  identityModule,
  identityAccessModule,
  identityAbacModule,
  identityRebacModule,
  identityPkiModule,
  identityMachineModule,
  identityDeviceModule,
  identityDelegationModule,
  identityAgentModule,
  issuesModule
];
function schemaOf(config) {
  const picked = withRequired(allModules(), config.models);
  if (picked.kind === "err")
    return err([{ kind: "compose", errors: picked.error }]);
  const domain = composeModules("arca", {}, picked.value);
  if (domain.kind === "err")
    return err([{ kind: "compose", errors: domain.error }]);
  const projected = projectDomain(domain.value);
  if (projected.kind === "err")
    return err([{ kind: "project", why: JSON.stringify(projected.error).slice(0, 300) }]);
  return ok({ domain: domain.value, schema: projected.value.schema });
}
async function loadConfig(path) {
  try {
    const mod = await import(path);
    return mod.default === undefined ? err(`${path} has no default export: write \`export default defineArca({...})\``) : ok(mod.default);
  } catch (thrown) {
    return err(`${path} could not be read: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
  }
}

// sql/cli/connection.ts
var plain3 = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v]));
async function connect(options = {}) {
  const bun = globalThis.Bun;
  if (options.driver === "bun" && bun?.SQL === undefined)
    throw new Error("Bun's client was asked for and this is not Bun");
  if (bun?.SQL !== undefined && options.driver !== "pg") {
    const sql = options.url === undefined ? new bun.SQL({ max: 1 }) : new bun.SQL(options.url, { max: 1, ...options.connectTimeout === undefined ? {} : { connectionTimeout: options.connectTimeout } });
    const one = await sql.reserve();
    return {
      kind: "bun",
      driver: {
        exec: async (q) => void await one.unsafe(q),
        query: async (q) => (await one.unsafe(q)).map(plain3)
      },
      close: async () => {
        await one.release();
        await sql.close();
      }
    };
  }
  const name = "pg";
  let mod;
  try {
    mod = await import(name);
  } catch {
    throw new Error("arcactl on Node needs the `pg` package (npm install pg); on Bun it needs nothing");
  }
  const Client = mod.Client ?? mod.default?.Client;
  if (Client === undefined)
    throw new Error("the `pg` package has no Client");
  const client = new Client({ ...options.url === undefined ? {} : { connectionString: options.url }, ...options.connectTimeout === undefined ? {} : { connectionTimeoutMillis: options.connectTimeout * 1000 } });
  await client.connect();
  const rowsOf = (r) => Array.isArray(r) ? r.at(-1)?.rows ?? [] : r.rows ?? [];
  return {
    kind: "pg",
    driver: { exec: async (q) => void await client.query(q), query: async (q) => rowsOf(await client.query(q)).map(plain3) },
    close: () => client.end()
  };
}

// sql/cli/doctor.ts
init_api2();

// sql/dialects/postgres/mod.ts
init_api4();
var type = (t) => {
  switch (t.kind) {
    case "text":
      return t.max === undefined ? "TEXT" : `VARCHAR(${t.max})`;
    case "integer":
      return "INTEGER";
    case "decimal":
      return t.precision === undefined ? "NUMERIC" : t.scale === undefined ? `NUMERIC(${t.precision})` : `NUMERIC(${t.precision}, ${t.scale})`;
    case "boolean":
      return "BOOLEAN";
    case "date":
      return "DATE";
    case "timestamp":
      return t.zone ? "TIMESTAMPTZ" : "TIMESTAMP";
    case "json":
      return "JSONB";
    case "bytes":
      return "BYTEA";
    case "vector":
      return `VECTOR(${t.dimensions})`;
  }
};
var dialect = {
  name: "postgres",
  features: [
    "comment-on",
    "regex-check",
    "add-constraint",
    "or-replace-view",
    "row-security",
    "grants",
    "routines",
    "partitions",
    "alter-column",
    "schemas",
    "updatable-views",
    "triggers",
    "event-triggers"
  ],
  maxName: 63,
  now: "CURRENT_TIMESTAMP",
  quote: quoteName,
  literal: standardLiteral,
  type,
  cascade: true,
  advisory: { acquire: (k) => `SELECT pg_advisory_lock(${k});`, release: (k) => `SELECT pg_advisory_unlock(${k});` },
  catalog: {
    compares: ["tables", "columns (type, nullability, default)", "primary keys", "indexes", "foreign keys, uniques and checks (by name)"],
    read: async (query, schema) => {
      const s = schema === undefined ? "current_schema()" : standardLiteral(schema);
      const tables = await query(`SELECT table_name n FROM information_schema.tables WHERE table_schema = ${s} AND table_type = 'BASE TABLE' ORDER BY table_name`);
      const cols = await query(`SELECT table_name t, column_name c, data_type d, character_maximum_length l, numeric_precision p, numeric_scale sc, udt_name u, is_nullable n, column_default df FROM information_schema.columns WHERE table_schema = ${s} ORDER BY table_name, ordinal_position`);
      const pks = await query(`SELECT tc.table_name t, kcu.column_name c FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = ${s} ORDER BY kcu.ordinal_position`);
      const cons = await query(`SELECT r.relname t, c.conname n, c.contype k FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace ns ON ns.oid = r.relnamespace WHERE ns.nspname = ${s} AND c.contype IN ('f', 'u', 'c')`);
      const idx = await query(`SELECT tablename t, indexname n FROM pg_indexes WHERE schemaname = ${s} AND indexname NOT IN (SELECT conname FROM pg_constraint)`);
      const typeOf = (r) => {
        const d = String(r["d"]);
        if (d === "character varying")
          return r["l"] === null || r["l"] === undefined ? d : `${d}(${r["l"]})`;
        if (d === "numeric")
          return r["p"] === null || r["p"] === undefined ? d : `numeric(${r["p"]},${r["sc"]})`;
        return d === "USER-DEFINED" ? String(r["u"]) : d;
      };
      return tables.map((t) => {
        const name = String(t["n"]);
        return {
          name,
          columns: cols.filter((c) => c["t"] === name).map((c) => ({ name: String(c["c"]), type: typeOf(c), nullable: c["n"] === "YES", ...c["df"] === null || c["df"] === undefined ? {} : { default: String(c["df"]) } })),
          primaryKey: pks.filter((k) => k["t"] === name).map((k) => String(k["c"])),
          indexes: idx.filter((i) => i["t"] === name).map((i) => String(i["n"])),
          constraints: cons.filter((c) => c["t"] === name).map((c) => ({
            name: String(c["n"]),
            kind: c["k"] === "f" ? "foreignKey" : c["k"] === "u" ? "unique" : "check"
          }))
        };
      });
    }
  },
  locks: {
    timeouts: (lockMs, statementMs) => [
      `SELECT set_config('lock_timeout', '${lockMs}', true);`,
      `SELECT set_config('statement_timeout', '${statementMs}', true);`
    ],
    timedOut: (message) => message.includes("lock timeout") || message.includes("lock_not_available")
  },
  deferredValidation: true,
  hash: (t) => `md5(${t})`,
  hasRole: (r) => `pg_has_role(current_user, ${standardLiteral(r)}, 'member')`,
  ifExists: ["addColumn", "dropColumn", "dropConstraint", "dropTable", "dropIndex"],
  probes: {
    table: (t, s) => `SELECT 1 FROM information_schema.tables WHERE table_schema = ${s === undefined ? "current_schema()" : standardLiteral(s)} AND table_name = ${standardLiteral(t)}`,
    column: (t, c, s) => `SELECT 1 FROM information_schema.columns WHERE table_schema = ${s === undefined ? "current_schema()" : standardLiteral(s)} AND table_name = ${standardLiteral(t)} AND column_name = ${standardLiteral(c)}`,
    constraint: (t, n, s) => `SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace s ON s.oid = r.relnamespace WHERE s.nspname = ${s === undefined ? "current_schema()" : standardLiteral(s)} AND r.relname = ${standardLiteral(t)} AND c.conname = ${standardLiteral(n)}`,
    validConstraint: (t, n, s) => `SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace s ON s.oid = r.relnamespace WHERE s.nspname = ${s === undefined ? "current_schema()" : standardLiteral(s)} AND r.relname = ${standardLiteral(t)} AND c.conname = ${standardLiteral(n)} AND c.convalidated`,
    index: (n, s) => `SELECT 1 FROM pg_indexes WHERE schemaname = ${s === undefined ? "current_schema()" : standardLiteral(s)} AND indexname = ${standardLiteral(n)}`
  },
  setup: (types) => types.some((t) => t.kind === "vector") ? ["CREATE EXTENSION IF NOT EXISTS vector;"] : [],
  pattern: (column, pattern) => `${column} ~ ${standardLiteral(pattern)}`
};
var extension = dialectExtension(dialect);

// sql/extensions/convergence/connect.ts
init_mod();
init_api5();

// sql/extensions/convergence/plan.ts
init_api5();

// sql/extensions/convergence/propose.ts
init_mod();
init_api5();

// sql/extensions/convergence/read.ts
init_mod();
init_api2();
init_api4();
var SYNONYMS = [
  ["character varying", "varchar"],
  ["timestamp with time zone", "timestamptz"],
  ["timestamp without time zone", "timestamp"],
  ["double precision", "double"],
  ["decimal", "numeric"],
  ["character", "char"],
  ["int4", "integer"],
  ["int", "integer"],
  ["bool", "boolean"]
];
function normalizeType(t) {
  let out = t.toLowerCase().replace(/\s+/g, " ").replace(/\s*([(),])\s*/g, "$1").trim();
  for (const [from, to] of SYNONYMS)
    out = out.replace(new RegExp(`^${from}(?![a-z])`), to);
  return out;
}
var sameType = (a, b) => normalizeType(a) === normalizeType(b);
var PLAIN = [
  { kind: "text" },
  { kind: "integer" },
  { kind: "boolean" },
  { kind: "date" },
  { kind: "timestamp", zone: true },
  { kind: "timestamp", zone: false },
  { kind: "json" },
  { kind: "bytes" }
];
function spell(dialect, live) {
  const n = normalizeType(live);
  for (const t of PLAIN)
    if (normalizeType(dialect.type(t)) === n)
      return dialect.type(t);
  let m;
  if (m = n.match(/^varchar\((\d+)\)$/))
    return dialect.type({ kind: "text", max: Number(m[1]) });
  if (m = n.match(/^numeric\((\d+)(?:,(\d+))?\)$/))
    return dialect.type({ kind: "decimal", precision: Number(m[1]), ...m[2] === undefined ? {} : { scale: Number(m[2]) } });
  if (n === "numeric")
    return dialect.type({ kind: "decimal" });
  if (m = n.match(/^(?:vector\((\d+)\)|float\[(\d+)\])$/))
    return dialect.type({ kind: "vector", dimensions: Number(m[1] ?? m[2]) });
  return live;
}
function normalDefault(text) {
  let t = text.trim();
  t = t.replace(/::[a-z_][a-z0-9_ ]*(\(\d+(,\d+)?\))?(\[\])?/gi, "");
  for (;; ) {
    const m = /^\((.*)\)$/s.exec(t);
    if (m === null)
      break;
    t = (m[1] ?? "").trim();
  }
  return t.split(/('(?:[^']|'')*')/).map((part, i) => i % 2 === 1 ? part : part.toLowerCase().replace(/\s+/g, " ")).join("");
}
function defaultOf(live, wanted) {
  if (live === undefined)
    return {};
  return wanted !== undefined && normalDefault(wanted) === normalDefault(live) ? { default: wanted } : { default: live };
}
var HOLD = "@hold";
async function readState(driver, dialect, desired, options = {}) {
  if (dialect.catalog === undefined)
    return err([{ kind: "unsupported", why: `${dialect.name} cannot read its own catalog` }]);
  const live = await dialect.catalog.read((sql) => driver.query(sql), desired.qualifier);
  const hold = (options.ignore ?? []).includes(HOLD);
  const skip = new Set((options.ignore ?? []).filter((n) => n !== HOLD));
  const held = options.held ?? [];
  const tails = [...skip].filter((n) => n.startsWith("*")).map((n) => n.slice(1).toLowerCase());
  const left = (name) => skip.has(name) || tails.some((x) => name.toLowerCase().endsWith(x));
  const first = desired.tables[0];
  const prefix = first === undefined ? [] : words(first.name).slice(0, Math.max(0, words(first.name).length - first.words.length));
  const tables = [];
  for (const t of live) {
    if (left(t.name))
      continue;
    const want = desired.tables.find((d) => d.name === t.name);
    if (hold && want === undefined) {
      held.push(`table ${t.name}`);
      continue;
    }
    const w = want?.words ?? (prefix.length > 0 && words(t.name).slice(0, prefix.length).join(".") === prefix.join(".") ? words(t.name).slice(prefix.length) : words(t.name));
    const columns = t.columns.filter((c) => {
      if (!hold || want === undefined || want.columns.some((x) => x.name === c.name || x.renamedFrom?.join(".") === words(c.name).join(".")))
        return true;
      held.push(`column ${t.name}.${c.name}`);
      return false;
    }).map((c) => {
      const d = want?.columns.find((x) => x.name === c.name);
      const renamed = d === undefined ? want?.columns.find((x) => x.renamedFrom?.join(".") === words(c.name).join(".")) : undefined;
      const typed = d ?? renamed;
      return {
        id: d?.id ?? `column:${w.join(".")}/${words(c.name).join(".")}`,
        words: d?.words ?? words(c.name),
        name: c.name,
        type: typed !== undefined && sameType(typed.type, c.type) ? typed.type : spell(dialect, c.type),
        nullable: c.nullable,
        ...defaultOf(c.default, d?.default)
      };
    });
    const kinds = ["foreignKey", "unique", "check"];
    const constraints = [];
    for (const k of kinds) {
      if (t.constraints === undefined)
        constraints.push(...want?.constraints.filter((c) => c.kind === k) ?? []);
      else
        for (const c of t.constraints.filter((x) => x.kind === k)) {
          if (hold && want !== undefined && !want.constraints.some((d) => d.kind === k && d.name === c.name)) {
            held.push(`${k} ${t.name}.${c.name}`);
            continue;
          }
          constraints.push(want?.constraints.find((d) => d.kind === k && d.name === c.name) ?? {
            id: `${k}:${c.name}`,
            kind: k,
            name: c.name,
            signature: `unknown:${c.name}`,
            text: ""
          });
        }
    }
    for (const name of t.indexes) {
      if (hold && want !== undefined && !want.constraints.some((d) => d.kind === "index" && d.name === name)) {
        held.push(`index ${t.name}.${name}`);
        continue;
      }
      constraints.push(want?.constraints.find((d) => d.kind === "index" && d.name === name) ?? {
        id: `ix:${name}`,
        kind: "index",
        name,
        signature: `unknown:${name}`,
        text: ""
      });
    }
    let rows = [];
    if (want !== undefined && want.rows.length > 0 && columns.length >= 3) {
      const [c0, c1, c2] = columns.map((c) => dialect.quote(c.name));
      const found = await driver.query(`SELECT ${c0} AS a, ${c1} AS b, ${c2} AS c FROM ${qualified(dialect, desired.qualifier, t.name)}`);
      rows = found.map((r) => ({
        code: String(r["a"]),
        label: String(r["b"]),
        description: r["c"] === null || r["c"] === undefined ? null : String(r["c"])
      }));
    }
    tables.push({
      id: want?.id ?? `table:${w.join(".")}`,
      words: w,
      name: t.name,
      columns,
      primaryKey: t.primaryKey,
      constraints,
      rows,
      ...want?.clause === undefined ? {} : { clause: want.clause }
    });
  }
  return ok({
    format: 1,
    dialect: desired.dialect,
    naming: desired.naming,
    ...desired.qualifier === undefined ? {} : { qualifier: desired.qualifier },
    tables
  });
}

// sql/extensions/convergence/propose.ts
init_api5();
function desiredState(schema, desired) {
  const r = snapshotOf(schema, {
    dialect: desired.dialect,
    ...desired.naming === undefined ? {} : { naming: desired.naming },
    ...desired.schema === undefined ? {} : { schema: desired.schema },
    ...desired.tableClauses === undefined ? {} : { tableClauses: desired.tableClauses }
  });
  return r.kind === "ok" ? r.value : undefined;
}
async function propose(driver, schema, desired, options = {}) {
  const wanted = desiredState(schema, desired);
  if (wanted === undefined)
    return err([{ kind: "plan", errors: [{ kind: "write", errors: [] }] }]);
  const held = [];
  const live = await readState(driver, desired.dialect, wanted, {
    ignore: [options.ledgerTable ?? "lifecycle_ledger", ...options.ignore ?? []],
    held
  });
  if (live.kind === "err")
    return err([{ kind: "read", errors: live.error }]);
  const { ignore: _ignore, ledgerTable: _ledger, ...planOptions } = options;
  const p = plan(live.value, schema, desired, planOptions);
  if (p.kind === "err")
    return err([{ kind: "plan", errors: p.error }]);
  const proposal = {
    format: 1,
    dialect: desired.dialect.name,
    base: stateHash(live.value),
    to: p.value.to,
    ...held.length === 0 ? {} : { held },
    steps: p.value.steps.map((s, i) => ({
      number: i + 1,
      id: s.id,
      name: s.name,
      kind: s.kind,
      class: s.class,
      ...s.why === undefined ? {} : { why: s.why },
      reversibility: s.reversibility,
      ...s.idempotency === undefined ? {} : { idempotency: s.idempotency },
      from: s.from,
      to: s.to,
      of: s.of,
      up: s.up,
      ...s.down === undefined ? {} : { down: s.down },
      ...s.verify === undefined ? {} : { verify: s.verify }
    })),
    repeatable: p.value.repeatable.map((r) => ({ key: r.key, hash: r.hash, of: r.of, statements: r.statements }))
  };
  return ok({ proposal, plan: p.value, live: live.value, wanted });
}
// sql/extensions/convergence/settings.ts
var defaultPolicy = {
  enabled: true,
  classes: ["safe"],
  reversibilities: ["lossless"],
  kinds: ["createTable", "addColumn", "addConstraint", "upsertRows"]
};
function settingsOf2(given = {}) {
  const ledgerTable = given.ledgerTable ?? "lifecycle_ledger";
  return {
    approval: given.approval ?? "reviewed",
    policy: { ...defaultPolicy, ...given.policy },
    ledgerTable,
    ignore: [...new Set([ledgerTable, "*quarantine", "*quarantined", ...given.ignore ?? [], ...given.unmanaged === "hold" ? [HOLD] : []])],
    unmanaged: given.unmanaged ?? "drop"
  };
}
// sql/extensions/invariants/mod.ts
init_mod();
init_api5();
init_api2();
init_api3();
init_api4();
var { quality: quality9 } = exports_mod;
var column = (t, member) => {
  const w = words(member).join(".");
  const exact = t.columns.find((c) => c.name.join(".") === w);
  if (exact !== undefined)
    return exact;
  const near = t.columns.filter((c) => c.name.join(".").startsWith(`${w}.`) && c.name.join(".").endsWith(".code"));
  return near.length === 1 ? near[0] : undefined;
};
function invariantsOf(tables) {
  const out = [];
  for (const t of tables) {
    const name = t.name.join(" ");
    for (const a of carriedOf(t, quality9.appendOnly)) {
      out.push({ table: name, kind: "append-only", says: "records are only added" });
      if (a.chain !== undefined)
        out.push({ table: name, kind: "chain", says: `each record names the hash of the one before it, in sequence` });
    }
    for (const m of carriedOf(t, quality9.atMost))
      out.push({ table: name, kind: "at-most", says: `${m.member} is never above ${m.other}` });
    for (const c of t.columns)
      for (const tr of carriedOf(c, quality9.transitions))
        out.push({ table: name, kind: "transitions", says: `${c.name.join(" ")} moves only ${Object.entries(tr.allowed).map(([f, to]) => `${f} to ${to.join(" or ") || "nothing"}`).join("; ")}` });
  }
  return out;
}
function invariants(given = {}) {
  const mode = given.unsupported ?? "refuse";
  return (context) => {
    const { dialect, schema, written, naming } = context;
    const declared = schema.tables.filter((t) => invariantsOf([t]).length > 0);
    if (declared.length === 0)
      return ok([]);
    if (!dialect.features.includes("triggers")) {
      return mode === "carry" ? ok([]) : err(declared.map((t) => ({ kind: "unsupported", element: t.id, why: `${dialect.name} has no triggers, so ${invariantsOf([t]).map((i) => i.says).join("; ")} cannot be enforced by the database` })));
    }
    const errors = [];
    const out = [];
    const q = (n) => dialect.quote(n);
    const lit = (s) => dialect.literal(s);
    for (const t of declared) {
      const tn = written.table(t.id) ?? "";
      const ref = written.ref(t.id);
      const of = [t.id];
      const col = (m) => {
        const c = column(t, m);
        if (c === undefined) {
          errors.push({ kind: "unsupported", element: t.id, why: `${tn} has no member ${m} for an invariant` });
          return;
        }
        return written.column(c.id);
      };
      const postgres = dialect.name === "postgres";
      const add = (what, timing, body) => {
        const fn = `inv_${tn}_${what}`.slice(0, 63);
        const message = `${tn}: ${body.message}`;
        if (postgres) {
          const fnRef = qualified(dialect, written.qualifier, fn);
          out.push({ group: "routine", of, sql: `CREATE OR REPLACE FUNCTION ${fnRef}() RETURNS trigger LANGUAGE plpgsql AS $inv$
BEGIN
  IF ${body.test} THEN
    RAISE EXCEPTION ${lit(message)} USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END
$inv$;` });
          out.push({ group: "routine", of, sql: `DROP TRIGGER IF EXISTS ${q(fn)} ON ${ref};` });
          out.push({ group: "routine", of, sql: `CREATE TRIGGER ${q(fn)} ${timing} ON ${ref} FOR EACH ROW EXECUTE FUNCTION ${fnRef}();` });
        } else {
          out.push({ group: "routine", of, sql: `DROP TRIGGER IF EXISTS ${q(fn)};` });
          out.push({ group: "routine", of, sql: `CREATE TRIGGER ${q(fn)} ${timing} ON ${ref}${body.when === undefined ? "" : ` WHEN ${body.when}`}
BEGIN
  SELECT RAISE(ABORT, ${lit(message)});
END;` });
        }
      };
      const rule = (what, timing, condition, message, sqliteTimings = [timing]) => {
        if (postgres)
          add(what, timing, { test: condition, message });
        else
          for (const s of sqliteTimings)
            add(`${what}${sqliteTimings.length > 1 ? `_${s.split(" ")[1]?.toLowerCase() ?? ""}` : ""}`, s, { when: condition, test: condition, message });
      };
      for (const a of carriedOf(t, quality9.appendOnly)) {
        if (postgres) {
          const fn = `inv_${tn}_append_only`.slice(0, 63);
          const fnRef = qualified(dialect, written.qualifier, fn);
          out.push({ group: "routine", of, sql: `CREATE OR REPLACE FUNCTION ${fnRef}() RETURNS trigger LANGUAGE plpgsql AS $inv$
BEGIN
  RAISE EXCEPTION ${lit(`${tn} is append-only: a record is never changed or removed`)} USING ERRCODE = 'integrity_constraint_violation';
END
$inv$;` });
          out.push({ group: "routine", of, sql: `DROP TRIGGER IF EXISTS ${q(fn)} ON ${ref};` });
          out.push({ group: "routine", of, sql: `CREATE TRIGGER ${q(fn)} BEFORE UPDATE OR DELETE ON ${ref} FOR EACH ROW EXECUTE FUNCTION ${fnRef}();` });
          out.push({ group: "routine", of, sql: `DROP TRIGGER IF EXISTS ${q(`${fn}_t`.slice(0, 63))} ON ${ref};` });
          out.push({ group: "routine", of, sql: `CREATE TRIGGER ${q(`${fn}_t`.slice(0, 63))} BEFORE TRUNCATE ON ${ref} FOR EACH STATEMENT EXECUTE FUNCTION ${fnRef}();` });
        } else {
          for (const when of ["UPDATE", "DELETE"]) {
            const n = `inv_${tn}_append_only_${when.toLowerCase()}`.slice(0, 63);
            out.push({ group: "routine", of, sql: `DROP TRIGGER IF EXISTS ${q(n)};` });
            out.push({ group: "routine", of, sql: `CREATE TRIGGER ${q(n)} BEFORE ${when} ON ${ref}
BEGIN
  SELECT RAISE(ABORT, ${lit(`${tn} is append-only: a record is never changed or removed`)});
END;` });
          }
        }
        if (a.chain !== undefined) {
          const h = col(a.chain.hash);
          const p = col(a.chain.previous);
          const s = col(a.chain.sequence);
          if (h === undefined || p === undefined || s === undefined)
            continue;
          const genesis = lit(a.chain.genesis);
          if (postgres) {
            const fn = `inv_${tn}_chain`.slice(0, 63);
            const fnRef = qualified(dialect, written.qualifier, fn);
            out.push({
              group: "routine",
              of,
              sql: `CREATE OR REPLACE FUNCTION ${fnRef}() RETURNS trigger LANGUAGE plpgsql AS $inv$
DECLARE last_seq bigint; last_hash text;
BEGIN
  SELECT ${q(s)}, ${q(h)} INTO last_seq, last_hash FROM ${ref} ORDER BY ${q(s)} DESC LIMIT 1;
  IF NOT FOUND THEN
    IF NEW.${q(s)} <> 1 OR NEW.${q(p)} <> ${genesis} THEN RAISE EXCEPTION ${lit(`${tn} chain: the first record is number 1 and follows the start`)} USING ERRCODE = 'integrity_constraint_violation'; END IF;
  ELSIF NEW.${q(s)} <> last_seq + 1 OR NEW.${q(p)} <> last_hash THEN
    RAISE EXCEPTION ${lit(`${tn} chain: a record follows the last one, by number and by hash`)} USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END
$inv$;`
            });
            out.push({ group: "routine", of, sql: `DROP TRIGGER IF EXISTS ${q(fn)} ON ${ref};` });
            out.push({ group: "routine", of, sql: `CREATE TRIGGER ${q(fn)} BEFORE INSERT ON ${ref} FOR EACH ROW EXECUTE FUNCTION ${fnRef}();` });
          } else {
            const n = `inv_${tn}_chain`.slice(0, 63);
            const when = `((SELECT COUNT(*) FROM ${ref}) = 0 AND (NEW.${q(s)} <> 1 OR NEW.${q(p)} <> ${genesis})) OR ((SELECT COUNT(*) FROM ${ref}) > 0 AND NOT EXISTS (SELECT 1 FROM ${ref} AS h WHERE h.${q(s)} = (SELECT MAX(${q(s)}) FROM ${ref}) AND NEW.${q(s)} = h.${q(s)} + 1 AND NEW.${q(p)} = h.${q(h)}))`;
            out.push({ group: "routine", of, sql: `DROP TRIGGER IF EXISTS ${q(n)};` });
            out.push({ group: "routine", of, sql: `CREATE TRIGGER ${q(n)} BEFORE INSERT ON ${ref} WHEN ${when}
BEGIN
  SELECT RAISE(ABORT, ${lit(`${tn} chain: a record follows the last one, by number and by hash`)});
END;` });
          }
        }
      }
      for (const m of carriedOf(t, quality9.atMost)) {
        const a = col(m.member);
        const b = col(m.other);
        if (a === undefined || b === undefined)
          continue;
        const bad = `NEW.${q(a)} > NEW.${q(b)}`;
        rule(`${a}_at_most`, "BEFORE INSERT OR UPDATE", bad, `${a} is never above ${b}`, ["BEFORE INSERT", "BEFORE UPDATE"]);
      }
      for (const c of t.columns) {
        for (const tr of carriedOf(c, quality9.transitions)) {
          const cn = written.column(c.id) ?? "";
          const allowed = Object.entries(tr.allowed).filter(([, to]) => to.length > 0);
          const ok1 = allowed.length === 0 ? "FALSE" : allowed.map(([from, to]) => `(OLD.${q(cn)} = ${lit(writeCode(naming, from))} AND NEW.${q(cn)} IN (${to.map((x) => lit(writeCode(naming, x))).join(", ")}))`).join(" OR ");
          const changed = postgres ? `OLD.${q(cn)} IS DISTINCT FROM NEW.${q(cn)}` : `OLD.${q(cn)} IS NOT NEW.${q(cn)}`;
          rule(`${cn}_moves`, `BEFORE UPDATE OF ${q(cn)}`, `${changed} AND NOT (${ok1})`, `${cn} moves only along the moves it may make`, [`BEFORE UPDATE OF ${q(cn)}`]);
        }
      }
    }
    if (dialect.name === "postgres" && given.guard !== false && dialect.features.includes("event-triggers"))
      out.push(...guardStatements(context, declared.map((t) => t.id), given.guard?.unlock));
    return errors.length > 0 ? err(errors) : ok(out);
  };
}
function guardStatements(context, of, unlock) {
  const { dialect, written } = context;
  const lit = (s) => dialect.literal(s);
  const fn = (n) => qualified(dialect, written.qualifier, n);
  const open = unlock === undefined ? "FALSE" : `encode(sha256(convert_to(coalesce(current_setting('ifc.ddl_unlock', true), ''), 'UTF8')), 'hex') = ${lit(unlock)}`;
  const body = (inner) => `AS $g$
DECLARE o record;
BEGIN
  IF ${open} THEN RETURN; END IF;
${inner}END
$g$;`;
  const refuse = (what) => `RAISE EXCEPTION '%: %', ${lit(what)}, o.object_identity USING ERRCODE = 'insufficient_privilege', HINT = 'the invariants of the database are changed by a session that holds the unlock secret';`;
  const s = (sql) => ({ group: "routine", of, sql });
  return [
    s(`CREATE OR REPLACE FUNCTION ${fn("inv_guard_drop")}() RETURNS event_trigger LANGUAGE plpgsql ${body(`  FOR o IN SELECT object_type, object_identity FROM pg_event_trigger_dropped_objects() LOOP
    IF o.object_type IN ('trigger', 'function') AND o.object_identity ~ '(^|[ .])inv_' THEN ${refuse("an invariant of the database cannot be dropped")} END IF;
  END LOOP;
`)}`),
    s(`CREATE OR REPLACE FUNCTION ${fn("inv_guard_end")}() RETURNS event_trigger LANGUAGE plpgsql ${body(`  FOR o IN SELECT command_tag, object_identity, objid FROM pg_event_trigger_ddl_commands() LOOP
    IF o.command_tag = 'ALTER TABLE' AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = o.objid AND tgname ~ '^inv_' AND tgenabled <> 'O') THEN ${refuse("an invariant of the database cannot be disabled")} END IF;
    IF o.command_tag IN ('CREATE FUNCTION', 'ALTER FUNCTION') AND o.object_identity ~ '(^|[.])inv_' THEN ${refuse("an invariant of the database cannot be replaced")} END IF;
  END LOOP;
`)}`),
    s(`CREATE OR REPLACE FUNCTION ${fn("inv_guard_start")}() RETURNS event_trigger LANGUAGE plpgsql AS $g$
BEGIN
  IF ${open} THEN RETURN; END IF;
  RAISE EXCEPTION 'a trigger cannot be renamed: it may be an invariant of the database' USING ERRCODE = 'insufficient_privilege';
END
$g$;`),
    s("DROP EVENT TRIGGER IF EXISTS inv_guard_drop;"),
    s(`CREATE EVENT TRIGGER inv_guard_drop ON sql_drop EXECUTE FUNCTION ${fn("inv_guard_drop")}();`),
    s("DROP EVENT TRIGGER IF EXISTS inv_guard_end;"),
    s(`CREATE EVENT TRIGGER inv_guard_end ON ddl_command_end WHEN TAG IN ('ALTER TABLE', 'CREATE FUNCTION', 'ALTER FUNCTION') EXECUTE FUNCTION ${fn("inv_guard_end")}();`),
    s("DROP EVENT TRIGGER IF EXISTS inv_guard_start;"),
    s(`CREATE EVENT TRIGGER inv_guard_start ON ddl_command_start WHEN TAG IN ('ALTER TRIGGER') EXECUTE FUNCTION ${fn("inv_guard_start")}();`)
  ];
}
function placed(tables, dialect) {
  const need = { "append-only": "append-only", chain: "hash-chain", transitions: "status-moves", "at-most": "column-cap" };
  return invariantsOf(tables).map((i) => ({ ...i, ...where(dialect, need[i.kind]) }));
}

// sql/extensions/operations/runtime.ts
init_mod();
init_api2();
init_api5();
init_api4();

// sql/extensions/operations/tx.ts
init_api2();
init_api4();
var camel2 = (w) => w.map((x, i) => i === 0 ? x : x.charAt(0).toUpperCase() + x.slice(1)).join("");
var plain4 = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v]));
function resolver(schema, dialect, naming, inSchema) {
  const names = writeNames(schema, dialect, naming, [], inSchema);
  const tableOf = (name) => {
    const t = schema.tables.find((x) => x.name.join(".") === words(name).join("."));
    if (t === undefined)
      throw new Error(`the schema has no table ${name}`);
    return t;
  };
  const column = (t, key) => {
    const w = words(key);
    const exact = t.columns.find((c) => c.name.join(".") === w.join("."));
    if (exact !== undefined)
      return { written: names.column(exact.id) ?? "", key: camel2(exact.name) };
    const holders = t.foreignKeys.flatMap((f) => f.columns.length === 1 ? f.columns : []).filter((c) => c.slice(0, w.length).join(".") === w.join("."));
    const col = holders.length === 1 ? t.columns.find((c) => c.name.join(".") === holders[0].join(".")) : undefined;
    if (col === undefined)
      throw new Error(`${t.name.join(" ")} has no column ${key}${holders.length > 1 ? ` (${holders.length} hold it)` : ""}`);
    return { written: names.column(col.id) ?? "", key: camel2(col.name) };
  };
  const q = (n) => dialect.quote(n);
  const refs = {
    table: (name) => names.ref(tableOf(name).id),
    col: (table, key) => q(column(tableOf(table), key).written),
    lit: (v) => dialect.literal(v),
    code: (v) => writeCode(naming, v)
  };
  return { refs, tableOf, column, written: names, naming };
}
function track(driver, r, dialect, kind, sink, context) {
  const written = new Set;
  const changed = new Set;
  const actions = [];
  const q = (n) => dialect.quote(n);
  const lit = (v) => dialect.literal(v);
  const mayWrite = (table) => {
    if (kind === "query")
      throw new Error(`a query may not write ${table}`);
    written.add(words(table).join("."));
  };
  const writable = (table) => {
    mayWrite(table);
    changed.add(words(table).join("."));
  };
  const cond = (t, where) => {
    const parts = Object.entries(where).map(([k, test]) => {
      const c = q(r.column(t, k).written);
      if (test === null)
        return `${c} IS NULL`;
      if (typeof test !== "object")
        return `${c} = ${lit(test)}`;
      const ops = [];
      for (const [op, v] of Object.entries(test)) {
        const sym = { gt: ">", ge: ">=", lt: "<", le: "<=", ne: "<>" }[op];
        if (sym === undefined)
          throw new Error(`no comparison ${op}`);
        ops.push(v === null ? `${c} IS ${op === "ne" ? "NOT " : ""}NULL` : `${c} ${sym} ${lit(v)}`);
      }
      return ops.join(" AND ");
    });
    return parts.length === 0 ? "TRUE" : parts.join(" AND ");
  };
  const tx = {
    ...r.refs,
    async insert(table, values) {
      writable(table);
      const t = r.tableOf(table);
      const cols = Object.keys(values).map((k) => r.column(t, k).written);
      await driver.exec(`INSERT INTO ${r.refs.table(table)} (${cols.map(q).join(", ")}) VALUES (${Object.values(values).map(lit).join(", ")});`);
    },
    async update(table, set, where) {
      mayWrite(table);
      const t = r.tableOf(table);
      const sets = Object.entries(set).map(([k, v]) => `${q(r.column(t, k).written)} = ${lit(v)}`);
      const n = (await driver.query(`UPDATE ${r.refs.table(table)} SET ${sets.join(", ")} WHERE ${cond(t, where)} RETURNING 1 AS n;`)).length;
      if (n > 0)
        changed.add(words(table).join("."));
      return n;
    },
    async remove(table, where) {
      mayWrite(table);
      const t = r.tableOf(table);
      const n = (await driver.query(`DELETE FROM ${r.refs.table(table)} WHERE ${cond(t, where)} RETURNING 1 AS n;`)).length;
      if (n > 0)
        changed.add(words(table).join("."));
      return n;
    },
    async select(table, options = {}) {
      const t = r.tableOf(table);
      const asked = options.columns?.map((k) => ({ asked: k, written: r.column(t, k).written }));
      const all = t.columns.map((c) => ({ asked: camel2(c.name), written: r.column(t, c.name.join(".")).written }));
      const cols = asked ?? all;
      const order = (options.orderBy ?? []).map(([k, d]) => `${q(r.column(t, k).written)} ${d === "desc" ? "DESC" : "ASC"}`);
      const sql = `SELECT ${cols.map((c) => `${q(c.written)} AS ${q(c.asked)}`).join(", ")} FROM ${r.refs.table(table)} WHERE ${cond(t, options.where ?? {})}${order.length > 0 ? ` ORDER BY ${order.join(", ")}` : ""}${options.limit === undefined ? "" : ` LIMIT ${options.limit}`};`;
      return (await driver.query(sql)).map(plain4);
    },
    async count(table, where = {}) {
      return Number((await driver.query(`SELECT COUNT(*) AS n FROM ${r.refs.table(table)} WHERE ${cond(r.tableOf(table), where)};`))[0]?.["n"] ?? 0);
    },
    async query(build) {
      return (await driver.query(build(r.refs))).map(plain4);
    },
    async audit(event) {
      if (sink === undefined)
        throw new Error("no audit trail is given");
      actions.push(event.action);
      return sink.record(tx, event, context);
    }
  };
  return { tx, writes: () => written, changed: () => changed, actions: () => actions };
}

// sql/extensions/operations/runtime.ts
var bytes2 = (n) => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
function defaultContext(pepper = "") {
  return {
    now: () => new Date().toISOString(),
    newId: () => globalThis.crypto.randomUUID(),
    newToken: () => bytes2(32),
    hashToken: (t) => sha256Hex(t),
    hashIdentifier: (s) => sha256Hex(`${pepper}:${s.trim().toLowerCase()}`),
    verifyPassword: () => Promise.reject(new Error("no password verifier is given"))
  };
}
var TYPES = {
  text: (v) => typeof v === "string",
  integer: (v) => typeof v === "number" && Number.isSafeInteger(v),
  number: (v) => typeof v === "number" && Number.isFinite(v),
  boolean: (v) => typeof v === "boolean",
  instant: (v) => typeof v === "string" && !Number.isNaN(Date.parse(v)),
  textList: (v) => Array.isArray(v) && v.every((x) => typeof x === "string")
};
function checkInput(o, input) {
  const errors = [];
  for (const k of Object.keys(input))
    if (!(k in o.input))
      errors.push({ kind: "unknown", input: k });
  for (const [k, spec] of Object.entries(o.input)) {
    const v = input[k];
    if (v === undefined || v === null) {
      if (!spec.optional)
        errors.push({ kind: "missing", input: k });
    } else if (!TYPES[spec.type](v))
      errors.push({ kind: "type", input: k, expected: spec.type });
  }
  return errors;
}
function operations2(schema, dialect, driver, contracts, implementations, options = {}) {
  const nm = options.naming ?? naming();
  const r = resolver(schema, dialect, nm, options.schema);
  const errors = [];
  const by = new Map(contracts.map((c) => [c.name, c]));
  for (const c of contracts) {
    if (implementations[c.name] === undefined)
      errors.push({ kind: "no-implementation", operation: c.name });
    for (const t of [...c.spec.reads, ...c.spec.writes])
      try {
        r.tableOf(t);
      } catch {
        errors.push({ kind: "unknown-table", operation: c.name, table: t });
      }
    if (c.spec.requires === undefined && c.spec.public !== true && c.spec.checkedBy === undefined)
      errors.push({ kind: "no-permission", operation: c.name });
    if (c.spec.requires !== undefined && options.authorize === undefined)
      errors.push({ kind: "no-authorizer", operation: c.name });
    if (c.spec.emits.length > 0 && options.audit === undefined)
      errors.push({ kind: "no-audit", operation: c.name });
  }
  for (const n of Object.keys(implementations))
    if (!by.has(n))
      errors.push({ kind: "no-contract", operation: n });
  if (errors.length > 0)
    return err(errors);
  const context = { ...defaultContext(), ...options.context };
  const run = async (name, input, caller) => {
    const o = by.get(name);
    if (o === undefined)
      return err({ kind: "unknown-operation", name });
    const bad = checkInput(o, input);
    if (bad.length > 0)
      return err({ kind: "input", errors: bad });
    const ctx = caller === undefined ? context : { ...context, caller };
    const kept = track(driver, r, dialect, o.spec.kind, options.audit, ctx);
    await driver.exec("BEGIN");
    let done = false;
    try {
      if (o.spec.requires !== undefined) {
        const tenant = o.spec.scope === undefined ? undefined : input[o.spec.scope];
        const allowed = caller !== undefined && await options.authorize(kept.tx, caller, o.spec.requires, tenant);
        if (!allowed) {
          const first = o.spec.emits[0];
          if (first !== undefined && o.spec.kind === "command") {
            const event = { action: first, outcome: "denied", actorKind: caller === undefined ? "system" : "user", ...caller === undefined ? {} : { actor: caller }, ...tenant === undefined ? {} : { tenant }, reason: `lacks ${o.spec.requires}` };
            await kept.tx.audit(event);
            await driver.exec("COMMIT");
            done = true;
          }
          return ok({ status: "denied", permission: o.spec.requires });
        }
      }
      const outcome = await implementations[name](kept.tx, input, ctx);
      if (o.spec.kind === "command") {
        const declared = new Set([...o.spec.writes, ...options.audit === undefined ? [] : [options.audit.table]].map((w) => words(w).join(".")));
        const stray = [...kept.writes()].filter((w) => !declared.has(w));
        if (stray.length > 0)
          return err({ kind: "undeclared-write", tables: stray });
        if (outcome.commit !== false && kept.changed().size > 0 && o.spec.emits.length > 0 && !kept.actions().some((a) => o.spec.emits.includes(a)))
          return err({ kind: "missing-audit", emits: o.spec.emits });
      }
      if (outcome.commit === false || o.spec.kind === "query")
        await driver.exec("ROLLBACK");
      else
        await driver.exec("COMMIT");
      done = true;
      return ok(outcome);
    } catch (thrown) {
      return err({ kind: "failed", message: thrown instanceof Error ? thrown.message : String(thrown) });
    } finally {
      if (!done)
        await driver.exec("ROLLBACK").catch(() => {
          return;
        });
    }
  };
  return ok({ names: contracts.map((c) => c.name), run });
}
// sql/extensions/operations/identity/expr.ts
var OPS = new Set(["and", "or", "not", "eq", "ne", "lt", "le", "gt", "ge", "in", "contains", "startsWith", "exists"]);
// sql/extensions/operations/identity/audit.ts
init_api5();
var GENESIS3 = "genesis";
var eventHashOf = (f) => sha256Hex(canonical([f.previous, f.sequence, f.id, f.at, f.actorKind, f.actor ?? null, f.onBehalfOf ?? null, f.tenant ?? null, f.action, f.outcome, f.decision ?? null, f.targetConcept ?? null, f.targetKey ?? null, f.reason ?? null, f.policyRefs ?? null, f.chain ?? null]));
async function verifyAuditChain(tx) {
  const rows = await tx.select("audit event", {
    columns: ["auditEventId", "sequence", "occurredAt", "actorKind", "actor", "onBehalfOf", "tenant", "action", "outcome", "decision", "targetConcept", "targetKey", "reason", "policyRefs", "chain", "previousHash", "eventHash"],
    orderBy: [["sequence", "asc"]]
  });
  const parsed = (v) => {
    if (typeof v !== "string")
      return v ?? null;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  };
  const text = (v) => v === null || v === undefined ? null : String(v);
  const problems = [];
  let at = GENESIS3;
  let expected = 1;
  for (const e of rows) {
    const id = String(e["auditEventId"]);
    if (Number(e["sequence"]) !== expected)
      problems.push({ kind: Number(e["sequence"]) < expected ? "forked" : "broken", at: id });
    if (String(e["previousHash"]) !== at)
      problems.push({ kind: "broken", at: id });
    const again = eventHashOf({
      previous: String(e["previousHash"]),
      sequence: Number(e["sequence"]),
      id,
      at: e["occurredAt"] instanceof Date ? e["occurredAt"].toISOString() : new Date(String(e["occurredAt"])).toISOString(),
      actorKind: String(e["actorKind"]),
      actor: text(e["actor"]),
      onBehalfOf: text(e["onBehalfOf"]),
      tenant: text(e["tenant"]),
      action: String(e["action"]),
      outcome: String(e["outcome"]),
      decision: text(e["decision"]),
      targetConcept: text(e["targetConcept"]),
      targetKey: text(e["targetKey"]),
      reason: text(e["reason"]),
      policyRefs: parsed(e["policyRefs"]),
      chain: parsed(e["chain"])
    });
    if (again !== String(e["eventHash"]))
      problems.push({ kind: "hash-mismatch", at: id });
    at = String(e["eventHash"]);
    expected = Number(e["sequence"]) + 1;
  }
  return { length: rows.length, problems };
}
// sql/cli/doctor.ts
init_api5();
init_api3();
init_api4();

// sql/cli/redact.ts
function redact(text, secrets = []) {
  let out = text.replace(/([a-z][a-z0-9+.-]*:\/\/[^\s:/@]*):([^\s@/]+)@/gi, "$1:***@").replace(/(password\s*=\s*)('[^']*'|"[^"]*"|\S+)/gi, "$1***");
  for (const s of secrets)
    if (s.length >= 4)
      out = out.split(s).join("***");
  return out;
}
function passwordOf(url) {
  if (url === undefined)
    return;
  try {
    const p = new URL(url).password;
    return p === "" ? undefined : decodeURIComponent(p);
  } catch {
    return;
  }
}

// sql/cli/doctor.ts
var lit = (s) => dialect.literal(s);
var rows = (c, sql) => c.driver.query(sql);
var num = (v) => Number(v ?? 0);
var names = (xs, max = 8) => xs.length <= max ? xs.join(", ") : `${xs.slice(0, max).join(", ")} and ${xs.length - max} more`;
function bound(c) {
  const sources = c.config.invariants ? [invariants({ ...c.config.guard ? {} : { guard: false } })] : [];
  const b = bind(c.schema, { dialect, schema: c.config.schema, sources });
  return b.kind === "ok" ? b.value : undefined;
}
var expectedTriggers = (c) => {
  const b = bound(c);
  if (b === undefined)
    return [];
  return b.statements.flatMap((s) => {
    const m = /^CREATE TRIGGER "([^"]+)"[^\n]* ON (?:"[^"]+"\.)?"([^"]+)"/.exec(s.sql);
    return m === null ? [] : [{ name: m[1], table: m[2] }];
  });
};
var checks = [
  {
    id: "ARCA-D001",
    title: "connection and server",
    async run(c) {
      const r = (await rows(c, `SELECT version() AS v, current_user AS u, current_setting('server_version_num')::int AS n, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS su`))[0];
      const n = num(r?.["n"]);
      const su = r?.["su"] === true;
      const note = su ? "a superuser" : "not a superuser, so it cannot install the DDL guard (event triggers)";
      return n < 140000 ? { status: "warn", detail: `${String(r?.["v"])} as ${String(r?.["u"])}, ${note}; the models are tested on PostgreSQL 14 and later`, next: "use PostgreSQL 14 or later" } : { status: "pass", detail: `${String(r?.["v"]).split(" on ")[0]} as ${String(r?.["u"])}, ${note}` };
    }
  },
  {
    id: "ARCA-D002",
    title: "initialised",
    async run(c) {
      const have = await rows(c, `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ${lit(c.config.schema)}`);
      if (have.length === 0)
        return { status: "fail", detail: `nothing is in the schema ${c.config.schema}: this database has not been initialised for ${c.config.models.join(", ")}`, next: "initialise it (arcactl init), or apply the models' DDL to this schema" };
      const there = new Set(have.map((r) => String(r["t"])));
      const b = bound(c);
      const wanted = b === undefined ? [] : [...new Set(b.statements.flatMap((s) => s.group === "table" ? [/^CREATE TABLE IF NOT EXISTS (?:"[^"]+"\.)?"([^"]+)"/.exec(s.sql)?.[1] ?? ""] : []))].filter((x) => x !== "");
      const missing = wanted.filter((t) => !there.has(t));
      return missing.length > 0 ? { status: "fail", detail: `${missing.length} of ${wanted.length} tables are missing: ${names(missing)}`, next: "bring the database to the model (arcactl init), after reviewing what drift (ARCA-D003) says" } : { status: "pass", detail: `all ${wanted.length} tables of ${c.config.models.join(", ")} are in ${c.config.schema}` };
    }
  },
  {
    id: "ARCA-D003",
    title: "drift from the model",
    async run(c) {
      const exists = (await rows(c, `SELECT 1 AS x FROM information_schema.schemata WHERE schema_name = ${lit(c.config.schema)}`)).length > 0;
      if (!exists)
        return { status: "unknown", detail: "the schema is not there, so there is nothing to compare", next: "see ARCA-D002" };
      const r = await propose(c.driver, c.schema, { dialect, schema: c.config.schema }, { allow: { destructive: true }, ignore: settingsOf2({ unmanaged: c.config.unmanaged, ledgerTable: c.config.ledgerTable }).ignore, ledgerTable: c.config.ledgerTable });
      if (r.kind === "err")
        return { status: "unknown", detail: `the database could not be read against the model: ${redact(JSON.stringify(r.error).slice(0, 300), c.secrets)}` };
      const steps = r.value.plan.steps.map((s) => s.name);
      const held = r.value.proposal.held ?? [];
      if (steps.length > 0)
        return { status: "fail", detail: `${steps.length} change${steps.length === 1 ? "" : "s"} would bring the database to the model: ${names(steps)}`, next: "review the plan (arcactl plan, or propose in the library) before anything is applied" };
      return held.length > 0 ? { status: "warn", detail: `the database is as the model says; held outside it: ${names(held)}`, next: "name them in the model or remove them" } : { status: "pass", detail: `the database is as the model says (${stateHash(r.value.live).slice(0, 12)})` };
    }
  },
  {
    id: "ARCA-D004",
    title: "ledger",
    async run(c) {
      const there = (await rows(c, `SELECT 1 AS x FROM information_schema.tables WHERE table_schema = ${lit(c.config.schema)} AND table_name = ${lit(c.config.ledgerTable)}`)).length > 0;
      if (!there)
        return { status: "warn", detail: `there is no ledger (${c.config.ledgerTable}) in ${c.config.schema}: the tables were not made through the lifecycle, so what was applied is not recorded`, next: "initialise through arcactl so that each change is recorded" };
      await c.driver.exec(`SET search_path TO ${dialect.quote(c.config.schema)}, public`);
      const entries = await readLedger(c.driver, dialect, c.config.ledgerTable);
      const broken = verifyChain(entries);
      return broken === undefined ? { status: "pass", detail: `${entries.length} entr${entries.length === 1 ? "y" : "ies"}, in order, each chained to the one before` } : { status: "fail", detail: `the ledger is broken at entry ${broken.seq} (${broken.why === "seq" ? "out of order or missing" : "its hash does not follow from the one before"})`, next: "an entry was changed or removed: restore the ledger from a backup" };
    }
  },
  {
    id: "ARCA-D005",
    title: "invariants in the database",
    async run(c) {
      if (!c.config.invariants)
        return { status: "pass", detail: "not expected (invariants: false); the operations runtime enforces them" };
      const want = expectedTriggers(c);
      if (want.length === 0)
        return { status: "pass", detail: "these models declare no invariants" };
      const have = await rows(c, `SELECT t.tgname AS n, r.relname AS t, t.tgenabled AS e FROM pg_trigger t JOIN pg_class r ON r.oid = t.tgrelid JOIN pg_namespace s ON s.oid = r.relnamespace WHERE s.nspname = ${lit(c.config.schema)} AND NOT t.tgisinternal`);
      const by = new Map(have.map((r) => [`${String(r["t"])}/${String(r["n"])}`, String(r["e"])]));
      const missing = want.filter((w) => !by.has(`${w.table}/${w.name}`)).map((w) => `${w.name} on ${w.table}`);
      const off = want.filter((w) => by.has(`${w.table}/${w.name}`) && by.get(`${w.table}/${w.name}`) !== "O").map((w) => `${w.name} on ${w.table}`);
      if (missing.length + off.length === 0)
        return { status: "pass", detail: `all ${want.length} triggers of the invariants are there and enabled` };
      return {
        status: "fail",
        detail: `${missing.length > 0 ? `missing: ${names(missing)}. ` : ""}${off.length > 0 ? `disabled: ${names(off)}.` : ""} The database no longer refuses what governance says must never happen.`,
        next: off.length > 0 && missing.length === 0 ? "ALTER TABLE … ENABLE TRIGGER … for each, then find out who disabled it" : "apply the invariants again (arcactl init); find out who dropped them"
      };
    }
  },
  {
    id: "ARCA-D006",
    title: "guard against weakening the invariants",
    async run(c) {
      if (!c.config.invariants || expectedTriggers(c).length === 0)
        return { status: "pass", detail: "there are no invariants to guard" };
      if (!c.config.guard)
        return { status: "pass", detail: "not expected (guard: false): the owner of a table can drop the triggers of its invariants" };
      const have = await rows(c, `SELECT evtname AS n, evtenabled AS e FROM pg_event_trigger WHERE evtname LIKE 'inv\\_guard\\_%'`);
      const by = new Map(have.map((r) => [String(r["n"]), String(r["e"])]));
      const want = ["inv_guard_drop", "inv_guard_end", "inv_guard_start"];
      const missing = want.filter((n) => !by.has(n));
      const off = want.filter((n) => by.has(n) && by.get(n) !== "O");
      return missing.length + off.length === 0 ? { status: "pass", detail: "the event triggers that refuse to drop, disable, rename or replace an invariant are there and enabled" } : { status: "fail", detail: `${missing.length > 0 ? `missing: ${missing.join(", ")}. ` : ""}${off.length > 0 ? `disabled: ${off.join(", ")}.` : ""} The owner of a table can weaken its invariants.`, next: "install the guard as a superuser (arcactl init), or say guard: false if it is not wanted" };
    }
  },
  {
    id: "ARCA-D007",
    title: "row security and the seal",
    async run(c) {
      const scoped = c.schema.tables.filter((t) => t.columns.some((col) => carriedOf(col, exports_security.scope).length > 0));
      const sealed = (await rows(c, `SELECT 1 AS x FROM pg_namespace WHERE nspname = 'ifc_seal'`)).length > 0;
      if (scoped.length === 0 && !sealed && !c.config.seal)
        return { status: "pass", detail: "these models have no scoped tables: row security is not in play" };
      const problems = [];
      for (const t of scoped) {
        const name = t.name.join("_");
        const r = (await rows(c, `SELECT c.relrowsecurity AS on_, c.relforcerowsecurity AS forced FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = ${lit(c.config.schema)} AND c.relname = ${lit(name)}`))[0];
        if (r === undefined)
          continue;
        if (r["on_"] !== true)
          problems.push(`row security is off on ${name}`);
        else if (r["forced"] !== true && sealed)
          problems.push(`row security is not forced on ${name}: its owner sees every row`);
      }
      if (c.config.seal && !sealed)
        problems.push("the scope is meant to be sealed and there is no seal (schema ifc_seal)");
      if (sealed) {
        const open = await rows(c, `SELECT 'table ' || c.relname AS x FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'ifc_seal' AND c.relkind = 'r' AND c.relacl IS NOT NULL AND EXISTS (SELECT 1 FROM aclexplode(c.relacl) a WHERE a.grantee = 0) UNION ALL SELECT 'function ' || p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'ifc_seal' AND p.proname = 'mac' AND (p.proacl IS NULL OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0))`);
        for (const r of open)
          problems.push(`every role can use the seal's ${String(r["x"])}: a session could read the key or make a mark`);
        const guards = await rows(c, `SELECT evtname AS n FROM pg_event_trigger WHERE evtname LIKE 'ifc\\_seal\\_guard\\_%' AND evtenabled = 'O'`);
        if (guards.length < 2)
          problems.push("the guard of the seal (event triggers) is missing or disabled");
      } else if (scoped.length > 0) {
        problems.push(`the scope of ${names(scoped.map((t) => t.name.join("_")))} is not sealed: a session can set it to another tenant's itself`);
      }
      if (problems.length === 0)
        return { status: "pass", detail: `${scoped.length} scoped table${scoped.length === 1 ? "" : "s"}: row security on, the seal in place, its key and its mark function closed to application roles` };
      const hard = problems.some((p) => !p.includes("is not sealed") || c.config.seal);
      return { status: hard ? "fail" : "warn", detail: problems.join("; "), next: sealed ? "apply the access source again with its seal (accessSource({ seal }))" : "seal the scope: accessSource({ seal: { key } }) and set seal: true" };
    }
  },
  {
    id: "ARCA-D008",
    title: "audit chain",
    async run(c) {
      const there = (await rows(c, `SELECT 1 AS x FROM information_schema.tables WHERE table_schema = ${lit(c.config.schema)} AND table_name = 'audit_event'`)).length > 0;
      if (!there)
        return { status: "pass", detail: "these models have no audit trail" };
      const check = operation("doctorAuditChain", { definition: "Verifies the audit chain", kind: "query", input: {}, reads: ["auditEvent"], public: true, runsAs: "service", idempotent: true });
      const impl = async (tx) => {
        const r = await verifyAuditChain(tx);
        return { status: "checked", length: r.length, problems: r.problems.map((p) => `${p.kind} at ${p.at}`) };
      };
      const rt = operations2(c.schema, dialect, c.driver, [check], { doctorAuditChain: impl }, { schema: c.config.schema });
      if (rt.kind === "err")
        return { status: "unknown", detail: `the chain could not be read: ${JSON.stringify(rt.error).slice(0, 200)}` };
      const out = await rt.value.run("doctorAuditChain", {});
      if (out.kind === "err")
        return { status: "unknown", detail: `the chain could not be read: ${redact(JSON.stringify(out.error).slice(0, 200), c.secrets)}` };
      const problems = out.value["problems"];
      return problems.length === 0 ? { status: "pass", detail: `${String(out.value["length"])} events, in sequence, each naming the hash of the one before and holding the hash of its own fields` } : { status: "fail", detail: `the audit trail was changed: ${names(problems)}`, next: "treat it as an incident: compare with a backup and find who had write access" };
    }
  },
  {
    id: "ARCA-D009",
    title: "what the database enforces",
    async run(c) {
      const all = placed(c.schema.tables, dialect);
      if (all.length === 0)
        return { status: "pass", detail: "these models declare no invariants" };
      const db = all.filter((p) => p.by === "database").length;
      return { status: "pass", detail: `PostgreSQL can enforce all of the ${all.length} invariants of these models in the database (${db} by triggers); the application's runtime enforces ${all.length - db}` };
    }
  }
];
var checkIds = checks.map((c) => c.id);
async function doctor(driver, config, schema, options = {}) {
  const context = { driver, config, schema, secrets: options.secrets ?? [] };
  const results = [];
  for (const check of checks) {
    if (options.only !== undefined && !options.only.includes(check.id))
      continue;
    try {
      results.push({ id: check.id, title: check.title, ...await check.run(context) });
    } catch (thrown) {
      const why = redact(thrown instanceof Error ? thrown.message : String(thrown), context.secrets);
      results.push({ id: check.id, title: check.title, status: "unknown", detail: `could not check: ${why}`, next: /permission denied|must be (owner|superuser)/i.test(why) ? "run it as a role that may read the catalogs" : undefined });
    }
  }
  const summary = { pass: 0, warn: 0, fail: 0, unknown: 0 };
  for (const r of results)
    summary[r.status]++;
  return { results, summary, code: summary.warn + summary.fail + summary.unknown === 0 ? 0 : 1 };
}
var MARK = { pass: "PASS", warn: "WARN", fail: "FAIL", unknown: "?   " };
function renderReport(r) {
  const lines = r.results.flatMap((x) => [`${MARK[x.status]}  ${x.id}  ${x.title}`, `      ${x.detail}`, ...x.next === undefined ? [] : [`      next: ${x.next}`]]);
  const s = r.summary;
  return [...lines, "", `${s.pass} passed, ${s.warn} warned, ${s.fail} failed, ${s.unknown} could not be checked`].join(`
`);
}

// sql/cli/server.ts
init_mod();
import { readFileSync } from "node:fs";
var CI = ["CI", "GITHUB_ACTIONS", "GITLAB_CI", "BUILDKITE", "JENKINS_URL", "TF_BUILD", "CIRCLECI", "TEAMCITY_VERSION", "CODEBUILD_BUILD_ID"];
var truthy = (v) => v !== undefined && v !== "" && v !== "0" && v.toLowerCase() !== "false";
function modeOf(argv, env, tty) {
  if (argv.includes("--non-interactive"))
    return { mode: "server", why: "--non-interactive" };
  if (argv.includes("--interactive"))
    return { mode: "workstation", why: "--interactive" };
  const said = env["ARCA_MODE"]?.toLowerCase();
  if (said === "server" || said === "workstation")
    return { mode: said, why: `ARCA_MODE=${said}` };
  const ci = CI.find((n) => truthy(env[n]));
  if (ci !== undefined)
    return { mode: "server", why: `${ci} is set` };
  return tty ? { mode: "workstation", why: "a terminal" } : { mode: "server", why: "no terminal" };
}
function secretOf(env, name, read = (p) => readFileSync(p, "utf8")) {
  const direct = env[name];
  const file = env[`${name}_FILE`];
  const has = direct !== undefined && direct !== "";
  if (has && file !== undefined && file !== "")
    return err(`${name} and ${name}_FILE are both set: give one`);
  if (has)
    return ok(direct);
  if (file === undefined || file === "")
    return ok(undefined);
  try {
    const text = read(file);
    return ok(text.replace(/\r?\n$/, ""));
  } catch (thrown) {
    return err(`${name}_FILE names ${file}, which cannot be read: ${thrown instanceof Error ? thrown.message.replace(/^.*?: /, "") : String(thrown)}`);
  }
}

// sql/cli/shell.ts
init_mod();

// sql/cli/workstation.ts
init_mod();
import { posix, win32 } from "node:path";
var shells = ["bash", "zsh", "fish", "pwsh", "nu", "sh"];
var set = (v) => v === undefined || v === "" ? undefined : v;
function pathsOf(host) {
  const e = host.env;
  const win = host.platform === "win32";
  const p = win ? win32 : posix;
  const home = win ? set(e["USERPROFILE"]) ?? (set(e["HOMEDRIVE"]) !== undefined && set(e["HOMEPATH"]) !== undefined ? `${e["HOMEDRIVE"]}${e["HOMEPATH"]}` : undefined) : set(e["HOME"]);
  if (home === undefined)
    return err(win ? "the home directory is not known: USERPROFILE is not set" : "the home directory is not known: HOME is not set");
  const appdata = set(e["APPDATA"]) ?? p.join(home, "AppData", "Roaming");
  const local = set(e["LOCALAPPDATA"]) ?? p.join(home, "AppData", "Local");
  const xdgConfig = set(e["XDG_CONFIG_HOME"]) ?? p.join(home, ".config");
  const config = win ? p.join(appdata, "arcactl") : p.join(xdgConfig, "arcactl");
  const cache = win ? p.join(local, "arcactl", "cache") : p.join(set(e["XDG_CACHE_HOME"]) ?? p.join(home, ".cache"), "arcactl");
  const state = win ? p.join(local, "arcactl", "state") : p.join(set(e["XDG_STATE_HOME"]) ?? p.join(home, ".local", "state"), "arcactl");
  const pgdir = p.join(appdata, "postgresql");
  const profiles = {
    bash: host.platform === "darwin" ? { files: [p.join(home, ".bash_profile"), p.join(home, ".bashrc")], policy: "first-existing" } : { files: [p.join(home, ".bashrc")], policy: "all" },
    zsh: { files: [p.join(set(e["ZDOTDIR"]) ?? home, ".zshrc")], policy: "all" },
    fish: { files: [p.join(xdgConfig, "fish", "conf.d", "arcactl.fish")], policy: "all" },
    pwsh: win ? { files: [p.join(home, "Documents", "PowerShell", "Microsoft.PowerShell_profile.ps1"), p.join(home, "Documents", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1")], policy: "all" } : { files: [p.join(xdgConfig, "powershell", "Microsoft.PowerShell_profile.ps1")], policy: "all" },
    nu: { files: [win ? p.join(appdata, "nushell", "config.nu") : p.join(xdgConfig, "nushell", "config.nu")], policy: "all" },
    sh: { files: [p.join(home, ".profile")], policy: "all" }
  };
  const pwshOverride = set(e["ARCACTL_PWSH_PROFILE"]);
  if (pwshOverride !== undefined)
    profiles.pwsh = { files: [pwshOverride], policy: "all" };
  return ok({
    platform: host.platform,
    home,
    config,
    cache,
    state,
    pgpass: set(e["PGPASSFILE"]) ?? (win ? p.join(pgdir, "pgpass.conf") : p.join(home, ".pgpass")),
    pgServiceFile: set(e["PGSERVICEFILE"]) ?? (win ? p.join(pgdir, ".pg_service.conf") : p.join(home, ".pg_service.conf")),
    psqlrc: set(e["PSQLRC"]) ?? (win ? p.join(pgdir, "psqlrc.conf") : p.join(home, ".psqlrc")),
    arcaPsqlrc: p.join(config, "psqlrc"),
    instances: p.join(config, "instances.json"),
    profiles
  });
}
function profileTargets(profile, exists) {
  if (profile.policy === "all")
    return profile.files;
  const first = profile.files.find(exists) ?? profile.files[0];
  return first === undefined ? [] : [first];
}
function shellOf(name) {
  if (name === undefined)
    return;
  const base = (name.split(/[\\/]/).pop() ?? "").toLowerCase().replace(/\.exe$/, "");
  if (base === "powershell")
    return "pwsh";
  if (base === "nushell")
    return "nu";
  return shells.includes(base) ? base : base === "dash" || base === "ash" ? "sh" : undefined;
}

// sql/cli/shell.ts
var commands = [
  {
    name: "doctor",
    help: "check the database against the models",
    flags: [
      { name: "--config", help: "arca.config.ts" },
      { name: "--models", help: "the models wanted", values: modelNames },
      { name: "--schema", help: "the schema" },
      { name: "--check", help: "only these checks", values: checkIds },
      { name: "--json", help: "machine-readable output", switch: true },
      { name: "--url", help: "connection URL" },
      { name: "--non-interactive", help: "run as a server", switch: true }
    ]
  },
  {
    name: "shell",
    help: "print the script that sets up this shell",
    flags: [
      { name: "--shell", help: "the shell", values: shells },
      { name: "--instance", help: "the instance" },
      { name: "--env", help: "dev, staging or prod", values: ["dev", "staging", "prod"] },
      { name: "--schema", help: "the schema" },
      { name: "--service", help: "the libpq service" },
      { name: "--models", help: "the models", values: modelNames },
      { name: "--config", help: "arca.config.ts" },
      { name: "--prompt", help: "add arca-prompt", switch: true },
      { name: "--env-json", help: "the variables as JSON", switch: true }
    ]
  }
];
function variablesOf(i) {
  const out = [];
  const add = (k, v) => void (v === undefined || v === "" ? undefined : out.push([k, v]));
  add("ARCA_INSTANCE", i.instance);
  add("ARCA_ENV", i.env);
  add("ARCA_SCHEMA", i.schema);
  add("ARCA_MODELS", i.models?.join(","));
  add("ARCA_CONFIG", i.config);
  add("ARCA_HOME", i.home);
  add("ARCA_SERVICE", i.service);
  add("ARCA_DATABASE_URL", i.url);
  return out;
}
var pgoptionsOf = (i) => `-c search_path=${i.schema},public`;
function checkInput2(i) {
  const out = [];
  if (!shells.includes(i.shell))
    out.push(`${i.shell} is not a shell this script is made for (${shells.join(", ")})`);
  if (i.instance !== undefined && !/^[a-z0-9][a-z0-9._-]{0,62}$/.test(i.instance))
    out.push(`the instance name ${JSON.stringify(i.instance)} is not lower-case letters, digits, dots, dashes and underscores`);
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(i.schema))
    out.push(`the schema name ${JSON.stringify(i.schema)} is not a lower-case name`);
  if (i.service !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/.test(i.service))
    out.push(`the service name ${JSON.stringify(i.service)} is not letters, digits, dots, dashes and underscores`);
  if (i.url !== undefined && passwordOf(i.url) !== undefined)
    out.push("the URL has a password: a shell script never holds one; keep it in .pgpass and name a service");
  if (i.env !== undefined && !/^[a-z][a-z0-9-]{0,30}$/.test(i.env))
    out.push(`the environment ${JSON.stringify(i.env)} is not a lower-case word`);
  return out;
}
var quotePosix = (v) => `'${v.replaceAll("'", `'\\''`)}'`;
var quoteFish = (v) => `'${v.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
var quotePwsh = (v) => `'${v.replaceAll("'", "''")}'`;
var quoteNu = (v) => `"${v.replaceAll("\\", "\\\\").replaceAll('"', "\\\"").replaceAll(`
`, "\\n").replaceAll("\r", "\\r").replaceAll("\t", "\\t")}"`;
var FN = ["arca", "arca-doctor", "arca-psql", "arca-use", "arca-off"];
var FN_PROMPT = "arca-prompt";
var MANAGED = ["ARCA_INSTANCE", "ARCA_ENV", "ARCA_SCHEMA", "ARCA_MODELS", "ARCA_CONFIG", "ARCA_HOME", "ARCA_SERVICE", "ARCA_DATABASE_URL", "ARCA_PGOPTIONS"];
var header = (shell) => `# arcactl shell for ${shell}: source this; arca-off takes it away`;
var wordsOf = (xs) => xs.join(" ");
function posix2(i, vars) {
  const q = quotePosix;
  const sh = i.shell === "sh";
  const name = (n) => sh ? n.replaceAll("-", "_") : n;
  const set = new Set(vars.map(([k]) => k));
  const pgo = pgoptionsOf(i);
  const lines = [header(i.shell)];
  for (const k of MANAGED)
    if (k !== "ARCA_PGOPTIONS" && !set.has(k))
      lines.push(`unset ${k}`);
  if (!set.has("ARCA_SERVICE"))
    lines.push(`if [ -n "\${ARCA_SERVICE-}" ] && [ "\${PGSERVICE-}" = "\${ARCA_SERVICE-}" ]; then unset PGSERVICE; fi`);
  for (const [k, v] of vars)
    lines.push(`export ${k}=${q(v)}`);
  if (set.has("ARCA_SERVICE"))
    lines.push(`export PGSERVICE=${q(i.service ?? "")}`);
  lines.push(`if [ -z "\${PGOPTIONS-}" ] || [ "\${PGOPTIONS-}" = "\${ARCA_PGOPTIONS-}" ]; then export PGOPTIONS=${q(pgo)}; fi`);
  lines.push(`export ARCA_PGOPTIONS=${q(pgo)}`);
  lines.push(`${name("arca")}() { arcactl "$@"; }`, `${name("arca-doctor")}() { arcactl doctor "$@"; }`, `${name("arca-psql")}() { psql "$@"; }`, `${name("arca-use")}() { if [ -z "\${1-}" ]; then echo "usage: ${name("arca-use")} <instance>" >&2; return 2; fi; eval "$(arcactl shell --shell ${i.shell} --instance "$1")"; }`);
  if (i.prompt === true)
    lines.push(`${name(FN_PROMPT)}() { printf '%s' "[\${ARCA_INSTANCE-}\${ARCA_ENV:+:\${ARCA_ENV}}]"; }`);
  const gone = [...FN, ...i.prompt === true ? [FN_PROMPT] : []].map(name);
  lines.push(`${name("arca-off")}() { if [ "\${PGOPTIONS-}" = "\${ARCA_PGOPTIONS-}" ]; then unset PGOPTIONS; fi; if [ -n "\${ARCA_SERVICE-}" ] && [ "\${PGSERVICE-}" = "\${ARCA_SERVICE-}" ]; then unset PGSERVICE; fi; unset ${wordsOf(MANAGED)}; unset -f ${wordsOf(gone)} 2>/dev/null; return 0; }`);
  const cmds = commands.map((c) => c.name);
  if (i.shell === "bash") {
    lines.push(`_arcactl() { local cur="\${COMP_WORDS[COMP_CWORD]}" prev="\${COMP_WORDS[COMP_CWORD-1]}" cmd="\${COMP_WORDS[1]}"; COMPREPLY=();`, `  if [ "$COMP_CWORD" -eq 1 ]; then COMPREPLY=($(compgen -W "${wordsOf(cmds)}" -- "$cur")); return; fi;`, `  case "$cmd $prev" in`, ...commands.flatMap((c) => c.flags.filter((f) => f.values !== undefined).map((f) => `    "${c.name} ${f.name}") COMPREPLY=($(compgen -W "${wordsOf(f.values ?? [])}" -- "$cur")); return;;`)), `  esac`, `  case "$cmd" in`, ...commands.map((c) => `    ${c.name}) COMPREPLY=($(compgen -W "${wordsOf(c.flags.map((f) => f.name))}" -- "$cur"));;`), `  esac; }`, `complete -F _arcactl arcactl arca`);
  } else if (i.shell === "zsh") {
    lines.push(`_arcactl() { local -a cmds; local state; cmds=(${commands.map((c) => q(`${c.name}:${c.help}`)).join(" ")});`, `  if (( CURRENT == 2 )); then _describe 'command' cmds; return; fi;`, `  case "\${words[2]} \${words[CURRENT-1]}" in`, ...commands.flatMap((c) => c.flags.filter((f) => f.values !== undefined).map((f) => `    "${c.name} ${f.name}") compadd -- ${wordsOf(f.values ?? [])};;`)), `    *) case "\${words[2]}" in`, ...commands.map((c) => `      ${c.name}) compadd -- ${wordsOf(c.flags.map((f) => f.name))};;`), `    esac;;`, `  esac; }`, `if (( $+functions[compdef] )); then compdef _arcactl arcactl arca; fi`);
  }
  return `${lines.join(`
`)}
`;
}
function fish(i, vars) {
  const q = quoteFish;
  const set = new Set(vars.map(([k]) => k));
  const pgo = pgoptionsOf(i);
  const lines = [header("fish")];
  for (const k of MANAGED)
    if (k !== "ARCA_PGOPTIONS" && !set.has(k))
      lines.push(`set -e ${k}`);
  if (!set.has("ARCA_SERVICE"))
    lines.push(`if set -q ARCA_SERVICE; and test "$PGSERVICE" = "$ARCA_SERVICE"; set -e PGSERVICE; end`);
  for (const [k, v] of vars)
    lines.push(`set -gx ${k} ${q(v)}`);
  if (set.has("ARCA_SERVICE"))
    lines.push(`set -gx PGSERVICE ${q(i.service ?? "")}`);
  lines.push(`if not set -q PGOPTIONS; or test -z "$PGOPTIONS"; or test "$PGOPTIONS" = "$ARCA_PGOPTIONS"; set -gx PGOPTIONS ${q(pgo)}; end`);
  lines.push(`set -gx ARCA_PGOPTIONS ${q(pgo)}`);
  lines.push(`function arca; arcactl $argv; end`, `function arca-doctor; arcactl doctor $argv; end`, `function arca-psql; psql $argv; end`, `function arca-use; if test (count $argv) -lt 1; echo "usage: arca-use <instance>" >&2; return 2; end; arcactl shell --shell fish --instance $argv[1] | source; end`);
  if (i.prompt === true)
    lines.push(`function ${FN_PROMPT}; printf '%s' "[$ARCA_INSTANCE"(test -n "$ARCA_ENV"; and echo ":$ARCA_ENV")"]"; end`);
  const gone = [...FN, ...i.prompt === true ? [FN_PROMPT] : []];
  lines.push(`function arca-off; if test "$PGOPTIONS" = "$ARCA_PGOPTIONS"; set -e PGOPTIONS; end; if set -q ARCA_SERVICE; and test "$PGSERVICE" = "$ARCA_SERVICE"; set -e PGSERVICE; end; set -e ${wordsOf(MANAGED)}; functions -e ${wordsOf(gone)}; end`);
  lines.push(`complete -c arcactl -e`, `complete -c arca -e`);
  for (const bin of ["arcactl", "arca"]) {
    for (const c of commands)
      lines.push(`complete -c ${bin} -f -n __fish_use_subcommand -a ${c.name} -d ${q(c.help)}`);
    for (const c of commands)
      for (const f of c.flags)
        lines.push(`complete -c ${bin} -f -n '__fish_seen_subcommand_from ${c.name}' -l ${f.name.slice(2)} -d ${q(f.help)}${f.values === undefined ? "" : ` -xa ${q(wordsOf(f.values))}`}`);
  }
  return `${lines.join(`
`)}
`;
}
function pwsh(i, vars) {
  const q = quotePwsh;
  const set = new Set(vars.map(([k]) => k));
  const pgo = pgoptionsOf(i);
  const lines = [header("pwsh")];
  for (const k of MANAGED)
    if (k !== "ARCA_PGOPTIONS" && !set.has(k))
      lines.push(`Remove-Item Env:${k} -ErrorAction SilentlyContinue`);
  if (!set.has("ARCA_SERVICE"))
    lines.push(`if ($env:ARCA_SERVICE -and $env:PGSERVICE -eq $env:ARCA_SERVICE) { Remove-Item Env:PGSERVICE -ErrorAction SilentlyContinue }`);
  for (const [k, v] of vars)
    lines.push(`$env:${k} = ${q(v)}`);
  if (set.has("ARCA_SERVICE"))
    lines.push(`$env:PGSERVICE = ${q(i.service ?? "")}`);
  lines.push(`if (-not $env:PGOPTIONS -or $env:PGOPTIONS -eq $env:ARCA_PGOPTIONS) { $env:PGOPTIONS = ${q(pgo)} }`);
  lines.push(`$env:ARCA_PGOPTIONS = ${q(pgo)}`);
  lines.push(`function global:arca { arcactl @args }`, `function global:arca-doctor { arcactl doctor @args }`, `function global:arca-psql { psql @args }`, `function global:arca-use { param([Parameter(Mandatory = $true)][string]$Name) arcactl shell --shell pwsh --instance $Name | Out-String | Invoke-Expression }`);
  if (i.prompt === true)
    lines.push(`function global:${FN_PROMPT} { "[$env:ARCA_INSTANCE" + $(if ($env:ARCA_ENV) { ":$env:ARCA_ENV" }) + "]" }`);
  const gone = [...FN, ...i.prompt === true ? [FN_PROMPT] : []];
  lines.push(`function global:arca-off { if ($env:PGOPTIONS -eq $env:ARCA_PGOPTIONS) { Remove-Item Env:PGOPTIONS -ErrorAction SilentlyContinue }; if ($env:ARCA_SERVICE -and $env:PGSERVICE -eq $env:ARCA_SERVICE) { Remove-Item Env:PGSERVICE -ErrorAction SilentlyContinue }; ${MANAGED.map((k) => `Remove-Item Env:${k} -ErrorAction SilentlyContinue`).join("; ")}; ${gone.map((f) => `Remove-Item Function:\\${f} -ErrorAction SilentlyContinue`).join("; ")} }`);
  const completions = commands.map((c) => `    '${c.name}' { ${c.flags.map((f) => q(f.name)).join(", ")} }`).join(`
`);
  lines.push(`Register-ArgumentCompleter -Native -CommandName arcactl, arca -ScriptBlock {`, `  param($wordToComplete, $commandAst, $cursorPosition)`, `  $parts = $commandAst.CommandElements | ForEach-Object { $_.ToString() }`, `  $options = if ($parts.Count -le 1 -or ($parts.Count -eq 2 -and $wordToComplete)) { ${commands.map((c) => q(c.name)).join(", ")} } else { switch ($parts[1]) {`, completions, `  } }`, `  $options | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }`, `}`);
  return `${lines.join(`
`)}
`;
}
function nu(i, vars) {
  const q = quoteNu;
  const set = new Set(vars.map(([k]) => k));
  const pgo = pgoptionsOf(i);
  const lines = [header("nu")];
  for (const k of MANAGED)
    if (k !== "ARCA_PGOPTIONS" && !set.has(k))
      lines.push(`hide-env -i ${k}`);
  if (!set.has("ARCA_SERVICE"))
    lines.push(`if (($env.ARCA_SERVICE? | default "") != "") and ($env.PGSERVICE? == $env.ARCA_SERVICE?) { hide-env -i PGSERVICE }`);
  for (const [k, v] of vars)
    lines.push(`$env.${k} = ${q(v)}`);
  if (set.has("ARCA_SERVICE"))
    lines.push(`$env.PGSERVICE = ${q(i.service ?? "")}`);
  lines.push(`if (($env.PGOPTIONS? | default "") == "") or ($env.PGOPTIONS? == $env.ARCA_PGOPTIONS?) { $env.PGOPTIONS = ${q(pgo)} }`);
  lines.push(`$env.ARCA_PGOPTIONS = ${q(pgo)}`);
  lines.push(`def --wrapped arca [...rest: string] { ^arcactl ...$rest }`, `def --wrapped arca-doctor [...rest: string] { ^arcactl doctor ...$rest }`, `def --wrapped arca-psql [...rest: string] { ^psql ...$rest }`, `def --env arca-use [name: string] { let vars = (^arcactl shell --shell nu --env-json --instance $name | from json); load-env $vars; if (($env.PGOPTIONS? | default "") == "") { $env.PGOPTIONS = $env.ARCA_PGOPTIONS } }`);
  if (i.prompt === true)
    lines.push(`def ${FN_PROMPT} [] { $"[($env.ARCA_INSTANCE? | default '')(if (($env.ARCA_ENV? | default '') != '') { ':' + $env.ARCA_ENV } else { '' })]" }`);
  lines.push(`def --env arca-off [] { if ($env.PGOPTIONS? == $env.ARCA_PGOPTIONS?) { hide-env -i PGOPTIONS }; if (($env.ARCA_SERVICE? | default "") != "") and ($env.PGSERVICE? == $env.ARCA_SERVICE?) { hide-env -i PGSERVICE }; ${MANAGED.map((k) => `hide-env -i ${k}`).join("; ")} }`);
  for (const c of commands)
    lines.push(`extern "arcactl ${c.name}" [ ${c.flags.map((f) => `${f.name}${f.switch === true ? "" : ": string"}`).join(" ")} ]`);
  return `${lines.join(`
`)}
`;
}
function shellScript(input) {
  const bad = checkInput2(input);
  if (bad.length > 0)
    return err(bad);
  const vars = variablesOf(input);
  switch (input.shell) {
    case "bash":
    case "zsh":
    case "sh":
      return ok(posix2(input, vars));
    case "fish":
      return ok(fish(input, vars));
    case "pwsh":
      return ok(pwsh(input, vars));
    case "nu":
      return ok(nu(input, vars));
  }
}
function envJson(input) {
  const bad = checkInput2(input);
  if (bad.length > 0)
    return err(bad);
  const all = Object.fromEntries([...variablesOf(input), ...input.service === undefined ? [] : [["PGSERVICE", input.service]], ["ARCA_PGOPTIONS", pgoptionsOf(input)]]);
  return ok(JSON.stringify(all));
}

// sql/cli/init.ts
import { existsSync as existsSync6 } from "node:fs";

// sql/cli/discover.ts
import { existsSync as existsSync3, readdirSync, readFileSync as readFileSync4, statSync as statSync3 } from "node:fs";
import { join as join2 } from "node:path";

// sql/cli/libpq.ts
init_mod();
import { chmodSync as chmodSync2, existsSync as existsSync2, readFileSync as readFileSync3, statSync as statSync2 } from "node:fs";

// sql/cli/blocks.ts
init_mod();
var NAME2 = /^[a-z][a-z0-9-]*$/;
var markers = (name, style) => ({
  open: `${style} >>> arcactl:${name} >>>`,
  close: `${style} <<< arcactl:${name} <<<`
});
var eolOf = (text) => text.includes(`\r
`) ? `\r
` : `
`;
function find(text, name, style) {
  if (!NAME2.test(name))
    return err({ kind: "name", name });
  const m = markers(name, style);
  const lines = [];
  let at = 0;
  while (at <= text.length) {
    const nl = text.indexOf(`
`, at);
    const stop = nl === -1 ? text.length : nl;
    lines.push({ at, line: text.slice(at, stop).replace(/\r$/, ""), next: nl === -1 ? text.length : nl + 1 });
    if (nl === -1)
      break;
    at = nl + 1;
  }
  const opens = lines.filter((l) => l.line.trimEnd() === m.open);
  const closes = lines.filter((l) => l.line.trimEnd() === m.close);
  if (opens.length === 0 && closes.length === 0)
    return ok(undefined);
  if (opens.length > 1 || closes.length > 1)
    return err({ kind: "duplicate", name });
  const open = opens[0];
  const close = closes[0];
  if (open === undefined)
    return err({ kind: "unbalanced", name, why: "there is a closing marker and no opening one" });
  if (close === undefined)
    return err({ kind: "unbalanced", name, why: "there is an opening marker and no closing one" });
  if (close.at < open.at)
    return err({ kind: "unbalanced", name, why: "the closing marker is before the opening one" });
  return ok({ start: open.at, end: close.next, body: text.slice(open.next, close.at) });
}
function blockOf(text, name, style) {
  const f = find(text, name, style);
  return f.kind === "err" ? f : ok(f.value === undefined ? undefined : f.value.body.replace(/\r?\n$/, ""));
}
function withBlock(text, name, style, body) {
  const f = find(text, name, style);
  if (f.kind === "err")
    return f;
  const eol = eolOf(text);
  const m = markers(name, style);
  const inside = body === "" ? "" : `${body.replace(/\r?\n/g, eol)}${eol}`;
  const block = `${m.open}${eol}${inside}${m.close}${eol}`;
  if (f.value !== undefined)
    return ok(text.slice(0, f.value.start) + block + text.slice(f.value.end));
  if (text === "")
    return ok(block);
  return ok(`${text}${text.endsWith(`
`) ? "" : eol}${eol}${block}`);
}
function withoutBlock(text, name, style) {
  const f = find(text, name, style);
  if (f.kind === "err")
    return f;
  if (f.value === undefined)
    return ok(text);
  const eol = eolOf(text);
  let before = text.slice(0, f.value.start);
  const after = text.slice(f.value.end);
  if (before.endsWith(`${eol}${eol}`))
    before = before.slice(0, -eol.length);
  return ok(before + after);
}

// sql/cli/files.ts
init_mod();
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync as readFileSync2, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
function planBlock(path, name, style, want, mode = 420) {
  let target = path;
  let through = false;
  let before;
  try {
    if (existsSync(path) || lstatSync(path, { throwIfNoEntry: false }) !== undefined) {
      if (lstatSync(path).isSymbolicLink()) {
        target = realpathSync(path);
        through = true;
      }
      if (statSync(target).isDirectory())
        return err({ kind: "unreadable", path, why: "it is a directory" });
      before = readFileSync2(target, "utf8");
    }
  } catch (thrown) {
    return err({ kind: "unreadable", path, why: thrown instanceof Error ? thrown.message : String(thrown) });
  }
  const text = before ?? "";
  const next = want === "absent" ? withoutBlock(text, name, style) : withBlock(text, name, style, want.body);
  if (next.kind === "err")
    return err({ kind: "block", path, error: next.error });
  const action = before === undefined ? want === "absent" || next.value === "" ? "unchanged" : "create" : next.value === before ? "unchanged" : "update";
  return ok({ path, target, through, action, before, after: next.value, mode });
}
function planWhole(path, text, mode = 420) {
  let target = path;
  let through = false;
  let before;
  try {
    if (lstatSync(path, { throwIfNoEntry: false }) !== undefined) {
      if (lstatSync(path).isSymbolicLink()) {
        target = realpathSync(path);
        through = true;
      }
      if (statSync(target).isDirectory())
        return err({ kind: "unreadable", path, why: "it is a directory" });
      before = readFileSync2(target, "utf8");
    }
  } catch (thrown) {
    return err({ kind: "unreadable", path, why: thrown instanceof Error ? thrown.message : String(thrown) });
  }
  return ok({ path, target, through, action: before === undefined ? "create" : before === text ? "unchanged" : "update", before, after: text, mode });
}
function planRemoveFile(path) {
  try {
    const st = lstatSync(path, { throwIfNoEntry: false });
    if (st === undefined)
      return ok({ path, target: path, through: false, action: "unchanged", before: undefined, after: "", mode: 420 });
    if (st.isDirectory())
      return err({ kind: "unreadable", path, why: "it is a directory" });
    return ok({ path, target: path, through: false, action: "remove", before: st.isSymbolicLink() ? "" : readFileSync2(path, "utf8"), after: "", mode: st.mode & 4095 });
  } catch (thrown) {
    return err({ kind: "unreadable", path, why: thrown instanceof Error ? thrown.message : String(thrown) });
  }
}
function diffOf(before, after) {
  const a = before === undefined || before === "" ? [] : before.split(/\r?\n/);
  const b = after === "" ? [] : after.split(/\r?\n/);
  if (a.at(-1) === "")
    a.pop();
  if (b.at(-1) === "")
    b.pop();
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1;i >= 0; i--)
    for (let j = m - 1;j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      out.push(`  ${a[i]}`);
      i++;
      j++;
    } else if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j]))
      out.push(`+ ${b[j++]}`);
    else
      out.push(`- ${a[i++]}`);
  }
  const keep = out.map((l, k) => l[0] !== " " || out[k - 1]?.[0] !== " " && out[k - 1] !== undefined || out[k + 1]?.[0] !== " " && out[k + 1] !== undefined);
  return out.filter((_, k) => keep[k]).join(`
`);
}
function applyChange2(change) {
  if (change.action === "unchanged")
    return { path: change.path, action: "unchanged" };
  if (change.action === "remove") {
    unlinkSync(change.path);
    return { path: change.path, action: "remove" };
  }
  mkdirSync(dirname(change.target), { recursive: true });
  let backup;
  let mode = change.mode;
  if (change.before !== undefined) {
    mode = statSync(change.target).mode & 4095;
    const copy = `${change.target}.arcactl-bak`;
    if (!existsSync(copy)) {
      writeFileSync(copy, change.before, { mode });
      backup = copy;
    }
  }
  const temp = join(dirname(change.target), `.${basename(change.target)}.arcactl-${process.pid}-${Date.now()}`);
  try {
    writeFileSync(temp, change.after, { mode });
    chmodSync(temp, mode);
    renameSync(temp, change.target);
  } catch (thrown) {
    try {
      unlinkSync(temp);
    } catch {}
    throw thrown;
  }
  return { path: change.path, action: change.action, ...backup === undefined ? {} : { backup } };
}
var pgpassModeOk = (mode) => (mode & 63) === 0;

// sql/cli/libpq.ts
var SSLMODES = ["disable", "allow", "prefer", "require", "verify-ca", "verify-full"];
var NO_LINE = /[\r\n\0]/;
var bad = (what, why) => ({ kind: "invalid", what, why });
function checkInstance(i) {
  const out = [];
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/.test(i.name))
    out.push(bad("name", `${JSON.stringify(i.name)} is not letters, digits, dots, dashes and underscores`));
  for (const [k, v] of [["host", i.host], ["database", i.database], ["user", i.user]])
    if (v !== undefined && (v === "" || NO_LINE.test(v) || v !== v.trim()))
      out.push(bad(k, `${JSON.stringify(v)} is empty, has a line ending or surrounding space`));
  if (i.port !== undefined && !(Number.isInteger(i.port) && i.port >= 1 && i.port <= 65535))
    out.push(bad("port", `${String(i.port)} is not a port`));
  if (i.sslmode !== undefined && !SSLMODES.includes(i.sslmode))
    out.push(bad("sslmode", `${i.sslmode} is not one of ${SSLMODES.join(", ")}`));
  if (i.schema !== undefined && !/^[a-z][a-z0-9_]{0,62}$/.test(i.schema))
    out.push(bad("schema", `${JSON.stringify(i.schema)} is not a lower-case name`));
  return out;
}
function checkCredential(c) {
  const out = [];
  for (const k of ["host", "port", "database", "user"])
    if (c[k] === "" || NO_LINE.test(c[k]))
      out.push(bad(k, "it is empty or has a line ending"));
  if (c.port !== "*" && !/^\d{1,5}$/.test(c.port))
    out.push(bad("port", `${JSON.stringify(c.port)} is not a port or *`));
  if (c.password === "" || NO_LINE.test(c.password))
    out.push(bad("password", "it is empty or has a line ending, which `.pgpass` cannot hold"));
  return out;
}
var field = (v) => v === "*" ? "*" : v.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
var pgpassLine = (c) => [c.host, c.port, c.database, c.user, c.password].map((v, i) => i === 4 ? v.replaceAll("\\", "\\\\").replaceAll(":", "\\:") : field(v)).join(":");
function splitPgpass(line) {
  const parts = [];
  let cur = "";
  for (let i = 0;i < line.length; i++) {
    const ch = line[i];
    if (ch === "\\" && i + 1 < line.length)
      cur += line[++i];
    else if (ch === ":") {
      parts.push(cur);
      cur = "";
    } else
      cur += ch;
  }
  parts.push(cur);
  return parts.length === 5 ? parts : undefined;
}
function parsePgpass(text) {
  const credentials = [];
  const other = [];
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === "" || raw.startsWith("#"))
      continue;
    const f = splitPgpass(raw);
    if (f === undefined)
      other.push(raw);
    else
      credentials.push({ host: f[0], port: f[1], database: f[2], user: f[3], password: f[4] });
  }
  return { credentials, other };
}
var sameKey = (a, b) => a.host === b.host && a.port === b.port && a.database === b.database && a.user === b.user;
var matches2 = (c, place) => ["host", "port", "database", "user"].every((k) => c[k] === "*" || c[k] === place[k]);
var readText = (path) => {
  try {
    return existsSync2(path) ? readFileSync3(path, "utf8") : undefined;
  } catch {
    return;
  }
};
var lines = (text) => text.split(/\r?\n/);
function outside(text, name, style) {
  const open = `${style} >>> arcactl:${name} >>>`;
  const close = `${style} <<< arcactl:${name} <<<`;
  const out = [];
  let inside = false;
  for (const l of lines(text)) {
    if (l.trimEnd() === open)
      inside = true;
    else if (l.trimEnd() === close)
      inside = false;
    else if (!inside)
      out.push(l);
  }
  return out.join(`
`);
}
function planPgpass(paths, change) {
  const errors = (change.set ?? []).flatMap((c) => checkCredential(c));
  if (errors.length > 0)
    return err(errors);
  const text = readText(paths.pgpass) ?? "";
  const inside = blockOf(text, "credentials", "#");
  if (inside.kind === "err")
    return err([{ kind: "block", path: paths.pgpass, error: inside.error }]);
  const mine = parsePgpass(inside.value ?? "");
  if (mine.other.length > 0)
    return err([bad("credentials block", `it has a line that is not a credential: ${mine.other[0]?.replace(/:[^:]*$/, ":***")}`)]);
  const wanted = change.set ?? [];
  const kept = mine.credentials.filter((c) => !(change.remove ?? []).some((k) => sameKey(c, k))).map((c) => wanted.find((w) => sameKey(w, c)) ?? c);
  const creds = [...kept, ...wanted.filter((w) => !kept.some((c) => sameKey(c, w)))];
  const planned = planBlock(paths.pgpass, "credentials", "#", creds.length === 0 ? "absent" : { body: creds.map(pgpassLine).join(`
`) }, 384);
  if (planned.kind === "err")
    return err([planned.error]);
  const warnings = [];
  const theirs = parsePgpass(outside(text, "credentials", "#")).credentials;
  for (const c of change.set ?? []) {
    const first = theirs.find((t) => matches2(t, c));
    if (first !== undefined)
      warnings.push(`a line of your own in ${paths.pgpass} for ${first.host}:${first.port}:${first.database}:${first.user} comes before the one arcactl wrote, and libpq reads the first that matches`);
  }
  const modes = [];
  if (paths.platform !== "win32" && existsSync2(planned.value.target)) {
    const mode = statSync2(planned.value.target).mode & 511;
    if (!pgpassModeOk(mode))
      modes.push({ path: planned.value.target, from: mode, to: 384 });
  }
  return ok({ changes: [planned.value], warnings, modes });
}
function serviceSection(i) {
  const kv = [];
  if (i.host !== undefined)
    kv.push(["host", i.host]);
  if (i.port !== undefined)
    kv.push(["port", String(i.port)]);
  if (i.database !== undefined)
    kv.push(["dbname", i.database]);
  if (i.user !== undefined)
    kv.push(["user", i.user]);
  if (i.sslmode !== undefined)
    kv.push(["sslmode", i.sslmode]);
  if (i.schema !== undefined)
    kv.push(["options", `-c search_path=${i.schema},public`]);
  return [`[${i.name}]`, ...kv.map(([k, v]) => `${k}=${v}`)].join(`
`);
}
function parseServices(text) {
  const out = [];
  for (const raw of lines(text)) {
    const l = raw.trim();
    if (l === "" || l.startsWith("#") || l.startsWith(";"))
      continue;
    const m = /^\[(.+)\]$/.exec(l);
    if (m !== null)
      out.push({ name: m[1], settings: {} });
    else {
      const eq = l.indexOf("=");
      if (eq > 0 && out.length > 0)
        out[out.length - 1].settings[l.slice(0, eq).trim()] = l.slice(eq + 1).trim();
    }
  }
  return out;
}
function readInstances(paths) {
  const text = readText(paths.pgServiceFile) ?? "";
  const body = blockOf(text, "services", "#");
  if (body.kind === "err")
    return err([{ kind: "block", path: paths.pgServiceFile, error: body.error }]);
  return ok(parseServices(body.value ?? "").map((s) => {
    const schema = /search_path=([a-z][a-z0-9_]*),public/.exec(s.settings["options"] ?? "")?.[1];
    return {
      name: s.name,
      ...s.settings["host"] === undefined ? {} : { host: s.settings["host"] },
      ...s.settings["port"] === undefined ? {} : { port: Number(s.settings["port"]) },
      ...s.settings["dbname"] === undefined ? {} : { database: s.settings["dbname"] },
      ...s.settings["user"] === undefined ? {} : { user: s.settings["user"] },
      ...s.settings["sslmode"] === undefined ? {} : { sslmode: s.settings["sslmode"] },
      ...schema === undefined ? {} : { schema }
    };
  }));
}
function planServices(paths, instances) {
  const errors = instances.flatMap((i) => checkInstance(i));
  const dup = instances.find((x, n) => instances.findIndex((y) => y.name === x.name) !== n);
  if (dup !== undefined)
    errors.push(bad("name", `${dup.name} is there twice`));
  const text = readText(paths.pgServiceFile) ?? "";
  const theirs = new Set(parseServices(outside(text, "services", "#")).map((s) => s.name));
  for (const i of instances)
    if (theirs.has(i.name))
      errors.push({ kind: "conflict", service: i.name, why: `${i.name} is already a service in ${paths.pgServiceFile}, outside the block arcactl owns: rename one of them` });
  if (errors.length > 0)
    return err(errors);
  const planned = planBlock(paths.pgServiceFile, "services", "#", instances.length === 0 ? "absent" : { body: instances.map(serviceSection).join(`

`) });
  return planned.kind === "err" ? err([planned.error]) : ok({ changes: [planned.value], warnings: [], modes: [] });
}
var psqlrcBody = () => [
  "-- psql for arca instances: the prompt names the instance, and a few queries are one word away (:tables :invariants :guard :audit)",
  "\\set QUIET 1",
  "\\getenv arca_instance ARCA_INSTANCE",
  "\\getenv arca_env ARCA_ENV",
  "\\set PROMPT1 '%[%033[1m%]%:arca_instance:%[%033[0m%] %/%R%# '",
  "\\set PROMPT2 '%R> '",
  "\\x auto",
  "\\pset null '(null)'",
  "\\pset linestyle unicode",
  "\\pset border 1",
  "\\set HISTFILE ~/.psql_history- :DBNAME",
  "\\set HISTCONTROL ignoredups",
  "\\set COMP_KEYWORD_CASE upper",
  "\\set tables 'SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY 1;'",
  `\\set invariants 'SELECT c.relname AS "table", t.tgname AS trigger, t.tgenabled AS enabled FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relnamespace = current_schema()::regnamespace AND t.tgname LIKE ''inv\\\\_%'' ORDER BY 1, 2;'`,
  "\\set guard 'SELECT evtname, evtenabled FROM pg_event_trigger WHERE evtname LIKE ''inv\\\\_guard\\\\_%'' OR evtname LIKE ''ifc\\\\_seal\\\\_guard\\\\_%'' ORDER BY 1;'",
  "\\set audit 'SELECT sequence, occurred_at, actor_kind, action, outcome FROM audit_event ORDER BY sequence DESC LIMIT 20;'",
  "\\unset QUIET"
].join(`
`);
var psqlPath = (p) => p.replaceAll("\\", "/");
function planPsql(paths) {
  const own = planBlock(paths.arcaPsqlrc, "psql", "--", { body: psqlrcBody() });
  if (own.kind === "err")
    return err([own.error]);
  const include = planBlock(paths.psqlrc, "psql", "--", { body: `\\i ${psqlPath(paths.arcaPsqlrc)}` });
  if (include.kind === "err")
    return err([include.error]);
  return ok({ changes: [own.value, include.value], warnings: [], modes: [] });
}
function planUndo(paths) {
  const changes = [];
  const errors = [];
  for (const [path, name, style] of [
    [paths.pgpass, "credentials", "#"],
    [paths.pgServiceFile, "services", "#"],
    [paths.psqlrc, "psql", "--"],
    [paths.arcaPsqlrc, "psql", "--"]
  ]) {
    const c = planBlock(path, name, style, "absent");
    if (c.kind === "err")
      errors.push(c.error);
    else
      changes.push(c.value);
  }
  return errors.length > 0 ? err(errors) : ok({ changes, warnings: [], modes: [] });
}
function fixModes(plan) {
  const done = [];
  for (const m of plan.modes) {
    chmodSync2(m.path, m.to);
    done.push(`${m.path}: ${m.from.toString(8)} to ${m.to.toString(8)}`);
  }
  return done;
}

// sql/cli/discover.ts
var read = (p) => {
  try {
    return existsSync3(p) ? readFileSync4(p, "utf8") : "";
  } catch {
    return "";
  }
};
var concrete = (host) => host !== undefined && host !== "" && host !== "*";
var portOf = (v) => v !== undefined && /^\d{1,5}$/.test(v) ? Number(v) : undefined;
var keyOf = (c) => `${c.host ?? ""}|${c.port ?? 5432}|${c.database ?? ""}`;
var derived = (c) => `${(c.host ?? "local").replace(/[^A-Za-z0-9._-]/g, "-")}${c.port === undefined || c.port === 5432 ? "" : `-${c.port}`}`;
function workspaceConfigs(root, depth = 4) {
  const out = [];
  const walk = (dir, d) => {
    let entries;
    try {
      entries = readdirSync(dir).toSorted();
    } catch {
      return;
    }
    for (const name of entries) {
      if (name === "node_modules" || name === ".git" || name === ".worktrees" || name === "dist")
        continue;
      const full = join2(dir, name);
      if (name === "arca.config.ts")
        out.push(full);
      else if (d > 0) {
        try {
          if (statSync3(full).isDirectory())
            walk(full, d - 1);
        } catch {}
      }
    }
  };
  if (existsSync3(root))
    walk(root, depth);
  return out;
}
function discover(i) {
  const found = [];
  const add = (c) => void found.push(c);
  if (i.url !== undefined) {
    try {
      const u = new URL(i.url);
      add({ name: i.env["ARCA_INSTANCE"] ?? "given", sources: ["the connection URL"], host: u.hostname, ...u.port === "" ? {} : { port: Number(u.port) }, ...u.pathname.length > 1 ? { database: decodeURIComponent(u.pathname.slice(1)) } : {}, ...u.username === "" ? {} : { user: decodeURIComponent(u.username) }, ...u.searchParams.get("sslmode") === null ? {} : { sslmode: u.searchParams.get("sslmode") } });
    } catch {}
  }
  const e = i.env;
  if (concrete(e["PGHOST"]))
    add({ name: e["PGSERVICE"] ?? "libpq-env", sources: ["libpq's environment"], host: e["PGHOST"], ...portOf(e["PGPORT"]) === undefined ? {} : { port: portOf(e["PGPORT"]) }, ...e["PGDATABASE"] === undefined ? {} : { database: e["PGDATABASE"] }, ...e["PGUSER"] === undefined ? {} : { user: e["PGUSER"] }, ...e["PGSSLMODE"] === undefined ? {} : { sslmode: e["PGSSLMODE"] } });
  const own = new Set(i.state.instances.filter((k) => k.ownsService === true).map((k) => k.name));
  for (const s of parseServices(read(i.paths.pgServiceFile))) {
    const host = s.settings["host"];
    if (!concrete(host))
      continue;
    add({ name: s.name, sources: [own.has(s.name) ? "pg_service.conf (arcactl's)" : "pg_service.conf"], host, ...portOf(s.settings["port"]) === undefined ? {} : { port: portOf(s.settings["port"]) }, ...s.settings["dbname"] === undefined ? {} : { database: s.settings["dbname"] }, ...s.settings["user"] === undefined ? {} : { user: s.settings["user"] }, ...s.settings["sslmode"] === undefined ? {} : { sslmode: s.settings["sslmode"] }, ...own.has(s.name) ? {} : { userService: true } });
  }
  for (const c of parsePgpass(read(i.paths.pgpass)).credentials) {
    if (!concrete(c.host))
      continue;
    add({ name: "", sources: [".pgpass"], host: c.host, ...portOf(c.port) === undefined ? {} : { port: portOf(c.port) }, ...c.database === "*" ? {} : { database: c.database }, ...c.user === "*" ? {} : { user: c.user } });
  }
  for (const k of i.state.instances)
    if (concrete(k.host))
      add({ name: k.name, sources: ["arcactl"], host: k.host, ...k.port === undefined ? {} : { port: k.port }, ...k.database === undefined ? {} : { database: k.database }, ...k.user === undefined ? {} : { user: k.user }, ...k.sslmode === undefined ? {} : { sslmode: k.sslmode } });
  if (i.local === true)
    add({ name: "local", sources: ["this machine"], host: "127.0.0.1", port: 5432 });
  const merged = new Map;
  for (const c of found) {
    const k = keyOf(c);
    const had = merged.get(k);
    if (had === undefined) {
      merged.set(k, c);
      continue;
    }
    const pick = (f) => {
      const v = had[f] ?? c[f];
      return v === undefined ? {} : { [f]: v };
    };
    merged.set(k, {
      name: had.name !== "" && !(c.name !== "" && (c.sources[0] ?? "").startsWith("pg_service")) ? had.name : c.name !== "" ? c.name : had.name,
      sources: [...new Set([...had.sources, ...c.sources])],
      ...pick("host"),
      ...pick("port"),
      ...pick("database"),
      ...pick("user"),
      ...pick("sslmode"),
      ...had.userService === true || c.userService === true ? { userService: true } : {}
    });
  }
  const named = [...merged.values()].map((c) => c.name === "" ? { ...c, name: derived(c) } : c);
  const seen = new Map;
  const unique = named.map((c) => {
    const n = seen.get(c.name) ?? 0;
    seen.set(c.name, n + 1);
    return n === 0 ? c : { ...c, name: `${c.name}-${derived(c)}` };
  });
  return { candidates: unique, configs: i.workspace === undefined ? [] : workspaceConfigs(i.workspace) };
}
function passwordFor(paths, c) {
  const want = { host: c.host ?? "", port: String(c.port ?? 5432), database: c.database ?? "postgres", user: c.user ?? "" };
  const hit = parsePgpass(read(paths.pgpass)).credentials.find((p) => ["host", "port", "database", "user"].every((k) => p[k] === "*" || p[k] === want[k]));
  return hit?.password;
}
function urlOf(c, password) {
  const auth = c.user === undefined ? "" : `${encodeURIComponent(c.user)}${password === undefined ? "" : `:${encodeURIComponent(password)}`}@`;
  const q = c.sslmode === undefined ? "" : `?sslmode=${encodeURIComponent(c.sslmode)}`;
  return `postgres://${auth}${c.host ?? "127.0.0.1"}:${c.port ?? 5432}/${encodeURIComponent(c.database ?? "postgres")}${q}`;
}
var modelTables = new Map;
function tablesOfModel(m) {
  const had = modelTables.get(m);
  if (had !== undefined)
    return had;
  const c = settingsOf({ models: [m] });
  const s = c.kind === "ok" ? schemaOf(c.value) : undefined;
  const set = new Set(s?.kind === "ok" ? s.value.schema.tables.map((t) => t.name.join("_")) : []);
  modelTables.set(m, set);
  return set;
}
async function probe(connect, c, password, schema = "arca") {
  const none = (error) => ({ reachable: false, error, level: "none", arca: { schema, exists: false, tables: 0, models: [] } });
  let conn;
  try {
    conn = await connect({ url: urlOf(c, password), connectTimeout: 3 });
  } catch (thrown) {
    return none(redact(thrown instanceof Error ? thrown.message : String(thrown), password === undefined ? [] : [password]));
  }
  try {
    const q = (sql) => conn.driver.query(sql);
    const lit = (s) => `'${s.replaceAll("'", "''")}'`;
    const me = (await q(`SELECT version() AS v, current_user AS u, coalesce((SELECT rolsuper FROM pg_roles WHERE rolname = current_user), false) AS su, has_database_privilege(current_database(), 'CREATE') AS cdb`))[0];
    const tables = (await q(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ${lit(schema)}`)).map((r) => String(r["t"]));
    const exists = (await q(`SELECT 1 AS x FROM information_schema.schemata WHERE schema_name = ${lit(schema)}`)).length > 0;
    const there = new Set(tables);
    const models = modelNames.filter((m) => {
      const want = tablesOfModel(m);
      return want.size > 0 && [...want].every((t) => there.has(t));
    });
    const create = exists ? (await q(`SELECT has_schema_privilege(current_user, ${lit(schema)}, 'CREATE') AS ok`))[0]?.["ok"] === true : me?.["cdb"] === true;
    const superuser = me?.["su"] === true;
    return {
      reachable: true,
      version: String(me?.["v"]).split(" on ")[0],
      user: String(me?.["u"]),
      superuser,
      level: superuser ? "migrate+guard" : create ? "migrate" : "read",
      arca: { schema, exists, tables: tables.length, models }
    };
  } catch (thrown) {
    return none(redact(thrown instanceof Error ? thrown.message : String(thrown), password === undefined ? [] : [password]));
  } finally {
    await conn.close().catch(() => {
      return;
    });
  }
}

// sql/cli/profile.ts
import { join as join3 } from "node:path";
var cacheOf = (paths, shell) => join3(paths.cache, `shell.${shell === "pwsh" ? "ps1" : shell}`);
function inputOf(shell, paths, known) {
  return {
    shell,
    schema: known?.schema ?? "arca",
    home: paths.config,
    ...known === undefined ? {} : { instance: known.name, service: known.name },
    ...known?.env === undefined ? {} : { env: known.env },
    ...known?.models === undefined ? {} : { models: known.models }
  };
}
function scriptFor(shell, paths, known) {
  const r = shellScript(inputOf(shell, paths, known));
  if (r.kind === "err")
    throw new Error(r.error.join("; "));
  return r.value;
}
function profileBody(shell, cache) {
  switch (shell) {
    case "bash":
    case "zsh":
    case "sh":
      return `[ -r ${quotePosix(cache)} ] && . ${quotePosix(cache)}`;
    case "fish":
      return `test -r ${quoteFish(cache)}; and source ${quoteFish(cache)}`;
    case "pwsh":
      return `if (Test-Path ${quotePwsh(cache)}) { . ${quotePwsh(cache)} }`;
    case "nu":
      return `source ${quoteNu(cache.replaceAll("\\", "/"))}`;
  }
}

// sql/cli/prompt.ts
var silent = { interactive: false, ask: async () => {
  return;
}, secret: async () => {
  return;
}, confirm: async () => false };

// sql/cli/state.ts
init_mod();
import { existsSync as existsSync4, readFileSync as readFileSync5 } from "node:fs";
var emptyState2 = { version: 1, instances: [], profiles: [] };
var str2 = (v) => typeof v === "string" && v !== "" ? v : undefined;
function readState2(paths) {
  if (!existsSync4(paths.instances))
    return ok(emptyState2);
  let raw;
  try {
    raw = JSON.parse(readFileSync5(paths.instances, "utf8"));
  } catch (thrown) {
    return err(`${paths.instances} is not JSON: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
  }
  if (typeof raw !== "object" || raw === null || raw.version !== 1)
    return err(`${paths.instances} is not a state file of version 1`);
  const o = raw;
  const instances = [];
  for (const i of Array.isArray(o.instances) ? o.instances : []) {
    const x = i;
    const name = str2(x["name"]);
    if (name === undefined)
      return err(`${paths.instances}: an instance has no name`);
    instances.push({
      name,
      ...str2(x["env"]) === undefined ? {} : { env: str2(x["env"]) },
      ...str2(x["schema"]) === undefined ? {} : { schema: str2(x["schema"]) },
      ...Array.isArray(x["models"]) ? { models: x["models"].filter((m) => typeof m === "string") } : {},
      ...str2(x["host"]) === undefined ? {} : { host: str2(x["host"]) },
      ...typeof x["port"] === "number" ? { port: x["port"] } : {},
      ...str2(x["database"]) === undefined ? {} : { database: str2(x["database"]) },
      ...str2(x["user"]) === undefined ? {} : { user: str2(x["user"]) },
      ...str2(x["sslmode"]) === undefined ? {} : { sslmode: str2(x["sslmode"]) },
      ...x["ownsService"] === true ? { ownsService: true } : {}
    });
  }
  const profiles = [];
  for (const p of Array.isArray(o.profiles) ? o.profiles : []) {
    const x = p;
    const shell = str2(x["shell"]);
    if (shell === undefined || !shells.includes(shell) || !Array.isArray(x["files"]) || str2(x["cache"]) === undefined)
      return err(`${paths.instances}: a profile is not one`);
    profiles.push({ shell, files: x["files"].filter((f) => typeof f === "string"), cache: str2(x["cache"]) });
  }
  return ok({ version: 1, ...str2(o.default) === undefined ? {} : { default: str2(o.default) }, instances, profiles });
}
var stateText = (s) => `${JSON.stringify({ version: 1, ...s.default === undefined ? {} : { default: s.default }, instances: [...s.instances].sort((a, b) => a.name.localeCompare(b.name)), profiles: [...s.profiles].sort((a, b) => a.shell.localeCompare(b.shell)) }, null, 2)}
`;
var planState = (paths, s) => planWhole(paths.instances, stateText(s));
function withInstance(s, k, makeDefault) {
  const rest = s.instances.filter((i) => i.name !== k.name);
  return { ...s, instances: [...rest, k], ...makeDefault || s.default === undefined ? { default: k.name } : {} };
}

// sql/cli/workstation-checks.ts
import { spawnSync } from "node:child_process";
import { existsSync as existsSync5, readFileSync as readFileSync6, statSync as statSync4 } from "node:fs";
var readOr = (p) => {
  try {
    return existsSync5(p) ? readFileSync6(p, "utf8") : "";
  } catch {
    return "";
  }
};
function realPsqlVersion() {
  const r = spawnSync("psql", ["--version"], { encoding: "utf8", timeout: 5000 });
  return r.status === 0 ? r.stdout.trim() : undefined;
}
var defaultOf2 = (s) => s.instances.find((i) => i.name === s.default);
var checks2 = [
  {
    id: "ARCA-W001",
    title: "psql",
    async run(w) {
      const text = (w.psqlVersion ?? realPsqlVersion)();
      if (text === undefined)
        return { status: "fail", detail: "psql is not on the PATH", next: "install the PostgreSQL client (postgresql-client, or libpq's psql)" };
      const major = Number(/(\d+)(?:\.\d+)*\s*(?:\(|$|\n)/.exec(text.replace(/^psql \(PostgreSQL\)\s*/, ""))?.[1] ?? "0");
      return major >= 15 ? { status: "pass", detail: text } : { status: "warn", detail: `${text}: the helper file of arcactl needs psql 15 or later (\\getenv)`, next: "install psql 15 or later" };
    }
  },
  {
    id: "ARCA-W002",
    title: "passwords (.pgpass)",
    async run(w, known) {
      const text = readOr(w.paths.pgpass);
      if (blockOf(text, "credentials", "#").kind === "err")
        return { status: "fail", detail: `the arcactl block of ${w.paths.pgpass} is broken (a marker is missing or twice)`, next: "repair or remove the block, then run arcactl init" };
      const mine = blockOf(text, "credentials", "#");
      const body = mine.kind === "ok" ? mine.value : undefined;
      if (body === undefined)
        return { status: "pass", detail: "arcactl stores no password: libpq will use its own sources (trust, peer, a service, your own .pgpass lines)" };
      if (w.paths.platform !== "win32" && existsSync5(w.paths.pgpass) && !pgpassModeOk(statSync4(w.paths.pgpass).mode))
        return { status: "fail", detail: `${w.paths.pgpass} can be read by the group or others: libpq ignores it`, next: "run arcactl init, or chmod 600 the file" };
      const creds = parsePgpass(body).credentials;
      if (known?.host !== undefined && !creds.some((c) => c.host === known.host))
        return { status: "warn", detail: `arcactl has no password for ${known.host} (the default instance ${known.name})`, next: "run arcactl init --instance with the password, if it needs one" };
      return { status: "pass", detail: `${creds.length} credential${creds.length === 1 ? "" : "s"} of arcactl's, in a file libpq will use` };
    }
  },
  {
    id: "ARCA-W003",
    title: "the service of the default instance",
    async run(w, known) {
      if (known === undefined)
        return { status: "warn", detail: "there is no default instance", next: "run arcactl init --instance <name> --host <host> ..." };
      const has = parseServices(readOr(w.paths.pgServiceFile)).some((s) => s.name === known.name);
      return has ? { status: "pass", detail: `${known.name} is a service in ${w.paths.pgServiceFile}` } : { status: "fail", detail: `${known.name} is not a service in ${w.paths.pgServiceFile}`, next: "run arcactl init to write it" };
    }
  },
  {
    id: "ARCA-W004",
    title: "psql settings",
    async run(w) {
      const inc = blockOf(readOr(w.paths.psqlrc), "psql", "--");
      const own = blockOf(readOr(w.paths.arcaPsqlrc), "psql", "--");
      if (inc.kind === "err" || own.kind === "err")
        return { status: "fail", detail: "a block of the psqlrc files is broken", next: "repair or remove it, then run arcactl init" };
      if (inc.value === undefined)
        return { status: "warn", detail: `${w.paths.psqlrc} does not include arcactl's settings`, next: "run arcactl init" };
      if (own.value !== psqlrcBody())
        return { status: "fail", detail: `${w.paths.arcaPsqlrc} is not as this arcactl writes it`, next: "run arcactl init" };
      return { status: "pass", detail: "psql includes arcactl's prompt, settings and helper queries" };
    }
  },
  {
    id: "ARCA-W005",
    title: "shell profiles",
    async run(w, known) {
      if (w.state.profiles.length === 0)
        return { status: "warn", detail: "arcactl has not put its script into any shell profile", next: "run arcactl init --shell auto" };
      const problems = [];
      for (const p of w.state.profiles) {
        const cache = cacheOf(w.paths, p.shell);
        for (const f of p.files) {
          const b = blockOf(readOr(f), "shell", "#");
          if (b.kind === "err" || b.value === undefined)
            problems.push(`${f} has no arcactl block`);
          else if (b.value !== profileBody(p.shell, cache))
            problems.push(`${f}: the block is not as this arcactl writes it`);
        }
        if (!existsSync5(cache))
          problems.push(`${cache} is missing`);
        else if (readFileSync6(cache, "utf8") !== scriptFor(p.shell, w.paths, known))
          problems.push(`${cache} is not the script for ${known?.name ?? "no instance"} as it is made now`);
      }
      return problems.length === 0 ? { status: "pass", detail: `${w.state.profiles.map((p) => p.shell).join(", ")}: the profile sources a current script` } : { status: "fail", detail: problems.join("; "), next: "run arcactl init to write them again" };
    }
  },
  {
    id: "ARCA-W006",
    title: "the default instance can be reached",
    async run(w, known) {
      if (known?.host === undefined)
        return { status: "unknown", detail: "there is no default instance with a host to reach" };
      if (w.connect === undefined)
        return { status: "unknown", detail: "no connection was made" };
      const c = { name: known.name, sources: [], host: known.host, ...known.port === undefined ? {} : { port: known.port }, ...known.database === undefined ? {} : { database: known.database }, ...known.user === undefined ? {} : { user: known.user }, ...known.sslmode === undefined ? {} : { sslmode: known.sslmode } };
      const p = await probe(w.connect, c, passwordFor(w.paths, c), known.schema);
      return p.reachable ? { status: "pass", detail: `${known.name}: ${p.version} as ${p.user}` } : { status: "fail", detail: `${known.name} is not reached: ${p.error}`, next: "check the host, the port, the password in .pgpass and the network" };
    }
  }
];
var workstationIds = checks2.map((c) => c.id);
async function workstationChecks(w, only) {
  const known = defaultOf2(w.state);
  const results = [];
  for (const c of checks2) {
    if (only !== undefined && !only.includes(c.id))
      continue;
    try {
      results.push({ id: c.id, title: c.title, ...await c.run(w, known) });
    } catch (thrown) {
      results.push({ id: c.id, title: c.title, status: "unknown", detail: `could not check: ${thrown instanceof Error ? thrown.message : String(thrown)}` });
    }
  }
  const summary = { pass: 0, warn: 0, fail: 0, unknown: 0 };
  for (const r of results)
    summary[r.status]++;
  return { results, summary, code: summary.warn + summary.fail + summary.unknown === 0 ? 0 : 1 };
}

// sql/cli/init.ts
var SWITCHES = new Set(["--discover", "--local", "--no-psql", "--dry-run", "--yes", "-y", "--undo", "--password-stdin", "--json", "--interactive", "--non-interactive"]);
function parse(argv) {
  const values = new Map;
  const switches = new Set;
  const unknown = [];
  const takes = new Set(["--instance", "--host", "--port", "--database", "--user", "--sslmode", "--env", "--schema", "--models", "--shell", "--url"]);
  for (let i = 0;i < argv.length; i++) {
    const a = argv[i];
    if (SWITCHES.has(a))
      switches.add(a === "-y" ? "--yes" : a);
    else if (takes.has(a) && argv[i + 1] !== undefined)
      values.set(a, argv[++i]);
    else
      unknown.push(a);
  }
  return { values, switches, unknown };
}
var maskPgpass = (text) => text.split(`
`).map((l) => /^[^#].*:.*:.*:.*:/.test(l) ? l.replace(/:[^:]*$/, ":***") : l).join(`
`);
function describe2(c, paths) {
  if (c.action === "unchanged")
    return `  unchanged  ${c.path}`;
  const mask = c.path === paths.pgpass ? maskPgpass : (t) => t;
  const body = c.action === "remove" ? "" : diffOf(c.before === undefined ? undefined : mask(c.before), mask(c.after)).split(`
`).map((l) => `      ${l}`).join(`
`);
  return `  ${c.action.padEnd(9)}  ${c.path}${c.through ? ` (through the link to ${c.target})` : ""}${body === "" ? "" : `
${body}`}`;
}
var errorText = (e) => {
  switch (e.kind) {
    case "invalid":
      return `${e.what}: ${e.why}`;
    case "conflict":
      return e.why;
    case "block":
      return `${e.path}: the markers of the arcactl block do not make sense (${e.error.kind}); it was not changed`;
    case "unreadable":
      return `${e.path}: ${e.why}`;
  }
};
function shellsWanted(spec, io) {
  if (spec === "none")
    return [];
  if (spec === "all")
    return [...shells];
  if (spec === undefined || spec === "auto") {
    const s = shellOf(io.env["SHELL"]) ?? (io.platform === "win32" ? "pwsh" : undefined);
    return s === undefined ? [] : [s];
  }
  const out = [];
  for (const n of spec.split(",").map((x) => x.trim())) {
    const s = shellOf(n);
    if (s === undefined)
      return `${n} is not a shell (${shells.join(", ")}, all, auto, none)`;
    if (!out.includes(s))
      out.push(s);
  }
  return out;
}
function table(rows) {
  if (rows.length === 0)
    return "no instances were found";
  const head = ["instance", "from", "host:port", "status", "as", "could", "arca"];
  const body = rows.map(({ c, p }) => [
    c.name,
    c.sources.join(", "),
    `${c.host ?? "?"}:${c.port ?? 5432}`,
    p === undefined ? "not looked at" : p.reachable ? p.version ?? "reached" : `not reached: ${(p.error ?? "").slice(0, 60)}`,
    p?.user ?? "",
    p === undefined || !p.reachable ? "" : p.level,
    p === undefined || !p.reachable ? "" : p.arca.models.length > 0 ? p.arca.models.join(", ") : p.arca.exists ? `${p.arca.schema} (${p.arca.tables} tables)` : "none"
  ]);
  const w = head.map((h, i) => Math.max(h.length, ...body.map((r) => r[i].length)));
  return [head, ...body].map((r) => r.map((cell, i) => cell.padEnd(w[i])).join("  ").trimEnd()).join(`
`);
}
async function runInit(argv, io) {
  const a = parse(argv);
  const fail = (m) => ({ code: 2, out: "", err: `${m}
` });
  if (a.unknown.length > 0)
    return fail(`init has no option ${a.unknown[0]}`);
  const mode = modeOf(argv, io.env, io.tty);
  if (mode.mode === "server")
    return fail(`init sets up a person's workstation and writes files in a home directory: this run is a server (${mode.why}). In a pipeline, give the environment instead (ARCA_DATABASE_URL, ARCA_DATABASE_URL_FILE); to run init anyway, say --interactive`);
  const paths = pathsOf({ platform: io.platform, env: io.env });
  if (paths.kind === "err")
    return fail(paths.error);
  const P = paths.value;
  const read = readState2(P);
  if (read.kind === "err")
    return fail(read.error);
  let state = read.value;
  const prompt = io.prompt ?? silent;
  const connect2 = io.connect ?? connect;
  const json = a.switches.has("--json");
  const log = [];
  const say = (s = "") => void log.push(s);
  const apply = async (changes, modes, what) => {
    say(`${what}:`);
    for (const c of changes)
      say(describe2(c, P));
    if (changes.every((c) => c.action === "unchanged") && modes.length === 0) {
      say("  nothing to change");
      return true;
    }
    if (a.switches.has("--dry-run")) {
      say("  (dry run: nothing was written)");
      return true;
    }
    if (!a.switches.has("--yes")) {
      if (!prompt.interactive) {
        say("  nothing was written: run it again with --yes to make these changes");
        return false;
      }
      if (!await prompt.confirm("Make these changes?")) {
        say("  nothing was written");
        return false;
      }
    }
    for (const c of changes)
      applyChange2(c);
    fixModes({ changes, warnings: [], modes });
    for (const m of modes)
      say(`  mode of ${m.path} put right`);
    for (const c of changes)
      if (c.action !== "unchanged")
        say(`  done      ${c.path}`);
    return true;
  };
  const finish = (code, extra = {}) => ({ code, out: json ? `${JSON.stringify({ mode: mode.mode, log, ...extra }, null, 2)}
` : `${log.join(`
`)}
`, err: "" });
  if (a.switches.has("--undo")) {
    const plan = planUndo(P);
    if (plan.kind === "err")
      return fail(plan.error.map(errorText).join(`
`));
    const changes = [...plan.value.changes];
    const errors = [];
    for (const sh of shells)
      for (const f of P.profiles[sh].files) {
        const c = planBlock(f, "shell", "#", "absent");
        if (c.kind === "err")
          errors.push(c.error);
        else
          changes.push(c.value);
      }
    for (const sh of shells) {
      const c = planRemoveFile(cacheOf(P, sh));
      if (c.kind === "err")
        errors.push(c.error);
      else
        changes.push(c.value);
    }
    const st = planRemoveFile(P.instances);
    if (st.kind === "ok")
      changes.push(st.value);
    if (errors.length > 0)
      return fail(errors.map(errorText).join(`
`));
    const ok = await apply(changes, [], "Taking away what arcactl init put in");
    return finish(ok ? 0 : 1);
  }
  const urlGiven = a.values.get("--url") ?? (() => {
    const r = secretOf(io.env, "ARCA_DATABASE_URL");
    return r.kind === "ok" ? r.value : undefined;
  })();
  const found = discover({ paths: P, env: io.env, ...urlGiven === undefined ? {} : { url: urlGiven }, ...a.switches.has("--local") ? { local: true } : {}, state, ...io.env["ERGONEX_HOME"] === undefined ? {} : { workspace: io.env["ERGONEX_HOME"] } });
  let candidates = [...found.candidates];
  const wanted = a.values.get("--instance") ?? (candidates.length === 1 && !a.switches.has("--discover") ? undefined : undefined);
  const looking = a.switches.has("--discover") || wanted === undefined;
  const rows = [];
  for (const c of candidates)
    rows.push({ c, p: looking ? await probe(connect2, c, passwordFor(P, c), a.values.get("--schema") ?? "arca") : undefined });
  if (looking) {
    say("Instances you can reach:");
    say(table(rows));
    if (found.configs.length > 0)
      say(`
In your Ergonex workspace: ${found.configs.join(", ")}`);
    say();
  }
  let name = wanted ?? (prompt.interactive && rows.length > 0 ? await prompt.ask("Which instance is your default? (a name from the list, or a new one)", state.default ?? candidates[0]?.name) : undefined);
  name = name ?? state.default;
  let known;
  let password;
  let writeService = false;
  if (name !== undefined) {
    const have = candidates.find((c) => c.name === name);
    const host = a.values.get("--host") ?? have?.host ?? (prompt.interactive ? await prompt.ask(`Host of ${name}?`) : undefined);
    if (host === undefined)
      return fail(`${name} is not a place arcactl knows, and no --host was given`);
    const portText = a.values.get("--port") ?? (have?.port === undefined ? undefined : String(have.port));
    const port = portText === undefined ? undefined : Number(portText);
    const env = a.values.get("--env") ?? state.instances.find((i) => i.name === name)?.env ?? (prompt.interactive ? await prompt.ask("What is it for? (dev, staging, prod)", "dev") : undefined);
    const models = a.values.get("--models")?.split(",").map((m) => m.trim()).filter((m) => m !== "");
    const bad = (models ?? []).find((m) => !modelNames.includes(m));
    if (bad !== undefined)
      return fail(`the model ${bad} is not one of: ${modelNames.join(", ")}`);
    const database = a.values.get("--database") ?? have?.database;
    const user = a.values.get("--user") ?? have?.user;
    const sslmode = a.values.get("--sslmode") ?? have?.sslmode;
    const schema = a.values.get("--schema") ?? state.instances.find((i) => i.name === name)?.schema;
    known = {
      name,
      host,
      ...port === undefined ? {} : { port },
      ...database === undefined ? {} : { database },
      ...user === undefined ? {} : { user },
      ...sslmode === undefined ? {} : { sslmode },
      ...env === undefined ? {} : { env },
      ...schema === undefined ? {} : { schema },
      ...models === undefined ? state.instances.find((i) => i.name === name)?.models === undefined ? {} : { models: state.instances.find((i) => i.name === name)?.models } : { models }
    };
    const inst = { name, host, ...port === undefined ? {} : { port }, ...database === undefined ? {} : { database }, ...user === undefined ? {} : { user }, ...sslmode === undefined ? {} : { sslmode }, ...schema === undefined ? {} : { schema } };
    const errs = checkInstance(inst);
    if (errs.length > 0)
      return fail(errs.map(errorText).join(`
`));
    writeService = have?.userService !== true;
    if (a.switches.has("--password-stdin")) {
      if (io.stdin === undefined)
        return fail("--password-stdin needs standard input");
      password = (await io.stdin()).replace(/\r?\n$/, "");
    } else if (prompt.interactive && user !== undefined && passwordFor(P, { host, ...port === undefined ? {} : { port }, ...database === undefined ? {} : { database }, user }) === undefined) {
      const typed = await prompt.secret(`Password of ${user}@${host} (nothing to keep none)`);
      password = typed === undefined || typed === "" ? undefined : typed;
    }
    if (password !== undefined && user === undefined)
      return fail("a password needs --user, so that .pgpass can say whose it is");
  }
  const secrets = password === undefined ? [] : [password];
  const targets = shellsWanted(a.values.get("--shell"), io);
  if (typeof targets === "string")
    return fail(targets);
  const changes = [];
  const modes = [];
  const warnings = [];
  const errors = [];
  const take = (r) => {
    if (r.kind === "err")
      errors.push(...r.error);
    else {
      changes.push(...r.value.changes);
      warnings.push(...r.value.warnings);
      modes.push(...r.value.modes);
    }
  };
  if (known !== undefined && password !== undefined && known.user !== undefined) {
    const cred = { host: known.host, port: String(known.port ?? 5432), database: known.database ?? "*", user: known.user, password };
    const ce = checkCredential(cred);
    if (ce.length > 0)
      return fail(ce.map(errorText).join(`
`));
    take(planPgpass(P, { set: [cred] }));
  }
  if (known !== undefined && writeService) {
    const ours = readInstances(P);
    if (ours.kind === "err")
      errors.push(...ours.error);
    else {
      const inst = { name: known.name, host: known.host, ...known.port === undefined ? {} : { port: known.port }, ...known.database === undefined ? {} : { database: known.database }, ...known.user === undefined ? {} : { user: known.user }, ...known.sslmode === undefined ? {} : { sslmode: known.sslmode }, ...known.schema === undefined ? {} : { schema: known.schema } };
      take(planServices(P, [...ours.value.filter((i) => i.name !== known?.name), inst]));
    }
  }
  if (!a.switches.has("--no-psql"))
    take(planPsql(P));
  if (known !== undefined)
    state = withInstance(state, { ...known, ...writeService ? { ownsService: true } : {} }, true);
  const installed = state.profiles.filter((p) => !targets.includes(p.shell));
  const current = state.instances.find((i) => i.name === state.default);
  for (const sh of targets) {
    const cache = cacheOf(P, sh);
    const cc = planWhole(cache, scriptFor(sh, P, current));
    if (cc.kind === "err")
      errors.push(cc.error);
    else
      changes.push(cc.value);
    const files = profileTargets(P.profiles[sh], existsSync6);
    for (const f of files) {
      const b = planBlock(f, "shell", "#", { body: profileBody(sh, cache) });
      if (b.kind === "err")
        errors.push(b.error);
      else
        changes.push(b.value);
    }
    installed.push({ shell: sh, files, cache });
  }
  for (const p of installed.filter((x) => !targets.includes(x.shell))) {
    const cc = planWhole(p.cache, scriptFor(p.shell, P, current));
    if (cc.kind === "ok")
      changes.push(cc.value);
  }
  state = { ...state, profiles: installed };
  const stateChange = planState(P, state);
  if (stateChange.kind === "err")
    errors.push(stateChange.error);
  else
    changes.push(stateChange.value);
  if (errors.length > 0)
    return fail(errors.map((e) => redact(errorText(e), secrets)).join(`
`));
  for (const w of warnings)
    say(`note: ${w}`);
  const done = await apply(changes, modes, "Setting up your workstation");
  if (!done)
    return finish(1);
  if (a.switches.has("--dry-run"))
    return finish(0);
  say();
  say("Checking your workstation:");
  const report = await workstationChecks({ paths: P, state, connect: connect2, ...io.psqlVersion === undefined ? {} : { psqlVersion: io.psqlVersion } });
  for (const r of report.results)
    say(`  ${r.status === "pass" ? "PASS" : r.status === "warn" ? "WARN" : r.status === "fail" ? "FAIL" : "?   "}  ${r.id}  ${r.title}: ${redact(r.detail, secrets)}${r.next === undefined ? "" : `
        next: ${r.next}`}`);
  return finish(report.code, { checks: report.results });
}

// sql/cli/main.ts
var USAGE = `arcactl: manage and check an arca database in PostgreSQL

  arcactl doctor [options]     check the database against the models (read-only)
  arcactl shell [options]      print the script that sets up this shell (source it; writes nothing)
  arcactl init [options]       set up your workstation (not a database): find your instances, .pgpass, pg_service.conf, psql and shell profiles

options:
  --config <file>     arca.config.ts (default: ./arca.config.ts where there is one)
  --models <a,b,...>  the models wanted, where there is no config: ${modelNames.join(", ")}
  --schema <name>     the schema the tables are in (default: arca)
  --check <ids>       only these checks, as ARCA-D001,ARCA-D005 (ARCA-W001... are the workstation's)
  --scope <s>         instance (the database, the default), workstation (your files and tools) or all
  --json              machine-readable output
  --url <url>         connection URL; prefer ARCA_DATABASE_URL (or ARCA_DATABASE_URL_FILE), since arguments show in the process list
  --driver <bun|pg>   the client: Bun's own (default on Bun) or pg (default on Node); also ARCA_DRIVER
  --non-interactive   run as a server (pipelines, containers): nothing is asked and no home file is written; also ARCA_MODE=server, CI=true, or no terminal
  -h, --help

The connection comes from ARCA_DATABASE_URL, or from libpq's own environment (PGHOST, PGUSER, PGDATABASE, ...) and files (.pgpass, pg_service.conf), as psql does. A password is never an option.`;
function shellCommand(given, io) {
  const bad = (m) => ({ code: 2, out: "", err: `${m}
` });
  const named = flag(given, "--shell");
  const detected = shellOf(named) ?? (named === undefined ? shellOf(io.env["SHELL"]) ?? (io.env["PSModulePath"] !== undefined && io.env["SHELL"] === undefined ? "pwsh" : io.env["NU_VERSION"] !== undefined ? "nu" : undefined) : undefined);
  if (detected === undefined)
    return bad(named === undefined ? `which shell? give --shell (${shells.join(", ")})` : `${named} is not a shell this is made for (${shells.join(", ")})`);
  const models = flag(given, "--models")?.split(",").map((m) => m.trim()).filter((m) => m !== "") ?? io.env["ARCA_MODELS"]?.split(",");
  const switching = flag(given, "--instance") !== undefined;
  const input = {
    shell: detected,
    schema: flag(given, "--schema") ?? io.env["ARCA_SCHEMA"] ?? "arca",
    ...opt4("instance", flag(given, "--instance") ?? io.env["ARCA_INSTANCE"]),
    ...opt4("env", flag(given, "--env") ?? (switching ? undefined : io.env["ARCA_ENV"])),
    ...opt4("service", flag(given, "--service") ?? flag(given, "--instance") ?? io.env["ARCA_SERVICE"]),
    ...opt4("config", flag(given, "--config") ?? io.env["ARCA_CONFIG"]),
    ...opt4("home", io.env["ARCA_HOME"]),
    ...models === undefined ? {} : { models },
    ...given.includes("--prompt") ? { prompt: true } : {}
  };
  const r = given.includes("--env-json") ? envJson(input) : shellScript(input);
  return r.kind === "err" ? bad(r.error.join(`
`)) : { code: 0, out: r.value.endsWith(`
`) ? r.value : `${r.value}
`, err: "" };
}
var MARKS = { pass: "PASS", warn: "WARN", fail: "FAIL", unknown: "?   " };
var renderWorkstation = (results, r) => [...results.flatMap((x) => [`${MARKS[x.status]}  ${x.id}  ${x.title}`, `      ${x.detail}`, ...x.next === undefined ? [] : [`      next: ${x.next}`]]), "", `${r.summary.pass} passed, ${r.summary.warn} warned, ${r.summary.fail} failed, ${r.summary.unknown} could not be checked`].join(`
`);
var opt4 = (k, v) => v === undefined || v === "" ? {} : { [k]: v };
var flag = (argv, name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
var says = (e) => e.kind === "model" ? `the model ${e.name} is not one of: ${modelNames.join(", ")}` : e.kind === "schema" ? `the schema name ${JSON.stringify(e.name)} is not a lower-case name` : e.kind === "compose" ? `the models do not compose: ${JSON.stringify(e.errors).slice(0, 200)}` : `the models do not project: ${e.why}`;
async function main(argv, io) {
  const [command] = argv;
  if (command === undefined || command === "-h" || command === "--help" || command === "help")
    return { code: command === undefined ? 2 : 0, out: command === undefined ? "" : USAGE, err: command === undefined ? USAGE : "" };
  if (command === "shell")
    return shellCommand(argv.slice(1), io);
  if (command === "init") {
    const plat = io.platform ?? (process.platform === "win32" ? "win32" : process.platform === "darwin" ? "darwin" : "linux");
    return runInit(argv.slice(1), { env: io.env, platform: plat, cwd: io.cwd, tty: io.tty ?? false, ...io.prompt === undefined ? {} : { prompt: io.prompt }, ...io.stdin === undefined ? {} : { stdin: io.stdin }, ...io.connect === undefined ? {} : { connect: io.connect }, ...io.psqlVersion === undefined ? {} : { psqlVersion: io.psqlVersion } });
  }
  if (command !== "doctor")
    return { code: 2, out: "", err: `arcactl has no command ${command}

${USAGE}` };
  const given = argv.slice(1);
  const mode = modeOf(argv, io.env, io.tty ?? false);
  const fromEnv = secretOf(io.env, "ARCA_DATABASE_URL", io.read);
  const url = flag(given, "--url") ?? (fromEnv.kind === "ok" ? fromEnv.value : undefined);
  const secrets = [passwordOf(url), io.env["PGPASSWORD"]].filter((s) => s !== undefined);
  const fail = (m) => ({ code: 2, out: "", err: `${redact(m, secrets)}
` });
  if (fromEnv.kind === "err")
    return fail(fromEnv.error);
  const file = flag(given, "--config") ?? (existsSync7(resolve2(io.cwd, "arca.config.ts")) ? "arca.config.ts" : undefined);
  let base;
  if (file !== undefined) {
    const loaded = await loadConfig(resolve2(io.cwd, file));
    if (loaded.kind === "err")
      return fail(loaded.error);
    base = loaded.value;
  }
  const scope = flag(given, "--scope") ?? "instance";
  if (scope !== "instance" && scope !== "workstation" && scope !== "all")
    return fail(`--scope is instance, workstation or all, not ${scope}`);
  let workstation;
  if (scope !== "instance") {
    if (mode.mode === "server")
      return fail("the workstation checks are for a person's workstation: this run is a server (the checks of the database are --scope instance)");
    const plat = io.platform ?? (process.platform === "win32" ? "win32" : process.platform === "darwin" ? "darwin" : "linux");
    const paths = pathsOf({ platform: plat, env: io.env });
    if (paths.kind === "err")
      return fail(paths.error);
    const st = readState2(paths.value);
    if (st.kind === "err")
      return fail(st.error);
    const only = flag(given, "--check")?.split(",").map((x) => x.trim()).filter((x) => workstationIds.includes(x));
    workstation = await workstationChecks({ paths: paths.value, state: st.value, connect: io.connect ?? connect, ...io.psqlVersion === undefined ? {} : { psqlVersion: io.psqlVersion } }, scope === "workstation" ? only : only);
    if (scope === "workstation") {
      const text = given.includes("--json") ? JSON.stringify({ ...workstation, mode: mode.mode, scope }, null, 2) : renderWorkstation(workstation.results, workstation);
      return { code: workstation.code, out: `${redact(text, secrets)}
`, err: "" };
    }
  }
  const models = flag(given, "--models")?.split(",").map((m) => m.trim()).filter((m) => m !== "");
  const schema = flag(given, "--schema");
  if (base === undefined && models === undefined)
    return fail("name the models: write arca.config.ts, or give --models (for example --models identityAgent)");
  const config = settingsOf({ ...base ?? { models: [] }, ...models === undefined ? {} : { models }, ...schema === undefined ? {} : { schema } });
  if (config.kind === "err")
    return fail(config.error.map(says).join(`
`));
  const made = schemaOf(config.value);
  if (made.kind === "err")
    return fail(made.error.map(says).join(`
`));
  const only = flag(given, "--check")?.split(",").map((s) => s.trim());
  const unknown = (only ?? []).filter((c) => !checkIds.includes(c) && !workstationIds.includes(c));
  if (unknown.length > 0)
    return fail(`no such check: ${unknown.join(", ")} (they are ${checkIds.join(", ")})`);
  let connection;
  try {
    const driver = flag(given, "--driver") ?? io.env["ARCA_DRIVER"];
    if (driver !== undefined && driver !== "bun" && driver !== "pg")
      return fail(`--driver is bun or pg, not ${driver}`);
    connection = await (io.connect ?? connect)({ ...url === undefined ? {} : { url }, ...driver === undefined ? {} : { driver } });
  } catch (thrown) {
    return fail(`could not connect: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
  }
  try {
    const instance = await doctor(connection.driver, config.value, made.value.schema, { secrets, ...only === undefined ? {} : { only: only.filter((c) => checkIds.includes(c)) } });
    const report = workstation === undefined ? instance : { results: [...workstation.results, ...instance.results], summary: { pass: workstation.summary.pass + instance.summary.pass, warn: workstation.summary.warn + instance.summary.warn, fail: workstation.summary.fail + instance.summary.fail, unknown: workstation.summary.unknown + instance.summary.unknown }, code: workstation.code === 0 && instance.code === 0 ? 0 : 1 };
    const text = given.includes("--json") ? JSON.stringify({ ...report, mode: mode.mode, schema: config.value.schema, models: config.value.models }, null, 2) : renderReport(report);
    return { code: report.code, out: `${redact(text, secrets)}
`, err: "" };
  } finally {
    await connection.close();
  }
}

// sql/cli/prompt.ts
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
function terminalPrompter() {
  const line = (question, hide) => new Promise((resolve) => {
    let muted = false;
    const output = new Writable({
      write(chunk, enc, cb) {
        if (!muted)
          process.stderr.write(chunk, enc);
        cb();
      }
    });
    const rl = createInterface({ input: process.stdin, output, terminal: true });
    rl.question(question, (answer) => {
      rl.close();
      if (hide)
        process.stderr.write(`
`);
      resolve(answer);
    });
    muted = hide;
    rl.on("close", () => resolve(undefined));
  });
  return {
    interactive: true,
    ask: async (q, fallback) => {
      const a = await line(fallback === undefined ? `${q} ` : `${q} [${fallback}] `, false);
      return a === undefined ? undefined : a.trim() === "" ? fallback : a.trim();
    },
    secret: (q) => line(`${q} `, true),
    confirm: async (q) => /^y(es)?$/i.test((await line(`${q} [y/N] `, false))?.trim() ?? "")
  };
}

// sql/cli/arcactl.ts
var tty = process.stdin.isTTY === true && process.stdout.isTTY === true;
var readStdin = async () => {
  const chunks = [];
  for await (const c of process.stdin)
    chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
};
var result = await main(process.argv.slice(2), { env: process.env, cwd: process.cwd(), tty, ...tty ? { prompt: terminalPrompter() } : {}, stdin: readStdin });
if (result.out !== "")
  process.stdout.write(result.out);
if (result.err !== "")
  process.stderr.write(result.err);
process.exit(result.code);
