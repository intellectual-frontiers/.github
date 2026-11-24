/**
 * The suite of signed deltas on duckdb (0011-sql-signing FR-001), in a file of its own so that the shards of CI run the engines beside one another.
 *
 * @module
 */
import { signingConformance } from "./signing-conformance.ts";

signingConformance("duckdb");
