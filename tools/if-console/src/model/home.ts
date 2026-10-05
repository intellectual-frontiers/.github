// What needs a person (0043-if-console FR-037), derived from the launcher's own resources and nothing else: the check sections whose last run
// failed, the open proposals, the generated files `fresh` reports stale, the toolchain entries and libraries `doctor` reports absent, the
// state `doctor` gives, and a workspace that is not trusted. Every item is actionable (the owner's rule): it says in plain words what is
// wrong, gives the exact command line that fixes it and a way to run it, or, where no command does, says what the person must do themselves.
// Home adds no item that the launcher has no command for (FR-003).
import { asArray, asObject, asString, asStrings, firstValue } from './json';
import type { Status } from './presentation';
import { SEVERITY } from './status';
import { actionsOf, WRITES, type Action, type CommandSummary, type Doc, type Finding, type Link } from './wire';

/** What running a suggestion does. A `words` run is a command the launcher offers, run through the one path every command takes. */
export type Run =
  | { kind: 'action'; action: Action }
  | { kind: 'words'; words: string[] }
  | { kind: 'section'; section: string }
  | { kind: 'resource'; link: Link }
  | { kind: 'ext'; command: string };

/** The commands of VS Code and of this extension that a suggestion may run: nothing a launcher says can name another. */
export const EXT_COMMANDS: readonly string[] = ['if-console.trust', 'if-console.learn', 'if-console.getHelp', 'if-console.copyContext', 'if-console.refresh',
  'workbench.extensions.action.checkForUpdates'];

export interface Suggestion {
  id: string;
  group: 'checks' | 'proposals' | 'generated' | 'toolchain' | 'health' | 'trust' | 'help';
  status: Status;
  /** What is wrong, in plain words. */
  label: string;
  /** More plain words, for the tooltip. */
  why: string;
  /** The exact command line that fixes it, to paste in a terminal; null where no single line does. */
  commandLine: string | null;
  run: Run | null;
  /** The button's words: "Run check docs again". */
  runLabel: string;
  /** What the person must do themselves, where no command does it. */
  yourself: string | null;
  /** A check section's findings, shown under it. */
  findings: Finding[];
  /** Whether it counts toward the view's badge: what needs a person, not a suggestion to look. */
  counts: boolean;
}

