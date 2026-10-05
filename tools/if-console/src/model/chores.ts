// The Chores view (0043-if-console FR-019): one place for what a person routinely does in a repository, derived from the launcher's
// own resources and from each command's category, never from a list of any one tool's commands.
import { asArray, asObject, asString, firstValue } from './json';
import { actionsOf, WRITES, type Action, type CommandSummary, type Doc, type Finding, type Link } from './wire';

/** Each category of command is a kind of chore, in the order a person meets them. */
export const CATEGORY_CHORES = [
  { category: 'generate', label: 'Regenerate and create', hint: 'writes tracked files from their source' },
  { category: 'build', label: 'Build', hint: 'writes output that is not itself the record' },
  { category: 'record', label: 'Record and propose', hint: 'adds a fact or a proposal to the record' },
  { category: 'decision', label: 'Decide', hint: 'only a person decides; each asks first' },
  { category: 'setup', label: 'Set up this machine', hint: 'changes the environment' },
] as const;

export type Chore =
  | { kind: 'command'; label: string; command: string; description: string; category?: string }
  | { kind: 'section'; label: string; section: string; description: string }
  | { kind: 'action'; label: string; action: Action; description: string }
  | { kind: 'note'; label: string; description: string }
  | { kind: 'resource'; label: string; link: Link }
  | { kind: 'ext'; label: string; command: string; description: string };

export interface ChoreGroup { id: string; label: string; items: Chore[]; empty?: string }

/** What the chores are derived from: a repository, or anything with these fields. */
export interface ChoreSource {
  list: unknown;
  checks: Map<string, { status: string; findings: Finding[]; reason: string }>;
  fresh: Doc | null;
  doctor: Doc | null;
  proposals: Link[] | null;
  editorCommands(): CommandSummary[];
  has(id: string): boolean;
}

const plural = (n: number): string => `${n} finding${n === 1 ? '' : 's'}`;

export function deriveChores(repo: ChoreSource): ChoreGroup[] {
  if (!repo.list) return [];
  const groups: ChoreGroup[] = [];
  const editor = repo.editorCommands();
  const repoWide = editor.filter((c) => c.noun === null && c.category !== 'decision');
  groups.push({ id: 'repository', label: 'This repository',
    items: repoWide.map((c): Chore => ({ kind: 'command', label: c.id, command: c.id, description: c.help, category: c.category })) });

  const attention: Chore[] = [];
  for (const [section, r] of repo.checks) {
    if (r.status === 'failed') attention.push({ kind: 'section', label: `${section}: ${plural(r.findings.length)}`, section, description: 'the last check found something; run it again after a fix' });
  }
  const fresh = repo.fresh;
  if (fresh) {
    for (const a of actionsOf(fresh)) {
      if (a.enabled && WRITES.includes(a.category)) attention.push({ kind: 'action', label: a.label, action: a, description: 'a generated file is out of date' });
    }
  }
  if (repo.doctor) {
    const absent = asArray(repo.doctor.data.toolchain).map(asObject).filter((r) => r.cache === 'not fetched').map((r) => asString(r.entry));
    for (const a of actionsOf(repo.doctor)) {
      if (a.enabled && a.command !== 'doctor') attention.push({ kind: 'action', label: a.label, action: a,
        description: absent.length ? 'a program this repository needs is not fetched yet' : 'doctor suggests it' });
    }
    for (const p of asArray(repo.doctor.data.conflicts)) attention.push({ kind: 'note', label: asString(p), description: 'doctor reports a problem' });
  }
  groups.push({ id: 'attention', label: 'Needs attention', items: attention,
    empty: repo.doctor || fresh ? 'Nothing needs attention.' : 'Run Check, Fresh and Doctor to see what needs attention.' });

  if (repo.has('proposal list') || repo.has('proposal new')) {
    const items: Chore[] = [];
    if (repo.has('proposal new')) items.push({ kind: 'command', label: 'proposal new', command: 'proposal new', description: 'propose a change for a person to decide' });
    for (const l of repo.proposals ?? []) items.push({ kind: 'resource', label: firstValue(l.fields) ?? l.command, link: l });
    groups.push({ id: 'proposals', label: 'Proposals', items, empty: 'No open proposals.' });
  }

  for (const k of CATEGORY_CHORES) {
    const commands = editor.filter((c) => c.category === k.category && c.noun !== null && !(c.noun === 'proposal' && c.verb === 'new'));
    if (commands.length) {
      groups.push({ id: k.category, label: k.label, items: commands.map((c): Chore => ({ kind: 'command', label: c.id, command: c.id, description: c.help, category: c.category })) });
    }
  }
  groups.push({ id: 'help', label: 'Get help', items: [
    ...(repo.has('help') ? [{ kind: 'ext', label: 'Learn', command: 'if-console.learn', description: 'the help topics, each with its steps as buttons' } as const] : []),
    { kind: 'ext', label: 'Get Help', command: 'if-console.getHelp', description: 'the report to paste to a person or an AI' },
    { kind: 'ext', label: 'Copy Context', command: 'if-console.copyContext', description: 'what an AI agent needs to know about a resource' },
  ] });
  return groups;
}
