// Spec: 0022-sql-integrations FR-002
/**
 * CSV text (commons data 0022-sql-integrations FR-002): parsed as RFC 4180 does, a quoted field holding the delimiter, a newline or a doubled quote.
 *
 * @module
 */

/**
 * The records of CSV text, the first of which is the header.
 *
 * @param text - the text
 * @param delimiter - the delimiter, a comma where it is not said
 * @returns the records, each a list of fields
 */
export function parseCsv(text: string, delimiter = ","): readonly (readonly string[])[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let any = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') {
      quoted = true;
      any = true;
    } else if (c === delimiter) {
      record.push(field);
      field = "";
      any = true;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (any || field !== "") {
        record.push(field);
        records.push(record);
      }
      record = [];
      field = "";
      any = false;
    } else {
      field += c;
      any = true;
    }
  }
  if (any || field !== "") {
    record.push(field);
    records.push(record);
  }
  return records;
}
