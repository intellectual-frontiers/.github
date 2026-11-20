// Spec: 0001-integrations-github-connector FR-001, FR-002, FR-003, FR-004
/**
 * The reference connector of Integrations for one organization of a code host's cloud service (commons integrations-github 0001-integrations-github-connector): read-only,
 * with governance as data, the posture of the organization (two-factor requirement, public repositories, repositories), the repositories as records and entities and the
 * administrators as accounts. It is written against the `ReadPort` of Integrations and so cannot write, and it names a vendor, which the core of Integrations never does.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import {
  cadence,
  credentialSpec,
  denylistWith,
  parseConnectorId,
  parseCredentialRef,
  type ConnectorGovernance,
} from "@intellectual-frontiers/integrations/governance";
import {
  defineConnector,
  flagOf,
  gapOf,
  fromReadFailure,
  isObject,
  textOf,
  type Account,
  type Connector,
  type DefinitionError,
  type Gap,
  type Json,
  type ObservedRecord,
  type PosturePolicy,
  type ReadPort,
  type Repository,
} from "@intellectual-frontiers/integrations/logical";
import type { Result } from "@intellectual-frontiers/core";

/** The API's host, which the transport policy names. */
export const HOST = "api.github.com";

/** The posture policies of the organization, as data of GRC's vocabulary; the control urns are the consumer's to attach. */
export const POLICIES: readonly PosturePolicy[] = [
  { id: "org-two-factor-required", title: "The organization requires two-factor authentication", fact: "two-factor-required", want: { kind: "equals", value: true }, severity: "high", onMiss: "fail", controls: [], fix: "Require two-factor authentication in the organization's authentication security settings." },
  { id: "org-no-public-repositories", title: "The organization has no public repository", fact: "public-repositories", want: { kind: "every", field: "value", op: "le", value: 0 }, severity: "medium", onMiss: "warn", controls: [], fix: "Make the public repositories private, or record why they are public." },
  { id: "org-has-repositories", title: "The organization has repositories to observe", fact: "repositories", want: { kind: "non-empty" }, severity: "low", onMiss: "warn", controls: [], fix: "Check that the token reaches the repositories of the organization." },
];

/** Why the connector cannot be made. */
export type GithubError = { readonly kind: "id"; readonly what: string } | DefinitionError;

/** The governance of the connector for `org`: read-only scopes, a daily cadence, its entities, the generic denylist and HTTPS to the API's host with the system roots. */
export function governanceFor(org: string): Result<ConnectorGovernance, GithubError> {
  const id = parseConnectorId("github-org");
  const ref = parseCredentialRef(`vault://github/${org.toLowerCase()}-read`);
  const cad = cadence("1d");
  if (id.kind === "err" || ref.kind === "err" || cad.kind === "err") return err({ kind: "id", what: "github-org or the credential reference of the organization" });
  const spec = credentialSpec(ref.value, [{ name: "token", secret: true, hint: "A fine-grained token with read-only access to the organization's metadata, members and administration." }]);
  if (spec.kind === "err") return err({ kind: "id", what: "the credential spec" });
  return ok({
    id: id.value,
    title: "GitHub organization posture",
    class: "code-host",
    labels: { serviceModels: ["SaaS"], categories: ["source-control"] },
    contract: { writes: "never", tokenEndpoints: [] },
    credential: spec.value,
    scope: { grants: [{ resource: `orgs/${org}`, access: "read" }, { resource: `orgs/${org}/members`, access: "read" }, { resource: `orgs/${org}/repos`, access: "read" }] },
    cadence: cad.value,
    entities: ["repository", "account"],
    denylist: denylistWith([]),
    transport: { kind: "https", hosts: [HOST], tls: { kind: "system-roots" } },
  });
}

async function all(port: ReadPort, path: string): Promise<Result<readonly Json[], Gap | "failed">> {
  const items: Json[] = [];
  const g = port.pages(path);
  for (;;) {
    const n = await g.next();
    if (n.done === true) {
      if (n.value.kind === "err") {
        const gap = gapOf(fromReadFailure(n.value.error));
        return err(gap ?? "failed");
      }
      return ok(items);
    }
    items.push(n.value);
  }
}

/** The connector for one organization, or why it cannot be made. */
export function githubConnector(org: string): Result<Connector, GithubError> {
  const g = governanceFor(org);
  if (g.kind === "err") return g;
  return defineConnector({
    governance: g.value,
    policies: POLICIES,
    probe: async ({ port }) => {
      const o = await port.get(`/orgs/${org}`);
      return o.kind === "ok" ? ok({ reachable: true as const, account: textOf(o.value, "login") ?? org }) : err(fromReadFailure(o.error));
    },
    observe: async ({ port, now }) => {
      const o = await port.get(`/orgs/${org}`);
      if (o.kind === "err") return err(fromReadFailure(o.error));
      const gaps: Gap[] = [];
      const repos = await all(port, `/orgs/${org}/repos?per_page=100`);
      const admins = await all(port, `/orgs/${org}/members?role=admin&per_page=100`);
      const repoList: readonly Json[] = repos.kind === "ok" ? repos.value : [];
      const adminList: readonly Json[] = admins.kind === "ok" ? admins.value : [];
      if (repos.kind === "err") {
        if (repos.error === "failed") return err({ kind: "transport", subject: `/orgs/${org}/repos`, failure: "network" });
        gaps.push(repos.error);
      }
      if (admins.kind === "err" && admins.error !== "failed") gaps.push(admins.error);
      const named = repoList.filter(isObject).map((r) => ({ name: textOf(r, "name") ?? "?", private: flagOf(r, "private") ?? true, archived: flagOf(r, "archived") ?? false, branch: textOf(r, "default_branch") ?? "" }));
      const records: ObservedRecord[] = named.map((r) => ({ label: "code_repository", ocsf_class_uid: 5001, native_id: r.name, display_name: r.name, props: { private: r.private, archived: r.archived, default_branch: r.branch } }));
      const repositories: Repository[] = named.map((r) => ({ system: "github", name: r.name, private: r.private }));
      const accounts: Account[] = adminList.filter(isObject).map((a) => ({ system: "github", id: textOf(a, "login") ?? "?", name: textOf(a, "login") ?? "?", active: true, admin: true }));
      const twoFactor = flagOf(o.value, "two_factor_requirement_enabled");
      return ok({
        at: now,
        provider: "github-org",
        account: org,
        assets: named.map((r) => ({ kind: "repository", id: r.name, name: r.name })),
        posture: { ...(twoFactor === undefined ? {} : { "two-factor-required": twoFactor }), repositories: named.length, "public-repositories": named.filter((r) => !r.private).length },
        gaps,
        entities: { repositories, accounts },
        records,
      });
    },
  });
}
