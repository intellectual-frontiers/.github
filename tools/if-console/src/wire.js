'use strict';
// The wire shape every orchestrator uses for what the editor reads (0041-command-line FR-019, FR-064). Nothing here
// knows any one orchestrator: it reads documents and says what they hold.

const DECISION = 'decision';
const WRITES = ['record', 'build', 'generate', 'decision', 'setup'];  // every category but read and check (0041 FR-015)
// The versions of each document kind this extension reads. A kind it holds no entry for is read at version 1, the wire's first.
const SUPPORTED = { 'command-list': [1], command: [1], check: [1], doctor: [1], error: [1], fresh: [1], default: [1] };

class WireError extends Error {
  constructor(code, message, extra) {
    super(message);
    this.name = 'WireError';
    this.code = code;
    Object.assign(this, extra || {});
  }
}

function parseSchema(schema) {
  const m = /^([^/@\s]+)\/([^@\s]+)@(\d+)$/.exec(String(schema || ''));
  return m ? { orchestrator: m[1], kind: m[2], version: Number(m[3]) } : null;
}

// Returns {ok:true, schema} or {ok:false, code, message}. A newer version is "update needed" (0043 FR-021).
function checkSchema(doc, table) {
  const versions = table || SUPPORTED;
  const s = parseSchema(doc && doc.schema);
  if (!s) return { ok: false, code: 'schema', message: 'The command line answered with something this extension does not recognize as one of its documents.' };
  const known = versions[s.kind] || versions.default;
  if (!known.includes(s.version)) {
    return { ok: false, code: 'update', schema: s,
      message: `This command line answers in a newer form (${doc.schema}) than this extension understands. Update the IF Console extension to read it.` };
  }
  return { ok: true, schema: s };
}

// Parse standard output: one JSON document, or NDJSON, one document per line (0041 FR-019). Returns the documents.
function parseDocuments(text) {
  const t = String(text || '').trim();
  if (t === '') return [];
  try { return [JSON.parse(t)]; } catch (e) { /* NDJSON, below */ }
  const docs = [];
  for (const line of t.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    try { docs.push(JSON.parse(line)); } catch (e) { throw new WireError('json', 'The command line printed something that is not a document.'); }
  }
  return docs;
}

function wordsOf(id) { return String(id).trim().split(/\s+/); }

// `command list` -> {orchestrator, audience, commands}, each command with id, words, noun, verb, category, group, surfaces, help.
function commandList(doc) {
  const s = checkSchema(doc);
  if (!s.ok) throw new WireError(s.code, s.message);
  if (doc.kind !== 'command-list' || !doc.data || !Array.isArray(doc.data.commands)) {
    throw new WireError('schema', 'The command line did not answer `command list` with a list of commands.');
  }
  const commands = doc.data.commands.map((c) => {
    const words = wordsOf(c.id);
    return {
      id: words.join(' '), words,
      noun: c.noun !== undefined ? c.noun : (words.length === 2 ? words[0] : null),
      verb: c.verb !== undefined ? c.verb : (words.length === 2 ? words[1] : words[0]),
      category: c.category, group: c.group || null, surfaces: c.surfaces || [], help: c.help || '',
    };
  });
  return { orchestrator: s.schema.orchestrator, audience: doc.audience || 'unstated', commands };
}

const exposed = (c) => c.surfaces.includes('editor');

function nounsOf(list) {
  const nouns = new Map();
  const repoWide = [];
  for (const c of list.commands) {
    if (!exposed(c)) continue;
    if (c.noun === null) { repoWide.push(c); continue; }
    if (!nouns.has(c.noun)) nouns.set(c.noun, []);
    nouns.get(c.noun).push(c);
  }
  return { nouns, repoWide };
}

// `command show` -> {id, noun, verb, category, help, arguments, options, usage, surfaces, programs}
function commandDetail(doc) {
  const s = checkSchema(doc);
  if (!s.ok) throw new WireError(s.code, s.message);
  const d = doc.data;
  if (doc.kind !== 'command' || !d || !Array.isArray(d.arguments) || !Array.isArray(d.options)) {
    throw new WireError('schema', 'The command line did not describe the command in a form this extension reads.');
  }
  return {
    id: wordsOf(d.id).join(' '), words: wordsOf(d.id), noun: d.noun || null, verb: d.verb || null, category: d.category,
    help: d.help || '', group: d.group || null, usage: d.usage || '', surfaces: d.surfaces || [],
    programs: d.programs || d.toolchain || [],
    arguments: d.arguments.map((a) => ({ name: a.name, type: a.type, help: a.help || '', required: !!a.required,
      words: !!a.words, many: !!a.many, choices: Array.isArray(a.choices) ? a.choices : null })),
    options: d.options.map((o) => ({ flag: o.flag, type: o.type, help: o.help || '', multiple: !!o.multiple,
      required: !!o.required, choices: Array.isArray(o.choices) ? o.choices : null })),
  };
}

// An action the editor shows: only one the editor surface exposes; one that cannot run now is shown disabled with its reason.
function actionsOf(doc) {
  return (doc.actions || []).filter((a) => (a.surfaces || []).includes('editor')).map((a) => ({
    label: a.label, command: a.command, fields: a.fields || {}, category: a.category, cli: a.cli === undefined ? null : a.cli,
    enabled: a.enabled !== false, reason: a.reason || '', needs: a.needs || [],
  }));
}

function linksOf(doc) {
  return (doc.links || []).map((l) => ({ rel: l.rel, command: l.command, fields: l.fields || {}, cli: l.cli === undefined ? null : l.cli }));
}

// A `check` document -> {status, summary, sections:[{name,status,reason,findings:[{level,where,message,next}]}]}
function checkResult(doc) {
  const s = checkSchema(doc);
  if (!s.ok) throw new WireError(s.code, s.message);
  const d = doc.data;
  if (doc.kind !== 'check' || !d || !Array.isArray(d.sections)) throw new WireError('schema', 'The command line did not answer with check results.');
  return {
    status: d.status, summary: d.summary || {},
    sections: d.sections.map((x) => ({ name: x.name, status: x.status, reason: x.reason || '', notes: x.notes || [],
      findings: (x.findings || []).map((f) => ({ level: f.level, where: f.where || '', message: f.message || '', next: f.next || '' })) })),
  };
}

// The plain-words state of a `doctor` document: well, needs attention or something missing.
function doctorState(doc) {
  const status = doc && doc.data && doc.data.status;
  if (status === 'ok' || status === 'well' || status === 'passed') return 'well';
  if (status === 'missing') return 'something missing';
  if (status === 'failed' || status === 'attention') return 'needs attention';
  return 'unknown';
}

// An error document -> {code, message, type, value, examples}
function errorOf(doc) {
  if (!doc || doc.kind !== 'error') return null;
  const d = doc.data || {};
  return { code: d.code || doc.id, message: d.message || 'The command failed.', type: d.type || null, value: d.value,
    examples: d.examples || [], actions: actionsOf(doc) };
}

// The one-line label of a resource: its text rendering's first line is not in JSON, so use what the document carries.
function labelOf(doc) {
  const d = doc.data || {};
  return String(d.title || d.name || d.label || doc.id || doc.kind);
}

module.exports = { DECISION, WRITES, SUPPORTED, WireError, parseSchema, checkSchema, parseDocuments, commandList, nounsOf, exposed,
  commandDetail, actionsOf, linksOf, checkResult, doctorState, errorOf, labelOf, wordsOf };
