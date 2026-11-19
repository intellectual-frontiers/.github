// Spec: 0002-workspace-model FR-040
/**
 * The catalog and the inventory in the forms an assessor reads (commons 0002-workspace-model FR-040): the catalog as OSCAL `inventory-item`s, and what is installed as an SPDX 2.3 document and a
 * CycloneDX 1.6 bill of materials, each with the SHA-256 of the artifact that was pinned; and the finding of a tool on the path that the catalog does not list (FR-033).
 *
 * @remarks
 * Pure: the identifiers are UUIDs of version 5 from the tool, its version and its system (the same catalog gives the same document), and the documents hold no clock: the caller gives the instant.
 * An SPDX package or CycloneDX component names a tool by its name and version and its hash, and a purl-free `pkg:generic` identifier.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/commons/ts/kernel";
import { uuidV5Of, NAMESPACE_URL, uuidUrn, type Uuid } from "../platform/k-uuid.ts";
import { unapprovedSeverity, type Finding } from "../findings.ts";
import { PROBES, type Probe } from "./probe.ts";
import { type Tool, type ToolCatalog, type ToolOs, type ToolArch, providedBy } from "./catalog.ts";

/** The namespace of the UUIDs of the catalog's items. */
const NAMESPACE = "https://intellectual-frontiers.github.io/.github/ergonex/tools";

/** One installed tool, as the install record of its folder says it. */
export type InstalledTool = {
  readonly name: string;
  readonly version: string;
  readonly os: ToolOs;
  readonly arch: ToolArch;
  readonly url: string;
  /** The SHA-256 of the pinned artifact. */
  readonly sha256: string;
};

/** An OSCAL inventory item of a tool of the catalog. */
export type OscalInventoryItem = {
  readonly uuid: Uuid;
  readonly description: string;
  readonly props: readonly {
    readonly name: string;
    readonly value: string;
    readonly ns?: string;
  }[];
};

/** The property namespace of the properties OSCAL has no name for. */
export const ERGONEX_NS = "https://intellectual-frontiers.github.io/.github/ergonex";

/** The catalog as OSCAL `inventory-item`s: one for each tool and each of its artifacts (the system and the architecture), with the pinned version, URL and hash as properties. */
export async function oscalInventoryItems(catalog: ToolCatalog): Promise<readonly OscalInventoryItem[]> {
  const items: OscalInventoryItem[] = [];
  for (const t of catalog.tools) {
    for (const a of t.artifacts) {
      items.push({
        uuid: await uuidV5Of(NAMESPACE_URL, [NAMESPACE, t.name, t.version, a.os, a.arch]),
        description: `${t.name} ${t.version} for ${a.os} ${a.arch}`,
        props: [
          { name: "asset-id", value: `${t.name}@${t.version}` },
          { name: "asset-type", value: "software" },
          { name: "version", value: t.version },
          { name: "operating-system", ns: ERGONEX_NS, value: a.os },
          { name: "architecture", ns: ERGONEX_NS, value: a.arch },
          { name: "download-url", ns: ERGONEX_NS, value: a.url },
          { name: "sha256", ns: ERGONEX_NS, value: a.sha256 },
        ],
      });
    }
  }
  return items;
}

