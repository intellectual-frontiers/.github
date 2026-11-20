// Spec: 0033-identity-access FR-001
/**
 * Role-based access as a module (commons data 0033-identity-access): permissions, roles with inheritance, separation of duties, role assignments for every kind of principal, and entitlements.
 * It requires the identity core.
 *
 * @module
 */
import { defineModule } from "@intellectual-frontiers/data/governance";
import * as codes from "./codes.ts";
import { concepts } from "./concepts.ts";

export * from "./codes.ts";
export * from "./concepts.ts";

/** Role-based access for every kind of principal. */
export const identityAccessModule = defineModule({
  name: "identityAccess",
  definition: "Role-based access for every kind of principal",
  requires: ["identity"],
  concepts,
  codeLists: Object.values(codes),
});
