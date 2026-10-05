// Every user-facing string of the extension goes through `t` (0043-if-console FR-044): VS Code's own `l10n.t`, which finds the string in the
// language bundle (l10n/, written at build time from these very calls) and gives the English string itself where there is none. The model
// code, which the tests load without VS Code, gets the same words with the placeholders filled in.
/** `require` is Node's (the extension host's); the page's bundle has none, and this module is loaded there too, through the model code. */
declare const require: ((id: string) => unknown) | undefined;

type Translate = (message: string, ...args: Array<string | number | boolean>) => string;

let impl: Translate | null | undefined;

function load(): Translate | null {
  try {
    // The one place that reaches for VS Code, and only for its translator, so that a module that uses `t` still loads without VS Code.
    if (typeof require !== 'function') return null;
    const vscode = require('vscode') as { l10n?: { t?: Translate } };
    const translate = vscode.l10n?.t;
    return typeof translate === 'function' ? (m, ...a) => translate(m, ...a) : null;
  } catch { return null; }
}

export const fill = (message: string, args: ReadonlyArray<string | number | boolean>): string => message.replace(/\{(\d+)\}/g, (m, i: string) => (args[Number(i)] === undefined ? m : String(args[Number(i)])));

/** `t('{0} files', n)`: the message is a literal (the build reads it from the source), `{0}`, `{1}` are its placeholders. */
export function t(message: string, ...args: Array<string | number | boolean>): string {
  if (impl === undefined) impl = load();
  return impl ? impl(message, ...args) : fill(message, args);
}
