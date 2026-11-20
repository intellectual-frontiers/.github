# The ladder

The architecture of a harness of Intellectual Frontiers is one ladder of rungs, stated once in commons as typed data, so that a harness states its own homes, rungs and checks as an instance of it ([commons 0016-ladder](../../spec-kit/specs/0016-ladder/spec.md)).

The rungs, lowest first: 0 the ontology, 1 the specifications, 2 governed data, 3 data operations, 4 infrastructure rules, 5 business rules, 6 the application (headless hosts first, then windowed hosts), and 7 documentation; with an optional rung 8 for what is retired and then archived, rung 9 for the evidence the system records about itself, and rung 10 for the workspace where the work is done.

**In practice.** A rung may rest on the ones below it and on nothing above. That is why Core imports nothing, why the data library knows nothing of the programs that use it, and why documentation (rung 7) reads every other rung and changes none.
