/**
 * The libraries by family (commons 0001-docs FR-043, 0027-commons-libraries FR-027): a host with its extensions, the named groups of libraries of no host, the host first, and a library of neither not listed.
 *
 * @module
 */
import { assertEquals, proves } from "@intellectual-frontiers/test";
import { familiesOf } from "../src/pages/families.ts";

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
