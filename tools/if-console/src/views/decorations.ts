// Badges and colors in VS Code's own file decorations (0043-if-console FR-038, FR-040): a file that a check found something in carries a count
// and the color of its worst finding, its folders carry the color, and a row of a view whose noun declares a `badge` carries it as a badge.
// Only a count and a color are drawn; the findings themselves are in Problems.
import * as vscode from 'vscode';
import type { Diagnostics } from '../services/diagnostics';
import { badgeText } from '../model/rows';
import { ROW_SCHEME } from './resource-tree';

export class FileDecorations implements vscode.FileDecorationProvider, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this.emitter.event;
  private readonly subscription: vscode.Disposable;

  constructor(private readonly diagnostics: Diagnostics) {
    this.subscription = diagnostics.onDidChange((uris) => this.emitter.fire(uris));
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme === ROW_SCHEME) {
      const badge = uri.query;
      return badge ? new vscode.FileDecoration(badgeText(badge), `${badge}`, undefined) : undefined;
    }
    if (uri.scheme !== 'file') return undefined;
    const found = this.diagnostics.countsFor(uri);
    if (!found) return undefined;
    const total = found.errors + found.warnings;
    const decoration = new vscode.FileDecoration(total > 9 ? '9+' : String(total),
      `${found.errors ? `${found.errors} error${found.errors === 1 ? '' : 's'}` : ''}${found.errors && found.warnings ? ', ' : ''}${found.warnings ? `${found.warnings} warning${found.warnings === 1 ? '' : 's'}` : ''} from IF Console checks`,
      new vscode.ThemeColor(found.errors ? 'list.errorForeground' : 'list.warningForeground'));
    decoration.propagate = true;
    return decoration;
  }

  /** Redraw every row's badge (the rows were loaded again). */
  refreshRows(): void { this.emitter.fire(undefined); }

  dispose(): void { this.subscription.dispose(); this.emitter.dispose(); }
}
