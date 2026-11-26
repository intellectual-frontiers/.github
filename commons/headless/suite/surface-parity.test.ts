/**
 * Tests that a surface renders and does not decide (commons headless 0001-headless-layers FR-009): one command definition gives the same typed result through the command line and through the tool server, and the REST
 * document names the same command with the same options, so that no surface holds a decision the others lack.
 *
 * @module
 */
import { assertEquals, proves } from "@intellectual-frontiers/test";
import { value } from "@intellectual-frontiers/terminal/args";
import { defineReach, OPERATOR, type TierName } from "../src/governance/mod.ts";
import { branch, command, outcomeOf, programOf, type Program } from "../src/logical/mod.ts";
import { run } from "../src/surfaces/cli/run.ts";
import { handleLine, type McpConfig } from "../src/surfaces/mcp/mod.ts";
import { openApiOf } from "../src/surfaces/rest/mod.ts";
import { world } from "./world.ts";

const reach = defineReach({ channels: ["local", "mcp", "rest"], readOnly: true, idempotent: true });

/** One command definition: the typed result is decided here and by nothing else. */
const program = (): Program =>
  programOf({
    name: "fleet",
    summary: "The fleet.",
    version: "1.0.0",
    children: [
      branch({
        name: "host",
        summary: "Hosts.",
        children: [
          command({
            name: "count",
            summary: "Count hosts.",
            options: { limit: value({ short: "l", help: "How many." }) },
            action: { kind: "report", reach },
            run: (parsed) => Promise.resolve(outcomeOf({ said: "count", limit: parsed.options["limit"] ?? "none" }, { text: "counted" })),
          }),
        ],
      }),
    ],
  });

/** The tool server of the program, running each call through the command line, as a host does. */
const server = (tier: TierName): McpConfig => {
  const p = program();
  return {
    program: p,
    tier,
    mayOnlyRead: false,
    run: async (words) => {
      const r = await run(p, [...words], world({ tier }));
      return { code: r.code, out: r.out, err: r.err };
    },
  };
};

proves(["0001-headless-layers FR-009"], "one command definition gives the same typed result through the command line and the tool server, and the REST document names the same command and options", async () => {
  const p = program();
  const cli = await run(p, ["host", "count", "--limit", "3", "--json"], world({ tier: OPERATOR }));
  assertEquals(cli.code, 0);
  const typed = JSON.parse(cli.out) as { command: string; ok: boolean };
  assertEquals([typed.command, typed.ok], ["host count", true]);

  const line = await handleLine(server(OPERATOR), JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "fleet_host_count", arguments: { limit: "3" } } }));
  const mcp = (JSON.parse(line ?? "{}") as { result?: { structuredContent?: unknown; isError?: boolean } }).result;
  assertEquals(mcp?.isError, false);
  assertEquals(mcp?.structuredContent, typed, "the tool server gives the document of the command line, byte for byte as data");

  const doc = openApiOf(p, OPERATOR) as { paths: Record<string, { get?: { operationId: string; parameters?: { name: string }[] } }> };
  const op = doc.paths["/v1/host/count"]?.get;
  assertEquals(op?.operationId, "fleet_host_count");
  assertEquals(op?.parameters?.map((x) => x.name), ["limit"], "the REST operation takes the options of the one definition");
});
