/**
 * Tests of the renditions of a built dossier (commons dossier 0002-dossier-core FR-013): each declared rendition made by the renderer given for it, and a refusal that names the one missing.
 *
 * @module
 */
import type { Renderer } from "@intellectual-frontiers/dossier/governance";
import { build, renditionsFor } from "@intellectual-frontiers/dossier/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { declaration, registry, sources as made } from "./fixtures.ts";

const built = async () => {
  const r = await build({ ...declaration("restricted"), renditions: ["adoc", "html"] }, registry, await made());
  if (r.kind === "err") throw new Error(r.error.message);
  return r.value;
};

proves(["0002-dossier-core FR-013"], "each declared rendition is made by the renderer given for it from the AsciiDoc, the title and the instant, and a missing renderer is refused by name", async () => {
  const b = await built();
  const seen: string[] = [];
  const html: Renderer = async (adoc, meta) => {
    seen.push(`${meta.title}|${meta.asOf}`);
    return new TextEncoder().encode(`<pre>${adoc.length}</pre>`);
  };
  const r = await renditionsFor(b, new Map([["html", html]]));
  assert(r.kind === "ok");
  assertEquals([...r.value.keys()], ["dossier.html"]);
  assertEquals(seen, [`${b.declaration.title}|${b.asOf}`]);
  const none = await renditionsFor(b, new Map());
  assert(none.kind === "err" && none.error.code === "E-DOSSIER-NO-RENDERER" && none.error.message.includes("html"));
});
