/**
 * The families of the libraries of commons and the names held for them (commons 0027-commons-libraries FR-023, FR-024; commons 0033-kanon FR-021, FR-024): what the `family` field of a manifest
 * says, the reservations (names no library may take unless it is of the family they are held for), and the findings of the two sides of a family held together, the host's table and each member's
 * manifest.
 *
 * @remarks
 * Pure: it takes the libraries as data and returns one sentence for each finding. A library names its host and its role (`host`, `dialect` or `plugin`); the host's `kanon` table says what its
 * dialects and plugins are and how their packages are named (`@intellectual-frontiers/kanon`: `family`, `instances`, `plugins`), so the name of a member is checked against the host's rule and
 * never against a rule written here. A reservation is data: an exact name or a prefix, and the host that may hold it. It reserves a name without a folder, so that no empty library is created to hold one.
 *
 * Spec: 0001-libraries FR-016
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { classify, parsePackageName, type Table } from "@intellectual-frontiers/kanon";

/** The roles a library has in a family: a closed union. */
export const ROLES = ["host", "dialect", "plugin"] as const;
/** The role of a library in a family. */
export type Role = (typeof ROLES)[number];

/** What a manifest says of its family: the host's library name and its own role. */
export type LibraryFamily = { readonly host: string; readonly role: Role };

/** The scope of the packages of commons. */
const SCOPE = "@intellectual-frontiers/";

/** How a reservation holds names: one exact name, or every name that begins with a prefix. */
export type Match = { readonly kind: "exact"; readonly name: string } | { readonly kind: "prefix"; readonly prefix: string };

/** A held name: what it matches, the host whose family may use it and why it is held. */
export type Reservation = { readonly match: Match; readonly host: string; readonly reason: string };

/** The reason the names of the retired fleet engine are held (intellectual-frontiers/.github#11). */
const ARCHON = "held for the fleet library and its dialects and plugins, which replace the retired fleet engine (intellectual-frontiers/.github#11)";

/** The reason the names of the library of Kanon for content are held (intellectual-frontiers/.github#22). */
const CONTENT = "held for the content library, Kanon for content, and its renditions, named content-rendition-<name> (intellectual-frontiers/.github#22)";

/** The names held, as data: the check reads them and no folder holds them. */
export const RESERVED: readonly Reservation[] = [
  { match: { kind: "exact", name: "archon" }, host: "archon", reason: ARCHON },
  { match: { kind: "prefix", prefix: "archon-" }, host: "archon", reason: ARCHON },
  { match: { kind: "exact", name: "signing" }, host: "signing", reason: "held for the signing library of the fleet libraries (intellectual-frontiers/.github#11)" },
  { match: { kind: "exact", name: "gitops" }, host: "gitops", reason: "held for the gitops library of the fleet libraries (intellectual-frontiers/.github#11)" },
  { match: { kind: "exact", name: "anyfs" }, host: "anyfs", reason: "held for the AnyFS library and its backends, plugins named anyfs-<noun> (intellectual-frontiers/.github#21)" },
  { match: { kind: "prefix", prefix: "anyfs-" }, host: "anyfs", reason: "held for the AnyFS library and its backends, plugins named anyfs-<noun> (intellectual-frontiers/.github#21)" },
  { match: { kind: "exact", name: "estate" }, host: "estate", reason: "held for the estate library of the fleet libraries (intellectual-frontiers/.github#11)" },
  { match: { kind: "exact", name: "content" }, host: "content", reason: CONTENT },
  { match: { kind: "prefix", prefix: "content-" }, host: "content", reason: CONTENT },
  { match: { kind: "exact", name: "toolchain" }, host: "toolchain", reason: "held for the toolchain library of the fleet libraries (intellectual-frontiers/.github#11)" },
];

/** Whether a library name is one a match holds. */
export function matches(match: Match, name: string): boolean {
  switch (match.kind) {
    case "exact":
      return name === match.name;
    case "prefix":
      return name.startsWith(match.prefix);
    default:
      return absurd(match);
  }
}

/** The family field of a manifest, from what it says: the host's name and the role, or why it is not one. */
export function decodeFamily(input: { readonly host: string; readonly role: Role }): Result<LibraryFamily, string> {
  return /^[a-z][a-z0-9-]*$/.test(input.host)
    ? ok({ host: input.host, role: input.role })
    : err(`library.family.host ${JSON.stringify(input.host)} is not a library name`);
}

