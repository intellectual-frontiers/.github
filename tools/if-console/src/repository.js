'use strict';
// One workspace folder's repository (0043-if-console FR-005, FR-006, FR-007): its launcher, the command list the launcher
// returned, each command's description, its health from `doctor`, and the last check's results. Nothing is run until the
// workspace is trusted; a launcher that does not answer `command list` with a document this extension understands is not
// shown as an orchestrator, and the output channel says why.
const wire = require('./wire');
const forms = require('./forms');
const { Launcher } = require('./launcher');

const UNTRUSTED_WORDS = 'Nothing is shown for this repository because VS Code does not trust this workspace. Choose "Trust this workspace" to let IF Console run its command line; that decision is yours.';

class Repository {
  constructor({ folder, root, file, program, source, spawn, log, trusted, env }) {
    this.folder = folder;
    this.root = root;
    this.program = program;
    this.source = source;
    this.trusted = trusted || (() => true);
    this.launcher = new Launcher({ root, file, program, log, spawn, env });
    this.log = log || (() => {});
    this.state = 'unloaded';       // untrusted | ready | unavailable | update
    this.reason = '';
    this.list = null;
    this.details = new Map();
    this.nounValues = new Map();
    this.doctor = null;
    this.checks = new Map();       // section -> {status, findings, reason}
    this.fresh = null;
    this.proposals = null;
  }

  get key() { return this.folder.uri.toString(); }
  get name() { return this.list ? this.list.orchestrator : this.program; }
  get audience() { return this.list ? this.list.audience : 'unstated'; }
  get displayName() { return `${this.name} (${this.folder.name})`; }

  // The handshake: `command list --json` must be a document whose schema this extension understands.
  async load() {
    this.list = null;
    this.details.clear();
    this.nounValues.clear();
    if (!this.trusted()) { this.state = 'untrusted'; this.reason = UNTRUSTED_WORDS; return this; }
    const r = await this.launcher.run(['command', 'list']);
    if (r.failed || !r.doc) {
      this.state = 'unavailable';
      this.reason = `${this.program} did not answer "command list" (${r.failed || `exit ${r.exit}`}).`;
      this.log(this.reason);
      return this;
    }
    try {
      this.list = wire.commandList(r.doc);
      this.state = 'ready';
      this.reason = '';
    } catch (e) {
      this.state = e.code === 'update' ? 'update' : 'unavailable';
      this.reason = e.message;
      this.log(`${this.program}: ${e.message}`);
    }
    return this;
  }

  command(id) { return this.list ? this.list.commands.find((c) => c.id === id) || null : null; }
  has(id) { const c = this.command(id); return !!c; }
  editorCommands() { return this.list ? this.list.commands.filter(wire.exposed) : []; }
  nouns() { return this.list ? wire.nounsOf(this.list) : { nouns: new Map(), repoWide: [] }; }

  async detail(id) {
    if (this.details.has(id)) return this.details.get(id);
    const r = await this.launcher.run(['command', 'show', id]);
    if (r.failed || !r.doc) throw new wire.WireError('launcher', `${this.program} could not describe "${id}".`);
    const d = wire.commandDetail(r.doc);
    this.details.set(id, d);
    return d;
  }

  // The values a noun's `list` command offers (its resources), as links: [{rel, command, fields, label}].
  async resources(noun, limit) {
    if (!this.has(`${noun} list`)) return [];
    const r = await this.launcher.run([noun, 'list']);
    if (!r.doc || r.error) return [];
    const links = wire.linksOf(r.doc).filter((l) => l.command.split(/\s+/)[0] === noun);
    return limit ? links.slice(0, limit) : links;
  }

  async choicesFor(step, detail) {
    const noun = forms.nounForArgument(step, this.nouns().nouns);
    if (!noun || !this.has(`${noun} list`)) return null;
    if (!this.nounValues.has(noun)) {
      const r = await this.launcher.run([noun, 'list']);
      this.nounValues.set(noun, r.doc && !r.error ? forms.valuesFromList(r.doc, noun) : []);
    }
    const found = this.nounValues.get(noun);
    return found.length ? found : null;
  }

  async runDoctor() {
    const r = await this.launcher.run(['doctor']);
    if (r.doc && r.doc.kind === 'doctor') this.doctor = r.doc;
    return r;
  }

  get health() { return this.doctor ? wire.doctorState(this.doctor) : 'not checked yet'; }
}

module.exports = { Repository, UNTRUSTED_WORDS };
