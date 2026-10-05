// Workspace trust is VS Code's own, and the extension invents nothing (0043-if-console FR-006): it asks VS Code whether the workspace is
// trusted, offers VS Code's own page to change it, and runs nothing until it is.
import * as vscode from 'vscode';

export const isTrusted = (): boolean => vscode.workspace.isTrusted !== false;

export function onDidGrantTrust(listener: () => void): vscode.Disposable {
  return vscode.workspace.onDidGrantWorkspaceTrust(listener);
}

/** Opens VS Code's own Workspace Trust page. Trusting a workspace is a decision only a person makes. */
export function manageTrust(): Thenable<unknown> {
  return vscode.commands.executeCommand('workbench.trust.manage');
}
