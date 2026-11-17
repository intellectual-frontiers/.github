/**
 * The ledger of releases (commons 0026-works-versioning FR-017 to FR-020, FR-027, FR-028, FR-037): derived from the tags of a repository and never written by hand. Each tag `<slug>-v<version>`
 * of a work is one release, with the commit and tree it names, whether it carries a signature and the day of its commit; the tags are ordered by the work's scheme, a tag that is not greater than
 * an earlier one of its own history, a tag that moved and a tag that is gone are findings, and a retired version, its replacement and its tombstone are read from the record.
 *
 * @remarks
 * Pure: the tags (read by `git.ts`), the records of the works and the ancestry of the tags' commits are arguments. A work's slug is the prefix of its tags, and a tag belongs to the work with the
 * longest slug it starts with, since a slug and a version may both hold hyphens; a tag that starts with no work's slug is not a release and is left alone. Versions are compared only within one
 * scheme (FR-037): where a record names `migratedFrom`, the tags up to the one that carries the first version of the new scheme are of the old scheme and the others of the new, and each is read by
 * its own scheme. A tag that is not annotated is read too and says so (`annotated: false`), since commons' first tags are lightweight.
 *
 * @limits
 * It does not verify a signature: `signed` says the tag carries one, and a person verifies with `git tag -v` and the keys they trust. It does not read Git.
 *
 * @example
 * ```ts
 * import { ledgerJson, readLedger } from "./ledger.ts";
 * // const { entries, findings } = readLedger({ tags, works, isAncestor }); ledgerJson(entries)
 * ```
 *
 * @module
 */
import { type DecodeError, array, boolean, formatDecodeError, object, string } from "../../kernel/decode.ts";
import { err, ok, type Result } from "../../kernel/result.ts";
import { dayOf } from "../changes/declaration.ts";
import type { Release } from "./record.ts";
import type { VersionsFinding } from "./rules.ts";
import { compareVersions, parseVersion, type ParsedVersion, type Scheme, schemeOf, utcDay } from "./scheme.ts";

/** A tag of the repository as Git reports it. */
export type TagFact = {
  readonly name: string;
  /** Whether it is an annotated tag (a lightweight tag is a name for a commit and nothing more). */
  readonly annotated: boolean;
  /** Whether the tag carries a signature (it is not verified). */
  readonly signed: boolean;
  readonly commit: string;
  readonly tree: string;
  /** The committer time of the commit, in seconds since the epoch. */
  readonly seconds: number;
};

/** One release of the ledger. */
export type LedgerEntry = {
  readonly work: string;
  readonly version: string;
  readonly scheme: Scheme;
  readonly tag: string;
  readonly commit: string;
  readonly tree: string;
  readonly signed: boolean;
  readonly annotated: boolean;
  readonly day: string;
  /** The record's entry for the version where it was retired (FR-028). */
  readonly retired?: { readonly on: string; readonly replacedBy?: string; readonly archivedOn?: string };
  /** The day the bytes of the version were removed, where they were: the version then resolves to a tombstone (FR-027). */
  readonly tombstone?: string;
};

/** What `readLedger` takes. */
export type LedgerInput = {
  readonly tags: readonly TagFact[];
  readonly works: readonly Release[];
  /** Whether the commit `a` is a proper ancestor of the commit `b`. */
  readonly isAncestor: (a: string, b: string) => boolean;
  /** An earlier ledger (`--against`): a tag of it that moved or is gone is a finding. */
  readonly earlier?: readonly EarlierEntry[];
};

/** What the ledger keeps of an earlier ledger. */
export type EarlierEntry = {
  readonly work: string;
  readonly version: string;
  readonly tag: string;
  readonly commit: string;
  readonly tree: string;
};

/** The tag a version of a work has. */
export function tagNameOf(slug: string, version: string): string {
  return `${slug}-v${version}`;
}

/** The work and the version a tag name carries, by the slugs known: the work with the longest slug the name starts with. */
export function splitTag(name: string, slugs: readonly string[]): { readonly slug: string; readonly version: string } | undefined {
  const best = [...slugs].sort((a, b) => b.length - a.length).find((s) => name.startsWith(`${s}-v`) && name.length > s.length + 2);
  return best === undefined ? undefined : { slug: best, version: name.slice(best.length + 2) };
}

/** A day plus an ISO 8601 duration of years, months, weeks and days, clamped to the end of a short month. */
export function addDuration(day: string, duration: string): string | undefined {
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(duration);
  const d = dayOf(day);
  if (m === null || d === undefined) return undefined;
  const [y, mo, dd] = day.split("-").map(Number);
  if (y === undefined || mo === undefined || dd === undefined) return undefined;
  const months = (y + Number(m[1] ?? 0)) * 12 + (mo - 1) + Number(m[2] ?? 0);
  const year = Math.floor(months / 12);
  const month = months % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const base = Date.UTC(year, month, Math.min(dd, last));
  return new Date(base + (Number(m[3] ?? 0) * 7 + Number(m[4] ?? 0)) * 86_400_000).toISOString().slice(0, 10);
}

