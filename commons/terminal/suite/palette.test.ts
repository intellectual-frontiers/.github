/**
 * Tests of `kernel/palette.ts`: the marks and their ASCII fallbacks, colour only where allowed, and the roles as a closed union
 * (commons 0001-terminal FR-003).
 *
 * @module
 */
import fc from "fast-check";
import { type Capabilities, label, MARK_KINDS, MARKS, type MarkKind, mark, paint, type Role, ROLES, sgrOf } from "../src/palette.ts";
import { plain, type Equal, expectType } from "@intellectual-frontiers/core";
import { createScreen, describeStyle } from "../src/vt.ts";
import { displayWidth } from "../src/width.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

proves(["0001-terminal FR-003"], "every mark is one emoji of two columns, with its ASCII fallback where there are no emoji", () => {
  const expected: Readonly<Record<MarkKind, readonly [string, string]>> = {
    done: ["✅", "[ok]"],
    failed: ["❌", "[x]"],
    skipped: ["\u{23ed}\u{fe0f}", "[skip]"],
    cancelled: ["\u{23f9}\u{fe0f}", "[stop]"],
    hint: ["👉", "->"],
    warning: ["\u{26a0}\u{fe0f}", "[!]"],
    pending: ["\u{23f3}", "[todo]"],
    action: ["\u{26a1}", "[you]"],
  };
  for (const kind of MARK_KINDS) {
    assertEquals([mark(kind, { emoji: true }), mark(kind, { emoji: false })], expected[kind]);
    assertEquals(displayWidth(mark(kind, { emoji: true })), 2, kind);
    assert(/^[\x20-\x7e]+$/.test(mark(kind, { emoji: false })), `${kind}'s fallback is ASCII`);
  }
  assertEquals(Object.keys(MARKS).sort(), [...MARK_KINDS].sort());
});

proves(["0001-terminal FR-003"], "colour only where it is allowed, always reset after, never for plain or an empty text", () => {
  assertEquals(paint("failure", "3 failed", { colour: true }), "\u001b[31m3 failed\u001b[0m");
  assertEquals(paint("failure", "3 failed", { colour: false }), "3 failed");
  assertEquals(paint("plain", "x", { colour: true }), "x");
  assertEquals(paint("success", "", { colour: true }), "");
  assertEquals(label("done", "built", { colour: false, emoji: false }), "[ok] built");
  assertEquals(label("done", "built", { colour: true, emoji: true }), "\u001b[32m✅\u001b[0m built");
  for (const role of ROLES) assertEquals(sgrOf(role) === "", role === "plain", role);

  // What a person sees: the role's colour on the text, and nothing styled after it.
  const s = createScreen({ width: 20 });
  s.write(`${paint("warning", "slow", { colour: true })}!`);
  assertEquals(s.text(), "slow!");
  assertEquals(
    s.styled()[0]?.map((r) => [r.text, describeStyle(r.style)]),
    [
      ["slow", "bold fg=3"],
      ["!", ""],
    ],
  );
});

proves(["0001-terminal FR-003"], "a painted text without colour is the text, and with colour reads back as the text (property)", () => {
  fc.assert(
    fc.property(fc.constantFrom(...ROLES), fc.string(), fc.boolean(), (role, text, colour) => {
      const out = paint(role, text, { colour });
      if (!colour) assertEquals(out, text);
      assertEquals(plain(out), plain(text));
      if (colour && out !== text) assert(out.endsWith("\u001b[0m"));
    }),
  );
});

proves(["0001-terminal FR-003"], "the roles and marks are closed unions, and a runtime Look is a Capabilities", () => {
  expectType<Equal<Role, "success" | "failure" | "skipped" | "cancelled" | "hint" | "warning" | "dim" | "accent" | "plain">>();
  expectType<Equal<MarkKind, "done" | "failed" | "skipped" | "cancelled" | "hint" | "warning" | "pending" | "action">>();
  const look = { tty: true, colour: true, emoji: false, columns: 80 };
  const caps: Capabilities = look;
  assertEquals(mark("hint", caps), "->");
  const negative = (): void => {
    // @ts-expect-error a role outside the palette does not compile
    paint("purple", "x", caps);
    // @ts-expect-error a mark outside the palette does not compile
    mark("maybe", caps);
  };
  assertEquals(typeof negative, "function");
});
