// Learn (0043-if-console FR-031): a repository's help topics, each shown as a resource with its steps as buttons. The topics, their
// words and their steps are the launcher's; this builds a page from the resource it returned and holds none of its own.
import { asArray, asObject, asString } from './json';
import type { Action, Doc } from './wire';

export const esc = (v: unknown): string => (v === undefined || v === null ? '' : asString(v)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface Topic { topic: string; summary: string }

/** `help` -> the topics it lists. */
export function topicsOf(doc: Doc | null): Topic[] {
  return asArray(doc?.data.topics).map(asObject).filter((t) => asString(t.topic) !== '').map((t) => ({ topic: asString(t.topic), summary: asString(t.summary) }));
}

export interface Step { index: number; label: string; line: string; note: string; runnable: boolean; reason: string; action: Action }

/** A step is the topic's i-th action. It is a button when the editor surface exposes its command and the launcher says it can run now;
 * otherwise the button is disabled and says why, and its command line is shown to paste in a terminal. */
export function stepsOf(doc: Doc | null): Step[] {
  const steps = asArray(doc?.data.steps);
  const actions = doc?.actions ?? [];
  return steps.map((raw, i): Step => {
    const s = asObject(raw);
    const a = asObject(actions[i]);
    const editor = asArray(a.surfaces).includes('editor');
    const enabled = a.enabled !== false;
    const cli = a.cli === undefined || a.cli === null ? null : asString(a.cli);
    return { index: i, label: asString(s.label || a.label), line: asString(s.line || a.cli), note: asString(s.note),
      runnable: editor && enabled,
      reason: !editor ? 'This one runs in a terminal. Copy its command line.' : (enabled ? '' : asString(a.reason, 'It cannot run now.')),
      action: { label: asString(a.label || s.label), command: asString(a.command), fields: asObject(a.fields), category: asString(a.category), cli,
        enabled, reason: asString(a.reason), needs: asArray(a.needs).map((n) => asString(n)) } };
  });
}

/** Indented lines in a section are command lines: they are shown as code. */
function paragraphs(text: string): string {
  const out: string[] = [];
  let code: string[] = [];
  const flush = (): void => { if (code.length) { out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); code = []; } };
  for (const para of text.split('\n')) {
    if (para.startsWith('    ')) { code.push(para.slice(4)); continue; }
    flush();
    if (para.trim() !== '') out.push(`<p>${esc(para)}</p>`);
  }
  flush();
  return out.join('\n');
}

/** The page for a topic resource: its words, its sections, then a button for each step. */
export function topicPage(doc: Doc): string {
  const d = doc.data;
  const sections = Object.entries(asObject(d.sections));
  const steps = stepsOf(doc);
  const title = asString(d.topic || doc.id);
  const parts = [`<h1>${esc(title)}</h1>`, `<p>${esc(d.summary)}</p>`, paragraphs(asString(d.plain))];
  for (const [heading, text] of sections) parts.push(`<section><h2>${esc(heading)}</h2>${paragraphs(asString(text))}</section>`);
  if (steps.length) {
    parts.push('<section class="steps"><h2>Steps</h2><ol>');
    for (const s of steps) {
      const button = `<button type="button" data-step="${s.index}"${s.runnable ? '' : ' disabled'}${s.runnable ? '' : ` title="${esc(s.reason)}"`}>${esc(s.label)}</button>`;
      parts.push(`<li>${button}${s.line ? ` <code>${esc(s.line)}</code>` : ''}${s.note ? ` <em>${esc(s.note)}</em>` : ''}${s.runnable ? '' : ` <em>${esc(s.reason)}</em>`}</li>`);
    }
    parts.push('</ol></section>');
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title></head><body><main>${parts.join('\n')}</main></body></html>`;
}