type Placed = {
  readonly tag: TagFact;
  readonly slug: string;
  readonly version: string;
  readonly scheme: Scheme;
  readonly parsed: ParsedVersion | undefined;
};

function finding(rule: VersionsFinding["rule"], tag: string, work: string, message: string): VersionsFinding {
  return { rule, file: `refs/tags/${tag}`, work, message };
}

/** The ledger of a repository: its releases in order, and what is wrong with them. */
export function readLedger(input: LedgerInput): {
  readonly entries: readonly LedgerEntry[];
  readonly findings: readonly VersionsFinding[];
} {
  const { tags, works, isAncestor } = input;
  const findings: VersionsFinding[] = [];
  const slugs = works.map((w) => w.slug as string);
  const bySlug = new Map(works.map((w) => [w.slug as string, w] as const));
  const placed: Placed[] = [];
  for (const tag of tags) {
    const split = splitTag(tag.name, slugs);
    const work = split === undefined ? undefined : bySlug.get(split.slug);
    if (split === undefined || work === undefined) continue;
    const current = schemeOf(work.kind);
    const first =
      work.migratedFrom === undefined
        ? undefined
        : tags.find(
            (t) => splitTag(t.name, slugs)?.slug === split.slug && t.name === tagNameOf(split.slug, work.migratedFrom?.firstVersion ?? ""),
          );
    const isNew =
      work.migratedFrom === undefined || (first !== undefined && (first.name === tag.name || isAncestor(first.commit, tag.commit)));
    const scheme = isNew ? current : (work.migratedFrom?.scheme ?? current);
    const parsed = parseVersion(scheme, split.version);
    if (parsed.kind === "err") {
      findings.push(
        finding(
          "versions/scheme-mismatch",
          tag.name,
          split.slug,
          `the version ${JSON.stringify(split.version)} of the tag is not a ${scheme}: ${parsed.error}`,
        ),
      );
      placed.push({ tag, slug: split.slug, version: split.version, scheme, parsed: undefined });
    } else placed.push({ tag, slug: split.slug, version: split.version, scheme, parsed: parsed.value });
  }
  const order = (a: Placed, b: Placed): number => {
    if (a.slug !== b.slug) return a.slug < b.slug ? -1 : 1;
    if (a.scheme !== b.scheme) return a.scheme === (bySlug.get(a.slug)?.migratedFrom?.scheme ?? "") ? -1 : 1;
    const c =
      a.parsed === undefined || b.parsed === undefined
        ? undefined
        : compareVersions(a.parsed, b.parsed, () =>
            isAncestor(a.tag.commit, b.tag.commit) ? -1 : isAncestor(b.tag.commit, a.tag.commit) ? 1 : 0,
          );
    return c !== undefined && c !== 0 ? c : a.tag.name < b.tag.name ? -1 : a.tag.name > b.tag.name ? 1 : 0;
  };
  placed.sort(order);
  // a tag not greater than a tag of its own history (FR-020)
  for (const y of placed)
    for (const x of placed) {
      if (x === y || x.slug !== y.slug || x.scheme !== y.scheme || x.parsed === undefined || y.parsed === undefined) continue;
      if (x.tag.commit === y.tag.commit || !isAncestor(x.tag.commit, y.tag.commit)) continue;
      const c = compareVersions(y.parsed, x.parsed, () => 1);
      if (c !== undefined && c <= 0)
        findings.push(
          finding(
            "versions/ledger-order",
            y.tag.name,
            y.slug,
            `${y.tag.name} (${y.version}) is not greater than ${x.tag.name} (${x.version}), whose commit is an ancestor of its own`,
          ),
        );
    }
  const entries: LedgerEntry[] = placed.map((p) => {
    const work = bySlug.get(p.slug);
    const r = work?.retired?.find((e) => e.version === p.version);
    return {
      work: p.slug,
      version: p.version,
      scheme: p.scheme,
      tag: p.tag.name,
      commit: p.tag.commit,
      tree: p.tag.tree,
      signed: p.tag.signed,
      annotated: p.tag.annotated,
      day: utcDay(p.tag.seconds),
      ...(r === undefined
        ? {}
        : {
            retired: {
              on: r.on,
              ...(r.replacedBy === undefined ? {} : { replacedBy: r.replacedBy }),
              ...(r.archivedOn === undefined ? {} : { archivedOn: r.archivedOn }),
            },
          }),
      ...(r?.bytesRemovedOn === undefined ? {} : { tombstone: r.bytesRemovedOn }),
    };
  });
  // bytes are deleted only after the retention period the record states (FR-027)
  for (const e of entries) {
    if (e.tombstone === undefined) continue;
    const period = bySlug.get(e.work)?.retention;
    if (period === undefined)
      findings.push(
        finding(
          "versions/retention-early",
          e.tag,
          e.work,
          `the bytes of ${e.version} were removed on ${e.tombstone} and the record states no retention period (retention)`,
        ),
      );
    else {
      const until = addDuration(e.day, period);
      if (until !== undefined && e.tombstone < until)
        findings.push(
          finding(
            "versions/retention-early",
            e.tag,
            e.work,
            `the bytes of ${e.version} were removed on ${e.tombstone}, before the end of the retention ${period} from ${e.day} (${until})`,
          ),
        );
    }
  }
  // a tag that moved or is gone since an earlier ledger (FR-020, FR-028)
  for (const e of input.earlier ?? []) {
    const retired = bySlug.get(e.work)?.retired?.some((r) => r.version === e.version) ?? false;
    if (retired) continue;
    const now = tags.find((t) => t.name === e.tag);
    if (now === undefined)
      findings.push(
        finding(
          "versions/tag-removed",
          e.tag,
          e.work,
          `the tag ${e.tag} (${e.version}) is in the earlier ledger and is gone, and the record's retired does not name it`,
        ),
      );
    else if (now.commit !== e.commit || now.tree !== e.tree)
      findings.push(
        finding(
          "versions/tag-moved",
          e.tag,
          e.work,
          `the tag ${e.tag} named commit ${e.commit} (tree ${e.tree}) and names commit ${now.commit} (tree ${now.tree}): a published version is immutable`,
        ),
      );
  }
  return { entries, findings };
}

