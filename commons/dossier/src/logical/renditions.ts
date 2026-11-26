// Spec: 0002-dossier-core FR-013
/**
 * The renditions of a built dossier (0002-dossier-core FR-013): each rendition a dossier declares, other than its AsciiDoc, made by the renderer the product gives for it, or a refusal that names the one missing.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { RENDITION_FILES, type Built, type BuildError, type Renderer } from "@intellectual-frontiers/dossier/governance";

/** The renditions a built dossier declares, by file name: the bytes of each, in the order the dossier declares them. */
export async function renditionsFor(b: Built, renderers: ReadonlyMap<keyof typeof RENDITION_FILES, Renderer>): Promise<Result<ReadonlyMap<string, Uint8Array>, BuildError>> {
  const out = new Map<string, Uint8Array>();
  for (const name of b.declaration.renditions) {
    if (name === "adoc") continue;
    const render = renderers.get(name);
    if (render === undefined) return err({ code: "E-DOSSIER-NO-RENDERER", message: `the dossier declares the rendition ${name}, and no renderer for it was given` });
    out.set(RENDITION_FILES[name], await render(b.adoc, { title: b.declaration.title, asOf: b.asOf }));
  }
  return ok(out);
}
