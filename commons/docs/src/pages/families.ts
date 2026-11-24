// Spec: 0001-docs FR-043
/**
 * The libraries of commons by family (commons 0027-commons-libraries FR-027): a host with its extensions as one family, and the libraries of no host under the named group of their manifest. It is a
 * presentation only: no folder moves and no name changes for a group, and an extension is listed under the host whose folder holds it. The page is made from the facts `Family` and `Role` of each
 * library's `about`, which the configuration of commons writes from the manifests.
 *
 * @module
 */

/** A library as the families read it: its slug, its title, its family or group key, and its role in the family. */
export interface FamilyEntry {
  readonly slug: string;
  readonly title: string;
  /** The host of its family, or the group of its manifest; none where it is in neither. */
  readonly family?: string;
  /** `host`, `plugin`, `dialect`, or `member` for a library of a group. */
  readonly role?: string;
}

/** A family or a group of libraries: its key, its title and its members, the host first. */
export interface FamilyGroup {
  readonly key: string;
  readonly title: string;
  readonly members: readonly FamilyEntry[];
}

const ROLE_RANK: Readonly<Record<string, number>> = { host: 0, plugin: 1, dialect: 2, member: 3 };

/** `catalogs` is "Catalogs": the title of a group no library names. */
const capitalised = (key: string): string => `${key.slice(0, 1).toUpperCase()}${key.slice(1)}`;

/**
 * The families and groups of the libraries, in the order of their keys: each library under the key of its family or group, the host first and then by role and title; a library of neither is not listed.
 * The title of a family is the title of its host, and that of a group is the key in capitals.
 */
export function familiesOf(entries: readonly FamilyEntry[]): readonly FamilyGroup[] {
  const keys = [...new Set(entries.flatMap((e) => (e.family === undefined ? [] : [e.family])))].sort();
  return keys.map((key) => {
    const members = entries
      .filter((e) => e.family === key)
      .sort((a, b) => (ROLE_RANK[a.role ?? "member"] ?? 3) - (ROLE_RANK[b.role ?? "member"] ?? 3) || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
    const host = members.find((m) => m.role === "host");
    return { key, title: host?.title ?? capitalised(key), members };
  });
}
