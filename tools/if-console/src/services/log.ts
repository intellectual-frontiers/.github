// The extension's one log: a VS Code log output channel, which keeps levels and timestamps and which a person can open from the
// Output panel. Every command line run, every exit and every refusal goes here, and nothing leaves the machine.
import * as vscode from 'vscode';

export interface Log extends vscode.Disposable {
  info(line: string): void;
  warn(line: string): void;
  error(line: string): void;
  show(preserveFocus?: boolean): void;
}

export function createLog(name = 'IF Console'): Log {
  const channel = vscode.window.createOutputChannel(name, { log: true });
  return {
    info: (line) => channel.info(line),
    warn: (line) => channel.warn(line),
    error: (line) => channel.error(line),
    show: (preserveFocus) => channel.show(preserveFocus),
    dispose: () => channel.dispose(),
  };
}
