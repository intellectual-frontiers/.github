// Learn (0043-if-console FR-031, FR-043): a repository's help topics, each shown in the resource panel as its plain words, its sections and its
// steps, each step with the exact command line to copy and a Run button. The topics, their words and their steps are the launcher's; this builds
// the panel's model from the resource it returned and holds none of its own.
import { asArray, asObject, asString } from './json';
import { blocksOf, type Built, type LessonStep, type Section } from './panel';
import type { Action, Doc } from './wire';
import { t } from '../l10n';

export interface Topic { topic: string; summary: string }

/** `help` -> the topics it lists. */
export function topicsOf(doc: Doc | null): Topic[] {
  return asArray(doc?.data.topics).map(asObject).filter((t) => asString(t.topic) !== '').map((t) => ({ topic: asString(t.topic), summary: asString(t.summary) }));
}

/** The icon of a topic in the quick pick: a topic's own name is the launcher's, so the choice is by what the name is about, with one default. */
export const TOPIC_ICON = 'book';

export interface Step { index: number; label: string; line: string; note: string; runnable: boolean; reason: string; yourself: boolean; action: Action }

/** A step is the topic's i-th action. It runs from the panel when the editor surface exposes its command and the launcher says it can run now;
 * otherwise it is disabled and says why, and its command line is shown to paste in a terminal; a step with no command is the person's own. */
export function stepsOf(doc: Doc | null): Step[] {
  const steps = asArray(doc?.data.steps);
  const actions = doc?.actions ?? [];
  return steps.map((raw, i): Step => {
    const s = asObject(raw);
    const a = asObject(actions[i]);
    const editor = asArray(a.surfaces).includes('editor');
    const enabled = a.enabled !== false;
    const cli = a.cli === undefined || a.cli === null ? null : asString(a.cli);
    const command = asString(s.command || a.command);
    const yourself = command === '';
    return { index: i, label: asString(s.label || a.label), line: asString(s.line || a.cli), note: asString(s.note), yourself,
      runnable: !yourself && editor && enabled,
      reason: yourself ? 'You do this one yourself.' : !editor ? 'This one runs in a terminal. Copy its command line.' : (enabled ? '' : asString(a.reason, 'It cannot run now.')),
      action: { label: asString(a.label || s.label), command: asString(a.command), fields: asObject(a.fields), category: asString(a.category), cli,
        enabled, reason: asString(a.reason), needs: asArray(a.needs).map((n) => asString(n)) } };
  });
}

const bare = (line: string): string => line.trim().replace(/^\.\//, '');

/** The panel's model of a topic: its words, its sections (a heading and its words each, a leading "1." read as the number), and its steps. */
export function buildTopic(doc: Doc, { topics }: { topics: Topic[] }): Built {
  const d = doc.data;
  const topic = asString(d.topic, doc.id);
  const steps = stepsOf(doc);
  const byLine = new Map<string, Step>();
  for (const s of steps) if (s.line !== '' && !byLine.has(bare(s.line))) byLine.set(bare(s.line), s);
  const runs = (line: string): { run?: number; reason?: string } | undefined => {
    const hit = byLine.get(bare(line));
    if (!hit) return undefined;
    return hit.runnable ? { run: hit.index } : { reason: hit.reason };
  };
  const sections: Section[] = [];
  const plain = asString(d.plain);
  if (plain) sections.push({ type: 'text', id: 'plain', title: t('In plain words'), icon: 'comment', blocks: blocksOf(plain) });
  const parts = Object.entries(asObject(d.sections)).map(([heading, text]) => {
    const m = /^(\d+)\.\s+(.*)$/.exec(heading);
    return { n: m ? Number(m[1]) : null, heading: m ? (m[2] ?? heading) : heading, blocks: blocksOf(asString(text), runs) };
  });
  if (parts.length) sections.push({ type: 'reading', id: 'sections', title: t('Read'), icon: 'book', parts: parts.map(({ n, heading, blocks }) => ({ n, heading, blocks })) });
  if (steps.length) {
    const lesson: LessonStep[] = steps.map((s, i): LessonStep => ({ n: i + 1, label: s.label, note: s.note, line: s.line, ...(s.runnable ? { run: s.index } : {}), reason: s.reason, yourself: s.yourself }));
    sections.push({ type: 'lesson', id: 'steps', title: t('Do it, step by step'), icon: 'checklist', steps: lesson });
  }
  if (!sections.length) sections.push({ type: 'empty', id: 'nothing', title: topic, icon: 'inbox', text: t('This topic has no words and no steps.'), guidance: t('Ask the command line for the list of topics.') });
  const at = topics.findIndex((t) => t.topic === topic);
  const next = at >= 0 ? topics[at + 1] ?? null : null;
  return {
    mode: 'topic',
    header: { icon: 'mortar-board', title: topic, kind: t('Learn'), id: topic, audience: doc.audience, pills: steps.length ? [{ text: steps.length === 1 ? t('1 step') : t('{0} steps', steps.length), kind: 'plain', icon: 'checklist' }] : [], subtitle: asString(d.summary) },
    actions: [], sections, held: { actions: steps.map((s) => (s.runnable ? s.action : { ...s.action, enabled: false, reason: s.reason })), refs: [] }, next,
  };
}
