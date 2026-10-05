// Running a command for a person (0043-if-console FR-013, FR-014, FR-015, FR-017, FR-020). The one path every command takes:
//   form (typed arguments) -> the whole command line -> for a write, a dry run, its diff, and the person's acceptance ->
//   for a decision, a modal confirmation that only a person can give -> the real run.
// There is no other path that runs a write, and none that runs a decision without the modal: this module exports no function that skips
// either, and the extension exports no API (FR-015).
import { argvFromFields, collect, dest, type Fields, type FormUi, type Retry } from '../model/forms';
import { changesOf, type Change } from '../model/preview';
import { DECISION, WRITES, type CommandDetail, type Doc, type ErrorInfo } from '../model/wire';
import type { Cancellation, RunResult } from './launcher';
import type { Repository } from './repository';
import { t } from '../l10n';

const MAX_RETRIES = 5;

/** Everything the executor asks of the interface, made of VS Code's own parts in views/ui.ts. */
export interface Ui extends FormUi {
  copy(text: string): Promise<void>;
  progress<T>(title: string, fn: (token: Cancellation, report: (doc: Doc) => void) => Promise<T>): Promise<T>;
  showFailure(repo: Repository, detail: CommandDetail, r: RunResult): Promise<void>;
  reviewChanges(o: { repo: Repository; detail: CommandDetail; changes: Change[] }): Promise<boolean>;
  reviewWithoutFiles(o: { repo: Repository; detail: CommandDetail; doc: Doc }): Promise<boolean>;
  confirmDecision(o: { repo: Repository; detail: CommandDetail; argv: string[]; changes: Change[]; line: string }): Promise<boolean>;
  showResult(repo: Repository, detail: CommandDetail, argv: string[], real: RunResult): Promise<void>;
}

export interface Refused { key: string; message: string }

export interface Outcome {
  ran: boolean;
  reason?: string;
  dry?: RunResult;
  real?: RunResult;
  refused?: Refused;
}

/** A command whose category writes is always run with --dry-run first; its changes are previewed and accepted. */
export async function runWrite(ui: Ui, repo: Repository, detail: CommandDetail, argv: string[], { token }: { token?: Cancellation } = {}): Promise<Outcome> {
  const dry = await repo.launcher.run([...argv, '--dry-run'], { token });
  if (dry.cancelled) return { ran: false, reason: 'cancelled' };
  const refused = refusedValue(detail, dry.error);
  if (refused) return { ran: false, dry, refused, reason: 'value refused' };
  if (dry.failed || !dry.doc || dry.error || dry.exit !== 0) {
    await ui.showFailure(repo, detail, dry);
    return { ran: false, dry, reason: 'dry-run failed' };
  }
  const changes = changesOf(dry.doc);
  const accepted = changes.length ? await ui.reviewChanges({ repo, detail, changes }) : await ui.reviewWithoutFiles({ repo, detail, doc: dry.doc });
  if (!accepted) return { ran: false, dry, reason: 'not accepted' };
  if (detail.category === DECISION) {
    const confirmed = await ui.confirmDecision({ repo, detail, argv, changes, line: repo.launcher.line(argv) });
    if (confirmed !== true) return { ran: false, dry, reason: 'decision not confirmed' };   // exactly true: nothing else confirms
  }
  const real = await ui.progress(`${repo.name} ${detail.id}`, (token, report) => repo.launcher.run(argv, { token, onDocument: report }));
  return { ...(await settle(ui, repo, detail, real)), dry };
}

/** What came back from the real run: cancelled, a value the launcher refused, a failure, or a result. */
async function settle(ui: Ui, repo: Repository, detail: CommandDetail, real: RunResult): Promise<Outcome> {
  if (real.cancelled) return { ran: false, real, reason: 'cancelled' };
  const refused = refusedValue(detail, real.error);
  if (refused) return { ran: false, real, refused, reason: 'value refused' };
  if (real.error || real.failed || !real.doc) { await ui.showFailure(repo, detail, real); return { ran: false, real, reason: 'failed' }; }
  return { ran: true, real };
}

export async function runRead(ui: Ui, repo: Repository, detail: CommandDetail, argv: string[]): Promise<Outcome> {
  const real = await ui.progress(`${repo.name} ${detail.id}`, (token, report) => repo.launcher.run(argv, { token, onDocument: report }));
  return settle(ui, repo, detail, real);
}

/** Run a command with the argv already decided. */
export async function runArgv(ui: Ui, repo: Repository, detail: CommandDetail, argv: string[]): Promise<Outcome> {
  const out = WRITES.includes(detail.category) ? await runWrite(ui, repo, detail, argv) : await runRead(ui, repo, detail, argv);
  if (out.ran && out.real) await ui.showResult(repo, detail, argv, out.real);
  return out;
}

/** The form: one step per argument, then the whole command line, then run. A value the launcher refuses puts the person back at that step
 * with the type's own message and examples (FR-013). */
export async function runForm(ui: Ui, repo: Repository, detailOrId: CommandDetail | string, presets?: Fields, only?: string[]): Promise<Outcome> {
  const detail = typeof detailOrId === 'string' ? await repo.detail(detailOrId) : detailOrId;
  let retry: Retry | null = presets || only ? { values: presets ?? {}, only } : null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const collected = await collect(ui, detail, (step) => repo.choicesFor(step), retry);
    if (collected.cancelled) return { ran: false, reason: 'cancelled' };
    const argv = argvFromFields(detail, collected.values);
    const line = repo.launcher.line(argv);
    const verb = WRITES.includes(detail.category) ? 'Show what it would change' : 'Run it';
    const choice = await ui.pick<'run' | 'copy'>({ title: `${detail.id}: ready`, placeholder: line,
      items: [{ label: verb, description: line, value: 'run' }, { label: t('Copy the command line'), description: t('to paste in a terminal'), value: 'copy' }] });
    if (choice === undefined) return { ran: false, reason: 'cancelled' };
    if (choice === 'copy') { await ui.copy(line); return { ran: false, reason: 'copied' }; }
    const out = await runArgv(ui, repo, detail, argv);
    if (out.refused) { retry = { values: collected.values, only, ...out.refused }; continue; }
    return out;
  }
  return { ran: false, reason: 'too many tries' };
}

export function refusedValue(detail: CommandDetail, error: ErrorInfo | null): Refused | null {
  if (!error || error.code !== 'invalid-argument' || !error.type) return null;
  const all = [...detail.arguments.map((a) => ({ key: a.name, type: a.type })), ...detail.options.map((o) => ({ key: dest(o.flag), type: o.type }))];
  const hit = all.find((x) => x.type === error.type);
  if (!hit) return null;
  const e = error.examples.length ? ` For example: ${error.examples.join(', ')}.` : '';
  return { key: hit.key, message: `${error.message}${e}` };
}
