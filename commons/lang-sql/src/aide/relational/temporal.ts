/**
 * Dates, times and intervals for the relational engine (commons lang-sql 0010-aide FR-017, FR-018): a value of a temporal type is carried as text, so that a relation holds nothing but strings, numbers, booleans and nulls: a `DATE` as `YYYY-MM-DD`, a `TIME` as
 * `HH:MM:SS[.fff]`, a `TIMESTAMP` as `YYYY-MM-DD HH:MM:SS[.fff]` (all in UTC: there are no time zones) and an `INTERVAL` as the duration of ISO 8601 with a sign on each part (`P1Y-2M3DT4H5M6.5S`). The text of a date or a timestamp orders as the time does. Pure.
 *
 * Spec: 0010-aide FR-017, FR-018
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** A value that the engine holds. */
type Value = string | number | boolean | null;

/** An interval: whole months, whole days and seconds (which may have a fraction), each with its own sign. */
export interface Interval {
  readonly months: number;
  readonly days: number;
  readonly seconds: number;
}

const DAY_SECONDS = 86400;
const pad = (n: number, w = 2): string => String(Math.trunc(n)).padStart(w, "0");

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{2}):(\d{2}):(\d{2})(\.\d+)?$/;
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d+)?$/;
const ISO_INTERVAL = /^P(?:(-?\d+)Y)?(?:(-?\d+)M)?(?:(-?\d+)D)?(?:T(?:(-?\d+)H)?(?:(-?\d+)M)?(?:(-?\d+(?:\.\d+)?)S)?)?$/;

/** Whether the year, month and day are a day of the calendar. */
function validDay(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The text as a date, as the milliseconds of its midnight, or `undefined`. */
export function dateMs(text: string): number | undefined {
  const m = DATE.exec(text);
  if (m === null) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return validDay(y, mo, d) ? Date.UTC(y, mo - 1, d) : undefined;
}

/** The text as a timestamp (a `T` or a space between the day and the time), as the milliseconds since the epoch, or `undefined`. */
export function timestampMs(text: string): number | undefined {
  const m = TIMESTAMP.exec(text);
  if (m === null) return undefined;
  const [y, mo, d, h, mi, s] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])];
  if (!validDay(y, mo, d) || h > 23 || mi > 59 || s > 59) return undefined;
  return Date.UTC(y, mo - 1, d, h, mi, s) + Math.round(Number(m[7] ?? "0") * 1000);
}

/** The text as a time of day, as seconds from midnight, or `undefined`. */
export function timeSeconds(text: string): number | undefined {
  const m = TIME.exec(text);
  if (m === null) return undefined;
  const [h, mi, s] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return h > 23 || mi > 59 || s > 59 ? undefined : h * 3600 + mi * 60 + s + Number(m[4] ?? "0");
}

/** The interval of an ISO 8601 duration, with a sign on any part, or `undefined`. */
function isoInterval(text: string): Interval | undefined {
  const m = ISO_INTERVAL.exec(text);
  if (m === null || text === "P" || text.endsWith("T")) return undefined;
  const n = (i: number): number => Number(m[i] ?? "0");
  return { months: n(1) * 12 + n(2), days: n(3), seconds: n(4) * 3600 + n(5) * 60 + n(6) };
}

const UNITS: Readonly<Record<string, readonly [keyof Interval, number]>> = {
  year: ["months", 12], years: ["months", 12], mon: ["months", 1], mons: ["months", 1], month: ["months", 1], months: ["months", 1],
  week: ["days", 7], weeks: ["days", 7], day: ["days", 1], days: ["days", 1],
  hour: ["seconds", 3600], hours: ["seconds", 3600], min: ["seconds", 60], mins: ["seconds", 60], minute: ["seconds", 60], minutes: ["seconds", 60], sec: ["seconds", 1], secs: ["seconds", 1], second: ["seconds", 1], seconds: ["seconds", 1],
};

