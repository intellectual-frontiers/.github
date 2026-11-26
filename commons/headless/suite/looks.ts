/**
 * The three looks the renderer is tested at (commons headless 0004-headless-cli FR-016, FR-024): plain (a pipe), ansi (a small colour terminal: 16 colours, no emoji) and full (a modern terminal: truecolor and emoji),
 * each made by the ui's `capabilitiesOf` as the host makes them, never by hand.
 *
 * @module
 */
export { lookAt, LEVELS, type Level } from "../tools/cli-frames.ts";

/** The widths the drawings are tested at. */
export const WIDTHS = [60, 80, 100] as const;

/** Whether a text holds an escape sequence. */
export const hasEscape = (text: string): boolean => text.includes("\u001b");

/** Whether a text holds an emoji or a pictograph. */
export const hasEmoji = (text: string): boolean => /\p{Extended_Pictographic}/u.test(text);
