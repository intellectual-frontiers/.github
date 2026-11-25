# Plan: 0001-workload-layers

**Spec:** 0001-workload-layers. **Written:** 2026-11-25.

## Standards considered

None beyond the ones this library's other specifications name: this specification is about the layout of the library. The layers are Kanon (commons 0033-kanon), read in this repository.

## What is built and what is reused

Reused: the layer table and the shape of `commons/workbench` (manifest, `tools/pack.ts`, `tools/check.ts`, `tools/pages.ts`, the suite and the trace baseline, the instances of a unit for the dialects). New: the units of this library's own code. The order is the order of the specifications: the specs and the vocabularies first, the core, the shared logical layer, the forms, the physical layer.
