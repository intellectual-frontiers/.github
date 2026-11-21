// Spec: 0006-bridge-mirrored FR-007
/**
 * What a mirror tells as it works: a closed union of events, each with the time it happened, for a tracing or an audit layer to take. A listener is called for each event in the order they happen and a listener that
 * throws is dropped, so that no listener can stop a write or a convergence. The events can also be read as an async iterable, which ends when the mirror is closed.
 *
 * @example
 * ```ts
 * import { eventHub } from "./events.ts";
 * const hub = eventHub();
 * hub.subscribe((e) => e.kind);
 * ```
 *
 * @module
 */
import type { Path, Revision } from "@intellectual-frontiers/anyfs/governance";

/** What a mirror tells. */
export type MirrorEvent =
  /** The primary took a change: `op` is what was done, and `path` the object it was done to (the new name of a rename). */
  | { readonly kind: "written"; readonly at: number; readonly op: "put" | "delete" | "rename" | "append"; readonly path: Path; readonly rev?: Revision }
  /** Changes wait for the replicas: `pending` is how many paths. */
  | { readonly kind: "queued"; readonly at: number; readonly pending: number }
  /** A replica was brought up to the primary as far as it could be: how many changes were made and how many failed. */
  | { readonly kind: "converged"; readonly at: number; readonly replica: string; readonly applied: number; readonly failed: number }
  /** A replica is behind: `reachable` is false where it could not be reached. */
  | { readonly kind: "behind"; readonly at: number; readonly replica: string; readonly pending: number; readonly reachable: boolean }
  /** A replica was changed by someone else at these paths, which the mirror leaves as they are. */
  | { readonly kind: "diverged"; readonly at: number; readonly replica: string; readonly paths: readonly Path[] }
  /** A replica became the primary. */
  | { readonly kind: "promoted"; readonly at: number; readonly from: string; readonly to: string; readonly lost: number }
  /** A read was answered by a replica because the primary could not be reached. */
  | { readonly kind: "degraded-read"; readonly at: number; readonly path: Path; readonly from: string };

/** The listeners of a mirror and the iterables made from them. */
export type EventHub = {
  emit(event: MirrorEvent): void;
  /** Calls `listener` for each event after this; the function it gives stops it. */
  subscribe(listener: (event: MirrorEvent) => void): () => void;
  /** The events after this call, until the hub is closed. */
  stream(): AsyncIterable<MirrorEvent>;
  close(): void;
};

/** An empty hub. */
export function eventHub(): EventHub {
  const listeners = new Set<(event: MirrorEvent) => void>();
  const closers = new Set<() => void>();
  let closed = false;
  const subscribe = (listener: (event: MirrorEvent) => void): (() => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };
  return {
    emit(event) {
      if (closed) return;
      for (const l of [...listeners]) {
        try {
          l(event);
        } catch {
          listeners.delete(l);
        }
      }
    },
    subscribe,
    stream() {
      return {
        [Symbol.asyncIterator](): AsyncIterator<MirrorEvent> {
          const queue: MirrorEvent[] = [];
          let wake: (() => void) | undefined;
          let ended = closed;
          const stop = subscribe((e) => {
            queue.push(e);
            wake?.();
          });
          const end = (): void => {
            ended = true;
            stop();
            wake?.();
          };
          closers.add(end);
          return {
            async next(): Promise<IteratorResult<MirrorEvent>> {
              for (;;) {
                const e = queue.shift();
                if (e !== undefined) return { done: false, value: e };
                if (ended) return { done: true, value: undefined };
                await new Promise<void>((resolve) => (wake = resolve));
                wake = undefined;
              }
            },
            async return(): Promise<IteratorResult<MirrorEvent>> {
              closers.delete(end);
              end();
              return { done: true, value: undefined };
            },
          };
        },
      };
    },
    close() {
      closed = true;
      for (const end of [...closers]) end();
      closers.clear();
      listeners.clear();
    },
  };
}