/** The releases of one work in the scheme it uses now, the last of them first-class for the commands that need "the last tag" (those of `reachable` where given). */
export function lastRelease(entries: readonly LedgerEntry[], work: Release, reachable?: ReadonlySet<string>): LedgerEntry | undefined {
  const current = schemeOf(work.kind);
  const mine = entries.filter((e) => e.work === work.slug && e.scheme === current && (reachable === undefined || reachable.has(e.tag)));
  return mine[mine.length - 1];
}

/** The ledger as a deterministic JSON document: `{ "releases": [...] }`, two spaces, a newline at the end. */
export function ledgerJson(entries: readonly LedgerEntry[]): string {
  const releases = entries.map((e) => ({
    work: e.work,
    version: e.version,
    scheme: e.scheme,
    tag: e.tag,
    commit: e.commit,
    tree: e.tree,
    signed: e.signed,
    annotated: e.annotated,
    day: e.day,
    ...(e.retired === undefined ? {} : { retired: e.retired }),
    ...(e.tombstone === undefined ? {} : { tombstone: e.tombstone }),
  }));
  return `${JSON.stringify({ releases }, null, 2)}\n`;
}

/** The ledger as text, a line for each release: work, version, commit, tree, signed or unsigned, day, and where it is so a note on retirement. */
export function ledgerText(entries: readonly LedgerEntry[]): string {
  if (entries.length === 0) return "no releases: no tag of the form <slug>-v<version> names a work\n";
  return `${entries
    .map((e) => {
      const state = e.signed ? "signed" : e.annotated ? "unsigned" : "lightweight";
      const note =
        e.retired === undefined
          ? ""
          : `\tretired ${e.retired.on}${e.retired.replacedBy === undefined ? "" : ` replaced by ${e.retired.replacedBy}`}${e.tombstone === undefined ? "" : `; bytes removed ${e.tombstone}`}`;
      return `${e.work}\t${e.version}\t${e.commit}\t${e.tree}\t${state}\t${e.day}${note}`;
    })
    .join("\n")}\n`;
}

const earlierDecoder = array(
  object(
    { work: string, version: string, tag: string, commit: string, tree: string },
    { scheme: string, signed: boolean, annotated: boolean, day: string },
  ),
);

/** An earlier ledger read from the JSON `versions ledger --json` wrote (FR-020). */
export function readEarlier(text: string): Result<readonly EarlierEntry[], string> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return err(`not JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  const releases: unknown = typeof value === "object" && value !== null ? Reflect.get(value, "releases") : undefined;
  const r = earlierDecoder(releases, "releases");
  return r.kind === "ok"
    ? ok(r.value.map((e) => ({ work: e.work, version: e.version, tag: e.tag, commit: e.commit, tree: e.tree })))
    : err(formatDecodeError(r.error satisfies DecodeError));
}
