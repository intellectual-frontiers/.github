'use strict';
// Running a repository's launcher (0043-if-console FR-003, FR-017, FR-020): every call is `<launcher> ... --json` (or
// `--html`), with the repository's root as the working directory and IF_CONSOLE=1 in the environment, so that the launcher
// logs the surface `editor` (0041-command-line FR-042). Nothing else is ever run.
const childProcess = require('child_process');
const wire = require('./wire');
const forms = require('./forms');

class Launcher {
  // `program` is the path as shown to a person (`./tool`), `file` the absolute path that is run.
  constructor({ root, file, program, log, spawn, env }) {
    this.root = root;
    this.file = file;
    this.program = program;
    this.log = log || (() => {});
    this.spawn = spawn || childProcess.spawn;
    this.env = env || process.env;
  }

  line(argv, format) { return forms.commandLine(this.program, [...argv, ...(format ? [`--${format}`] : [])]); }

  // Run one command. Resolves {exit, stdout, stderr, docs, doc, error, cancelled}; never rejects for a non-zero exit.
  // `signal` (an AbortSignal) ends the process; `onDocument(doc)` sees each complete line of a stream as it arrives.
  run(argv, { format = 'json', signal, onDocument } = {}) {
    const full = [...argv, ...(format === 'text' ? [] : [`--${format}`])];
    const shown = forms.commandLine(this.program, full);
    this.log(`$ ${shown}`);
    return new Promise((resolve) => {
      let child;
      try {
        child = this.spawn(this.file, full, { cwd: this.root, env: { ...this.env, IF_CONSOLE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (e) {
        this.log(`could not start: ${e.message}`);
        resolve({ exit: null, stdout: '', stderr: e.message, docs: [], doc: null, error: null, failed: e.message });
        return;
      }
      let stdout = '';
      let stderr = '';
      let pending = '';
      let cancelled = false;
      let settled = false;
      const finish = (exit, failed) => {
        if (settled) return;
        settled = true;
        if (signal) signal.removeEventListener('abort', onAbort);
        this.log(cancelled ? `cancelled (${shown})` : `exit ${exit}${failed ? `: ${failed}` : ''}`);
        let docs = [];
        let problem = failed || null;
        if (format === 'json') {
          try { docs = wire.parseDocuments(stdout); } catch (e) { problem = problem || e.message; }
        }
        const doc = docs.length ? docs[docs.length - 1] : null;
        resolve({ exit, stdout, stderr, docs, doc, error: doc ? wire.errorOf(doc) : null, cancelled, failed: problem });
      };
      const onAbort = () => { cancelled = true; try { child.kill('SIGTERM'); } catch (e) { /* already gone */ } };
      if (signal) { if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort); }
      child.stdout.on('data', (b) => {
        const text = b.toString('utf8');
        stdout += text;
        if (format !== 'json') return;
        pending += text;
        let nl;
        while ((nl = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, nl);
          pending = pending.slice(nl + 1);
          let d = null;
          try { d = JSON.parse(line); } catch (e) { continue; }   // a line of one pretty document, not a stream's
          if (d && typeof d === 'object' && d.schema) { this.log(line.length > 400 ? `${line.slice(0, 400)} ...` : line); if (onDocument) onDocument(d); }
        }
      });
      child.stderr.on('data', (b) => {
        const text = b.toString('utf8');
        stderr += text;
        for (const l of text.split(/\r?\n/)) if (l.trim()) this.log(l);
      });
      child.on('error', (e) => finish(null, e.code === 'ENOENT' ? 'the launcher was not found' : e.message));
      child.on('close', (code) => finish(code));
    });
  }
}

module.exports = { Launcher };
