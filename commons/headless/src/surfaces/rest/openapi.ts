// Spec: 0014-rest-surface FR-001, FR-002, FR-003
/**
 * The REST surface, as a skeleton (commons headless 0014-rest-surface): the OpenAPI 3.1 document of a program, generated from governance for the caller's tier. One path for each command that the tier
 * may see, that may come through the `rest` channel and that is not for a person alone: `GET` for a command that only reads (its options are query parameters), `POST` for one that changes something (its
 * options and operands are the JSON body); the operation says its effect, its tier and whether it is safe to repeat, and the same refusals as the tool server are the `403` and `409` of every operation.
 *
 * @remarks
 * Pure: a program, a tier and the facts of the API give a JSON value. There is no server here: the routing of a request to a command, the authentication of the caller (which gives the tier) and the
 * transport are Planned (0014 Out of scope), and the document is what they will be held to.
 *
 * @example
 * ```ts
 * import { pathOf } from "./openapi.ts";
 * pathOf(["server", "list"]); // "/v1/server/list"
 * ```
 *
 * @module
 */
import { type TierName } from "@intellectual-frontiers/headless/governance";
import { offeredOptions, placedCommands, schemaOfOption, visibleProgram, type ArgSchema, type Placed, type Program } from "@intellectual-frontiers/headless/logical";

/** A JSON value. */
export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

/** The path of a command: `/v1/` and its words. */
export function pathOf(words: readonly string[]): string {
  return `/v1/${words.join("/")}`;
}

/** The identifier of an operation: the program's name and the words of the command joined by underscores. */
export function operationId(program: string, words: readonly string[]): string {
  return [program, ...words].join("_").replace(/[^A-Za-z0-9_]/g, "_");
}

/** Whether a command is an operation: it may come through the `rest` channel and it is not for a person alone. */
export function exposed(p: Placed): boolean {
  return p.reach !== undefined && p.reach.channels.includes("rest") && p.facts.audience !== "human";
}

/** The method of an operation: `GET` where the command only reads, `POST` where it changes something. */
export function methodOf(p: Placed): "get" | "post" {
  return p.facts.effect === "read" ? "get" : "post";
}

/** The reasons a call is refused, the same as the tool server's: a closed set a client may match on. */
export const REFUSAL_REASONS: readonly string[] = ["human-only-action", "human-only-option", "confirmation-needed", "confirmation-not-accepted", "consent-needed", "tier-too-low", "tier-unknown", "channel", "read-only-key"];

const refusal: Json = {
  type: "object",
  required: ["refusal", "message"],
  properties: { refusal: { type: "string", enum: [...REFUSAL_REASONS] }, message: { type: "string" } },
};

const body = (schema: ArgSchema): Json => ({ ...schema }) as Json;

function operation(program: string, p: Placed): Json {
  const options = offeredOptions(p);
  const operandRows = p.command.operands.map((o): [string, ArgSchema, boolean] => [o.name, o.arity === "many" ? { type: "array", items: { type: "string" }, description: o.help } : { type: "string", description: o.help }, o.arity !== "optional"]);
  const rows: [string, ArgSchema, boolean][] = [...Object.entries(options).map(([k, o]): [string, ArgSchema, boolean] => [k, schemaOfOption(o), o.kind === "value" && o.fallback.kind === "required"]), ...operandRows];
  const get = methodOf(p) === "get";
  const common = {
    operationId: operationId(program, p.path),
    summary: p.command.summary,
    tags: [p.path[0] ?? program],
    "x-effect": p.facts.effect,
    "x-tier": p.facts.tier,
    "x-idempotent": p.facts.idempotent,
    security: [{ bearer: [] }],
    responses: {
      "200": { description: "The command ran: its JSON document (the envelope of the command line).", content: { "application/json": { schema: { type: "object" } } } },
      "400": { description: "The arguments are not those of the command." },
      "403": { description: "Refused for the caller's tier, the channel or the key.", content: { "application/json": { schema: refusal } } },
      "409": { description: "Refused for what the action needs of a person: a confirmation or a consent.", content: { "application/json": { schema: refusal } } },
    },
  };
  if (get) {
    return { ...common, parameters: rows.map(([name, schema, required]) => ({ name, in: "query", required, schema: body(schema) })) };
  }
  return {
    ...common,
    requestBody: {
      required: rows.some(([, , required]) => required),
      content: { "application/json": { schema: { type: "object", properties: Object.fromEntries(rows.map(([name, schema]) => [name, body(schema)])), required: rows.filter(([, , r]) => r).map(([n]) => n), additionalProperties: false } } },
    },
  };
}

/** What the document says of the API besides the commands. */
export type ApiInfo = { readonly title?: string; readonly version?: string };

/** The OpenAPI 3.1 document of a program for a caller of a tier. */
export function openApiOf(program: Program, tier: TierName, info: ApiInfo = {}): Json {
  const seen = visibleProgram(program, tier);
  const paths: Record<string, Record<string, Json>> = {};
  for (const p of placedCommands(seen.children).filter(exposed)) paths[pathOf(p.path)] = { [methodOf(p)]: operation(program.name, p) };
  return {
    openapi: "3.1.0",
    info: { title: info.title ?? program.name, summary: program.summary, version: info.version ?? program.version },
    paths,
    components: { securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "Who the caller is, which gives its tier: authentication is the host's." } } },
  };
}
