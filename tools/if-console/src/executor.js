'use strict';
// Running a command for a person (0043-if-console FR-013, FR-014, FR-015, FR-017, FR-020). The one path every command takes:
//   form (typed arguments) -> the whole command line -> for a write, a dry run, its diff, and the person's acceptance ->
//   for a decision, a modal confirmation that only a person can give -> the real run.
// There is no other path that runs a write, and none that runs a decision without the modal: this module exports no
// function that skips either, and the extension exports no API (FR-015).
const wire = require('./wire');
const forms = require('./forms');
const preview = require('./preview');

const MAX_RETRIES = 5;

// A command whose category writes is always run with --dry-run first; its changes are previewed and accepted.
// Returns {ran:boolean, dry?, real?, reason?}.
async function runWrite(ui, repo, detail, argv, { signal } = {}) {
  const dry = await repo.launcher.run([...argv, '--dry-run'], { signal });
  if (dry.cancelled) return { ran: false, reason: 'cancelled' };
  const refused = refusedValue(detail, dry.error);
  if (refused) return { ran: false, dry, refused, reason: 'value refused' };
  if (dry.failed || !dry.doc || dry.error || dry.exit !== 0) {
    await ui.showFailure(repo, detail, dry);
    return { ran: false, dry, reason: 'dry-run failed' };
  }
  const changes = preview.changesOf(dry.doc);
  const accepted = changes.length
    ? await ui.reviewChanges({ repo, detail, argv, changes, doc: dry.doc })
    : await ui.reviewWithoutFiles({ repo, detail, argv, doc: dry.doc });
  if (!accepted) return { ran: false, dry, reason: 'not accepted' };
  if (detail.category === wire.DECISION) {
    const confirmed = await ui.confirmDecision({ repo, detail, argv, changes, doc: dry.doc,
      line: repo.launcher.line(argv) });
    if (confirmed !== true) return { ran: false, dry, reason: 'decision not confirmed' };
  }
  const real = await ui.progress(`${repo.name} ${detail.id}`, (signal2, report) =>
    repo.launcher.run(argv, { signal: signal2, onDocument: (d) => report(d) }));
  const out = await settle(ui, repo, detail, real);
  return { ...out, dry };
}

// What came back from the real run: cancelled, a value the launcher refused, a failure, or a result.
async function settle(ui, repo, detail, real) {
  if (real.cancelled) return { ran: false, real, reason: 'cancelled' };
  const refused = refusedValue(detail, real.error);
  if (refused) return { ran: false, real, refused, reason: 'value refused' };
  if (real.error || real.failed || !real.doc) { await ui.showFailure(repo, detail, real); return { ran: false, real, reason: 'failed' }; }
  return { ran: true, real };
}

async function runRead(ui, repo, detail, argv) {
  const real = await ui.progress(`${repo.name} ${detail.id}`, (signal, report) =>
    repo.launcher.run(argv, { signal, onDocument: (d) => report(d) }));
  return settle(ui, repo, detail, real);
}

// Run a command with the argv already decided.
async function runArgv(ui, repo, detail, argv) {
  const out = wire.WRITES.includes(detail.category) ? await runWrite(ui, repo, detail, argv) : await runRead(ui, repo, detail, argv);
  if (out.ran) await ui.showResult(repo, detail, argv, out.real, { dry: out.dry });
  return out;
}

// The form: one step per argument, then the whole command line, then run. A value the launcher refuses puts the person back at
// that step with the type's own message and examples (FR-013).
async function runForm(ui, repo, detailOrId, presets, only) {
  const detail = typeof detailOrId === 'string' ? await repo.detail(detailOrId) : detailOrId;
  let retry = presets || only ? { values: presets || {}, only } : null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const collected = await forms.collect(ui, detail, (step, d) => repo.choicesFor(step, d), retry);
    if (collected.cancelled) return { ran: false, reason: 'cancelled' };
    const argv = forms.argvFromFields(detail, collected.values);
    const line = repo.launcher.line(argv);
    const verb = wire.WRITES.includes(detail.category) ? 'Show what it would change' : 'Run it';
    const choice = await ui.pick({ title: `${detail.id}: ready`, placeholder: line,
      items: [{ label: verb, description: line, value: 'run' }, { label: 'Copy the command line', description: 'to paste in a terminal', value: 'copy' }] });
    if (choice === undefined) return { ran: false, reason: 'cancelled' };
    if (choice === 'copy') { await ui.copy(line); return { ran: false, reason: 'copied' }; }
    const out = await runArgv(ui, repo, detail, argv);
    if (out.refused) { retry = { values: collected.values, only, ...out.refused }; continue; }
    return out;
  }
  return { ran: false, reason: 'too many tries' };
}

function refusedValue(detail, error) {
  if (!error || error.code !== 'invalid-argument' || !error.type) return null;
  const all = [...detail.arguments.map((a) => ({ key: a.name, type: a.type })),
    ...detail.options.map((o) => ({ key: forms.dest(o.flag), type: o.type }))];
  const hit = all.find((x) => x.type === error.type);
  if (!hit) return null;
  const e = error.examples && error.examples.length ? ` For example: ${error.examples.join(', ')}.` : '';
  return { key: hit.key, message: `${error.message}${e}` };
}

module.exports = { runArgv, runForm, runWrite, runRead, refusedValue };
