// Spec: 0051-project-cli FR-001
/**
 * A model with a fault, for the tests of the project commands: a concept with no definition, which lint finds.
 *
 * @module
 */
import { attribute, concept, domain, identifier } from "@intellectual-frontiers/data/governance";

const thing = concept("thing", {
  definition: "",
  attributes: { id: attribute(identifier(), { definition: "What identifies it" }) },
  identifiedBy: ["id"],
});

export default domain("things", { definition: "Things", concepts: [thing] });
