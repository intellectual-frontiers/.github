/**
 * What the tests stand a store on: a repository of Git in memory behind the fake of GitHub's API or of GitLab's, a token the host accepts, and the stores opened on it as a caller opens them (by a place and a token), so that a contract
 * is held on both hosts by the same code.
 *
 * @module
 */
import { parsePlace } from "@intellectual-frontiers/anyfs/governance";
import {
  type GithubPlace,
  type GitlabPlace,
  type HostStore,
  type OpenedHost,
  openGithubStore,
  openGitlabStore,
  parseIdentity,
  staticToken,
  type Subject,
  type TokenSource,
} from "../src/mod.ts";
import { FakeRepo } from "./fake-git.ts";
import { fakeGithub, type FakeGithub, type Seen } from "./fake-github.ts";
import { fakeGitlab, type FakeGitlab } from "./fake-gitlab.ts";

export const TOKEN = "test-token-0123456789abcdef";

const who = parseIdentity("Fleet Writer", "fleet@example.test");
if (who.kind === "err") throw new Error(who.error);
export const AUTHOR = who.value;

export const tokenSource: TokenSource = (() => {
  const t = staticToken(TOKEN);
  if (t.kind === "err") throw new Error(t.error);
  return t.value;
})();

/** What a test may ask of the store it opens. */
export type OpenOptions = {
  readonly ref?: string | null;
  readonly prefix?: string;
  readonly createFrom?: string;
  readonly maxObjectBytes?: number;
  readonly attempts?: number;
  readonly token?: TokenSource;
  readonly subject?: Subject;
  readonly clock?: () => number;
};

/** A host with a repository behind it, and how to open stores on it. */
export type Rig = {
  readonly label: "github" | "gitlab";
  readonly repo: FakeRepo;
  readonly seen: Seen[];
  readonly fake: FakeGithub | FakeGitlab;
  /** Whether a host-side hook runs between a writer reading and writing. */
  hookBeforeWrite(f: (() => void) | undefined): void;
  setToken(t: string | undefined): void;
  /** Whether the token may push. */
  setPush(allowed: boolean): void;
  count(method: string, startsWith: string): number;
  open(options?: OpenOptions): Promise<OpenedHost>;
  /** The store, which must be one that may be written. */
  writable(options?: OpenOptions): Promise<HostStore>;
  /** The result of opening, as it is. */
  tryOpen(options?: OpenOptions): ReturnType<typeof openGithubStore>;
};

const placeOf = (label: Rig["label"], options: OpenOptions): GithubPlace | GitlabPlace => {
  const ref = options.ref === null ? "" : `@${options.ref ?? "main"}`;
  const text = label === "github" ? `github://acme/fleet${ref}${options.prefix === undefined ? "" : `/${options.prefix}`}` : `gitlab://gitlab.example.test/acme/ops/fleet${ref}${options.prefix === undefined ? "" : `/${options.prefix}`}`;
  const p = parsePlace(text);
  if (p.kind === "err" || (p.value.kind !== "github" && p.value.kind !== "gitlab")) throw new Error(`not a place: ${text}`);
  return p.value;
};

const common = (options: OpenOptions) => ({
  token: options.token ?? tokenSource,
  commit: { author: AUTHOR, ...(options.subject === undefined ? {} : { subject: options.subject }), ...(options.clock === undefined ? {} : { clock: options.clock }) },
  ...(options.createFrom === undefined ? {} : { createFrom: options.createFrom }),
  ...(options.maxObjectBytes === undefined ? {} : { maxObjectBytes: options.maxObjectBytes }),
  ...(options.attempts === undefined ? {} : { attempts: options.attempts }),
});

/** A repository with a first commit on `main`, behind the fake of a host. */
export function rig(label: Rig["label"], files: Readonly<Record<string, string>> = { "README.md": "fleet\n" }): Rig {
  const repo = new FakeRepo();
  repo.seed(files, "main");
  const fake = label === "github" ? fakeGithub(repo) : fakeGitlab(repo);
  fake.knobs.token = TOKEN;
  const tryOpen: Rig["tryOpen"] = (options = {}) => {
    const place = placeOf(label, options);
    const rest = common(options);
    return label === "github"
      ? openGithubStore({ ...rest, place: place as GithubPlace, transport: fake.transport, endpoint: "https://api.github.com" })
      : openGitlabStore({ ...rest, place: place as GitlabPlace, transport: fake.transport });
  };
  const open: Rig["open"] = async (options) => {
    const r = await tryOpen(options);
    if (r.kind === "err") throw new Error(r.error);
    return r.value;
  };
  return {
    label,
    repo,
    seen: fake.seen,
    fake,
    hookBeforeWrite: (f) => {
      if (label === "github") (fake as FakeGithub).knobs.beforeRef = f;
      else (fake as FakeGitlab).knobs.beforeCommit = f;
    },
    setToken: (t) => {
      fake.knobs.token = t;
    },
    setPush: (allowed) => {
      if (label === "github") (fake as FakeGithub).knobs.push = allowed;
      else (fake as FakeGitlab).knobs.accessLevel = allowed ? 30 : 20;
    },
    count: fake.count,
    open,
    tryOpen,
    async writable(options) {
      const o = await open(options);
      if (o.mode !== "writable") throw new Error("a store that can be written was expected");
      return o.store;
    },
  };
}

/** The bytes of a text and a text of bytes. */
export const bytes = (t: string): Uint8Array => new TextEncoder().encode(t);
export const text = (b: Uint8Array): string => new TextDecoder().decode(b);
