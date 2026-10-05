// Reading JSON the command line printed. What a launcher prints is untrusted until read, so every value is `unknown` here and
// is narrowed by these helpers; nothing in the extension casts a document's field to a type it has not checked.

export type JsonObject = Record<string, unknown>;

export const isObject = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);
export const asObject = (v: unknown): JsonObject => (isObject(v) ? v : {});
export const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export function asString(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  return typeof v === 'object' ? JSON.stringify(v) : fallback;
}
export const asNumber = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
export const asStrings = (v: unknown): string[] => asArray(v).filter((x): x is string => typeof x === 'string');
export const optString = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

/** The first value of an object, as text: the one field of a link that names its resource. */
export const firstValue = (fields: Record<string, unknown>): string | undefined => {
  const v = Object.values(fields)[0];
  return v === undefined ? undefined : asString(v);
};
export const asBool = (v: unknown): boolean => !!v;