/** What deriving needs of a repository. */
export interface HomeSource {
  name: string;
  program: string;
  state: string;
  reason: string;
  checks: Map<string, { status: string; findings: Finding[]; reason: string }>;
  fresh: Doc | null;
  doctor: Doc | null;
  proposals: Link[] | null;
  has(id: string): boolean;
  command(id: string): CommandSummary | null;
  line(argv: string[]): string;
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

function make(partial: Partial<Suggestion> & Pick<Suggestion, 'id' | 'group' | 'status' | 'label'>): Suggestion {
  return { why: '', commandLine: null, run: null, runLabel: '', yourself: null, findings: [], counts: partial.status === 'error' || partial.status === 'warning' || partial.status === 'pending', ...partial };
}

const again = (src: HomeSource, id: string, words: string[], label: string, group: Suggestion['group'], what: string, why: string): Suggestion =>
  make({ id, group, status: 'info', label: what, why, commandLine: src.line(words), run: { kind: 'words', words }, runLabel: label, counts: false });

// --- check sections ----------------------------------------------------------------------------------------------------
function checkItems(src: HomeSource): Suggestion[] {
  const out: Suggestion[] = [];
  for (const [section, r] of src.checks) {
    const problems = r.findings.filter((f) => f.level === 'error' || f.level === 'warning').length;
    if (r.status === 'failed') {
      out.push(make({ id: `check:${section}`, group: 'checks', status: 'error', label: `${section}: ${plural(problems || 1, 'problem')} to fix`,
        why: `The last check of "${section}" failed. Open each finding, make the change it names, then run the check again.`,
        commandLine: src.line(['check', section]), run: { kind: 'section', section }, runLabel: `Run check ${section} again`, findings: r.findings }));
    } else if (r.status === 'passed' && problems > 0) {
      out.push(make({ id: `check:${section}`, group: 'checks', status: 'warning', label: `${section}: ${plural(problems, 'warning')}`,
        why: `The check of "${section}" passed with warnings. They do not block anything; fix them when you can.`,
        commandLine: src.line(['check', section]), run: { kind: 'section', section }, runLabel: `Run check ${section} again`, findings: r.findings }));
    }
  }
  if (src.has('check') && src.checks.size === 0) {
    out.push(again(src, 'check:none', ['check', '--changed'], 'Run check on changes', 'checks', 'Nothing checked yet',
      'Nothing has been checked in this window yet. This runs only the checks whose files changed, which is quick.'));
  }
  return out;
}

// --- proposals ---------------------------------------------------------------------------------------------------------
const proposalItems = (src: HomeSource): Suggestion[] => (src.proposals ?? []).map((l) => make({
  id: `proposal:${firstValue(l.fields) ?? l.command}`, group: 'proposals', status: 'pending', label: `${firstValue(l.fields) ?? 'A proposal'} waits for your decision`,
  why: 'A change was drafted for a person to decide. Read it, then accept it or leave it; only you can decide.',
  commandLine: l.cli, run: { kind: 'resource', link: l }, runLabel: 'Open proposal' }));

// --- generated files ---------------------------------------------------------------------------------------------------
function freshItems(src: HomeSource): Suggestion[] {
  const fresh = src.fresh;
  if (!fresh) {
    return src.has('fresh') ? [again(src, 'fresh:none', ['fresh'], 'Prove generated files', 'generated', 'Generated files not proved yet',
      'Nobody has asked yet whether the generated files match their sources. Proving it writes nothing, but it can take a minute.')] : [];
  }
  const out: Suggestion[] = [];
  const stale = asArray(fresh.data.generators).map(asObject).filter((g) => asString(g.status) === 'stale');
  const files = stale.reduce((n, g) => n + asArray(g.stale).length, 0);
  for (const a of actionsOf(fresh)) {
    if (!a.enabled || !WRITES.includes(a.category)) continue;
    out.push(make({ id: `fresh:${a.command}:${JSON.stringify(a.fields)}`, group: 'generated', status: 'warning', label: capital(a.label),
      why: `${files ? plural(files, 'generated file') : 'A generated file'} no longer matches its source. Running this rewrites it; you see what would change first.`,
      commandLine: a.cli, run: { kind: 'action', action: a }, runLabel: capital(a.label) }));
  }
  if (!out.length && asString(fresh.data.status) === 'stale') {
    out.push(make({ id: 'fresh:stale', group: 'generated', status: 'warning', label: `${plural(files || stale.length, 'generated file')} out of date`,
      why: 'A generated file no longer matches its source, and the command line offers no single command that rewrites it.',
      commandLine: src.line(['fresh']), run: { kind: 'words', words: ['fresh'] }, runLabel: 'Prove again',
      yourself: 'Regenerate the files named in the fresh report with the command it gives for each.' }));
  }
  return out;
}

const capital = (s: string): string => (s ? s[0]?.toUpperCase() + s.slice(1) : s);

/** The first command in backticks in a hint, with the orchestrator's own name in front of it replaced by the launcher's path. */
export function commandIn(hint: string, src: Pick<HomeSource, 'name' | 'program'>): { line: string; words: string[] } | null {
  const m = /`([^`]+)`/.exec(hint);
  if (!m) return null;
  const tokens = (m[1] ?? '').trim().split(/\s+/);
  const words = tokens[0] === src.name || tokens[0] === src.program ? tokens.slice(1) : tokens;
  if (!words.length) return null;
  return { line: [src.program, ...words].join(' '), words };
}

/** The command of the launcher that a command line's words begin with (the rest are its values), or null where it offers none. */
function offered(src: HomeSource, words: string[]): CommandSummary | null {
  for (let n = Math.min(words.length, 3); n >= 1; n -= 1) { const c = src.command(words.slice(0, n).join(' ')); if (c) return c; }
  return null;
}

// --- doctor ------------------------------------------------------------------------------------------------------------
const NOT_READY = new Set(['ready', 'n/a', 'override', '']);

function doctorItems(src: HomeSource): Suggestion[] {
  const doctor = src.doctor;
  if (!doctor) return [];
  const d = doctor.data;
  const out: Suggestion[] = [];
  const actions = actionsOf(doctor).filter((a) => a.enabled && a.command !== 'doctor');
  const used = new Set<Action>();
  const doctorAgain = { run: { kind: 'words', words: ['doctor'] } as Run, runLabel: 'Run doctor again', commandLine: src.line(['doctor']) };

  for (const row of asArray(d.toolchain).map(asObject)) {
    const entry = asString(row.entry ?? row.name);
    const state = asString(row.cache ?? row.state);
    if (!entry || NOT_READY.has(state)) continue;
    const needed = asStrings(row['needed by']).join(', ');
    const why = [needed ? `Needed by: ${needed}.` : '', asString(row.detail)].filter(Boolean).join(' ');
    const a = actions.find((x) => asStrings(x.fields.entries).includes(entry) || x.label.includes(entry));
    const hint = asString(row.hint ?? row.fix);
    const fromHint = hint ? commandIn(hint, src) : null;
    const label = state === 'not fetched' || state === 'missing' ? `${entry} is not fetched yet` : `${entry} is not ready: ${state}`;
    if (a) { used.add(a); out.push(make({ id: `toolchain:${entry}`, group: 'toolchain', status: 'warning', label, why, commandLine: a.cli, run: { kind: 'action', action: a }, runLabel: capital(a.label) })); continue; }
    if (fromHint && offered(src, fromHint.words)?.surfaces.includes('editor')) {
      out.push(make({ id: `toolchain:${entry}`, group: 'toolchain', status: 'warning', label, why, commandLine: fromHint.line, run: { kind: 'words', words: fromHint.words }, runLabel: capital(fromHint.words.join(' ')) }));
      continue;
    }
    out.push(make({ id: `toolchain:${entry}`, group: 'toolchain', status: 'warning', label, why, ...doctorAgain, commandLine: fromHint?.line ?? doctorAgain.commandLine,
      yourself: hint || 'Set it up as the command line says, then run doctor again.' }));
  }
  for (const a of actions) {
    if (used.has(a)) continue;
    out.push(make({ id: `doctor:${a.command}:${JSON.stringify(a.fields)}`, group: 'health', status: 'warning', label: capital(a.label), why: 'Doctor suggests it.',
      commandLine: a.cli, run: { kind: 'action', action: a }, runLabel: capital(a.label) }));
  }
  for (const p of [...asArray(d.conflicts), ...asArray(d.toolchain_problems)]) {
    const text = asString(p).trim();
    if (text) out.push(make({ id: `conflict:${text}`, group: 'health', status: 'error', label: text.length > 140 ? `${text.slice(0, 139)}…` : text, why: 'Doctor found a problem in how this repository is set up.',
      ...doctorAgain, yourself: 'Correct what it names in the files it names, then run doctor again.' }));
  }
  for (const p of asArray(d.prerequisites).map(asObject)) {
    if (p.present === false) {
      out.push(make({ id: `prerequisite:${asString(p.name)}`, group: 'health', status: 'error', label: `${asString(p.name)} is not installed`, why: 'This command line needs it on this machine.',
        ...doctorAgain, yourself: asString(p.hint) || `Install ${asString(p.name)}, then run doctor again.` }));
    }
  }
  const libs = asObject(d['system libraries'] ?? d.system_libraries);
  const gone = asStrings(libs.missing);
  if (gone.length) {
    const hint = asString(libs.hint);
    const cmd = commandIn(hint, src);
    const found = cmd ? offered(src, cmd.words) : null;
    const editor = found !== null && found.surfaces.includes('editor');
    out.push(make({ id: 'libraries', group: 'toolchain', status: 'warning', label: `${plural(gone.length, 'system library', 'system libraries')} missing: ${gone.slice(0, 3).join(', ')}${gone.length > 3 ? ', …' : ''}`,
      why: 'A browser this command line fetches needs them on this machine. They are installed once with your administrator password.',
      commandLine: cmd?.line ?? null, run: editor && cmd ? { kind: 'words', words: cmd.words } : doctorAgain.run, runLabel: editor && cmd ? capital(cmd.words.join(' ')) : doctorAgain.runLabel,
      yourself: editor ? null : `${cmd ? 'Run it in a terminal, since it asks before using your administrator rights.' : 'Install them with your system’s package manager.'} ${hint}`.trim() }));
  }
  for (const m of asStrings(d.missing)) {
    if (/system librar/i.test(m) || out.some((i) => i.id === `toolchain:${m}`)) continue;
    out.push(make({ id: `missing:${m}`, group: 'health', status: 'warning', label: `${m} is missing`, why: 'Doctor reports it absent.', ...doctorAgain, yourself: 'Set it up as the command line says, then run doctor again.' }));
  }
  for (const row of asArray(d.state).map(asObject)) {
    const level = asString(row.level);
    if (level === 'ok' || !level) continue;
    const status: Status = level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'info';
    out.push(make({ id: `state:${asString(row.label)}`, group: 'health', status, label: `${asString(row.label)}: ${asString(row.note)}`.trim(), why: 'Doctor reports the state of this clone.',
      ...doctorAgain, yourself: asString(row.advice) || 'Look at it, then run doctor again.' }));
  }
  return out;
}

// --- the whole --------------------------------------------------------------------------------------------------------
export interface HomeItems { needs: Suggestion[]; help: Suggestion[] }

export function deriveHome(src: HomeSource): HomeItems {
  const needs: Suggestion[] = [];
  if (src.state === 'untrusted') {
    needs.push(make({ id: 'trust', group: 'trust', status: 'warning', label: `Trust this workspace to use ${src.program}`,
      why: src.reason, run: { kind: 'ext', command: 'if-console.trust' }, runLabel: 'Trust this workspace…',
      yourself: 'Trusting a workspace is a decision only you can make; VS Code asks you.' }));
  } else if (src.state === 'update') {
    needs.push(make({ id: 'update', group: 'trust', status: 'warning', label: `Update IF Console to read ${src.program}`, why: `${src.program} answers in a newer form than this extension reads. ${src.reason}`,
      run: { kind: 'ext', command: 'workbench.extensions.action.checkForUpdates' }, runLabel: 'Check for updates', yourself: 'Update the IF Console extension.' }));
  } else if (src.state === 'ready') {
    needs.push(...checkItems(src), ...proposalItems(src), ...freshItems(src), ...doctorItems(src));
  }
  needs.sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status]);
  const help: Suggestion[] = [];
  if (src.state === 'ready') {
    if (src.has('help')) help.push(make({ id: 'help:learn', group: 'help', status: 'muted', label: 'Learn how this works', why: 'The help topics of this command line, each with its steps as buttons.', run: { kind: 'ext', command: 'if-console.learn' }, runLabel: 'Learn', counts: false }));
    help.push(make({ id: 'help:report', group: 'help', status: 'muted', label: 'Copy a report to ask for help', why: 'Doctor and, if you choose, a resource, with passwords and keys removed. Nothing is sent anywhere.', run: { kind: 'ext', command: 'if-console.getHelp' }, runLabel: 'Get help', counts: false }));
    if (src.has('context')) help.push(make({ id: 'help:context', group: 'help', status: 'muted', label: 'Copy what an AI agent needs to know', why: 'The context of a resource you choose, with passwords and keys removed.', run: { kind: 'ext', command: 'if-console.copyContext' }, runLabel: 'Copy context', counts: false }));
  }
  return { needs, help };
}

export const countOf = (items: Suggestion[]): number => items.filter((i) => i.counts).length;
