// Findings of a check in the Problems panel (0043-if-console FR-009): one diagnostic for each finding that has a location, at its file
// and line, with its severity, its message and the section that reported it as the source; a section's diagnostics are cleared when that
// section runs again. A finding with no location is never placed at a file it does not name.
import * as vscode from 'vscode';
import type { Finding } from '../model/wire';

export interface Location { file: string; line: number; column: number }

/** A finding's `where` names a file when it starts with a path: `dir/file.ext`, `file.ext`, optionally `:line` and `:col`. Line and column
 * are 1-based, 1 when none is given. Whether the file exists is for the caller to say. */
export function locate(where: string | undefined): Location | null {
  const m = /^(\.{0,2}\/?[^\s:()]+?)(?::(\d+))?(?::(\d+))?(?:\s.*)?$/.exec((where ?? '').trim());
  if (!m) return null;
  const file = m[1] ?? '';
  if (!(file.includes('/') || /\.[A-Za-z0-9]{1,8}$/.test(file))) return null;
  return { file, line: m[2] ? Number(m[2]) : 1, column: m[3] ? Number(m[3]) : 1 };
}

const severityOf = (level: string): vscode.DiagnosticSeverity =>
  level === 'error' ? vscode.DiagnosticSeverity.Error : level === 'warning' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;

/** Returns the Uri when the file exists in the clone, else null. */
export type ResolveFile = (folder: vscode.WorkspaceFolder, file: string) => Promise<vscode.Uri | null>;

interface Placed { uri: vscode.Uri; diagnostics: vscode.Diagnostic[] }

export class Diagnostics implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection('if-console');
  private readonly bySection = new Map<string, Map<string, Placed>>();   // `${folderKey}\n${section}` -> uriString -> placed
  private readonly emitter = new vscode.EventEmitter<vscode.Uri[]>();
  /** Fires with the files whose findings changed, so that their decorations are drawn again. */
  readonly onDidChange = this.emitter.event;
  private shown = new Map<string, { uri: vscode.Uri; errors: number; warnings: number }>();

  constructor(private readonly resolve: ResolveFile) {}

  /** Replace one section's diagnostics with the findings it just reported. Returns the findings with no location. */
  async setSection(folder: vscode.WorkspaceFolder, orchestrator: string, section: string, findings: Finding[]): Promise<Finding[]> {
    const key = `${folder.uri.toString()}\n${section}`;
    const byUri = new Map<string, Placed>();
    const unplaced: Finding[] = [];
    for (const f of findings) {
      const loc = locate(f.where);
      const uri = loc ? await this.resolve(folder, loc.file) : null;
      if (!loc || !uri) { unplaced.push(f); continue; }
      const line = Math.max(0, loc.line - 1);
      const d = new vscode.Diagnostic(new vscode.Range(line, Math.max(0, loc.column - 1), line, Number.MAX_SAFE_INTEGER), f.message, severityOf(f.level));
      d.source = `${orchestrator} check ${section}`;
      const k = uri.toString();
      const held = byUri.get(k);
      if (held) held.diagnostics.push(d); else byUri.set(k, { uri, diagnostics: [d] });
    }
    if (byUri.size) this.bySection.set(key, byUri); else this.bySection.delete(key);
    this.publish();
    return unplaced;
  }

  clearSection(folder: vscode.WorkspaceFolder, section: string): void {
    this.bySection.delete(`${folder.uri.toString()}\n${section}`);
    this.publish();
  }

  private publish(): void {
    const merged = new Map<string, Placed>();
    for (const byUri of this.bySection.values()) {
      for (const [k, v] of byUri) {
        const held = merged.get(k);
        if (held) held.diagnostics.push(...v.diagnostics); else merged.set(k, { uri: v.uri, diagnostics: [...v.diagnostics] });
      }
    }
    this.collection.clear();
    const was = this.shown;
    this.shown = new Map();
    for (const { uri, diagnostics } of merged.values()) {
      this.collection.set(uri, diagnostics);
      this.shown.set(uri.toString(), { uri, errors: diagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Error).length,
        warnings: diagnostics.filter((d) => d.severity !== vscode.DiagnosticSeverity.Error).length });
    }
    const changed = [...was.values(), ...this.shown.values()].map((x) => x.uri);
    if (changed.length) this.emitter.fire(changed);
  }

  /** How many errors and other findings the checks reported at a file, or null where none. */
  countsFor(uri: vscode.Uri): { errors: number; warnings: number } | null { return this.shown.get(uri.toString()) ?? null; }

  count(): number {
    let n = 0;
    for (const b of this.bySection.values()) for (const v of b.values()) n += v.diagnostics.length;
    return n;
  }

  dispose(): void { this.collection.dispose(); this.emitter.dispose(); }
}