/** The identifier of a tool as a Package URL of the generic type (`pkg:generic/name@version`). */
export function purlOf(name: string, version: string): string {
  return `pkg:generic/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

/** An SPDX 2.3 document of what is installed: one package for each tool, with its checksum, and the workspace's documentDescribes. */
export async function spdxDocument(
  installed: readonly InstalledTool[],
  at: string,
  workspace: string,
): Promise<Readonly<Record<string, unknown>>> {
  const id = await uuidV5Of(NAMESPACE_URL, [NAMESPACE, "spdx", workspace, at]);
  const packages = installed.map((t) => ({
    SPDXID: `SPDXRef-${t.name.replace(/[^A-Za-z0-9.-]/g, "-")}-${t.version.replace(/[^A-Za-z0-9.-]/g, "-")}`,
    name: t.name,
    versionInfo: t.version,
    downloadLocation: t.url,
    filesAnalyzed: false,
    checksums: [{ algorithm: "SHA256", checksumValue: t.sha256 }],
    licenseConcluded: "NOASSERTION",
    licenseDeclared: "NOASSERTION",
    copyrightText: "NOASSERTION",
    externalRefs: [
      {
        referenceCategory: "PACKAGE-MANAGER",
        referenceType: "purl",
        referenceLocator: purlOf(t.name, t.version),
      },
    ],
  }));
  return {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `ergonex tools of ${workspace}`,
    documentNamespace: `${NAMESPACE}/spdx/${id}`,
    creationInfo: { created: at, creators: ["Tool: ergonex"] },
    packages,
    documentDescribes: packages.map((p) => p.SPDXID),
  };
}

/** A CycloneDX 1.6 bill of materials of what is installed: one component of type `application` for each tool, with its hash and its Package URL. */
export async function cycloneDxDocument(
  installed: readonly InstalledTool[],
  at: string,
  workspace: string,
): Promise<Readonly<Record<string, unknown>>> {
  const id = await uuidV5Of(NAMESPACE_URL, [NAMESPACE, "cyclonedx", workspace, at]);
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: uuidUrn(id),
    version: 1,
    metadata: {
      timestamp: at,
      tools: { components: [{ type: "application", name: "ergonex" }] },
      component: { type: "application", name: workspace },
    },
    components: installed.map((t) => ({
      type: "application",
      name: t.name,
      version: t.version,
      "bom-ref": purlOf(t.name, t.version),
      purl: purlOf(t.name, t.version),
      hashes: [{ alg: "SHA-256", content: t.sha256 }],
      externalReferences: [{ type: "distribution", url: t.url }],
    })),
  };
}

/** The export forms of the catalog and the inventory. */
export type ExportFormat = "oscal" | "spdx" | "cyclonedx";

/** All the export forms. */
export const EXPORT_FORMATS: readonly ExportFormat[] = ["oscal", "spdx", "cyclonedx"];

/** An export form from its name, or undefined. */
export function exportFormatOf(text: string): ExportFormat | undefined {
  return EXPORT_FORMATS.find((f) => f === text);
}

/** The document of an export form: the OSCAL one holds the catalog, the SPDX and CycloneDX ones what is installed. */
export async function exportDocument(
  format: ExportFormat,
  catalog: ToolCatalog,
  installed: readonly InstalledTool[],
  at: string,
  workspace: string,
): Promise<Readonly<Record<string, unknown>>> {
  switch (format) {
    case "oscal":
      return { "inventory-items": await oscalInventoryItems(catalog) };
    case "spdx":
      return spdxDocument(installed, at, workspace);
    case "cyclonedx":
      return cycloneDxDocument(installed, at, workspace);
    default:
      return absurd(format);
  }
}

/** A tool found on the path or among the tools of the workspace, with the day it was first seen. */
export type SeenTool = { readonly name: string; readonly firstSeen: string };

/**
 * The finding of each tool found that the catalog does not list: informational from the day it is first seen and a warning once it is more than the grace days old (0002-workspace-model FR-033).
 * The tools that are probed (`git`, `bun`, `node`) are the user's own and are never outside the catalog.
 */
export function outsideCatalogFindings(
  catalog: ToolCatalog,
  seen: readonly SeenTool[],
  today: string,
  graceDays?: number,
): readonly Finding[] {
  const out: Finding[] = [];
  for (const s of seen) {
    if (PROBES.some((p) => p === s.name) || providedBy(catalog, s.name) !== undefined) continue;
    const severity = unapprovedSeverity(s.firstSeen, today, graceDays);
    out.push({
      ruleId: "ergonex/tool-outside-catalog",
      severity,
      message: `${s.name} is not in the tool catalog (first seen ${s.firstSeen}); add it to the catalog with a pinned version and hash within the grace period, or remove it${severity === "Warning" ? " (the grace period is over)" : ""}`,
      subject: s.name,
      firstSeen: s.firstSeen,
    });
  }
  return out;
}

/** The probes as a list of name and version for the inventory (the tools that are probed are in an inventory too, though never installed): ok probes only. */
export function probedInventory(probes: readonly Probe[]): readonly { readonly name: string; readonly version: string }[] {
  return probes.flatMap((p) => (p.kind === "ok" || p.kind === "too-old" ? [{ name: p.tool, version: p.version }] : []));
}

/** The tool of a catalog by its pinned name and version, as an inventory entry for an artifact of the system and architecture, or undefined where it pins none for them. */
export function installedOf(tool: Tool, os: ToolOs, arch: ToolArch): InstalledTool | undefined {
  const a = tool.artifacts.find((x) => x.os === os && x.arch === arch);
  return a === undefined
    ? undefined
    : {
        name: tool.name,
        version: tool.version,
        os,
        arch,
        url: a.url,
        sha256: a.sha256,
      };
}
