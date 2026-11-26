/**
 * The libraries by family (commons 0001-docs FR-043, 0027-commons-libraries FR-027): a host with its extensions, the named groups of libraries of no host, the host first, and a library of neither not listed.
 *
 * @module
 */
import { assertEquals, proves } from "@intellectual-frontiers/test";
import { CONFIG, siteOnce } from "./helpers.ts";

import { familiesOf, nestLibraries } from "../src/pages/families.ts";

proves(["0001-docs FR-043", "0027-commons-libraries FR-027"], "libraries are listed under the host of their family or the group of their manifest, the host first, and a library of neither is not listed", () => {
  const families = familiesOf([
    { slug: "anyfs-s3", title: "AnyFS S3", family: "anyfs", role: "plugin" },
    { slug: "anyfs", title: "AnyFS", family: "anyfs", role: "host" },
    { slug: "anyfs-git", title: "AnyFS Git", family: "anyfs", role: "plugin" },
    { slug: "catalog-soc2", title: "Catalog Soc2", family: "catalogs", role: "member" },
    { slug: "catalog-nist-sp800", title: "Catalog Nist Sp800", family: "catalogs", role: "member" },
    { slug: "core", title: "Core" },
  ]);
  assertEquals(
    families.map((f) => [f.key, f.title, f.members.map((m) => m.slug)]),
    [
      ["anyfs", "AnyFS", ["anyfs", "anyfs-git", "anyfs-s3"]],
      ["catalogs", "Catalogs", ["catalog-nist-sp800", "catalog-soc2"]],
    ],
  );
});

proves(["0001-docs FR-044"], "a family is one folder of the navigation: its host with its extensions beneath, under their short names, and a group of no host has a page of its own", () => {
  const { placements, groupPages } = nestLibraries([
    { slug: "anyfs", title: "AnyFS", family: "anyfs", role: "host" },
    { slug: "anyfs-bridge", title: "AnyFS Bridge", family: "anyfs", role: "plugin" },
    { slug: "anyfs-cli", title: "AnyFS command line", family: "anyfs", role: "plugin" },
    { slug: "desired-os-state", title: "Desired OS State", family: "desired-os-state", role: "host" },
    { slug: "desired-os-state-dns", title: "Desired OS State plugin: dns", family: "desired-os-state", role: "plugin" },
    { slug: "desired-os-state-ansible", title: "Desired OS State dialect: Ansible", family: "desired-os-state", role: "dialect" },
    { slug: "catalog-soc2", title: "Catalog Soc2", family: "catalogs", role: "member" },
    { slug: "catalog-nist-sp800", title: "Catalog Nist Sp800", family: "catalogs", role: "member" },
    { slug: "lonely", title: "Lonely", family: "lonely", role: "member" },
    { slug: "core", title: "Core" },
  ]);
  assertEquals(placements.get("anyfs-bridge"), { parent: "anyfs", navTitle: "Bridge", navKind: "Plugins" });
  assertEquals(placements.get("anyfs-cli")?.navTitle, "Command line");
  assertEquals(placements.get("desired-os-state-dns"), { parent: "desired-os-state", navTitle: "Dns", navKind: "Plugins" });
  assertEquals(placements.get("desired-os-state-ansible"), { parent: "desired-os-state", navTitle: "Ansible", navKind: "Dialects" });
  assertEquals(placements.get("catalog-soc2")?.parent, "group:catalogs");
  assertEquals(groupPages, [{ key: "catalogs", title: "Catalogs" }]);
  assertEquals(placements.has("anyfs"), false, "a host is the page of its folder");
  assertEquals(placements.has("lonely"), false, "a group of one library is not a folder");
  assertEquals(placements.has("core"), false);
});

proves(["0001-docs FR-044"], "in the navigation of the real site no two libraries of one family are flat siblings", async () => {
  const built = await siteOnce();
  const byKey = new Map<string, string[]>();
  for (const p of CONFIG.packages) {
    const fact = p.about !== undefined && typeof p.about === "object" && p.about.kind === "value" ? p.about.value.facts?.find((f) => f.label === "Family")?.value.replace(/`/g, "") : undefined;
    if (fact !== undefined) byKey.set(fact, [...(byKey.get(fact) ?? []), p.slug]);
  }
  const flat: string[] = [];
  for (const [key, slugs] of byKey) {
    if (slugs.length < 2) continue;
    const pages = slugs.map((s) => built.pages.find((pg) => pg.path === `overview/${s}.html`)).filter((pg) => pg !== undefined);
    const roots = pages.filter((pg) => pg.parent === undefined);
    if (roots.length > 1) flat.push(`${key}: ${roots.map((r) => r.path).join(", ")}`);
  }
  assertEquals(flat, [], "the libraries of a family that stand side by side in the navigation");
});

proves(["0001-docs FR-044"], "in the navigation of every section no two libraries of one family are flat siblings", async () => {
  const built = await siteOnce();
  const members = new Map<string, string[]>();
  for (const p of CONFIG.packages) {
    const fact = p.about !== undefined && typeof p.about === "object" && p.about.kind === "value" ? p.about.value.facts?.find((f) => f.label === "Family")?.value.replace(/`/g, "") : undefined;
    if (fact !== undefined) members.set(fact, [...(members.get(fact) ?? []), p.slug]);
  }
  const sections = [...new Set(built.pages.map((pg) => pg.path.split("/")[0] ?? ""))].filter((s) => s !== "");
  const flat: string[] = [];
  for (const section of sections)
    for (const [key, slugs] of members) {
      if (slugs.length < 2) continue;
      const pages = slugs.map((s) => built.pages.find((pg) => pg.path === `${section}/${s}.html`)).filter((pg) => pg !== undefined);
      const roots = pages.filter((pg) => pg.parent === undefined);
      if (roots.length > 1) flat.push(`${section}, ${key}: ${roots.map((r) => r.path).join(", ")}`);
    }
  assertEquals(flat, [], "the libraries of a family that stand side by side in the navigation of a section");
});
