// Spec: 0002-guide FR-009
/**
 * The guided flow of the terminal (commons terminal 0002-guide): a typed step (`GuideStep`) and its decoder, the capabilities of a terminal
 * decided in one function (`capabilitiesOf`), a step rendered as plain text, ANSI text or a full screen (`renderStep`, `drawScreen`), and a
 * driver (`runGuide`) that shows one step at a time and carries it out through the caller's functions, and never answers for the person.
 * It has no dependency but Core and the `palette` and `width` of this library, and names no host: the streams, the environment, the
 * clock and the signal are parameters.
 *
 * @example
 * ```ts
 * import { capabilitiesOf, decodeStep, renderStep } from "@intellectual-frontiers/terminal/guide";
 * const step = decodeStep({ id: "a", kind: "done", summary: "All set", say: "Nothing more to do." });
 * if (step.kind === "ok") renderStep(step.value, capabilitiesOf({}, { isTTY: false })); // ["[done] All set", "  Nothing more to do."]
 * ```
 *
 * @module
 */
export * from "./guide-caps.ts";
export * from "./guide-driver.ts";
export * from "./guide-model.ts";
export * from "./guide-render.ts";
export * from "./guide-screen.ts";
