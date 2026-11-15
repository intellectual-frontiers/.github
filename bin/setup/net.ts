// A command that needs the network, run again where its own words say the network failed (009-machine-bootstrap FR-032, FR-033); downloads, their retries
// and the look at the network are commons' runtime/net. A refusal (not allowed, not found, a certificate the computer does not accept) is not tried again.
import type { Retries } from "../../commons/ts/runtime/net.ts";
import { type Ran, run, type RunOptions } from "./proc.ts";

/** Whether the words a command printed say the network failed (not a refusal, not a certificate), so that the command is worth running again. */
export function netWords(text: string): boolean {
  if (/certificate problem|self[ -]signed|unknown ca|not allowed|denied|authentication failed|not found|404/i.test(text)) return false;
  return /could not resolve|temporary failure (in name )?resolution|temporary failure resolving|name or service not known|connection failed|unable to connect|could not connect|dns error|connection (reset|refused|timed out|closed)|timed out|timeout|network is unreachable|no route to host|early eof|rpc failed|unexpected disconnect|broken pipe|handshake|tls|ssl|error sending request|failed to (fetch|download)|unable to access|\b50[0234]\b|too many requests/i
    .test(text);
}

/** A command that uses the network, run again where its own words say the network failed; anything else is returned at once. */
export async function retryCommand(retries: Retries, what: string, argv: readonly string[], opts: RunOptions = {}, before?: () => Promise<void>): Promise<Ran> {
  for (let n = 1;; n++) {
    await before?.();
    const r = await run(argv, opts);
    if (r.code === 0 || n >= retries.policy.tries || !netWords(r.output)) return r;
    const why = r.output.split("\n").find((l) =>
      /could not resolve|name resolution|name or service|timed out|timeout|reset|refused|unreachable|early eof|rpc failed|50[0234]|tls|ssl/i.test(l)
    ) ?? "";
    await retries.again(what, why.slice(0, 90), n);
  }
}
