// Spec: 0003-governance FR-002
/**
 * The business datatypes (commons data 0003-governance FR-002): what kind of fact an attribute holds, in terms that name no database. A tagged union, matched exhaustively; `code`
 * names a code list. How a datatype is stored is for the logical and the physical layers.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/commons/ts/kernel";
import type { AnyCodeList } from "./codelist.ts";

/** Text. */
export type TextType = { readonly kind: "text"; readonly max?: number };
/** A whole number. */
export type IntegerType = { readonly kind: "integer" };
/** A decimal number. */
export type DecimalType = { readonly kind: "decimal"; readonly precision?: number; readonly scale?: number };
/** True or false. */
export type BooleanType = { readonly kind: "boolean" };
/** A calendar day. */
export type DateType = { readonly kind: "date" };
/** A moment in time. */
export type InstantType = { readonly kind: "instant" };
/** An identifier. */
export type IdentifierType = { readonly kind: "identifier" };
/** One code of a code list `L`. */
export type CodeType<L extends AnyCodeList = AnyCodeList> = { readonly kind: "code"; readonly list: L };
/** A structured document. */
export type StructuredType = { readonly kind: "structured" };
/** Bytes. */
export type BinaryType = { readonly kind: "binary" };

/** A business datatype. */
export type Datatype =
  TextType | IntegerType | DecimalType | BooleanType | DateType | InstantType | IdentifierType | CodeType | StructuredType | BinaryType;

/** Text, with the longest it may be where that matters. */
export const text = (options: { readonly max?: number } = {}): TextType =>
  Object.freeze(options.max === undefined ? { kind: "text" } : { kind: "text", max: options.max });
/** A whole number. */
export const integer = (): IntegerType => Object.freeze({ kind: "integer" });
/** A decimal number, with its precision and scale where they matter. */
export const decimal = (options: { readonly precision?: number; readonly scale?: number } = {}): DecimalType =>
  Object.freeze({ kind: "decimal", ...options });
/** True or false. */
export const boolean = (): BooleanType => Object.freeze({ kind: "boolean" });
/** A calendar day. */
export const date = (): DateType => Object.freeze({ kind: "date" });
/** A moment in time. */
export const instant = (): InstantType => Object.freeze({ kind: "instant" });
/** An identifier: a value that names a thing and has no other meaning. */
export const identifier = (): IdentifierType => Object.freeze({ kind: "identifier" });
/** One code of a code list. */
export const codeOf = <L extends AnyCodeList>(list: L): CodeType<L> => Object.freeze({ kind: "code", list });
/** A structured document of no fixed shape. */
export const structured = (): StructuredType => Object.freeze({ kind: "structured" });
/** Bytes. */
export const binary = (): BinaryType => Object.freeze({ kind: "binary" });

/**
 * A datatype in a few words, for a dictionary or a message; the `switch` fails to compile where a case is left out.
 *
 * @param d - the datatype
 * @returns its description
 */
export function describeDatatype(d: Datatype): string {
  switch (d.kind) {
    case "text":
      return d.max === undefined ? "text" : `text of at most ${d.max}`;
    case "integer":
      return "a whole number";
    case "decimal":
      return d.precision === undefined
        ? "a decimal number"
        : `a decimal number of ${d.precision} digits${d.scale === undefined ? "" : `, ${d.scale} after the point`}`;
    case "boolean":
      return "true or false";
    case "date":
      return "a calendar day";
    case "instant":
      return "a moment in time";
    case "identifier":
      return "an identifier";
    case "code":
      return `a code of ${d.list.name}`;
    case "structured":
      return "a structured document";
    case "binary":
      return "bytes";
    default:
      return absurd(d);
  }
}
