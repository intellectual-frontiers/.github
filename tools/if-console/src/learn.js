'use strict';
// Learn (0043-if-console FR-031): a repository's help topics, each shown as a resource with its steps as buttons. The topics, their
// words and their steps are the launcher's; this builds a page from the resource it returned and holds none of its own.

const esc = (v) => String(v === undefined || v === null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// `help` -> [{topic, summary}]
function topicsOf(doc) {
  const rows = doc && doc.data && Array.isArray(doc.data.topics) ? doc.data.topics : [];
  return rows.filter((t) => t && t.topic).map((t) => ({ topic: String(t.topic), summary: String(t.summary || '') }));
}

// A step is the topic's i-th action. It is a button when the editor surface exposes its command and the launcher says it can run now;
// otherwise the button is disabled and says why, and its command line is shown to paste in a terminal.
function stepsOf(doc) {
  const steps = (doc && doc.data && Array.isArray(doc.data.steps)) ? doc.data.steps : [];
  const actions = (doc && doc.actions) || [];
  return steps.map((s, i) => {
    const a = actions[i] || {};
    const editor = (a.surfaces || []).includes('editor');
    const enabled = a.enabled !== false;
    return { index: i, label: String(s.label || a.label || ''), line: s.line || a.cli || '', note: s.note || '',
      runnable: editor && enabled,
      reason: !editor ? 'This one runs in a terminal. Copy its command line.' : (enabled ? '' : (a.reason || 'It cannot run now.')),
      action: { label: a.label || s.label, command: a.command, fields: a.fields || {}, category: a.category, cli: a.cli === undefined ? null : a.cli,
        enabled, reason: a.reason || '', needs: a.needs || [] } };
  });
}

// Indented lines in a section are command lines: they are shown as code.
function paragraphs(text) {
  const out = [];
  let code = [];
  const flush = () => { if (code.length) { out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); code = []; } };
  for (const para of String(text).split('\n')) {
    if (para.startsWith('    ')) { code.push(para.slice(4)); continue; }
    flush();
    if (para.trim() !== '') out.push(`<p>${esc(para)}</p>`);
  }
  flush();
  return out.join('\n');
}

// The page for a topic resource: its words, its sections, then a button for each step.
function topicPage(doc) {
  const d = (doc && doc.data) || {};
  const sections = Object.entries(d.sections || {});
  const steps = stepsOf(doc);
  const parts = [`<h1>${esc(d.topic || doc.id)}</h1>`, `<p>${esc(d.summary)}</p>`, paragraphs(d.plain || '')];
  for (const [heading, text] of sections) parts.push(`<section><h2>${esc(heading)}</h2>${paragraphs(text)}</section>`);
  if (steps.length) {
    parts.push('<section class="steps"><h2>Steps</h2><ol>');
    for (const s of steps) {
      const button = `<button type="button" data-step="${s.index}"${s.runnable ? '' : ' disabled'}${s.runnable ? '' : ` title="${esc(s.reason)}"`}>${esc(s.label)}</button>`;
      parts.push(`<li>${button}${s.line ? ` <code>${esc(s.line)}</code>` : ''}${s.note ? ` <em>${esc(s.note)}</em>` : ''}${s.runnable ? '' : ` <em>${esc(s.reason)}</em>`}</li>`);
    }
    parts.push('</ol></section>');
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.topic || doc.id)}</title></head><body><main>${parts.join('\n')}</main></body></html>`;
}

module.exports = { topicsOf, stepsOf, topicPage, esc };
