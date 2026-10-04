'use strict';
// Forms built from a command's typed arguments (0043-if-console FR-013): one step for each argument, a quick pick where the
// type lists its values or the noun has a `list` command that returns them, a text input where it does not, and a last step
// that shows the whole command line before anything runs. Pure logic: the interface (`ui`) is passed in.

const CONTROLLED = new Set(['--dry-run', '--json', '--html']);  // the extension decides these, never the person

const dest = (flag) => flag.replace(/^-+/, '').replace(/-/g, '_');

function shellWord(w) {
  const s = String(w);
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, "'\\''")}'`;
}

// One line a person can paste into a terminal, with no placeholder (0041-command-line FR-055).
function commandLine(program, argv) {
  return [program, ...argv].map(shellWord).join(' ');
}

// The argument list of a command for values given by name (an action's `fields`, or what a form collected).
function argvFromFields(detail, fields) {
  const argv = [...detail.words];
  const f = fields || {};
  for (const a of detail.arguments) {
    const v = f[a.name];
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) argv.push(...v.map(String)); else argv.push(String(v));
  }
  for (const o of detail.options) {
    if (CONTROLLED.has(o.flag)) continue;
    const v = f[dest(o.flag)];
    if (v === undefined || v === null || v === false || v === '') continue;
    if (o.type === 'flag' || v === true) { argv.push(o.flag); continue; }
    for (const item of (Array.isArray(v) ? v : [v])) argv.push(o.flag, String(item));
  }
  return argv;
}

function formSteps(detail) {
  const steps = detail.arguments.map((a) => ({
    kind: 'argument', key: a.name, label: a.name.toUpperCase(), type: a.type, help: a.help, required: a.required, many: a.many,
    words: a.words, choices: a.choices }));
  const options = detail.options.filter((o) => !CONTROLLED.has(o.flag));
  for (const o of options.filter((x) => x.required)) steps.push(optionStep(o));
  return { steps, optional: options.filter((o) => !o.required).map(optionStep) };
}

function optionStep(o) {
  return { kind: 'option', key: dest(o.flag), flag: o.flag, label: o.flag, type: o.type, help: o.help, required: o.required,
    many: o.multiple, flagOnly: o.type === 'flag', choices: o.choices };
}

function splitValues(text) { return String(text).split(/[\s,]+/).filter(Boolean); }

// Ask for one step's value. Returns {value} (possibly empty for an optional step) or {cancelled:true}.
async function askStep(ui, detail, step, state, lookup, note) {
  const where = `${detail.id}: ${step.label}`;
  if (step.flagOnly) return { value: true };
  let choices = step.choices;
  if (!choices && lookup) choices = await lookup(step, detail);
  if (choices && choices.length) {
    const items = choices.map((c) => ({ label: String(c), value: String(c) }));
    if (!step.required) items.unshift({ label: '(none)', description: 'leave this out', value: undefined, none: true });
    const picked = await ui.pick({ title: where, placeholder: [step.help, note].filter(Boolean).join(' - ') || `Choose a ${step.type}`,
      items, canPickMany: !!step.many });
    if (picked === undefined) return { cancelled: true };
    if (step.many) return { value: picked.filter((v) => v !== undefined) };
    return { value: picked };
  }
  const value = await ui.input({ title: where, prompt: [step.help || `Enter ${step.type}`, note].filter(Boolean).join(' - '),
    placeholder: step.type, value: state.values[step.key] === undefined ? '' : String(state.values[step.key]),
    validate: (v) => (step.required && String(v).trim() === '' ? 'A value is needed here.' : undefined) });
  if (value === undefined) return { cancelled: true };
  if (String(value).trim() === '') return { value: undefined };
  return { value: step.many ? splitValues(value) : step.words ? String(value).trim() : String(value).trim() };
}

// Walk the steps. `lookup(step, detail)` resolves choices from the noun's `list` command. Returns {values} or {cancelled:true}.
async function collect(ui, detail, lookup, retry) {
  const { steps, optional } = formSteps(detail);
  const state = { values: {} };
  if (retry && retry.values) state.values = { ...retry.values };
  const only = retry && retry.key ? steps.concat(optional).find((s) => s.key === retry.key) : null;
  const wanted = retry && Array.isArray(retry.only) ? retry.only : null;   // an action's `needs`: only what it lacks
  const todo = only ? [only] : wanted ? steps.concat(optional).filter((x) => wanted.includes(x.key)) : steps;
  for (const step of todo) {
    const r = await askStep(ui, detail, step, state, lookup, only ? retry.message : '');
    if (r.cancelled) return { cancelled: true };
    if (r.value !== undefined && !(Array.isArray(r.value) && r.value.length === 0)) state.values[step.key] = r.value;
    else delete state.values[step.key];
  }
  if (!only && !wanted && optional.length) {
    const more = await ui.pick({ title: `${detail.id}: more settings`, placeholder: 'Choose any settings to add, or none',
      items: optional.map((s) => ({ label: s.label, description: s.help, value: s })), canPickMany: true });
    if (more === undefined) return { cancelled: true };
    for (const step of more) {
      const r = await askStep(ui, detail, step, state, lookup, '');
      if (r.cancelled) return { cancelled: true };
      if (r.value !== undefined) state.values[step.key] = r.value;
    }
  }
  return { values: state.values };
}

// The values a noun's `list` document offers for a typed argument: the `fields` of the links that fetch one resource.
function valuesFromList(doc, noun) {
  const out = [];
  for (const l of doc.links || []) {
    const words = String(l.command || '').split(/\s+/);
    if (words[0] !== noun || words[1] !== 'show') continue;
    const v = Object.values(l.fields || {})[0];
    if (v !== undefined) out.push(String(v));
  }
  return out;
}

// Which noun's `list` command offers values for an argument: the noun the type is named after, or the argument's own name.
function nounForArgument(step, nouns) {
  const candidates = [String(step.type || '').toLowerCase().replace(/_/g, '-'), String(step.key || '').toLowerCase().replace(/_/g, '-')];
  return candidates.find((c) => nouns.has(c)) || null;
}

module.exports = { shellWord, commandLine, argvFromFields, formSteps, collect, valuesFromList, nounForArgument, dest, CONTROLLED };
