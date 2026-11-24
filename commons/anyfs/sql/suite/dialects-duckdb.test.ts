/**
 * The conformance of duckdb (0010-sql-dialects FR-001), in a file of its own so that the shards of CI run the engines beside one another.
 *
 * @module
 */
import { engineConformance } from "./engine-conformance.ts";

engineConformance("duckdb");
