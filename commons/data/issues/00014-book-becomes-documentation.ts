// Spec: 0044-issues FR-001
/** The book "Accepted Is Not Correct" should become the documentation of this library, besides its own content */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 14,
  slug: "book-becomes-documentation",
  title: "Refactor the book into the documentation of commons/data, besides its own content",
  summary:
    "The book \"Accepted Is Not Correct\" is the reference implementation of this library: the Appendix B toolkit, the stage ledger, idempotent intake, reconciliation, absence, effective dating and the rest are being built here as governed models and code, with each chapter's worked example reproduced exactly as a test. Once that code is in place, the book is to be refactored so that it is also the documentation of commons/data (each chapter's artifacts, examples and tests pointing at the models, the typed tables and the docs pages that implement them), in addition to its current content; the book as a governed model with a claim-to-test gate, and its editions and volumes, were left out for now because the book is young and incomplete. Do this after Stage 5 of the plan (0060 and later) is built.",
  severity: "low",
  priority: "P3",
  goals: ["G1", "G5"],
  appliesTo: { engines: "all" },
  status: { kind: "deferred", reason: "the book is young and incomplete, and the code it will document is not built yet", until: "after the Stage 5 models and code of the book's toolkit are in place" },
  size: "l",
  links: [{ kind: "relates", to: 10 }],
  raised: "2026-11-20",
});
