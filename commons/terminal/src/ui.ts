// Spec: 0002-ui FR-009
/**
 * The ui of the terminal (commons terminal 0002-ui), a general library for any terminal interface: the `flow` component (a guided flow: a typed step (`FlowStep`) and its decoder, the capabilities of a terminal
 * decided in one function (`capabilitiesOf`), a step rendered as plain text, ANSI text or a full screen (`renderStep`, `drawScreen`), and a
 * driver (`runFlow`) that shows one step at a time and carries it out through the caller's functions, and never answers for the person), the keys (`keyReader`), the widgets (`select`, `table`, `statusBar`, `log`, `home`) and the screen loop (`runScreen`).
 * It has no dependency but Core and the `palette` and `width` of this library, and names no host: the streams, the environment, the
 * clock and the signal are parameters.
 *
 * @example
 * ```ts
 * import { capabilitiesOf, decodeStep, renderStep } from "@intellectual-frontiers/terminal/ui";
 * const step = decodeStep({ id: "a", kind: "done", summary: "All set", say: "Nothing more to do." });
 * if (step.kind === "ok") renderStep(step.value, capabilitiesOf({}, { isTTY: false })); // ["[done] All set", "  Nothing more to do."]
 * ```
 *
 * @module
 */
export * from "./ui-caps.ts";
export * from "./ui-driver.ts";
export * from "./ui-model.ts";
export * from "./ui-render.ts";
export * from "./ui-screen.ts";
export * from "./ui-keys.ts";
export * from "./ui-widgets.ts";
export * from "./ui-app.ts";
export * from "./ui-theme.ts";
