# Plan: 0001-runbooks-layers

**Spec:** 0001-runbooks-layers. **Written:** 2026-11-25.

## Standards considered

None beyond the ones this library's other specifications name: this specification is about the layout of the library. The layers are Kanon (commons 0033-kanon), read in this repository.

## What is built and what is reused

Reused: the layer table and the shape of `commons/workbench` (manifest, `tools/pack.ts`, `tools/check.ts`, `tools/pages.ts`, the suite and the trace baseline). New: the nine units of this library's own code. The order is the order of the specifications: the specs and the vocabularies first (R0), governance (R1), logical (R2), physical (R3).