/** The interval of a text: an ISO 8601 duration, or numbers with their units (`1 year 2 months`, `-3 days 04:05:06`). */
export function parseInterval(text: string): Interval | undefined {
  const t = text.trim();
  const iso = isoInterval(t);
  if (iso !== undefined) return iso;
  let rest = t.toLowerCase();
  let out: Interval = { months: 0, days: 0, seconds: 0 };
  let any = false;
  for (;;) {
    rest = rest.trimStart();
    const clock = /^(-?)(\d+):(\d{2})(?::(\d{2}(?:\.\d+)?))?/.exec(rest);
    if (clock !== null && any) {
      const sign = clock[1] === "-" ? -1 : 1;
      out = { ...out, seconds: out.seconds + sign * (Number(clock[2]) * 3600 + Number(clock[3]) * 60 + Number(clock[4] ?? "0")) };
      rest = rest.slice(clock[0].length);
      continue;
    }
    const part = /^([+-]?\d+(?:\.\d+)?)\s*([a-z]+)/.exec(rest);
    if (part === null) break;
    const unit = UNITS[part[2] ?? ""];
    if (unit === undefined) return undefined;
    out = { ...out, [unit[0]]: out[unit[0]] + Number(part[1]) * unit[1] };
    rest = rest.slice(part[0].length);
    any = true;
  }
  return any && rest.trim() === "" ? cascade(out) : undefined;
}

/** The interval of a literal `INTERVAL 'text' UNIT [TO UNIT]`, with the fields of a compound unit read from the text (`'1-2' YEAR TO MONTH`, `'1 02:03:04' DAY TO SECOND`). */
export function intervalLiteral(text: string, unit: string | undefined): Interval | undefined {
  if (unit === undefined) return parseInterval(text);
  const u = unit.toUpperCase();
  const t = text.trim();
  const single: Readonly<Record<string, readonly [keyof Interval, number]>> = { YEAR: ["months", 12], MONTH: ["months", 1], WEEK: ["days", 7], DAY: ["days", 1], HOUR: ["seconds", 3600], MINUTE: ["seconds", 60], SECOND: ["seconds", 1] };
  const s = single[u];
  if (s !== undefined) {
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(t)) return undefined;
    return cascade({ months: 0, days: 0, seconds: 0, [s[0]]: Number(t) * s[1] });
  }
  const sign = t.startsWith("-") ? -1 : 1;
  const body = t.replace(/^[+-]/, "");
  let m: RegExpExecArray | null;
  switch (u) {
    case "YEAR TO MONTH":
      m = /^(\d+)-(\d+)$/.exec(body);
      return m === null ? undefined : { months: sign * (Number(m[1]) * 12 + Number(m[2])), days: 0, seconds: 0 };
    case "DAY TO HOUR":
      m = /^(\d+) (\d+)$/.exec(body);
      return m === null ? undefined : { months: 0, days: sign * Number(m[1]), seconds: sign * Number(m[2]) * 3600 };
    case "DAY TO MINUTE":
      m = /^(\d+) (\d+):(\d+)$/.exec(body);
      return m === null ? undefined : { months: 0, days: sign * Number(m[1]), seconds: sign * (Number(m[2]) * 3600 + Number(m[3]) * 60) };
    case "DAY TO SECOND":
      m = /^(\d+) (\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(body);
      return m === null ? undefined : { months: 0, days: sign * Number(m[1]), seconds: sign * (Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4])) };
    case "HOUR TO MINUTE":
      m = /^(\d+):(\d+)$/.exec(body);
      return m === null ? undefined : { months: 0, days: 0, seconds: sign * (Number(m[1]) * 3600 + Number(m[2]) * 60) };
    case "HOUR TO SECOND":
      m = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(body);
      return m === null ? undefined : { months: 0, days: 0, seconds: sign * (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) };
    case "MINUTE TO SECOND":
      m = /^(\d+):(\d+(?:\.\d+)?)$/.exec(body);
      return m === null ? undefined : { months: 0, days: 0, seconds: sign * (Number(m[1]) * 60 + Number(m[2])) };
    default:
      return undefined;
  }
}

/** Fractions of a month go to days (30 to a month), and fractions of a day to seconds, so that months and days stay whole. */
function cascade(i: Interval): Interval {
  const months = Math.trunc(i.months);
  const daysTotal = i.days + (i.months - months) * 30;
  const days = Math.trunc(daysTotal);
  return { months, days, seconds: i.seconds + (daysTotal - days) * DAY_SECONDS };
}