/** What the check reads of a library: its name, its family and its table. */
export type Entry = { readonly name: string; readonly family?: LibraryFamily; readonly kanon?: Table };

/** The findings of the names held: a library whose name a reservation holds and that is not of the family the name is held for. */
export function reservationFindings(libraries: readonly Entry[], reserved: readonly Reservation[] = RESERVED): readonly string[] {
  const out: string[] = [];
  for (const l of libraries)
    for (const r of reserved) {
      if (!matches(r.match, l.name)) continue;
      if (l.family?.host !== r.host)
        out.push(`commons/${l.name}: the name is ${r.reason}, so the manifest declares family: { host: "${r.host}", role } (0033-kanon FR-024)`);
      break;
    }
  return out;
}

/** The findings of a family held together: each member's name against the host's rule, each declared member registered, and each registered member declared (0033-kanon FR-021). */
export function familyFindings(libraries: readonly Entry[]): readonly string[] {
  const out: string[] = [];
  const by = new Map(libraries.map((l) => [l.name, l]));
  for (const l of libraries) {
    const f = l.family;
    if (f === undefined) {
      for (const h of libraries) {
        const rule = h.kanon?.family;
        const pkg = parsePackageName(`${SCOPE}${l.name}`);
        if (rule !== undefined && h.kanon !== undefined && pkg.kind === "ok" && h.name !== l.name) {
          const member = classify(rule, h.kanon.package, pkg.value);
          if (member !== undefined && member.kind !== "host")
            out.push(`commons/${l.name}: the name is a ${member.kind} of ${h.name} by its family rule, and the manifest declares no family (0033-kanon FR-021)`);
        }
      }
      continue;
    }
    switch (f.role) {
      case "host":
        if (l.name !== f.host) out.push(`commons/${l.name}: it declares itself the host of the family ${f.host}, and a host is named as its family (0033-kanon FR-021)`);
        break;
      case "dialect":
      case "plugin": {
        const host = by.get(f.host);
        if (host === undefined || host.family?.role !== "host" || host.kanon === undefined) {
          out.push(`commons/${l.name}: its family host ${f.host} is not a library that declares family role host and a kanon table (0033-kanon FR-021)`);
          break;
        }
        const rule = host.kanon.family;
        const pkg = parsePackageName(`${SCOPE}${l.name}`);
        const member = rule === undefined || pkg.kind === "err" ? undefined : classify(rule, host.kanon.package, pkg.value);
        if (member === undefined || member.kind !== f.role)
          out.push(`commons/${l.name}: the family rule of ${f.host} does not read the name as a ${f.role} (0033-kanon FR-021)`);
        const declared =
          f.role === "dialect"
            ? host.kanon.instances.some((i) => i.kind === "package" && i.package === `${SCOPE}${l.name}`)
            : host.kanon.plugins.some((p) => p.package === `${SCOPE}${l.name}`);
        if (!declared) out.push(`commons/${l.name}: the kanon table of ${f.host} does not declare it as a ${f.role} (0033-kanon FR-020)`);
        if (l.kanon === undefined || l.kanon.extends !== host.kanon.package)
          out.push(`commons/${l.name}: a ${f.role} of ${f.host} declares a kanon table with extends: "${host.kanon.package}" (0033-kanon FR-020)`);
        break;
      }
      default:
        return absurd(f.role);
    }
  }
  for (const h of libraries) {
    if (h.kanon === undefined) continue;
    const members = [
      ...h.kanon.instances.flatMap((i) => (i.kind === "package" ? [{ role: "dialect" as const, pkg: i.package }] : [])),
      ...h.kanon.plugins.map((p) => ({ role: "plugin" as const, pkg: p.package })),
    ];
    for (const m of members) {
      const name = m.pkg.slice(SCOPE.length);
      const l = by.get(name);
      if (l === undefined || l.family?.host !== h.name || l.family.role !== m.role)
        out.push(`commons/${h.name}: its kanon table declares ${m.pkg} as a ${m.role}, and no library of that name declares family: { host: "${h.name}", role: "${m.role}" } (0033-kanon FR-021)`);
    }
  }
  return out;
}
