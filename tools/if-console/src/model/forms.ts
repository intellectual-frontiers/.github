// Forms built from a command's typed arguments (0043-if-console FR-013): one step for each argument, a quick pick where the type
// lists its values or the noun has a `list` command that returns them, a text input where it does not, and a last step that shows the
// whole command line before anything runs. Pure logic: the interface (`FormUi`) is passed in.
import { asString } from './json';
import type { CommandDetail, Doc, Opt } from './wire';
import { linksOf } from './wire';
import { t } from '../l10n';

/** Flags the extension decides, never the person. */
export const CONTROLLED = new Set(['--dry-run', '--json', '--html']);

export const dest = (flag: string): string => flag.replace(/^-+/, '').replace(/-/g, '_');

export function shellWord(w: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(w) ? w : `'${w.replace(/'/g, "'\\''")}'`;
}

/** One line a person can paste into a terminal, with no placeholder (0041-command-line FR-055). */
export const commandLine = (program: string, argv: string[]): string => [program, ...argv].map(shellWord).join(' ');

/** A value given for a field: text, a list of texts or a flag. */
export type FieldValue = string | boolean | string[] | undefined | null;
export type Fields = Record<string, unknown>;

const present = (v: unknown): boolean => v !== undefined && v !== null && v !== '';

/** The argument list of a command for values given by name (an action's `fields`, or what a form collected). */
export function argvFromFields(detail: CommandDetail, fields: Fields | undefined): string[] {
  const argv = [...detail.words];
  const f = fields ?? {};
  for (const a of detail.arguments) {
    const v = f[a.name];
    if (!present(v)) continue;
    if (Array.isArray(v)) argv.push(...v.map((x) => asString(x))); else argv.push(asString(v));
  }
  for (const o of detail.options) {
    if (CONTROLLED.has(o.flag)) continue;
    const v = f[dest(o.flag)];
    if (!present(v) || v === false) continue;
    if (o.type === 'flag' || v === true) { argv.push(o.flag); continue; }
    for (const item of Array.isArray(v) ? v : [v]) argv.push(o.flag, asString(item));
  }
  return argv;
}

export interface Step {
  kind: 'argument' | 'option';
  key: string;
  label: string;
  type: string;
  help: string;
  required: boolean;
  many: boolean;
  words?: boolean;
  flag?: string;
  flagOnly?: boolean;
  choices: string[] | null;
}

function optionStep(o: Opt): Step {
  return { kind: 'option', key: dest(o.flag), flag: o.flag, label: o.flag, type: o.type, help: o.help, required: o.required, many: o.multiple,
    flagOnly: o.type === 'flag', choices: o.choices };
}

export function formSteps(detail: CommandDetail): { steps: Step[]; optional: Step[] } {
  const steps = detail.arguments.map((a): Step => ({ kind: 'argument', key: a.name, label: a.name.toUpperCase(), type: a.type, help: a.help,
    required: a.required, many: a.many, words: a.words, choices: a.choices }));
  const options = detail.options.filter((o) => !CONTROLLED.has(o.flag));
  for (const o of options.filter((x) => x.required)) steps.push(optionStep(o));
  return { steps, optional: options.filter((o) => !o.required).map(optionStep) };
}

const splitValues = (text: string): string[] => text.split(/[\s,]+/).filter(Boolean);

export interface PickItem<V> { label: string; description?: string; detail?: string; value: V }

/** What a form needs of the interface: a pick (one or many) and a text input. */
export interface FormUi {
  pick<V>(o: { title?: string; placeholder?: string; items: Array<PickItem<V>>; canPickMany?: boolean }): Promise<V | V[] | undefined>;
  input(o: { title?: string; prompt?: string; placeholder?: string; value?: string; validate?: (v: string) => string | undefined }): Promise<string | undefined>;
}

export type Lookup = (step: Step, detail: CommandDetail) => Promise<string[] | null>;

/** Where a form starts again: after a refused value, at that step with the type's message, or with an action's `needs` only. */
export interface Retry { values?: Fields; key?: string; message?: string; only?: string[] }

export type Collected = { cancelled: true } | { cancelled?: false; values: Fields };

type Asked = { cancelled: true } | { cancelled?: false; value: string | string[] | boolean | undefined };

