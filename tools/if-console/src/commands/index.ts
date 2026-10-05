// The handlers of the commands the manifest contributes. Each is registered by the local `cmd` function under the prefix `if-console.`, and the repository's check of this
// extension reads this file to prove that every contributed command has a handler and every handler is contributed.
import * as vscode from 'vscode';
import type { App } from '../app';
import { manageTrust } from '../services/trust';
import { Node } from '../views/node';
import { ContextCommands } from './context';
import { LearnCommands } from './learn';
import { RunCommands } from './run';
import { ViewCommands } from './views';

export interface Handlers {
  showResult: RunCommands['showResult'];
  runWords: RunCommands['runWords'];
  learn: LearnCommands;
  context: ContextCommands;
  run: RunCommands;
  views: ViewCommands;
  /** Register every command; `sub` keeps what it returns until the extension is deactivated. */
  register(sub: (d: vscode.Disposable) => unknown): void;
}

export function registerCommands(app: App): Handlers {
  const run = new RunCommands(app);
  const learn = new LearnCommands(app);
  const context = new ContextCommands(app);
  const views = new ViewCommands(app, run, context);
  return {
    run, learn, context, views,
    showResult: (...a) => run.showResult(...a),
    runWords: (...a) => run.runWords(...a),
    register(sub) {
      const cmd = (id: string, fn: (...args: unknown[]) => unknown): void => {
        sub(vscode.commands.registerCommand(`if-console.${id}`, (...a: unknown[]) => Promise.resolve(fn(...a)).catch((e: unknown) => app.fail(e))));
      };
      cmd('showHome', (arg) => views.showHome(arg));
      cmd('showView', () => views.showView());
      cmd('runCommand', () => run.runCommandPalette());
      cmd('check', () => run.runRepoWide('check', { form: true }));
      cmd('checkChanged', () => run.runRepoWide('check', { args: ['--changed'] }));
      cmd('fresh', () => run.runRepoWide('fresh'));
      cmd('test', () => run.runRepoWide('test'));
      cmd('doctor', () => run.runRepoWide('doctor'));
      cmd('showCommandLine', () => run.showCommandLine());
      cmd('getHelp', () => context.getHelp());
      cmd('learn', () => learn.learn());
      cmd('copyContext', (node) => context.copyContext(node));
      cmd('openView', () => run.openViewCommand());
      cmd('findResource', (node) => views.findResource(node));
      cmd('refresh', () => app.refresh());
      cmd('showOutput', () => { app.log.show(true); });
      cmd('trust', () => manageTrust());
      cmd('cancelRun', () => views.cancelRun());
      cmd('toggleAllCommands', () => views.toggleAllCommands());
      cmd('activateNode', (node) => run.activateNode(node));
      cmd('runSection', (node) => (node instanceof Node && node.kind === 'section' && node.data.name ? app.fromView(node.data.view, () => app.runSectionsShown(node.repo, [node.data.name ?? ''])) : null));
      cmd('runSuggestion', (node) => views.runSuggestion(node));
      cmd('openRow', (node) => views.openRow(node));
      cmd('runRowAction', (node) => views.runRowAction(node));
      cmd('runNounCommand', (node) => views.runNounCommand(node));
      cmd('copyCommandLine', (node) => views.copyCommandLine(node));
      cmd('copyId', (node) => views.copyId(node));
      cmd('followLink', (handle) => views.followLink(handle));
    },
  };
}
