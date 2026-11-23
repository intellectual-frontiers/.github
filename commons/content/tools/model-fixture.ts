// Spec: 0001-content-collector FR-003
/** Write a synthetic bundle so CI records a public Kanon model check. @module */
import { ensureDir, writeTextFile } from "@intellectual-frontiers/system/fs";
import { assembleContent, collectChapter, contentBundle } from "../src/mod.ts";

const { claims } = collectChapter({
  id: "pilot/chapter", file: "fixture.adoc", audience: "reader",
  sourceNotes: "source | Synthetic measurement | https://example.org/measurement",
  blocks: [{ line: 1, text: "A synthetic claim. {{source}}", disclosure: "public" }],
}, "2026-11-22");
const observations = claims.map((claim) => ({ claim: claim.id, evidence: claim.evidence.map((source) => source.url), audit: claim.audit }));
const assembled = assembleContent("Kanon public fixture", claims, [
  { name: "web", observations },
  { name: "markdown", observations },
]);
if (claims.length !== 1 || assembled.kind === "err") throw new Error("The synthetic chapter did not produce the expected model.");
const bundle = await contentBundle(assembled.value.model);
const dir = "dist/kanon-proof";
await ensureDir(dir);
for (const [path, text] of bundle.files) await writeTextFile(`${dir}/${path}`, text);
await writeTextFile(`${dir}/manifest.json`, bundle.manifest);
