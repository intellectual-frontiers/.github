// Spec: 0004-repoctl-status-release FR-006
/**
 * `repoctl release publish` (commons repoctl 0004-repoctl-status-release FR-006 to FR-010): the packed libraries of the release record, sent to npm by hand. It is a destruction (a version put on npm cannot be taken back), so it
 * is refused unless the caller holds the releaser tier and types the confirmation that a preview printed, which names how many packages and a digest of which. The credential is taken through the credentials port, written to a private
 * npmrc in a folder outside the repository that is removed whatever happens, and never printed, logged or put in an argument: every line the verb reports is redacted of it first. Each tarball is passed by its absolute path, because npm reads
 * a relative `dist/x.tgz` as the shorthand of a GitHub repository. A hand publish is staged by npm for about an hour, and the report says so.
 *
 * @example
 * ```ts
 * import { confirmationPhrase } from "./publish.ts";
 * confirmationPhrase([{ slug: "core", version: "0.1.0", folder: "commons/core", tag: "core-v0.1.0", publish: true }]).startsWith("publish 1 "); // true
 * ```
 *
 * @module
 */
import { redact } from "@intellectual-frontiers/headless/governance";
import { sha256Hex, type Secret } from "@intellectual-frontiers/headless/logical";
import { finding, type Finding, tailLines } from "./findings.ts";
import type { World } from "./ports.ts";

/** One release of the record: a library, its version, its folder and its tag, and whether it goes to npm. */
export type ReleaseEntry = { readonly slug: string; readonly version: string; readonly folder: string; readonly tag: string; readonly publish: boolean };

/** What is to happen to one release. */
export type Item =
  | { readonly kind: "ready"; readonly entry: ReleaseEntry; readonly tarball: string }
  | { readonly kind: "present"; readonly entry: ReleaseEntry }
  | { readonly kind: "no-tarball"; readonly entry: ReleaseEntry; readonly tarball: string }
  | { readonly kind: "unknown"; readonly entry: ReleaseEntry; readonly why: string };

/** The plan of a publication: what each release comes to, and the phrase that confirms it. */
export type PublishPlan = { readonly items: readonly Item[]; readonly phrase: string };

/** What happened to one release. */
export type Published =
  | { readonly kind: "published"; readonly entry: ReleaseEntry }
  | { readonly kind: "present"; readonly entry: ReleaseEntry }
  | { readonly kind: "failed"; readonly entry: ReleaseEntry; readonly detail: readonly string[] }
  | { readonly kind: "not-run"; readonly entry: ReleaseEntry; readonly why: string };

/** The absolute path of the tarball the packer makes for a release: `dist/intellectual-frontiers-<slug>-<version>.tgz` in the library's folder. */
export function tarballPath(repo: string, e: ReleaseEntry): string {
  return `${repo}/${e.folder}/dist/intellectual-frontiers-${e.slug}-${e.version}.tgz`;
}

/** The phrase that confirms a publication: the word, how many packages go, and the start of a digest of which (`publish 3 1a2b3c4d`), so that what was reviewed is what is sent. */
export function confirmationPhrase(entries: readonly ReleaseEntry[]): string {
  const sent = entries.filter((e) => e.publish).map((e) => `${e.slug}@${e.version}`);
  return `publish ${sent.length} ${sha256Hex(sent.join("\n")).slice(0, 8)}`;
}

/** The releases of the record that are not tagged yet and go to npm, as the plan: each with its tarball, or why it cannot be sent. */
export async function planPublish(w: Pick<World, "files" | "registry" | "repo">, entries: readonly ReleaseEntry[], tagged: ReadonlySet<string>): Promise<PublishPlan> {
  const todo = entries.filter((e) => e.publish && !tagged.has(e.tag));
  const items: Item[] = [];
  for (const entry of todo) {
    const seen = await w.registry.view(`@intellectual-frontiers/${entry.slug}`);
    if (seen.kind === "err") {
      items.push({ kind: "unknown", entry, why: seen.error });
      continue;
    }
    if (seen.value !== "absent" && seen.value.versions.includes(entry.version)) {
      items.push({ kind: "present", entry });
      continue;
    }
    const tarball = tarballPath(w.repo, entry);
    items.push((await w.files.exists(tarball)) ? { kind: "ready", entry, tarball } : { kind: "no-tarball", entry, tarball });
  }
  return { items, phrase: confirmationPhrase(todo) };
}

