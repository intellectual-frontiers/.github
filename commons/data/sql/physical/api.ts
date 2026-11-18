/** @module The physical layer's public surface (spike): imports the logical layer by package name. */
import { logicalFromGovernance } from "@intellectual-frontiers/data/sql/logical";

/** What the physical layer sees through the logical one. */
export const physicalSees = `physical <- ${logicalFromGovernance}`;
