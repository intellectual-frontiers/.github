// Spec: 0046-arcactl FR-002
/**
 * The configuration of `arcactl` and the models it knows (commons data 0046-arcactl FR-002): `arca.config.ts` is a TypeScript file that default-exports `defineArca({...})`, so the compiler checks it,
 * and holds no secret. The arca family is the party model, the tenancy model and the identity models; the issues model is available to it but is not of the family. A project names the models it
 * wants and the modules they require come with them.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { type ComposeError, composeModules, type Domain, type Module, moduleOf, withRequired } from "@intellectual-frontiers/data/governance";
import { partyDomain } from "@intellectual-frontiers/data/models/arca";
import { tenancyModule } from "@intellectual-frontiers/data/models/arca-tenancy";
import { identityModule } from "@intellectual-frontiers/data/models/identity";
import { identityAbacModule } from "@intellectual-frontiers/data/models/identity-abac";
import { identityAccessModule } from "@intellectual-frontiers/data/models/identity-access";
import { identityAgentModule } from "@intellectual-frontiers/data/models/identity-agent";
import { identityDelegationModule } from "@intellectual-frontiers/data/models/identity-delegation";
import { identityDeviceModule } from "@intellectual-frontiers/data/models/identity-device";
import { identityMachineModule } from "@intellectual-frontiers/data/models/identity-machine";
import { identityPkiModule } from "@intellectual-frontiers/data/models/identity-pki";
import { identityRebacModule } from "@intellectual-frontiers/data/models/identity-rebac";
import { issuesModule } from "@intellectual-frontiers/data/models/issues";
import { projectDomain, type LogicalSchema } from "@intellectual-frontiers/data/sql/logical";

/** What a project says of its arca database. */
export interface ArcaConfig {
  /** The schema the tables are in; `arca` by default. */
  readonly schema?: string;
  /** The models wanted, by name; what they require comes with them. */
  readonly models: readonly ModelName[];
  /** Whether the invariants are in the database (append-only, chains, status moves); on by default. */
  readonly invariants?: boolean;
  /** Whether the guard against weakening them is expected (PostgreSQL's event triggers); on by default. */
  readonly guard?: boolean;
  /** Whether the scope of row security is sealed (`accessSource({ seal })`); off by default. */
  readonly seal?: boolean;
  /** What to do with what is in the database and not in the model. */
  readonly unmanaged?: "drop" | "hold";
  /** The ledger's table; `lifecycle_ledger` by default. */
  readonly ledgerTable?: string;
}

/** The models of the arca family, and the issues model. */
export const modelNames = [
  "arcaParty",
  "arcaTenancy",
  "identity",
  "identityAccess",
  "identityAbac",
  "identityRebac",
  "identityPki",
  "identityMachine",
  "identityDevice",
  "identityDelegation",
  "identityAgent",
  "issues",
] as const;
export type ModelName = (typeof modelNames)[number];

/** The configuration, as the compiler checks it. */
export const defineArca = (config: ArcaConfig): ArcaConfig => Object.freeze({ ...config, models: Object.freeze([...config.models]) });

/** The configuration with every default filled. */
export interface Arca {
  readonly schema: string;
  readonly models: readonly ModelName[];
  readonly invariants: boolean;
  readonly guard: boolean;
  readonly seal: boolean;
  readonly unmanaged: "drop" | "hold";
  readonly ledgerTable: string;
}

/** What is wrong with a configuration. */
export type ConfigError = { readonly kind: "model"; readonly name: string } | { readonly kind: "schema"; readonly name: string } | { readonly kind: "compose"; readonly errors: readonly ComposeError[] } | { readonly kind: "project"; readonly why: string };

/** The configuration with its defaults, or what is wrong with it. */
export function settingsOf(given: ArcaConfig): Result<Arca, readonly ConfigError[]> {
  const errors: ConfigError[] = [];
  for (const m of given.models) if (!(modelNames as readonly string[]).includes(m)) errors.push({ kind: "model", name: m });
  const schema = given.schema ?? "arca";
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) errors.push({ kind: "schema", name: schema });
  if (given.models.length === 0) errors.push({ kind: "model", name: "(none)" });
  if (errors.length > 0) return err(errors);
  return ok({
    schema,
    models: given.models,
    invariants: given.invariants ?? true,
    guard: given.guard ?? true,
    seal: given.seal ?? false,
    unmanaged: given.unmanaged ?? "drop",
    ledgerTable: given.ledgerTable ?? "lifecycle_ledger",
  });
}

const party = (): Module => {
  if (partyDomain.kind === "err") throw new Error("the party model is not valid");
  return moduleOf(partyDomain.value);
};

/** Every model of the family, as a module. */
export const allModules = (): readonly Module[] => [
  party(),
  tenancyModule,
  identityModule,
  identityAccessModule,
  identityAbacModule,
  identityRebacModule,
  identityPkiModule,
  identityMachineModule,
  identityDeviceModule,
  identityDelegationModule,
  identityAgentModule,
  issuesModule,
];

/** The domain of the models a configuration wants, with what they require, and its logical schema. */
export function schemaOf(config: Arca): Result<{ readonly domain: Domain; readonly schema: LogicalSchema }, readonly ConfigError[]> {
  const picked = withRequired(allModules(), config.models);
  if (picked.kind === "err") return err([{ kind: "compose", errors: picked.error }]);
  const domain = composeModules("arca", {}, picked.value);
  if (domain.kind === "err") return err([{ kind: "compose", errors: domain.error }]);
  const projected = projectDomain(domain.value);
  if (projected.kind === "err") return err([{ kind: "project", why: JSON.stringify(projected.error).slice(0, 300) }]);
  return ok({ domain: domain.value, schema: projected.value.schema });
}

/** Reads `arca.config.ts`: the file's default export, which `defineArca` made. */
export async function loadConfig(path: string): Promise<Result<ArcaConfig, string>> {
  try {
    const mod = (await import(path)) as { default?: ArcaConfig };
    return mod.default === undefined ? err(`${path} has no default export: write \`export default defineArca({...})\``) : ok(mod.default);
  } catch (thrown) {
    return err(`${path} could not be read: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
  }
}
