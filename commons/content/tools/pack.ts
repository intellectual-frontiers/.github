/**
 * Builds, inspects, and packs Content in per-library distribution mode.
 *
 * Spec: 0001-content-collector FR-001
 * @module
 */
import process from "node:process";
import { main } from "@intellectual-frontiers/libraries/pack";
import { path } from "@intellectual-frontiers/system";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

if (import.meta.main) process.exitCode = await main(ROOT, process.argv.slice(2), { types: ["node"] });