/** Whether the publication may go on: the token is there and the typed phrase is the plan's. The reasons otherwise. */
export function gate(input: { readonly token: Secret | undefined; readonly typed: string | undefined; readonly phrase: string }): readonly Finding[] {
  const out: Finding[] = [];
  if (input.token === undefined) out.push(finding("fail", "E-NO-TOKEN", "INFRO_NPMJS_TOKEN is not set, so nothing can be sent to npm by hand", "repoctl doctor"));
  if (input.typed !== input.phrase)
    out.push(finding("fail", "E-PUBLISH-REFUSED", `the confirmation is not the one the preview printed (${input.phrase})`, `repoctl release publish --yes --confirm "${input.phrase}"`));
  return out;
}

/** The text of the private npmrc: the one line that gives npm the credential for the registry. It is written only to a file of mode 0600 in a folder that is removed. */
export function npmrcText(token: Secret): string {
  return `//registry.npmjs.org/:_authToken=${token.reveal()}\n`;
}

/** Publishes what the plan says is ready, one release at a time, and gives what happened to each. Nothing it reports holds the token. */
export async function runPublish(w: Pick<World, "files" | "process" | "repo">, plan: PublishPlan, token: Secret): Promise<readonly Published[]> {
  const out: Published[] = [];
  const scrub = (text: string): string => redact(text, [token.reveal()]);
  const dir = await w.files.makeTemp("repoctl-npm-");
  try {
    const rc = `${dir}/npmrc`;
    await w.files.write(rc, npmrcText(token), 0o600);
    for (const item of plan.items) {
      switch (item.kind) {
        case "present":
          out.push({ kind: "present", entry: item.entry });
          break;
        case "unknown":
          out.push({ kind: "not-run", entry: item.entry, why: scrub(`npm could not be asked about it (${item.why})`) });
          break;
        case "no-tarball":
          out.push({ kind: "not-run", entry: item.entry, why: `its tarball ${item.tarball} is not there` });
          break;
        case "ready": {
          const ran = await w.process.run(["npm", "publish", item.tarball, "--access", "public", "--userconfig", rc], { cwd: w.repo });
          out.push(ran.code === 0 ? { kind: "published", entry: item.entry } : { kind: "failed", entry: item.entry, detail: tailLines(scrub(`${ran.stderr}\n${ran.stdout}`), 6) });
          break;
        }
        default:
          return out;
      }
    }
  } finally {
    await w.files.removeTree(dir);
  }
  return out;
}

/** The findings of a publication: a release that failed or could not be tried. */
export function findingsOfPublish(done: readonly Published[]): readonly Finding[] {
  return done.flatMap((p): readonly Finding[] => {
    switch (p.kind) {
      case "published":
      case "present":
        return [];
      case "failed":
        return [finding("fail", "E-PUBLISH-FAILED", `${p.entry.slug} ${p.entry.version}: npm did not take it (${p.detail.join("; ")})`, "repoctl status")];
      case "not-run":
        return [finding("fail", p.why.includes("tarball") ? "E-NO-TARBALL" : "E-NPM-UNREACHABLE", `${p.entry.slug} ${p.entry.version}: ${p.why}`, p.why.includes("tarball") ? "repoctl release apply" : "repoctl status")];
      default:
        return [];
    }
  });
}

/** What is said of the versions that were sent: npm stages a hand publish for about an hour, so `status` may not list it at once; nothing says it is live. */
export const STAGED_NOTE = "npm stages a version published by hand for about an hour: `repoctl status` lists it once npm shows it, and the release workflow makes the tags";
