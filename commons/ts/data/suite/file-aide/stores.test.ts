/**
 * File Aide's stores: the conformance suite on the `memory` and `posix` drivers, what each driver can do as a type, and what only a folder
 * of the computer does (commons 0010-file-aide FR-014 to FR-018, FR-035).
 *
 * @module
 */
import { fs, path as host } from "../../../runtime/mod.ts";
import { assert, assertEquals, proves } from "../../../runtime/test.ts";
import { type Capability, type ConditionFor, memoryStore, type MemoryCapability, type Store, widen } from "../../file-aide/mod.ts";
import { type PosixCapability, posixStore, TEMPORARY } from "../../file-aide/runtime/mod.ts";
import { type Equal, expectType } from "../../../kernel/mod.ts";
import { allPaths, conformance, rel } from "./conformance.ts";

conformance("memory", () => Promise.resolve({ store: memoryStore(), done: () => Promise.resolve() }));
conformance("posix", async () => {
  const dir = await fs.makeTempDir({ prefix: "file-aide-" });
  return { store: posixStore(dir), done: () => fs.remove(dir, { recursive: true }) };
});

const bytesOf = (t: string): Uint8Array => new TextEncoder().encode(t);

proves(["0010-file-aide FR-015"], "a condition a store cannot keep does not compile where its type is known", () => {
  expectType<Equal<ConditionFor<PosixCapability>, { readonly kind: "none" } | { readonly kind: "if-absent" }>>();
  expectType<Equal<ConditionFor<"delimiter">, { readonly kind: "none" }>>();
  const typed = (s: Store<PosixCapability>, m: Store<MemoryCapability>, bare: Store<"delimiter">): void => {
    const p = rel("x");
    // @ts-expect-error the posix driver cannot write on a version atomically
    void s.put(p, new Uint8Array(), { kind: "if-match", version: "1" });
    // @ts-expect-error a store that cannot read a range is not asked for one
    void bare.get(p, { start: 0 });
    // the control: what the stores can do compiles
    void m.put(p, new Uint8Array(), { kind: "if-match", version: "1" });
    void s.put(p, new Uint8Array(), { kind: "if-absent" });
    const widened: Store<Capability> = widen(s);
    void widened;
  };
  void typed;
  assertEquals([...posixStore("/nowhere").capabilities].sort() as string[], [
    "delimiter",
    "modified",
    "range",
    "rename",
    "write-if-absent",
  ]);
});

proves(
  ["0010-file-aide FR-017"],
  "posix: a write leaves no temporary file and no folder of its own, and a delete removes the folders it empties",
  async () => {
    const dir = await fs.makeTempDir({ prefix: "file-aide-" });
    try {
      const s = posixStore(dir);
      assert((await s.put(rel("deep/er/file.txt"), bytesOf("x"))).kind === "ok");
      assertEquals(await fs.walkFiles(dir), [host.join("deep", "er", "file.txt")]);
      await fs.writeFile(host.join(dir, "deep", `${TEMPORARY}left-by-a-crash`), bytesOf("partial"));
      assertEquals(await allPaths(s), ["deep/er/file.txt"], "a temporary file is never listed");
      await fs.remove(host.join(dir, "deep", `${TEMPORARY}left-by-a-crash`));
      assert((await s.delete(rel("deep/er/file.txt"))).kind === "ok");
      assertEquals(await fs.exists(host.join(dir, "deep")), false);
      assert(await fs.exists(dir), "the root stays");
      await fs.mkdir(host.join(dir, "empty", "folder"), { recursive: true });
      const listed = await s.list({ delimiter: "/" });
      assert(listed.kind === "ok");
      assertEquals(listed.value.folders, [], "a folder with no file is not a folder of the store");
    } finally {
      await fs.remove(dir, { recursive: true });
    }
  },
);

proves(["0010-file-aide FR-017", "0010-file-aide FR-018"], "posix: a store opened read only refuses every write as a value", async () => {
  const dir = await fs.makeTempDir({ prefix: "file-aide-" });
  try {
    await fs.writeTextFile(host.join(dir, "kept.txt"), "kept");
    const s = posixStore(dir, { readOnly: true, name: "fixture" });
    for (const r of [
      await s.put(rel("new.txt"), bytesOf("x")),
      await s.delete(rel("kept.txt")),
      await s.copy(rel("kept.txt"), rel("copy.txt")),
    ]) {
      assert(r.kind === "err");
      assertEquals([r.error.kind, r.error.store], ["refused", "fixture"]);
    }
    assertEquals(await allPaths(s), ["kept.txt"]);
  } finally {
    await fs.remove(dir, { recursive: true });
  }
});
