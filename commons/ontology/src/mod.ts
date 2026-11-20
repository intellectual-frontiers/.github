/**
 * The ontologies of Intellectual Frontiers Commons (commons 0012-ontology), each a namespace: Mizan (`mizan`), IFCCM (`ifccm`), IFQS (`ifqs`), IFR (`ifr`), and the audit of packaging (`audit`). The software supply chain
 * is `./supply-chain/packaging`. Each is also an entry of its own, with the modules it is made of.
 *
 * @module
 */
export * as mizan from "./mizan/mod.ts";
export * as ifccm from "./ifccm/mod.ts";
export * as ifqs from "./ifqs/mod.ts";
export * as ifr from "./ifr/mod.ts";
export * as audit from "./audit/mod.ts";
