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
    const host = members.find((m) => m.slug === key);
    return { key, title: host?.title ?? capitalised(key), members: host === undefined ? members : [host, ...members.filter((m) => m !== host)] };
  });
}

/** Where a library is in the navigation: under the page of its host, or under the page of its named group, and what it is called there. */
export interface Placement {
  /** The slug of its host, or `group:<key>` for the page of a named group; none for a library that stands alone and for the host itself. */
  readonly parent?: string;
  /** The short name under its parent: `Bridge` under AnyFS, not `AnyFS Bridge`. */
  readonly navTitle?: string;
  /** The small heading it is listed under inside its parent: `Plugins`, `Dialects`, or none. */
  readonly navKind?: string;
}

/** The page of a named group that has no host library: its key and its title. */
export interface GroupPage {
  readonly key: string;
  readonly title: string;
}

/** What the title of a library says once its host and its role are taken off: `AnyFS Google Drive` under `AnyFS` is `Google Drive`, `Desired OS State plugin: tool` under `Desired OS State` is `Tool`. */
export function shortTitle(title: string, hostTitle: string): string {
  const singular = hostTitle.endsWith("s") ? hostTitle.slice(0, -1) : hostTitle;
  const rest = title.startsWith(`${hostTitle} `) ? title.slice(hostTitle.length + 1) : title.startsWith(`${singular} `) ? title.slice(singular.length + 1) : title;
  const bare = rest.replace(/^(plugin|dialect):\s*/i, "");
  return `${bare.slice(0, 1).toUpperCase()}${bare.slice(1)}`;
}

const KIND_OF_ROLE: Readonly<Record<string, string>> = { plugin: "Plugins", dialect: "Dialects" };

/**
 * The navigation of the libraries as a tree (0001-docs FR-044): a family is one folder with its host as the page of the folder and its extensions beneath, and a named group of no host is one folder
 * with a page of its own; a library that is in neither stands alone. Nothing here moves a folder or changes a name.
 */
export function nestLibraries(entries: readonly FamilyEntry[]): { readonly placements: ReadonlyMap<string, Placement>; readonly groupPages: readonly GroupPage[] } {
  const placements = new Map<string, Placement>();
  const groupPages: GroupPage[] = [];
  for (const fam of familiesOf(entries)) {
    const host = fam.members.find((m) => m.slug === fam.key);
    if (host === undefined && fam.members.length < 2) continue;
    if (host === undefined) groupPages.push({ key: fam.key, title: fam.title });
    for (const m of fam.members) {
      if (m === host) continue;
      const kind = KIND_OF_ROLE[m.role ?? ""];
      placements.set(m.slug, {
        parent: host === undefined ? `group:${fam.key}` : host.slug,
        navTitle: shortTitle(m.title, fam.title),
        ...(kind === undefined || host === undefined ? {} : { navKind: kind }),
      });
    }
  }
  return { placements, groupPages };
}
