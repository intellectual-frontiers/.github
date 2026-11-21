/**
 * The walks and the dump of the SQL language core (commons data 0066-sql-ast-parser): `children` gives every child of every kind in the order of the text, `walk` visits depth first and can skip, `findAll` is
 * typed by its kind, `fold` combines from the leaves; and the golden files hold the tree of each corpus text, so a change of the grammar shows as a difference.
 *
 * Spec: 0066-sql-ast-parser FR-016, FR-017
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ansi, children, findAll, fold, type Node, parse, toSexp, walk } from "@intellectual-frontiers/data/sql/lang";
import { expected, sources } from "../tools/golden-lang.ts";
import { CORPUS, GOLDEN, GOLDEN_DIALECTS } from "./lang-fixture.ts";

const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && "kind" in v && typeof v.kind === "string" && "start" in v;

/** The nodes a node holds in its own fields, found by looking at the fields and not by asking `children`. */
const held = (n: Node): readonly Node[] => {
  const out: Node[] = [];
  for (const v of Object.values(n)) {
    if (isNode(v)) out.push(v);
    else if (Array.isArray(v)) for (const x of v) if (isNode(x)) out.push(x);
  }
  return out;
};

const trees = (): readonly Node[] => {
  const out: Node[] = [parse(CORPUS).script];
  for (const [dir, name] of sources()) {
    const d = GOLDEN_DIALECTS[dir];
    if (d !== undefined) out.push(parse(readFileSync(join(GOLDEN, dir, `${name}.sql`), "utf8"), d).script);
  }
  return out;
};

proves(
  ["0066-sql-ast-parser FR-016"],
  "children gives every child of every kind in the order of the text, walk visits depth first and can skip, findAll is typed by its kind, and fold combines from the leaves",
  () => {
    const kinds = new Set<string>();
    let nodes = 0;
    for (const root of trees()) {
      walk(root, {
        enter: (n) => {
          nodes++;
          kinds.add(n.kind);
          const given = children(n);
          const own = held(n);
          assertEquals(given.length, own.length, `${n.kind}: children gives ${given.length} of the ${own.length} nodes it holds`);
          for (const c of own) assert(given.includes(c), `${n.kind}: a ${c.kind} it holds is not given`);
          for (let i = 1; i < given.length; i++)
            assert((given[i - 1]?.start ?? 0) <= (given[i]?.start ?? 0), `${n.kind}: children are not in the order of the text`);
          return undefined;
        },
      });
    }
    assert(nodes > 1000 && kinds.size >= 60, `${nodes} nodes of ${kinds.size} kinds were checked`);
    const p = parse("SELECT a, b + 1 FROM t WHERE a > 0");
    const order: string[] = [];
    walk(p.script, {
      enter: (n, parent) => {
        order.push(`+${n.kind}${parent === undefined ? "" : `<${parent.kind}`}`);
        return undefined;
      },
      leave: (n) => {
        order.push(`-${n.kind}`);
      },
    });
    assertEquals(order.slice(0, 6), ["+script", "+select<script", "+select-item<select", "+name<select-item", "+ident<name", "-ident"]);
    assertEquals(order[order.length - 1], "-script");
    const skipped: string[] = [];
    walk(p.script, {
      enter: (n) => {
        skipped.push(n.kind);
        return n.kind === "select-item" ? false : undefined;
      },
    });
    assertEquals(skipped.filter((k) => k === "number").length, 1, "the 1 under a skipped select item is not visited, the 0 in WHERE is");
    assert(skipped.includes("select-item") && skipped.includes("table"));
    const binaries = findAll(p.script, "binary");
    assertEquals(
      binaries.map((b) => b.op),
      ["+", ">"],
    );
    assertEquals(findAll(p.script, "name").length, 4);
    const text: string = findAll(p.script, "ident")[0]?.name ?? "";
    assertEquals(text, "a");
    const count = fold<number>(p.script, (_, rs) => 1 + rs.reduce((a, b) => a + b, 0));
    let visited = 0;
    walk(p.script, {
      enter: () => {
        visited++;
        return undefined;
      },
    });
    assertEquals(count, visited);
    assertEquals(
      fold<string>(parse("SELECT 1 + 2").script, (n, rs) =>
        n.kind === "number" ? n.text : n.kind === "binary" ? `(${rs.join(n.op)})` : rs.join(""),
      ),
      "(1+2)",
    );
  },
);

proves(
  ["0066-sql-ast-parser FR-017"],
  "toSexp writes the same text for the same tree, and each golden file is what the parser makes of its SQL",
  () => {
    const p = parse("SELECT a, 1 FROM t");
    assertEquals(toSexp(p.script), toSexp(parse("SELECT a, 1 FROM t").script));
    assertEquals(toSexp(p.script).split("\n")[0], "script");
    assert(!toSexp(p.script).includes("@"), "no range unless asked");
    assert(toSexp(p.script, { spans: true }).split("\n")[0] === "script @0-18");
    assertEquals(toSexp(parse("SELECT 'x'", ansi).script).includes('string value="x" prefix=""'), true);
    let files = 0;
    for (const [dir, name] of sources()) {
      for (const e of expected(dir, name)) {
        let have: string | undefined;
        try {
          have = readFileSync(e.path, "utf8");
        } catch {
          have = undefined;
        }
        assertEquals(
          have,
          e.text,
          `${e.path} is not what the parser makes: read the difference, then run bun tools/golden-lang.ts --write`,
        );
        if (e.text !== undefined) files++;
      }
    }
    assert(files >= 9, `${files} golden files were checked`);
  },
);
