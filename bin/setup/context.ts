// What every part of the run shares: the options, the screen and its log, the retries, the telemetry, and the state of this run.
import type { Retries } from "../../commons/ts/runtime/net.ts";
import type { Env, Options } from "./options.ts";
import type { Signals } from "./signals.ts";
import type { Ui } from "./ui.ts";
import type { Platform } from "./platform.ts";

/** How the GitHub sign-in was had: a token of the environment, or gh's own (now, or before). */
export type SignIn = "env" | "gh" | "none";

/** What ergactl's commands did in the clone (FR-055), for the summary. */
export type ErgaStatus = {
  ran: boolean;
  setup: number; // bin/setup.sh
  toolchain: { readonly kind: "ran"; readonly code: number } | { readonly kind: "nothing" } | { readonly kind: "left-for-sign-in" };
  check: { readonly kind: "ran"; readonly code: number } | { readonly kind: "absent" };
  doctor: number;
};

export class RunState {
  readonly problems: string[] = [];
  readonly skipped: string[] = [];
  stepNo = 0;
  platform: Platform | null = null;
  signIn: SignIn = "none";
  haveGithub = false;
  cloned = false;
  erga: ErgaStatus = { ran: false, setup: 0, toolchain: { kind: "nothing" }, check: { kind: "absent" }, doctor: 0 };
  /** what the last failed step printed */
  lastOutput = "";
}

export type Ctx = {
  readonly opts: Options;
  readonly env: Env;
  readonly ui: Ui;
  readonly retries: Retries;
  readonly signals: Signals;
  readonly st: RunState;
  /** a private working folder, removed at the end */
  readonly work: string;
  /** whether there is a terminal to ask on, even when standard input is a pipe */
  readonly hasTty: boolean;
};

/** Something that did not work, that nothing else depended on: listed at the end. */
export function problem(ctx: Ctx, text: string): void {
  ctx.st.problems.push(text);
  ctx.ui.log.line(`problem: ${text}`);
}

/** Left for a GitHub sign-in (not a failure): said in the summary. */
export function skipGithub(ctx: Ctx, what: string): void {
  ctx.st.skipped.push(what);
  ctx.ui.markBad();
  ctx.ui.log.line(`left until a GitHub sign-in: ${what}`);
}
