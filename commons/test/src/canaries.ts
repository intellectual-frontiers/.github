// Spec: 0001-test FR-009
/**
 * The canaries of the secret scanner (commons test 0001-test FR-009): the one corpus of text that LOOKS like a secret and is not one, which a test imports where it must hand a program something a secret scanner would stop. A test file that holds such text
 * itself cannot be committed, so a test imports a canary from here and holds none of its own. Each canary has an id, a kind, the rule of the scanner that must catch it (the label of the rule, as `repoctl` names it) and its text, and every text carries
 * `CANARY` and cannot be a working secret: a private key whose body says it is not one, and tokens whose characters are words.
 *
 * This file is the one canary file of the repository: the scanner of `repoctl commit` lets it pass, as an informational finding of kind canary, only while its content digest is the one `repoctl.config.ts` pins, so that any edit of it, a real secret pasted into it included,
 * blocks it as an ordinary holder of a secret until the owner pins the new digest.
 *
 * @example
 * ```ts
 * import { CANARIES, canaryText } from "@intellectual-frontiers/test/canaries";
 * canaryText("openssh-private-key").includes("CANARY"); // true
 * CANARIES.every((c) => c.text.includes("CANARY")); // true
 * ```
 *
 * @module
 */

/** What a canary imitates. */
export type CanaryKind = "private-key" | "token" | "access-key";

/** A text that looks like a secret and is not one. */
export type Canary = {
  /** The name a test imports it by. */
  readonly id: string;
  readonly kind: CanaryKind;
  /** The label of the rule of the scanner that must catch it (`DEFAULT_SECRET_PATTERNS` of repoctl). */
  readonly rule: string;
  /** The text: it carries `CANARY` and is no working secret. */
  readonly text: string;
};

/** Every canary: one for each rule of the scanner, and a second private key. */
export const CANARIES: readonly Canary[] = [
  { id: "openssh-private-key", kind: "private-key", rule: "a private key", text: "-----BEGIN OPENSSH PRIVATE KEY-----\nCANARY-THIS-IS-NOT-A-KEY-IT-IS-A-TEST-FIXTURE\n-----END OPENSSH PRIVATE KEY-----" },
  { id: "rsa-private-key", kind: "private-key", rule: "a private key", text: "-----BEGIN RSA PRIVATE KEY-----\nCANARY-THIS-IS-NOT-A-KEY-IT-IS-A-TEST-FIXTURE\n-----END RSA PRIVATE KEY-----" },
  { id: "npm-token", kind: "token", rule: "an npm token", text: "npm_CANARYabcdefghijklmnopqrstuvwxyz0123" },
  { id: "github-token", kind: "token", rule: "a GitHub token", text: "ghp_CANARYabcdefghijklmnopqrstuvwxyz0123456789" },
  { id: "github-fine-grained-token", kind: "token", rule: "a GitHub token", text: "github_pat_CANARY_THIS_IS_NOT_A_TOKEN_0123456789" },
  { id: "aws-access-key", kind: "access-key", rule: "an access key of AWS", text: "AKIACANARY0000000000" },
  { id: "slack-token", kind: "token", rule: "a token of Slack", text: "xoxb-CANARY-0000000000-NOT-A-TOKEN" },
  { id: "anthropic-key", kind: "token", rule: "a key of an API", text: "sk-ant-CANARY-0000000000000000-NOT-A-KEY" },
];

/** The canary of an id, or a thrown error naming the ids there are: a test that asks for one that is not there is wrong. */
export function canary(id: string): Canary {
  const found = CANARIES.find((c) => c.id === id);
  if (found === undefined) throw new Error(`no canary ${JSON.stringify(id)}: the canaries are ${CANARIES.map((c) => c.id).join(", ")}`);
  return found;
}

/** The text of the canary of an id. */
export function canaryText(id: string): string {
  return canary(id).text;
}
