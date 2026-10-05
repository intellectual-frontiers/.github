// The views each command line declares, merged across repositories by view id (0043-if-console FR-036). The manifest holds a fixed pool of
// view slots (a view cannot be added at run time), and each slot takes the title of one planned view, in the order the command lines
// ask for. Where more than one command line declares the same view, its entries are grouped by repository.
import type { NounDecl, ViewDecl } from './presentation';
import type { CommandList } from './wire';
import { exposed } from './wire';

/** How many view slots the manifest holds: the most views of every command line in a window together. */
export const SLOTS = 16;

/** What planning needs of a repository. */
export interface PlanSource { key: string; state: string; list: CommandList | null }

export interface PlannedEntry<S extends PlanSource = PlanSource> { source: S; nouns: NounDecl[] }

export interface PlannedView<S extends PlanSource = PlanSource> {
  id: string;
  title: string;
  description: string;
  icon: string;
  order: number;
  entries: Array<PlannedEntry<S>>;
}

/** Whether a noun gives its view something to show: rows of its `list`, or at least one command the editor offers. */
export function nounShows(list: CommandList, noun: NounDecl): boolean {
  if (noun.list) {
    const l = noun.list;
    const c = list.commands.find((x) => x.id === l.command);
    if (c && exposed(c) && c.category === 'read') return true;
  }
  return list.commands.some((c) => c.noun === noun.noun && exposed(c));
}

export function planViews<S extends PlanSource>(sources: S[], slots = SLOTS): Array<PlannedView<S>> {
  const byId = new Map<string, PlannedView<S>>();
  for (const source of sources) {
    if (source.state !== 'ready' || !source.list) continue;
    const { list } = source;
    for (const decl of list.presentation.views) {
      const nouns = list.presentation.nouns.filter((n) => n.view === decl.id && nounShows(list, n));
      if (!nouns.length) continue;
      const held = byId.get(decl.id) ?? fresh<S>(decl);
      held.entries.push({ source, nouns });
      if (decl.order < held.order) { held.order = decl.order; held.title = decl.title; held.icon = decl.icon; }
      if (!held.description && decl.description) held.description = decl.description;
      byId.set(decl.id, held);
    }
  }
  return [...byId.values()].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)).slice(0, slots);
}

const fresh = <S extends PlanSource>(d: ViewDecl): PlannedView<S> => ({ id: d.id, title: d.title, description: d.description, icon: d.icon, order: d.order, entries: [] });
