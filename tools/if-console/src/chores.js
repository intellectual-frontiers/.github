'use strict';
// The Chores view (0043-if-console FR-019): one place for what a person routinely does in a repository, derived from the
// launcher's own resources and from each command's category, never from a list of any one tool's commands.
const wire = require('./wire');

// Each category of command is a kind of chore, in the order a person meets them.
const CATEGORY_CHORES = [
  { category: 'generate', label: 'Regenerate and create', hint: 'writes tracked files from their source' },
  { category: 'build', label: 'Build', hint: 'writes output that is not itself the record' },
  { category: 'record', label: 'Record and propose', hint: 'adds a fact or a proposal to the record' },
  { category: 'decision', label: 'Decide', hint: 'only a person decides; each asks first' },
  { category: 'setup', label: 'Set up this machine', hint: 'changes the environment' },
];

const item = (kind, label, extra) => ({ kind, label, ...extra });

// `repo` is a Repository (or anything with the same fields): list, doctor, checks, fresh, proposals.
function deriveChores(repo) {
  if (!repo.list) return [];
  const groups = [];
  const editor = repo.editorCommands();
  const repoWide = editor.filter((c) => c.noun === null && c.category !== 'decision');
  groups.push({ id: 'repository', label: 'This repository',
    items: repoWide.map((c) => item('command', c.id, { command: c.id, description: c.help, category: c.category })) });

  const attention = [];
  for (const [section, r] of repo.checks || []) {
    if (r.status === 'failed') attention.push(item('section', `${section}: ${r.findings.length} finding${r.findings.length === 1 ? '' : 's'}`,
      { section, description: 'the last check found something; run it again after a fix' }));
  }
  const fresh = repo.fresh && repo.fresh.data ? repo.fresh : null;
  if (fresh) {
    for (const a of wire.actionsOf(fresh)) {
      if (a.enabled && wire.WRITES.includes(a.category)) attention.push(item('action', a.label, { action: a, description: 'a generated file is out of date' }));
    }
  }
  if (repo.doctor) {
    const absent = ((repo.doctor.data || {}).toolchain || []).filter((r) => r.cache === 'not fetched').map((r) => r.entry);
    for (const a of wire.actionsOf(repo.doctor)) {
      if (a.enabled && a.command !== 'doctor') attention.push(item('action', a.label, { action: a,
        description: absent.length ? 'a program this repository needs is not fetched yet' : 'doctor suggests it' }));
    }
    for (const p of ((repo.doctor.data || {}).conflicts || [])) attention.push(item('note', String(p), { description: 'doctor reports a problem' }));
  }
  groups.push({ id: 'attention', label: 'Needs attention', items: attention,
    empty: repo.doctor || fresh ? 'Nothing needs attention.' : 'Run Check, Fresh and Doctor to see what needs attention.' });

  const proposals = (repo.proposals || []).map((l) => item('resource', l.fields ? Object.values(l.fields)[0] : l.command, { link: l }));
  if (repo.has('proposal list') || repo.has('proposal new')) {
    const items = [];
    if (repo.has('proposal new')) items.push(item('command', 'proposal new', { command: 'proposal new', description: 'propose a change for a person to decide' }));
    items.push(...proposals);
    groups.push({ id: 'proposals', label: 'Proposals', items, empty: 'No open proposals.' });
  }

  for (const k of CATEGORY_CHORES) {
    const commands = editor.filter((c) => c.category === k.category && c.noun !== null && !(c.noun === 'proposal' && c.verb === 'new'));
    if (commands.length) {
      groups.push({ id: k.category, label: k.label, items: commands.map((c) => item('command', c.id, { command: c.id, description: c.help, category: c.category })) });
    }
  }
  groups.push({ id: 'help', label: 'Get help', items: [
    ...(repo.has('help') ? [item('ext', 'Learn', { command: 'if-console.learn', description: 'the help topics, each with its steps as buttons' })] : []),
    item('ext', 'Get Help', { command: 'if-console.getHelp', description: 'the report to paste to a person or an AI' }),
    item('ext', 'Copy Context', { command: 'if-console.copyContext', description: 'what an AI agent needs to know about a resource' }),
  ] });
  return groups;
}

module.exports = { deriveChores, CATEGORY_CHORES };
