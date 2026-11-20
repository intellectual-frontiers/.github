/**
 * The catalog data packages (0008-grc-catalogs) are a shape this release specifies and builds none of, so no test proves them: each requirement is reviewed here with its reason, and the
 * enforcement register says `none`. The documents a package holds (frameworks and crosswalks) are proved by the tests of governance.
 *
 * @module
 */
import { reviewed } from "@intellectual-frontiers/test";

for (const fr of ["FR-001", "FR-002", "FR-003", "FR-004", "FR-005", "FR-006"]) {
  reviewed(`0008-grc-catalogs ${fr}`, "the shape of a catalog package, specified for the packages that will be built; this release builds none and the library has no loader of one");
}
