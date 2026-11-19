// Spec: 0030-identity FR-001
/**
 * The identity model as a module (commons data 0030-identity): who may do what and how they prove it, for a business that serves businesses and the consumers of those businesses. It requires the
 * party model and the tenancy model. A project that wants it lists `identityModule` with those two to `composeModules`.
 *
 * @module
 */
import { defineModule } from "@intellectual-frontiers/data/governance";
import * as codes from "./codes.ts";
import { concepts } from "./concepts.ts";

export * from "./codes.ts";
export * from "./concepts.ts";
export * from "./kit.ts";

/** The identity module: principals and accounts, authorization, credentials, sessions, invitations, domains, policies and audit. */
export const identityModule = defineModule({
  name: "identity",
  definition: "Who may do what, and how they prove it",
  requires: ["arcaParty", "arcaTenancy"],
  concepts,
  codeLists: Object.values(codes),
});
