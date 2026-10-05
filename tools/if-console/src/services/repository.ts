// One workspace folder's repository (0043-if-console FR-005, FR-006, FR-007): its launcher, the command list the launcher returned, each
// command's description, its health from `doctor`, and the last check's results. Nothing is run until the workspace is trusted; a launcher
// that does not answer `command list` with a document this extension understands is not shown as an orchestrator, and the log says why.
import type * as vscode from 'vscode';
import { valuesFromList, nounForArgument, commandLine, type Step } from '../model/forms';
import { doctorState, commandDetail, commandList, exposed, linksOf, nounsOf, WireError, type CommandDetail, type CommandList, type CommandSummary, type Doc, type Finding, type Health, type Link, type Nouns } from '../model/wire';
import { Launcher, type RunResult, type SpawnFn } from './launcher';
import { RegistryCache } from './registry';

export const UNTRUSTED_WORDS = 'Nothing is shown for this repository because VS Code does not trust this workspace. Choose "Trust this workspace" to let IF Console run its command line; that decision is yours.';

export type RepoState = 'unloaded' | 'untrusted' | 'ready' | 'unavailable' | 'update';

export interface CheckRecord { status: string; findings: Finding[]; reason: string }

export interface RepositoryInit {
  folder: vscode.WorkspaceFolder;
  root: string;
  file: string;
  program: string;
  source: string;
  spawn?: SpawnFn;
  log?: (line: string) => void;
  trusted?: () => boolean;
  env?: NodeJS.ProcessEnv;
}

export class Repository {
  readonly folder: vscode.WorkspaceFolder;
  readonly root: string;
  readonly program: string;
  readonly source: string;
  readonly trusted: () => boolean;
  readonly launcher: Launcher;
  readonly registry = new RegistryCache();
  state: RepoState = 'unloaded';
  reason = '';
  doctor: Doc | null = null;
  readonly checks = new Map<string, CheckRecord>();   // section -> its last result
  fresh: Doc | null = null;
  proposals: Link[] | null = null;
  private readonly log: (line: string) => void;

  constructor({ folder, root, file, program, source, spawn, log, trusted, env }: RepositoryInit) {
    this.folder = folder;
    this.root = root;
    this.program = program;
    this.source = source;
    this.trusted = trusted ?? (() => true);
    this.log = log ?? (() => undefined);
    this.launcher = new Launcher({ root, file, program, log, spawn, env });
  }

  get key(): string { return this.folder.uri.toString(); }
  get list(): CommandList | null { return this.registry.list; }
  get name(): string { return this.list ? this.list.orchestrator : this.program; }
  get audience(): string { return this.list ? this.list.audience : 'unstated'; }
  get displayName(): string { return `${this.name} (${this.folder.name})`; }
  get health(): Health | 'not checked yet' { return this.doctor ? doctorState(this.doctor) : 'not checked yet'; }

  /** The handshake: `command list --json` must be a document whose schema this extension understands. */
  async load(): Promise<this> {
    this.registry.clear();
    if (!this.trusted()) { this.state = 'untrusted'; this.reason = UNTRUSTED_WORDS; return this; }
    const r = await this.launcher.run(['command', 'list']);
    if (r.failed || !r.doc) {
      this.state = 'unavailable';
      this.reason = `${this.program} did not answer "command list" (${r.failed ?? `exit ${String(r.exit)}`}).`;
      this.log(this.reason);
      return this;
    }
    try {
      this.registry.list = commandList(r.doc);
      this.state = 'ready';
      this.reason = '';
    } catch (e) {
      const wire = e instanceof WireError ? e : null;
      this.state = wire?.code === 'update' ? 'update' : 'unavailable';
      this.reason = e instanceof Error ? e.message : String(e);
      this.log(`${this.program}: ${this.reason}`);
    }
    return this;
  }

  /** Forget what the launcher said, so that the next read asks again (its file or its declaration changed). */
  invalidate(): void { this.registry.clear(); }

  command(id: string): CommandSummary | null { return this.list?.commands.find((c) => c.id === id) ?? null; }
  has(id: string): boolean { return this.command(id) !== null; }
  editorCommands(): CommandSummary[] { return this.list ? this.list.commands.filter(exposed) : []; }
  nouns(): Nouns { return this.list ? nounsOf(this.list) : { nouns: new Map(), repoWide: [] }; }
  line(argv: string[]): string { return commandLine(this.program, argv); }

  async detail(id: string): Promise<CommandDetail> {
    const held = this.registry.details.get(id);
    if (held) return held;
    const r = await this.launcher.run(['command', 'show', id]);
    if (r.failed || !r.doc) throw new WireError('launcher', `${this.program} could not describe "${id}".`);
    const d = commandDetail(r.doc);
    this.registry.details.set(id, d);
    return d;
  }

  /** The values a noun's `list` command offers (its resources), as links. */
  async resources(noun: string, limit?: number): Promise<Link[]> {
    if (!this.has(`${noun} list`)) return [];
    const r = await this.launcher.run([noun, 'list']);
    if (!r.doc || r.error) return [];
    const links = linksOf(r.doc).filter((l) => l.command.split(/\s+/)[0] === noun);
    return limit ? links.slice(0, limit) : links;
  }

  async choicesFor(step: Pick<Step, 'type' | 'key'>): Promise<string[] | null> {
    const noun = nounForArgument(step, this.nouns().nouns);
    if (!noun || !this.has(`${noun} list`)) return null;
    if (!this.registry.nounValues.has(noun)) {
      const r = await this.launcher.run([noun, 'list']);
      this.registry.nounValues.set(noun, r.doc && !r.error ? valuesFromList(r.doc, noun) : []);
    }
    const found = this.registry.nounValues.get(noun) ?? [];
    return found.length ? found : null;
  }

  async runDoctor(): Promise<RunResult> {
    const r = await this.launcher.run(['doctor']);
    if (r.doc && r.doc.kind === 'doctor') this.doctor = r.doc;
    return r;
  }
}
