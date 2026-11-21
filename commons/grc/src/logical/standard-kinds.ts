// Spec: 0004-grc-documents FR-001, FR-002
/**
 * The registry of every kind of document of this library: the one a reader is given.
 *
 * @example
 * ```ts
 * import { standardKinds } from "./standard-kinds.ts";
 * standardKinds().has("grc.result"); // true
 * ```
 *
 * @module
 */
import {
  catalogPackage,
  check,
  controlScope,
  createKinds,
  crosswalk,
  entityGroup,
  evidencePolicy,
  exception,
  framework,
  policy,
  requirement,
  type Kinds,
} from "@intellectual-frontiers/grc/governance";
import { entitySnapshot } from "./group.ts";
import { assessment, attestation, evidence, evidenceManifest, finding, ledgerEntry, result, risk } from "./kinds.ts";

/** The registry of every kind of document of this library: the one a reader is given. */
export function standardKinds(): Kinds {
  const kinds = createKinds();
  for (const k of [
    catalogPackage,
    framework,
    crosswalk,
    policy,
    check,
    requirement,
    evidencePolicy,
    exception,
    result,
    finding,
    evidence,
    attestation,
    risk,
    assessment,
    ledgerEntry,
    evidenceManifest,
    entityGroup,
    controlScope,
    entitySnapshot,
  ]) {
    kinds.register(k);
  }
  return kinds;
}
