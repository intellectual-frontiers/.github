// A command link in a tooltip, a hover or a CodeLens carries a handle, never a command: the handle names something the extension itself made,
// and one that it did not make runs nothing (0043-if-console FR-015). Anything else that can write a Markdown link (a launcher's text, another
// extension, a file) can name no handle that was not issued here, and a handle only ever leads to the one path every command takes.
import type { Run } from '../model/home';
import type { Action } from '../model/wire';

/** What a handle stands for. */
export type Payload =
  | { kind: 'run'; repoKey: string; run: Run }
  | { kind: 'open'; repoKey: string; noun: string; id: string }
  | { kind: 'primary'; repoKey: string; noun: string; id: string }
  | { kind: 'context'; repoKey: string; noun: string; id: string }
  | { kind: 'action'; repoKey: string; action: Action }
  | { kind: 'copy'; text: string }
  | { kind: 'home' };

export class Handles<T = Payload> {
  private readonly held = new Map<string, T>();
  private n = 0;

  constructor(private readonly limit = 4000) {}

  /** A new handle for a payload; the oldest are forgotten past the limit. */
  issue(payload: T): string {
    this.n += 1;
    const id = `h${this.n}`;
    this.held.set(id, payload);
    if (this.held.size > this.limit) { const first = this.held.keys().next(); if (!first.done) this.held.delete(first.value); }
    return id;
  }

  /** The payload of a handle this made, or undefined for anything else. */
  get(id: unknown): T | undefined { return typeof id === 'string' ? this.held.get(id) : undefined; }

  clear(): void { this.held.clear(); }
  get size(): number { return this.held.size; }
}
