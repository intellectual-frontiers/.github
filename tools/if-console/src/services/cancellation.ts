// A cancellation source that needs no VS Code: its token is what the launcher takes, and VS Code's own tokens fit the same shape.
import type { Cancellation } from './launcher';

class Token implements Cancellation {
  cancelled = false;
  readonly listeners = new Set<() => void>();
  get isCancellationRequested(): boolean { return this.cancelled; }
  onCancellationRequested(listener: () => void): { dispose(): void } {
    this.listeners.add(listener);
    return { dispose: () => { this.listeners.delete(listener); } };
  }
}

export class CancelSource {
  private readonly own = new Token();
  get token(): Cancellation { return this.own; }

  cancel(): void {
    if (this.own.cancelled) return;
    this.own.cancelled = true;
    for (const l of [...this.own.listeners]) l();
  }
}
