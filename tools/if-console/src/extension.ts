// IF Console: the secondary interface of every repository's orchestrator (0043-if-console). It finds each repository's launcher by that
// repository's own declaration, runs it with --json, and offers what it returns the way VS Code offers anything. It re-implements nothing,
// writes nothing, collects no telemetry and opens no network connection.
import type * as vscode from 'vscode';
import { App } from './app';

let app: App | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  app = new App(context);
  app.register();
  await app.refresh();
  // Nothing is returned: the extension exports no API, so no other extension can run a command through it (FR-015).
}

export function deactivate(): void { app = null; }
