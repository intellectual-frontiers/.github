// Spec: 0051-project-cli FR-001
/**
 * A model of a project's own, for the tests of the project commands: a domain that `arcactl --module` reads from its default export.
 *
 * @module
 */
import { attribute, concept, domain, identifier, text } from "@intellectual-frontiers/data/governance";

const note = concept("note", {
  definition: "A line someone wrote",
  attributes: { id: attribute(identifier(), { definition: "What identifies it" }), body: attribute(text(), { definition: "What it says" }) },
  identifiedBy: ["id"],
});

export default domain("notes", { definition: "Notes", concepts: [note] });
