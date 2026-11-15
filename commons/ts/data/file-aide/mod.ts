/**
 * File Aide: a store of files described once as TypeScript algebraic types (its paths, their names and the files under them), checked,
 * reached and queried through that description (commons 0010-file-aide). This is the public entry point; a library built with File Aide
 * imports this module alone.
 *
 * @module
 */
export {
  custom,
  date,
  DIGEST_LENGTHS,
  digest,
  enumeration,
  escapeRegExp,
  fanout,
  fileName,
  integer,
  literal,
  partition,
  rest,
  slug,
  ulid,
  uuid,
} from "./algebra/segment.ts";
export type { AnySegment, DateFormat, Segment, SegmentKind, SegmentRole, ValueOf } from "./algebra/segment.ts";
export { path, under } from "./algebra/path.ts";
export type { KeyOf, KeyOfPattern, MatchError, Part, Pattern } from "./algebra/path.ts";
export { checkNames, joinPath, LINUX_LIMITS, MACOS_LIMITS, relPath, S3_LIMITS, WINDOWS_LIMITS } from "./algebra/names.ts";
export type { NameFinding, NameLimits, PathError, RelPath } from "./algebra/names.ts";
export { bytes, codec, entry, formatLayoutError, json5, layout, mount, text } from "./algebra/entry.ts";
export type { Codec, Entry, KeyOfEntry, Layout, LayoutError, Match, ValueOfEntry } from "./algebra/entry.ts";
export { err, ok } from "../../kernel/mod.ts";
export type { Json, Result } from "../../kernel/mod.ts";
export { can, checkCondition, compareKeys, listAll, pageOf, pageOfItems, storeError, widen } from "./store/store.ts";
export type {
  ByteRange,
  Capability,
  Condition,
  ConditionFor,
  FileMeta,
  ListItem,
  ListRequest,
  Page,
  Store,
  StoreError,
} from "./store/store.ts";
export { memoryStore } from "./store/memory.ts";
export type { MemoryCapability } from "./store/memory.ts";
export { catalog, readEntry, writeEntry } from "./store/entries.ts";
export type { Cataloged, EntryError } from "./store/entries.ts";
