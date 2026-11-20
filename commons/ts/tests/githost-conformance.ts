/**
 * The conformance tests the three Git host adapters share (commons 0020-ifccm FR-039): one function that asks a `GitHostClient` the same questions whatever host is behind it, and
 * holds the answers to the contract of `githost/types.ts`. The interface is not fixed until GitHub, GitLab and plain Git pass all of them.
 *
 * @module
 */
import { CAPABILITIES } from "../githost/capabilities.ts";
import type { Capability, GitHostClient, HostResult, RepoRef } from "../githost/types.ts";
import { assert, assertEquals } from "@intellectual-frontiers/test";

/** What a conformance run needs to know of the host behind a client. */
export type ConformanceFixture = {
  readonly client: GitHostClient;
  /** A repository that exists and that the client may read. */
  readonly existing: RepoRef;
  /** The default branch the host says `existing` has. */
  readonly defaultBranch: string;
  /** A repository that does not exist. */
  readonly missing: RepoRef;
  /** A repository path of three segments: it is read where the host has nested groups, and unsupported where it has not. */
  readonly deep: RepoRef;
  /** A commit of `existing` that is signed and verified, and one that is not signed. */
  readonly signed: string;
  readonly unsigned: string;
  /** What the client was given that must never be said in an answer: a token. */
  readonly secrets: readonly string[];
};

/** The answer's failure kind, or `ok`. */
const kindOf = <T>(r: HostResult<T>): string => (r.kind === "ok" ? "ok" : r.error.kind);

/** Holds a client to the contract; every assertion names the host it was made on. */
export async function conformance(f: ConformanceFixture): Promise<void> {
  const { client } = f;
  const at = (what: string): string => `${client.kind}: ${what}`;
  const answers: unknown[] = [];

  // the capabilities are the kind's, and the four common ones are always there
  assertEquals([...client.capabilities].sort(), [...CAPABILITIES[client.kind]].sort(), at("capabilities"));
  for (const c of ["CloneUrl", "Credentials", "DefaultBranch", "SignedCommits"] as const)
    assert(client.capabilities.has(c), at(`offers ${c}`));

  // the common capabilities: the repository, its default branch and clone URL
  const repo = await client.repository(f.existing);
  answers.push(repo);
  assertEquals(repo.kind, "ok", at("repository"));
  if (repo.kind === "ok") {
    assertEquals(repo.value.ref, f.existing, at("the reference is the one asked"));
    assertEquals(repo.value.defaultBranch, f.defaultBranch, at("default branch"));
    assert(/^https?:\/\/[^@/]+\//.test(repo.value.cloneUrl), at(`a clone URL with no credential: ${repo.value.cloneUrl}`));
    assert(["public", "private", "internal", "unknown"].includes(repo.value.visibility), at("visibility"));
  }

  // a repository that is not there is not found (or, for a private one, unauthorized: never ok, never a throw)
  const missing = await client.repository(f.missing);
  answers.push(missing);
  assert(kindOf(missing) === "not-found" || kindOf(missing) === "unauthorized", at(`a missing repository is ${kindOf(missing)}`));

  // a capability a kind lacks is `unsupported`, naming the host and the capability, and a capability it has is never
  const expectations: readonly (readonly [Capability, () => Promise<HostResult<unknown>>])[] = [
    ["Issues", () => client.issue(f.existing, 1)],
    ["ChangeRequests", () => client.changeRequest(f.existing, 1)],
    ["ProtectedBranches", () => client.branchProtection(f.existing, f.defaultBranch)],
  ];
  for (const [capability, call] of expectations) {
    const r = await call();
    answers.push(r);
    if (client.capabilities.has(capability))
      assert(kindOf(r) !== "unsupported", at(`${capability} is offered and was answered unsupported`));
    else
      assertEquals(
        r,
        { kind: "err", error: { kind: "unsupported", capability, host: client.kind } },
        at(`${capability} is unsupported, naming both`),
      );
  }

  // nested groups
  const deep = await client.repository(f.deep);
  answers.push(deep);
  if (client.capabilities.has("NestedGroups")) assertEquals(deep.kind, "ok", at("a nested path is read"));
  else
    assertEquals(
      deep,
      { kind: "err", error: { kind: "unsupported", capability: "NestedGroups", host: client.kind } },
      at("a nested path is unsupported"),
    );

  // whether a signature verifies
  const signed = await client.commitVerified(f.existing, f.signed);
  const unsigned = await client.commitVerified(f.existing, f.unsigned);
  answers.push(signed, unsigned);
  assertEquals(signed, { kind: "ok", value: true }, at("a signed commit is verified"));
  assertEquals(unsigned, { kind: "ok", value: false }, at("an unsigned commit is not"));

  // no answer says a credential
  const said = JSON.stringify(answers) + JSON.stringify(Object.entries(client));
  for (const s of f.secrets) assert(!said.includes(s), at("a credential is in an answer or in the client"));
}