const num = (n: number): string => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(6))));

/** The text of an interval, in the ISO 8601 form with a sign on each part; `PT0S` for none. */
export function formatInterval(i: Interval): string {
  const years = Math.trunc(i.months / 12);
  const months = i.months - years * 12;
  const hours = Math.trunc(i.seconds / 3600);
  const minutes = Math.trunc((i.seconds - hours * 3600) / 60);
  const seconds = Number((i.seconds - hours * 3600 - minutes * 60).toFixed(6));
  const date = `${years === 0 ? "" : `${years}Y`}${months === 0 ? "" : `${months}M`}${i.days === 0 ? "" : `${i.days}D`}`;
  const time = `${hours === 0 ? "" : `${hours}H`}${minutes === 0 ? "" : `${minutes}M`}${seconds === 0 ? "" : `${num(seconds)}S`}`;
  return date === "" && time === "" ? "PT0S" : `P${date}${time === "" ? "" : `T${time}`}`;
}

/** The text of a date, from the milliseconds of its midnight. */
export function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** The text of a time of day, from seconds from midnight (taken within a day). */
export function formatTime(seconds: number): string {
  const s = ((seconds % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS;
  const whole = Math.floor(s);
  const frac = Number((s - whole).toFixed(6));
  return `${pad(whole / 3600)}:${pad((whole % 3600) / 60)}:${pad(whole % 60)}${frac === 0 ? "" : String(frac).slice(1)}`;
}

/** The text of a timestamp, from the milliseconds since the epoch. */
export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const frac = ((ms % 1000) + 1000) % 1000;
  return `${formatDate(ms)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}${frac === 0 ? "" : `.${String(frac).padStart(3, "0").replace(/0+$/, "")}`}`;
}

/** A value of a temporal type, as the engine reads text. */
export type Temporal =
  | { readonly kind: "date"; readonly ms: number }
  | { readonly kind: "timestamp"; readonly ms: number }
  | { readonly kind: "time"; readonly seconds: number }
  | { readonly kind: "interval"; readonly interval: Interval };

/** What a value is, where it is the text of a date, a timestamp, a time or an interval (a number, a boolean, a null and any other text are none). */
export function temporalOf(v: Value): Temporal | undefined {
  if (typeof v !== "string") return undefined;
  const d = dateMs(v);
  if (d !== undefined) return { kind: "date", ms: d };
  const t = timestampMs(v);
  if (t !== undefined) return { kind: "timestamp", ms: t };
  const s = timeSeconds(v);
  if (s !== undefined) return { kind: "time", seconds: s };
  if (v.startsWith("P") || v.startsWith("-P")) {
    const i = isoInterval(v);
    if (i !== undefined) return { kind: "interval", interval: i };
  }
  return undefined;
}

/** The order of two interval's lengths, a month being 30 days. */
export const intervalLength = (i: Interval): number => (i.months * 30 + i.days) * DAY_SECONDS + i.seconds;

/** A date or timestamp and an interval added: months by the calendar (a day past the end of a month goes to its last day), then days and seconds. */
function shift(ms: number, i: Interval, sign: 1 | -1): number {
  const d = new Date(ms);
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + sign * i.months;
  const y = Math.floor(total / 12);
  const m = total - y * 12;
  const day = Math.min(d.getUTCDate(), new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
  const base = Date.UTC(y, m, day, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
  return base + sign * (i.days * DAY_SECONDS + i.seconds) * 1000;
}

const scaled = (i: Interval, k: number): Interval => cascade({ months: i.months * k, days: i.days * k, seconds: i.seconds * k });

/**
 * The value of `a op b` where one is temporal: `+` and `-` of a date or timestamp and an interval (or, for a date, a whole number of days), of two intervals, and of two dates (days), two timestamps or two times (an interval); `*` and `/` of an interval and a
 * number. An error value says what does not make sense; `undefined` where neither side is temporal, which the engine then reads as arithmetic.
 */
export function temporalArithmetic(op: string, a: Value, b: Value): Result<Value, string> | undefined {
  const l = temporalOf(a);
  const r = temporalOf(b);
  if (l === undefined && r === undefined) return undefined;
  const bad = (): Result<Value, string> => err(`${op} does not apply to ${l?.kind ?? typeof a} and ${r?.kind ?? typeof b}`);
  const stamp = (ms: number, withTime: boolean): Result<Value, string> => ok(withTime ? formatTimestamp(ms) : formatDate(ms));
  if (op === "*" || op === "/") {
    if (op === "*" && l === undefined && r?.kind === "interval" && typeof a === "number") return ok(formatInterval(scaled(r.interval, a)));
    if (l?.kind === "interval" && typeof b === "number" && (op === "*" || b !== 0)) return ok(formatInterval(scaled(l.interval, op === "*" ? b : 1 / b)));
    return bad();
  }
  if (op !== "+" && op !== "-") return undefined;
  const sign: 1 | -1 = op === "+" ? 1 : -1;
  if (l === undefined || r === undefined) {
    if (l !== undefined && typeof b === "number" && l.kind === "date") return stamp(l.ms + sign * b * DAY_SECONDS * 1000, false);
    if (r !== undefined && typeof a === "number" && r.kind === "date" && op === "+") return stamp(r.ms + a * DAY_SECONDS * 1000, false);
    return bad();
  }
  if (l.kind === "interval" && r.kind === "interval") return ok(formatInterval({ months: l.interval.months + sign * r.interval.months, days: l.interval.days + sign * r.interval.days, seconds: l.interval.seconds + sign * r.interval.seconds }));
  if ((l.kind === "date" || l.kind === "timestamp") && r.kind === "interval") {
    const ms = shift(l.ms, r.interval, sign);
    return stamp(ms, l.kind === "timestamp" || r.interval.seconds !== 0);
  }
  if (l.kind === "interval" && (r.kind === "date" || r.kind === "timestamp") && op === "+") {
    const ms = shift(r.ms, l.interval, 1);
    return stamp(ms, r.kind === "timestamp" || l.interval.seconds !== 0);
  }
  if (l.kind === "time" && r.kind === "interval") return ok(formatTime(l.seconds + sign * r.interval.seconds));
  if (op === "-" && l.kind === "date" && r.kind === "date") return ok(Math.round((l.ms - r.ms) / (DAY_SECONDS * 1000)));
  if (op === "-" && (l.kind === "date" || l.kind === "timestamp") && (r.kind === "date" || r.kind === "timestamp")) {
    const diff = (l.ms - r.ms) / 1000;
    const days = Math.trunc(diff / DAY_SECONDS);
    return ok(formatInterval({ months: 0, days, seconds: diff - days * DAY_SECONDS }));
  }
  if (op === "-" && l.kind === "time" && r.kind === "time") return ok(formatInterval({ months: 0, days: 0, seconds: l.seconds - r.seconds }));
  return bad();
}

/** The value of `-x` for an interval. */
export function negateInterval(v: Value): string | undefined {
  const t = temporalOf(v);
  return t?.kind === "interval" ? formatInterval({ months: -t.interval.months, days: -t.interval.days, seconds: -t.interval.seconds }) : undefined;
}

/** The order of two temporal values of the same kind (an interval by its length, a date against a timestamp by its midnight), or `undefined` where they are not both temporal. */
export function temporalOrder(a: Value, b: Value): number | undefined {
  const l = temporalOf(a);
  const r = temporalOf(b);
  if (l === undefined || r === undefined) return undefined;
  if (l.kind === "interval" && r.kind === "interval") return Math.sign(intervalLength(l.interval) - intervalLength(r.interval));
  if ((l.kind === "date" || l.kind === "timestamp") && (r.kind === "date" || r.kind === "timestamp")) return Math.sign(l.ms - r.ms);
  if (l.kind === "time" && r.kind === "time") return Math.sign(l.seconds - r.seconds);
  return undefined;
}

/** The cast of a value to `DATE`, `TIME`, `TIMESTAMP` or `INTERVAL` (a date from a timestamp keeps its day; a timestamp from a date is its midnight), or an error value. */
export function castTemporal(type: string, v: Value): Result<Value, string> {
  if (typeof v !== "string") return err(`${typeof v} is not a ${type}`);
  const t = temporalOf(v.trim());
  switch (type) {
    case "DATE":
      return t?.kind === "date" ? ok(formatDate(t.ms)) : t?.kind === "timestamp" ? ok(formatDate(Math.floor(t.ms / (DAY_SECONDS * 1000)) * DAY_SECONDS * 1000)) : err(`"${v}" is not a date`);
    case "TIMESTAMP":
      return t?.kind === "timestamp" ? ok(formatTimestamp(t.ms)) : t?.kind === "date" ? ok(formatTimestamp(t.ms)) : err(`"${v}" is not a timestamp`);
    case "TIME":
      return t?.kind === "time" ? ok(formatTime(t.seconds)) : t?.kind === "timestamp" ? ok(formatTime((t.ms / 1000) % DAY_SECONDS)) : err(`"${v}" is not a time`);
    default: {
      const i = parseInterval(v);
      return i === undefined ? err(`"${v}" is not an interval`) : ok(formatInterval(i));
    }
  }
}

/** The part of a date, a timestamp, a time or an interval that `EXTRACT(field FROM x)` names, or an error value (0010-aide FR-018). */
export function extract(field: string, v: Value): Result<Value, string> {
  const f = field.toUpperCase();
  const t = temporalOf(v);
  if (t === undefined) return err(`EXTRACT needs a date, a time, a timestamp or an interval, not ${typeof v === "string" ? `"${v}"` : String(v)}`);
  if (t.kind === "interval") {
    const i = t.interval;
    const hours = Math.trunc(i.seconds / 3600);
    const minutes = Math.trunc((i.seconds - hours * 3600) / 60);
    switch (f) {
      case "YEAR": return ok(Math.trunc(i.months / 12));
      case "MONTH": return ok(i.months % 12);
      case "DAY": return ok(i.days);
      case "HOUR": return ok(hours);
      case "MINUTE": return ok(minutes);
      case "SECOND": return ok(Number((i.seconds - hours * 3600 - minutes * 60).toFixed(6)));
      case "EPOCH": return ok(intervalLength(i));
      default: return err(`${f} is not a part of an interval`);
    }
  }
  if (t.kind === "time") {
    const s = t.seconds;
    switch (f) {
      case "HOUR": return ok(Math.trunc(s / 3600));
      case "MINUTE": return ok(Math.trunc((s % 3600) / 60));
      case "SECOND": return ok(Number((s % 60).toFixed(6)));
      case "EPOCH": return ok(s);
      default: return err(`${f} is not a part of a time`);
    }
  }
  const d = new Date(t.ms);
  const year = d.getUTCFullYear();
  const startOfYear = Date.UTC(year, 0, 1);
  const doy = Math.floor((t.ms - startOfYear) / (DAY_SECONDS * 1000)) + 1;
  const dow = d.getUTCDay();
  switch (f) {
    case "YEAR": return ok(year);
    case "QUARTER": return ok(Math.floor(d.getUTCMonth() / 3) + 1);
    case "MONTH": return ok(d.getUTCMonth() + 1);
    case "DAY": return ok(d.getUTCDate());
    case "DOW": return ok(dow);
    case "ISODOW": return ok(dow === 0 ? 7 : dow);
    case "DOY": return ok(doy);
    case "WEEK": {
      const thursday = new Date(Date.UTC(year, d.getUTCMonth(), d.getUTCDate() + 4 - (dow === 0 ? 7 : dow)));
      return ok(Math.ceil(((thursday.getTime() - Date.UTC(thursday.getUTCFullYear(), 0, 1)) / (DAY_SECONDS * 1000) + 1) / 7));
    }
    case "HOUR": return ok(d.getUTCHours());
    case "MINUTE": return ok(d.getUTCMinutes());
    case "SECOND": return ok(d.getUTCSeconds() + d.getUTCMilliseconds() / 1000);
    case "MILLISECOND":
    case "MILLISECONDS": return ok(d.getUTCSeconds() * 1000 + d.getUTCMilliseconds());
    case "MICROSECOND":
    case "MICROSECONDS": return ok((d.getUTCSeconds() * 1000 + d.getUTCMilliseconds()) * 1000);
    case "EPOCH": return ok(t.ms / 1000);
    default: return err(`${f} is not a part of a date or a timestamp`);
  }
}
