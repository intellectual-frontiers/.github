// Spec: 0004-onboarding FR-003
/**
 * What `ergonex` says when it is run with no command (commons ergonex 0004-onboarding FR-003): in plain words, what to do next, from whether there is a workspace. It names no internal term and prints no
 * stack trace. Pure: the controller reads the folder.
 *
 * @module
 */

/** What the words are made from. */
export type GuidanceFacts = {
  readonly home: string | undefined;
  readonly hasWorkspace: boolean;
};

/** The words: where there is no root, no workspace, or a workspace. */
export function guidanceFor(f: GuidanceFacts): string {
  if (f.home === undefined) {
    return [
      "Ergonex sets up and looks after the repositories you work on.",
      "",
      "It cannot find a folder to keep them in. Say where with:",
      "",
      "  ergonex init --home <a folder>",
    ].join("\n");
  }
  if (!f.hasWorkspace) {
    return [
      "Ergonex sets up and looks after the repositories you work on.",
      "",
      "You have no workspace yet. To make one, run:",
      "",
      "  ergonex init",
      "",
      `It makes the folder ${f.home}, puts ergonex where every terminal can find it, and tells you what to do next.`,
    ].join("\n");
  }
  return [
    `Your workspace is at ${f.home}.`,
    "",
    "  ergonex status    shows each repository and whether it is up to date",
    "  ergonex doctor    checks your workspace and says what to fix",
    "  ergonex plan      shows what ergonex would change, and changes nothing",
    "  ergonex help      lists everything ergonex can do",
  ].join("\n");
}
