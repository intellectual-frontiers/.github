// Spec: 0002-enrollment-protocol FR-007
/**
 * The install plan: an ordered list of typed steps, never a script. A step names what to do in fields of a small alphabet, and an argument vector is a list of words, never a shell string. The controller builds a plan (for
 * example from the output of an Desired OS State dialect) and a person approves it; the bootstrap script executes only these steps, without a shell, and verifies the SHA-256 of every download before it uses it.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import type { Result } from "@intellectual-frontiers/core";
import { parsePublicKeyLine } from "./keys.ts";

/** The kind of an installer file. */
export type InstallerKind = "deb" | "rpm" | "msi" | "pkg";
/** The family of an operating system a package is for. */
export type PackageOs = "linux" | "windows" | "macos";

/** Install a package from a pinned URL whose SHA-256 is verified before it is installed. */
export type InstallPackageStep = {
  readonly kind: "install-package";
  readonly osFamily: PackageOs;
  readonly name: string;
  readonly version: string;
  readonly url: string;
  readonly sha256: string;
  readonly installer: InstallerKind;
};
/** Add a public key to the authorized keys of a named account. */
export type AuthorizeKeyStep = { readonly kind: "authorize-key"; readonly account: string; readonly publicKey: string };
/** Create the enrollment account (or make sure it exists), with or without administrative rights. */
export type EnsureAccountStep = { readonly kind: "ensure-account"; readonly name: string; readonly sudo: boolean };
/** Run a program with an argument vector, as the user or as root, and expect one of the exit codes. */
export type RunStep = { readonly kind: "run"; readonly argv: readonly string[]; readonly as: "user" | "root"; readonly expect: readonly number[] };
/** Pin the host key of the controller on the device (a known_hosts line for the host and port), so that the device reconnects as `s-device` with strict checking. */
export type PinControllerStep = { readonly kind: "pin-controller"; readonly host: string; readonly port: number; readonly publicKey: string };
/** One step. */
export type PlanStep = InstallPackageStep | AuthorizeKeyStep | EnsureAccountStep | RunStep | PinControllerStep;
/** An install plan. */
export type InstallPlan = { readonly steps: readonly PlanStep[] };

/** The most steps in a plan. */
export const MAX_STEPS = 64;
/** What a word of an argument vector may hold: no space, quote, glob, `$`, backtick, backslash, `;`, `&`, `|`, `<`, `>`, `(`, `)`, `{`, `}`, `#`, `!`, `~`, newline. */
export const ARGV_WORD = /^[A-Za-z0-9._:/@=+,%-]{1,512}$/;
const ACCOUNT = /^[a-z_][a-z0-9_-]{0,31}$/;
const URL_OK = /^https:\/\/[A-Za-z0-9._:/@=+%-]{1,500}$/;
const NAME = /^[A-Za-z0-9._+-]{1,64}$/;
const VERSION = /^[A-Za-z0-9._+~-]{1,64}$/;
const SHA = /^[0-9a-f]{64}$/;

/** Read a plan from data, or say the first thing wrong. */
export function decodePlan(input: unknown): Result<InstallPlan, string> {
  if (typeof input !== "object" || input === null) return err("plan: an object");
  const raw = (input as { steps?: unknown }).steps;
  if (!Array.isArray(raw)) return err("plan.steps: a list");
  if (raw.length > MAX_STEPS) return err(`plan.steps: at most ${MAX_STEPS}`);
  const steps: PlanStep[] = [];
  for (const [i, s] of raw.entries()) {
    const r = decodeStep(s, `plan.steps[${i}]`);
    if (r.kind === "err") return r;
    steps.push(r.value);
  }
  return ok({ steps });
}

