// The entry of the webview bundle (dist/webview.js): the panels' own script, built apart from the extension host's. It uses VS Code
// Elements (web components styled with VS Code's theme variables) and the codicon font, both from the extension's own lock, and loads
// nothing from anywhere else. Nothing opens it yet; the resource panel of 0043-if-console FR-042 does.
import '@vscode-elements/elements/dist/vscode-button/index.js';
import '@vscode-elements/elements/dist/vscode-icon/index.js';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

export const api = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
