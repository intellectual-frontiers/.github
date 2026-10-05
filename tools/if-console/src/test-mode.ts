// The one test hook (0043-if-console FR-033). A test running inside a real VS Code cannot press the button of a modal dialog or read a
// quick pick, so when VS Code runs this extension in its test mode (ExtensionMode.Test, which VS Code sets only for a host started with an
// extension test path, never for an installed extension) the extension publishes one object, under Symbol.for('if-console.test') on
// globalThis, through which a test
//   - queues the answer to the next decision modal (true gives the modal's one button; anything else refuses it; with nothing queued the
//     modal is refused), and reads what each modal would have shown;
//   - reads what the extension showed (the quick picks' items and the webviews' pages), in the order shown;
//   - reads a snapshot of what it holds: the repositories found, the views' entries and the MCP servers it would register.
// Outside test mode the object does not exist and every function here does nothing; the modal is VS Code's own. The hook answers no other
// prompt: quick picks and input boxes are driven by VS Code's own commands in the tests.
import * as vscode from 'vscode';

export const KEY = Symbol.for('if-console.test');

export interface Shown { kind: string; [field: string]: unknown }

export interface TestHook {
  answers: boolean[];
  shown: Shown[];
  describe: () => Promise<unknown>;
}

let hook: TestHook | null = null;

export const active = (): boolean => hook !== null;

export function install(extensionContext: { extensionMode?: vscode.ExtensionMode } | null | undefined, describe: () => Promise<unknown>): TestHook | null {
  if (!extensionContext || extensionContext.extensionMode !== vscode.ExtensionMode.Test) return null;
  hook = { answers: [], shown: [], describe };
  (globalThis as Record<symbol, unknown>)[KEY] = hook;
  return hook;
}

export function uninstall(): void {
  const g = globalThis as Record<symbol, unknown>;
  if (hook && g[KEY] === hook) delete g[KEY];
  hook = null;
}

/** Record what was shown. Nothing happens outside test mode. */
export function note(kind: string, data: Record<string, unknown>): void {
  if (hook) hook.shown.push({ kind, ...data });
}

/** The answer to a decision modal: the label of the button the test pressed, or undefined. */
export function answerModal(shown: Record<string, unknown>, button: string): string | undefined | null {
  if (!hook) return null;
  note('modal', shown);
  const answer = hook.answers.length ? hook.answers.shift() : false;
  return answer === true ? button : undefined;
}
