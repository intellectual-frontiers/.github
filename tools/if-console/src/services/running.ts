// The commands running now (0043-if-console FR-020, FR-038): each has a cancellation source, so that one Stop action in a view's title ends
// them all, and so that the view that started one can say it is working.
import { CancelSource } from './cancellation';

export class Running {
  private readonly sources = new Set<CancelSource>();

  constructor(private readonly changed: (count: number) => void = () => undefined) {}

  /** A new cancellation source, tracked until `done`. */
  begin(): CancelSource {
    const source = new CancelSource();
    this.sources.add(source);
    this.changed(this.sources.size);
    return source;
  }

  done(source: CancelSource): void {
    this.sources.delete(source);
    this.changed(this.sources.size);
  }

  /** End every process that is running; a person asked to stop. */
  cancelAll(): number {
    const n = this.sources.size;
    for (const s of [...this.sources]) s.cancel();
    return n;
  }

  get count(): number { return this.sources.size; }
}
