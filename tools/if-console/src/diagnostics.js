'use strict';
// Findings of a check in the Problems panel (0043-if-console FR-009): one diagnostic for each finding that has a location,
// at its file and line, with its severity, its message and the section that reported it as the source; a section's
// diagnostics are cleared when that section runs again. A finding with no location is never placed at a file it does not name.
const vscode = require('vscode');

// A finding's `where` names a file when it starts with a path: `dir/file.ext`, `file.ext`, optionally `:line` and `:col`.
// Returns {file, line} (line is 1-based, 1 when none is given) or null. Whether the file exists is for the caller to say.
function locate(where) {
  const m = /^(\.{0,2}\/?[^\s:()]+?)(?::(\d+))?(?::(\d+))?(?:\s.*)?$/.exec(String(where || '').trim());
  if (!m) return null;
  const file = m[1];
  if (!(file.includes('/') || /\.[A-Za-z0-9]{1,8}$/.test(file))) return null;
  return { file, line: m[2] ? Number(m[2]) : 1, column: m[3] ? Number(m[3]) : 1 };
}

const severityName = (level) => (level === 'error' ? 'Error' : level === 'warning' ? 'Warning' : 'Information');

class Diagnostics {
  // `resolve(folder, file)` returns a Uri when the file exists in the clone, else null.
  constructor(resolve) {
    this.collection = vscode.languages.createDiagnosticCollection('if-console');
    this.resolve = resolve;
    this.bySection = new Map();   // `${folderKey}\n${section}` -> Map(uriString -> {uri, diagnostics})
  }

  // Replace one section's diagnostics with the findings it just reported. Returns the findings with no location.
  async setSection(folder, orchestrator, section, findings) {
    const key = `${folder.uri.toString()}\n${section}`;
    const byUri = new Map();
    const unplaced = [];
    for (const f of findings) {
      const loc = locate(f.where);
      const uri = loc ? await this.resolve(folder, loc.file) : null;
      if (!loc || !uri) { unplaced.push(f); continue; }
      const line = Math.max(0, loc.line - 1);
      const d = new vscode.Diagnostic(new vscode.Range(line, Math.max(0, loc.column - 1), line, Number.MAX_SAFE_INTEGER),
        f.message, vscode.DiagnosticSeverity[severityName(f.level)]);
      d.source = `${orchestrator} check ${section}`;
      const k = uri.toString();
      if (!byUri.has(k)) byUri.set(k, { uri, diagnostics: [] });
      byUri.get(k).diagnostics.push(d);
    }
    if (byUri.size) this.bySection.set(key, byUri); else this.bySection.delete(key);
    this.publish();
    return unplaced;
  }

  clearSection(folder, section) {
    this.bySection.delete(`${folder.uri.toString()}\n${section}`);
    this.publish();
  }

  publish() {
    const merged = new Map();
    for (const byUri of this.bySection.values()) {
      for (const [k, v] of byUri) {
        if (!merged.has(k)) merged.set(k, { uri: v.uri, diagnostics: [] });
        merged.get(k).diagnostics.push(...v.diagnostics);
      }
    }
    this.collection.clear();
    for (const { uri, diagnostics } of merged.values()) this.collection.set(uri, diagnostics);
  }

  count() { let n = 0; for (const b of this.bySection.values()) for (const v of b.values()) n += v.diagnostics.length; return n; }
  dispose() { this.collection.dispose(); }
}

module.exports = { locate, Diagnostics };