async function askStep(ui: FormUi, detail: CommandDetail, step: Step, state: { values: Fields }, lookup: Lookup | null, note: string): Promise<Asked> {
  const where = `${detail.id}: ${step.label}`;
  if (step.flagOnly) return { value: true };
  let choices = step.choices;
  if (!choices && lookup) choices = await lookup(step, detail);
  if (choices && choices.length) {
    // "(none)" is `null`, not `undefined`: the interface answers `undefined` for a pick that was dismissed, which cancels the form.
    const items: Array<PickItem<string | null>> = choices.map((c) => ({ label: c, value: c }));
    if (!step.required) items.unshift({ label: t('(none)'), description: t('leave this out'), value: null });
    const picked = await ui.pick({ title: where, placeholder: [step.help, note].filter(Boolean).join(' - ') || `Choose a ${step.type}`, items, canPickMany: step.many });
    if (picked === undefined) return { cancelled: true };
    if (Array.isArray(picked)) return { value: picked.filter((v): v is string => v !== null) };
    return { value: picked ?? undefined };
  }
  const had = state.values[step.key];
  const value = await ui.input({ title: where, prompt: [step.help || `Enter ${step.type}`, note].filter(Boolean).join(' - '), placeholder: step.type,
    value: had === undefined ? '' : asString(had),
    validate: (v) => (step.required && v.trim() === '' ? 'A value is needed here.' : undefined) });
  if (value === undefined) return { cancelled: true };
  if (value.trim() === '') return { value: undefined };
  return { value: step.many ? splitValues(value) : value.trim() };
}

/** Walk the steps. `lookup(step, detail)` resolves choices from the noun's `list` command. */
export async function collect(ui: FormUi, detail: CommandDetail, lookup: Lookup | null, retry: Retry | null): Promise<Collected> {
  const { steps, optional } = formSteps(detail);
  const state: { values: Fields } = { values: {} };
  if (retry?.values) state.values = { ...retry.values };
  const everything = steps.concat(optional);
  const only = retry?.key ? everything.find((s) => s.key === retry.key) ?? null : null;
  const wanted = retry && Array.isArray(retry.only) ? retry.only : null;   // an action's `needs`: only what it lacks
  const todo = only ? [only] : wanted ? everything.filter((x) => wanted.includes(x.key)) : steps;
  for (const step of todo) {
    const r = await askStep(ui, detail, step, state, lookup, only ? retry?.message ?? '' : '');
    if (r.cancelled) return { cancelled: true };
    if (r.value !== undefined && !(Array.isArray(r.value) && r.value.length === 0)) state.values[step.key] = r.value;
    else delete state.values[step.key];
  }
  if (!only && !wanted && optional.length) {
    const more = await ui.pick<Step>({ title: `${detail.id}: more settings`, placeholder: t('Choose any settings to add, or none'),
      items: optional.map((s) => ({ label: s.label, description: s.help, value: s })), canPickMany: true });
    if (more === undefined) return { cancelled: true };
    for (const step of Array.isArray(more) ? more : [more]) {
      const r = await askStep(ui, detail, step, state, lookup, '');
      if (r.cancelled) return { cancelled: true };
      if (r.value !== undefined) state.values[step.key] = r.value;
    }
  }
  return { values: state.values };
}

/** The values a noun's `list` document offers for a typed argument: the `fields` of the links that fetch one resource. */
export function valuesFromList(doc: Doc, noun: string): string[] {
  const out: string[] = [];
  for (const l of linksOf(doc)) {
    const words = l.command.split(/\s+/);
    if (words[0] !== noun || words[1] !== 'show') continue;
    const v = Object.values(l.fields)[0];
    if (v !== undefined) out.push(asString(v));
  }
  return out;
}

/** Which noun's `list` command offers values for an argument: the noun the type is named after, or the argument's own name. */
export function nounForArgument(step: Pick<Step, 'type' | 'key'>, nouns: Map<string, unknown>): string | null {
  const candidates = [step.type.toLowerCase().replace(/_/g, '-'), step.key.toLowerCase().replace(/_/g, '-')];
  return candidates.find((c) => nouns.has(c)) ?? null;
}
