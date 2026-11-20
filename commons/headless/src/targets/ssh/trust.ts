// Spec: 0007-ssh-coverage FR-002
/**
 * The verb of first contact (commons headless 0007-ssh-coverage FR-002): `trust-host <target> [--fingerprint SHA256:...]`. Without a fingerprint it only shows what the host
 * presents and says how to confirm it; with one, which a person checked by another way, it records the host in the repository's known hosts if the host showed that fingerprint, and
 * records nothing otherwise. The fingerprint is an option only a person may give, the action comes through the local channel only, and it is confirmed by a person: so no flag, tool
 * server or script can accept a key on anyone's behalf. This replaces `StrictHostKeyChecking=accept-new`, which this library never writes.
 *
 * @example
 * ```ts
 * import { trustHostCommand } from "./trust.ts";
 * // const verb = trustHostCommand({ targets, run: (argv, opts) => proc.output(argv, opts), append: (line) => appendToKnownHosts(line) });
 * ```
 *
 * @module
 */
import { isErr } from "@intellectual-frontiers/core";
import { value } from "@intellectual-frontiers/terminal/args";
import { defineReach, problem } from "@intellectual-frontiers/headless/governance";
import { command, outcomeOf, type Command, type Target } from "@intellectual-frontiers/headless/logical";
import type { RunLocal } from "./executor.ts";
import { acceptHostKey, scanHost } from "./hostkey.ts";

/** What the verb needs of its program: the targets, how a local program is run, and where a line of known hosts is written. */
export type TrustDeps = {
  readonly targets: readonly Target[];
  readonly run: RunLocal;
  /** Appends one line to the repository's known hosts. */
  readonly append: (line: string) => Promise<void> | void;
  /** The verb's own name, for the words it tells a person to run; `trust-host` by default. */
  readonly name?: string;
};

/** The verb that shows what a host presents and, given the fingerprint a person checked, records the host. */
export function trustHostCommand(deps: TrustDeps): Command {
  const name = deps.name ?? "trust-host";
  return command({
    name,
    summary: "Show the host key a target presents, and record it once you have checked its fingerprint.",
    options: { fingerprint: value({ help: "The fingerprint you checked by another way (SHA256:...): the host is recorded only if it showed it." }) },
    operands: [{ name: "TARGET", help: "The id of the target.", arity: "one" }],
    examples: [{ args: ["alpha"], says: "See what alpha presents." }, { args: ["alpha", "--fingerprint", "SHA256:..."], says: "Record alpha after checking." }],
    action: { kind: "action", dryRun: true, idempotent: true, humanOnly: ["fingerprint"], reach: defineReach({ channels: ["local"], idempotent: true, confirmation: "person" }) },
    run: async (args, ctx) => {
      const id = args.positionals[0];
      const t = deps.targets.find((x) => x.id === id);
      if (t === undefined) return outcomeOf(null, { problems: [problem("fail", `${id ?? "a target"} is not a target`, { code: "E000-USAGE-TARGET" })] });
      const scanned = await scanHost(t, deps.run);
      if (isErr(scanned)) return outcomeOf(null, { problems: [problem("fail", scanned.error, { code: "E000-REMOTE-HOSTKEY" })] });
      const fingerprint = args.options["fingerprint"];
      const shown = scanned.value.map((k) => k.fingerprint);
      if (typeof fingerprint !== "string" || ctx.mode !== "apply") {
        return outcomeOf({ target: t.id, fingerprints: shown }, {
          text: `${t.id} presents:\n${shown.map((f) => `  ${f}`).join("\n")}`,
          problems: [problem("action", `Check one of these against the host itself, then record it`, { fix: `${ctx.program} ${name} ${t.id} --fingerprint ${shown[0] ?? "SHA256:..."}`, code: "E000-YOURS-HOSTKEY" })],
        });
      }
      const accepted = await acceptHostKey(t, scanned.value, fingerprint, deps.append);
      if (isErr(accepted)) return outcomeOf({ target: t.id, fingerprints: shown }, { problems: [problem("fail", accepted.error, { code: "E000-REMOTE-HOSTKEY" })] });
      return outcomeOf({ target: t.id, recorded: accepted.value.map((k) => k.fingerprint) }, { outcomes: [`Recorded ${accepted.value.length} key${accepted.value.length === 1 ? "" : "s"} of ${t.id}`] });
    },
  });
}
