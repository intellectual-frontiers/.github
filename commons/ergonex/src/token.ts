// Spec: 0004-onboarding FR-006
/**
 * The doctor's check of the token for reading packages (commons ergonex 0004-onboarding FR-004, FR-006): whether `ERGONEX_GITHUB_TOKEN` is there, whether GitHub CLI is, and, where GitHub was asked, whether the
 * token may read packages (the scope `read:packages`), each with the command that fixes it. Pure: `commands/doctor.ts` gathers the facts and asks GitHub only with `--fetch`.
 *
 * @module
 */
import type { Check } from "./doctor.ts";

/** What the check is made from. */
export type TokenFacts = {
  /** Whether `ERGONEX_GITHUB_TOKEN` is set to something in this terminal. */
  readonly tokenSet: boolean;
  /** Whether GitHub CLI is on the path. */
  readonly ghInstalled: boolean;
  /** Whether GitHub was asked about the token's rights. */
  readonly fetched: boolean;
  /** The scopes GitHub says the token has; undefined where it did not say (a fine-grained token, or no answer). */
  readonly scopes: readonly string[] | undefined;
};

/** The scopes that let a token read packages: `write:packages` includes reading. */
const READS = ["read:packages", "write:packages"] as const;

/** The scopes in the header `X-OAuth-Scopes: a, b`, as the text of a response (`gh api -i`) gives it; undefined where there is no such header. */
export function scopesOf(response: string): readonly string[] | undefined {
  const line = response.split(/\r?\n/).find((l) => /^x-oauth-scopes:/i.test(l));
  if (line === undefined) return undefined;
  return line
    .slice(line.indexOf(":") + 1)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

/** The checks, in plain words. */
export function tokenChecks(f: TokenFacts): readonly Check[] {
  const id = "ergonex/token";
  const subject = "ERGONEX_GITHUB_TOKEN";
  if (!f.tokenSet) {
    return [
      f.ghInstalled
        ? {
            id,
            level: "suggest",
            subject,
            message:
              "the token for reading this organization's packages is not set in this terminal: run `ergonex shell install <your shell>` and open a new terminal, and `gh auth login` if you have not signed in to GitHub",
          }
        : {
            id,
            level: "suggest",
            subject,
            message:
              "the token for reading this organization's packages comes from GitHub CLI, which is not installed: install it (https://cli.github.com), run `gh auth login`, then `ergonex shell install <your shell>` and open a new terminal",
          },
    ];
  }
  if (!f.fetched) {
    return [
      {
        id,
        level: "ok",
        subject,
        message: "it is set; whether it may read packages is checked by `ergonex doctor --fetch`, which asks GitHub",
      },
    ];
  }
  if (f.scopes === undefined) {
    return [
      {
        id,
        level: "suggest",
        subject,
        message:
          "it is set, but GitHub did not say which rights it has (a fine-grained token does not): packages are read only if it was given the right to",
      },
    ];
  }
  if (READS.some((s) => f.scopes?.includes(s) === true)) {
    return [{ id, level: "ok", subject, message: "it is set and may read packages" }];
  }
  return [
    {
      id,
      level: "warn",
      subject,
      message: `it is set, but it cannot read packages (its rights: ${f.scopes.length === 0 ? "none listed" : f.scopes.join(", ")}): run \`gh auth refresh -s read:packages\`, then open a new terminal`,
    },
  ];
}
