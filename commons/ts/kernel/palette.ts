/**
 * The console's one palette (commons 0006-signals FR-022): the colour roles as a union type, and the marks a person reads at a glance,
 * each with an ASCII fallback for a terminal with no emoji. Whether colour and emoji may be used is the terminal's (commons
 * 0005-typescript-runtime FR-023, `runtime/tty.ts`'s `lookOf`); this module only obeys it: `paint` writes SGR sequences only where colour is
 * allowed, and `mark` an emoji only where emoji are.
 *
 * `Capabilities` has the fields of the runtime's `Look` that output depends on (`colour`, `emoji`, `columns`, the same names), so a `Look`
 * is a `Capabilities` as it is.
 *
 * @example
 * ```ts
 * import { label, mark, paint } from "./palette.ts";
 * mark("done", { emoji: true }); // "✅"
 * mark("done", { emoji: false }); // "[ok]"
 * paint("failure", "3 failed", { colour: true }); // "\u001b[31m3 failed\u001b[0m"
 * label("warning", "slow", { colour: false, emoji: false }); // "[!] slow"
 * ```
 *
 * @module
 */
import { absurd } from "./absurd.ts";

/** What the terminal written to can show: colour, emoji, and its width in columns (the fields of the runtime's `Look`). */
export type Capabilities = { readonly colour: boolean; readonly emoji: boolean; readonly columns: number };

/** What a piece of output means, and so its colour. */
export type Role = "success" | "failure" | "skipped" | "cancelled" | "hint" | "warning" | "dim" | "accent" | "plain";

/** Every role, in a fixed order. */
export const ROLES: readonly Role[] = ["success", "failure", "skipped", "cancelled", "hint", "warning", "dim", "accent", "plain"];

/** A mark at the start of a line: how something ended, or what a line is. */
export type MarkKind = "done" | "failed" | "skipped" | "cancelled" | "hint" | "warning" | "pending" | "action";

/** Every mark, in a fixed order. */
export const MARK_KINDS: readonly MarkKind[] = ["done", "failed", "skipped", "cancelled", "hint", "warning", "pending", "action"];

/** A mark as an emoji, its ASCII fallback, and the role it is painted in. */
export type MarkStyle = { readonly emoji: string; readonly ascii: string; readonly role: Role };

/**
 * The marks: ✅ ❌ ⏭️ ⏹️ 👉 ⚠️ ⏳ ⚡, and `[ok]` `[x]` `[skip]` `[stop]` `->` `[!]` `[todo]` `[you]` where there are no emoji. ❌ and ⚠️ are
 * problems; ⏳ (pending) is something not set up yet, expected until someone does it; ⚡ (action) is a step that is the person's to take
 * (send a change, back up, approve): nothing is wrong, so it is neither a warning nor an error (FR-027).
 */
export const MARKS: Readonly<Record<MarkKind, MarkStyle>> = {
  done: { emoji: "✅", ascii: "[ok]", role: "success" },
  failed: { emoji: "❌", ascii: "[x]", role: "failure" },
  skipped: { emoji: "\u{23ed}\u{fe0f}", ascii: "[skip]", role: "skipped" },
  cancelled: { emoji: "\u{23f9}\u{fe0f}", ascii: "[stop]", role: "cancelled" },
  hint: { emoji: "👉", ascii: "->", role: "hint" },
  warning: { emoji: "\u{26a0}\u{fe0f}", ascii: "[!]", role: "warning" },
  pending: { emoji: "\u{23f3}", ascii: "[todo]", role: "dim" },
  action: { emoji: "\u{26a1}", ascii: "[you]", role: "accent" },
};

/** A mark: its emoji where the terminal shows emoji, else its ASCII fallback. */
export function mark(kind: MarkKind, caps: { readonly emoji: boolean }): string {
  const m = MARKS[kind];
  return caps.emoji ? m.emoji : m.ascii;
}

/** The SGR parameters of a role; empty for `plain`. */
export function sgrOf(role: Role): string {
  switch (role) {
    case "success":
      return "32";
    case "failure":
      return "31";
    case "skipped":
      return "33";
    case "cancelled":
      return "35";
    case "hint":
      return "36";
    case "warning":
      return "33;1";
    case "dim":
      return "2";
    case "accent":
      return "1";
    case "plain":
      return "";
    default:
      return absurd(role);
  }
}

const ESC = String.fromCharCode(0x1b);

/**
 * A text in a role's colour, followed by a reset, where colour is allowed; the text as it is where it is not, for the role `plain`, and for
 * an empty text. Painted texts are put side by side, not inside one another: the inner reset would end the outer colour.
 */
export function paint(role: Role, text: string, caps: { readonly colour: boolean }): string {
  const sgr = sgrOf(role);
  return caps.colour && sgr !== "" && text !== "" ? `${ESC}[${sgr}m${text}${ESC}[0m` : text;
}

/** A line's beginning: the mark painted in its role, a space, and the text. */
export function label(kind: MarkKind, text: string, caps: { readonly colour: boolean; readonly emoji: boolean }): string {
  return `${paint(MARKS[kind].role, mark(kind, caps), caps)} ${text}`;
}
