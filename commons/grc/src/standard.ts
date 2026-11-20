// Spec: 0001-grc-layers FR-007
/**
 * The registries of the extensions this library ships: the root, which is the one place that knows every unit by name. `standardSerializers` and `standardSigners` register what has no need of the
 * host; `standardRunners` registers a runner for each piece the host gives (a connection, a reader, a client, a remote), so that a host without a database has no `sql` runner and says so.
 *
 * @example
 * ```ts
 * import { standardSerializers } from "./standard.ts";
 * standardSerializers().list().map((s) => s.id); // ["cyclonedx", "intoto", "ocsf", "oscal", "sarif"]
 * ```
 *
 * @module
 */
import { createSerializers, type Serializers } from "./logical/mod.ts";
import { createRunners, createSigners, type Runners, type Signers } from "./physical/mod.ts";
import { apiRunner, type ApiClient } from "./runners/api/mod.ts";
import { externalRunner, type Evaluators } from "./runners/external/mod.ts";
import { fileRunner, type FileReader } from "./runners/file/mod.ts";
import { manualRunner } from "./runners/manual/mod.ts";
import { remoteRunner, type Remote } from "./runners/remote/mod.ts";
import { sqlRunner, type SqlConnection } from "./runners/sql/mod.ts";
import { cyclonedx } from "./serializers/cyclonedx/mod.ts";
import { intoto } from "./serializers/intoto/mod.ts";
import { ocsf } from "./serializers/ocsf/mod.ts";
import { oscal } from "./serializers/oscal/mod.ts";
import { sarif } from "./serializers/sarif/mod.ts";
import { dsseSigner } from "./signers/dsse/mod.ts";
import type { EvidencePolicy } from "./governance/mod.ts";
import type { Attestation } from "./logical/mod.ts";

/** The serializers this library ships, registered. */
export function standardSerializers(): Serializers {
  const r = createSerializers();
  for (const s of [oscal, ocsf, sarif, cyclonedx, intoto]) r.register(s);
  return r;
}

/** The signers this library ships, registered. */
export function standardSigners(): Signers {
  const r = createSigners();
  r.register(dsseSigner);
  return r;
}

/** What a host gives: each piece is optional, and a runner is registered for each that is given. */
export type RunnerHost = {
  readonly sql?: SqlConnection;
  readonly file?: FileReader;
  readonly api?: ApiClient;
  readonly remote?: Remote;
  /** The attestations that exist and the evidence policy: the `manual` runner. */
  readonly manual?: { readonly attestations: () => readonly Attestation[]; readonly policy: EvidencePolicy };
  readonly evaluators?: Evaluators;
};

/** The runners for what the host gives. */
export function standardRunners(host: RunnerHost): Runners {
  const r = createRunners();
  if (host.sql !== undefined) r.register(sqlRunner(host.sql));
  if (host.file !== undefined) r.register(fileRunner(host.file));
  if (host.api !== undefined) r.register(apiRunner(host.api));
  if (host.remote !== undefined) r.register(remoteRunner(host.remote));
  if (host.manual !== undefined) r.register(manualRunner(host.manual.attestations, host.manual.policy));
  if (host.evaluators !== undefined) r.register(externalRunner(host.evaluators));
  return r;
}
