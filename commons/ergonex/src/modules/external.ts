// Spec: 0001-ergonex FR-008
/**
 * What an external module answers to `--ergonex-manifest` (commons 0001-ergonex FR-008): JSON naming the version of this contract, the module's name and summary and its commands, which a typed decoder
 * checks. Its JSON Schema is made from the same declaration of fields as the decoder, so that a module written in any language can be checked against the schema and `ergonex` against the decoder, and
 * the two cannot differ. A module that does not answer, or whose answer does not decode, runs as an opaque command.
 *
 * @module
 */
import { array, type Decoder, formatDecodeError, integer, json, object, string } from "@intellectual-frontiers/commons/ts/kernel";
import type { JsonObject } from "@intellectual-frontiers/commons/ts/kernel";
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { moduleName } from "./name.ts";

/** The version of this contract an external module names. */
export const CONTRACT_VERSION = 1;

/** How long a module has to answer `--ergonex-manifest`, in milliseconds (0001-ergonex FR-008). */
export const MANIFEST_TIMEOUT_MS = 5000;

/** The word a module is asked for its manifest with. */
export const MANIFEST_FLAG = "--ergonex-manifest";

/** A command of an external module. */
export type ExternalCommand = {
  readonly name: string;
  readonly summary: string;
};

/** What an external module answers. */
export type ExternalManifest = {
  readonly contract: number;
  readonly name: string;
  readonly summary: string;
  readonly commands: readonly ExternalCommand[];
};

/** The fields of the answer, once: the decoder and the JSON Schema are both made from them. */
const FIELDS = {
  contract: {
    type: "integer",
    description: "The version of this contract the module speaks.",
  },
  name: {
    type: "string",
    description: "The module's name, as `ergonex <name>` runs it.",
  },
  summary: {
    type: "string",
    description: "One sentence on what the module does.",
  },
  commands: { type: "array", description: "The commands the module has." },
} as const;

const COMMAND_FIELDS = {
  name: { type: "string", description: "The command's name." },
  summary: {
    type: "string",
    description: "One sentence on what the command does.",
  },
} as const;

const commandDecoder: Decoder<ExternalCommand> = object({
  name: string,
  summary: string,
});
const manifestDecoder = object({
  contract: integer,
  name: string,
  summary: string,
  commands: array(commandDecoder),
});

/** The module's manifest from the text it printed, or why it is not one: not JSON, not the shape, a name that is not a module name, or a contract this `ergonex` does not speak. */
export function decodeExternalManifest(text: string): Result<ExternalManifest, string> {
  const r = json(text, manifestDecoder);
  if (r.kind === "err") return err(formatDecodeError(r.error));
  const m = r.value;
  if (m.contract !== CONTRACT_VERSION) return err(`the module speaks contract ${m.contract}, and this ergonex speaks ${CONTRACT_VERSION}`);
  const name = moduleName(m.name);
  if (name.kind === "err") return err(`the module names itself ${JSON.stringify(m.name)}, which is not a module name`);
  return ok(m);
}

/** The JSON Schema (2020-12) of the answer, from the same fields the decoder checks. */
export function externalManifestSchema(): JsonObject {
  const property = (f: { readonly type: string; readonly description: string }): JsonObject => ({
    type: f.type,
    description: f.description,
  });
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://intellectual-frontiers.github.io/.github/schemas/ergonex-manifest.json",
    title: "The answer of an ergonex module to --ergonex-manifest",
    type: "object",
    required: Object.keys(FIELDS),
    additionalProperties: true,
    properties: {
      contract: { ...property(FIELDS.contract), const: CONTRACT_VERSION },
      name: { ...property(FIELDS.name), pattern: "^[a-z][a-z0-9-]{0,31}$" },
      summary: property(FIELDS.summary),
      commands: {
        ...property(FIELDS.commands),
        items: {
          type: "object",
          required: Object.keys(COMMAND_FIELDS),
          additionalProperties: true,
          properties: {
            name: property(COMMAND_FIELDS.name),
            summary: property(COMMAND_FIELDS.summary),
          },
        },
      },
    },
  };
}