function decodeStep(s: unknown, at: string): Result<PlanStep, string> {
  if (typeof s !== "object" || s === null) return err(`${at}: an object`);
  const o = s as Record<string, unknown>;
  switch (o["kind"]) {
    case "install-package": {
      const { osFamily, name, version, url, sha256, installer } = o;
      if (osFamily !== "linux" && osFamily !== "windows" && osFamily !== "macos") return err(`${at}.osFamily: linux, windows or macos`);
      if (typeof name !== "string" || !NAME.test(name)) return err(`${at}.name: a package name`);
      if (typeof version !== "string" || !VERSION.test(version)) return err(`${at}.version: a version`);
      if (typeof url !== "string" || !URL_OK.test(url)) return err(`${at}.url: an https URL of the safe alphabet`);
      if (typeof sha256 !== "string" || !SHA.test(sha256)) return err(`${at}.sha256: 64 lowercase hex characters`);
      if (installer !== "deb" && installer !== "rpm" && installer !== "msi" && installer !== "pkg") return err(`${at}.installer: deb, rpm, msi or pkg`);
      return ok({ kind: "install-package", osFamily, name, version, url, sha256, installer });
    }
    case "authorize-key": {
      const { account, publicKey } = o;
      if (typeof account !== "string" || !ACCOUNT.test(account)) return err(`${at}.account: an account name`);
      const k = parsePublicKeyLine(publicKey);
      if (k.kind === "err") return err(`${at}.publicKey: ${k.error}`);
      return ok({ kind: "authorize-key", account, publicKey: `${k.value.algo} ${k.value.base64}` });
    }
    case "ensure-account": {
      const { name, sudo } = o;
      if (typeof name !== "string" || !ACCOUNT.test(name)) return err(`${at}.name: an account name`);
      if (typeof sudo !== "boolean") return err(`${at}.sudo: true or false`);
      return ok({ kind: "ensure-account", name, sudo });
    }
    case "run": {
      const { argv, as, expect } = o;
      if (!Array.isArray(argv) || argv.length === 0 || argv.length > 64) return err(`${at}.argv: 1 to 64 words`);
      for (const w of argv) if (typeof w !== "string" || !ARGV_WORD.test(w)) return err(`${at}.argv: words of the safe alphabet (no space, quote, glob or shell syntax)`);
      if (as !== "user" && as !== "root") return err(`${at}.as: user or root`);
      if (!Array.isArray(expect) || expect.length === 0 || expect.length > 8 || !expect.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) return err(`${at}.expect: 1 to 8 exit codes`);
      return ok({ kind: "run", argv: argv as string[], as, expect: expect as number[] });
    }
    case "pin-controller": {
      const { host, port, publicKey } = o;
      if (typeof host !== "string" || !/^[A-Za-z0-9._-]{1,253}$/.test(host)) return err(`${at}.host: a host name`);
      if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) return err(`${at}.port: a port`);
      const k = parsePublicKeyLine(publicKey);
      if (k.kind === "err") return err(`${at}.publicKey: ${k.error}`);
      return ok({ kind: "pin-controller", host, port, publicKey: `${k.value.algo} ${k.value.base64}` });
    }
    default:
      return err(`${at}.kind: install-package, authorize-key, ensure-account, run or pin-controller`);
  }
}

/** Say a plan as the lines the scripts read: tab-separated fields of the safe alphabet, one step a line, between `PLAN` and `END`. */
export function planWire(session: string, plan: InstallPlan): string {
  const lines = [`PLAN\t1\t${session}`];
  for (const s of plan.steps) {
    switch (s.kind) {
      case "install-package":
        lines.push(["STEP", s.kind, s.installer, s.name, s.version, s.url, s.sha256].join("\t"));
        break;
      case "authorize-key": {
        const [algo, b64] = s.publicKey.split(" ");
        lines.push(["STEP", s.kind, s.account, algo, b64].join("\t"));
        break;
      }
      case "ensure-account":
        lines.push(["STEP", s.kind, s.name, s.sudo ? "sudo" : "nosudo"].join("\t"));
        break;
      case "pin-controller": {
        const [algo, b64] = s.publicKey.split(" ");
        lines.push(["STEP", s.kind, s.host, String(s.port), algo, b64].join("\t"));
        break;
      }
      case "run":
        lines.push(["STEP", s.kind, s.as, s.expect.join(","), s.argv.join(" ")].join("\t"));
        break;
    }
  }
  lines.push("END");
  return `${lines.join("\n")}\n`;
}

/** A result a device reports for one step. */
export type StepResult = { readonly index: number; readonly ok: boolean; readonly detail: string };
