"""The brand group: brand, imagery, ink and openedx commands, and the decoration group (0042-agora FR-006, FR-012;
0014-design-systems FR-028, FR-037, FR-043, FR-047; frontiers-brand FR-017, FR-020)."""
import json
import os
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

from agora.core.registry import Registry
from agora.groups.decoration import commands as deco
from agora.lib import brand_specimen, brand_theme, brands, decoration, imagery, openedx

from .brandfix import HAS_PILLOW, Repo, png, tree, webp_works
from .helpers import HOME, run_json

GPL = "GIMP Palette\nName: Test card\nColumns: 3\n# comment\n 33  78 162  Blue 1\n 31 119 117  Teal 2\n200  10  10  Red 3\n"


class Brand(Repo):
    def test_brand_list_and_show(self):  # 0042 FR-006
        code, doc = self.go("brand", "list")
        self.assertEqual(code, 0)
        (row,) = doc["data"]["brands"]
        self.assertEqual((row["name"], row["pieces"], row["openedx"], row["decoration"]), ("mini-brand", 0, False, True))
        code, doc = self.go("brand", "show", "mini-brand")
        d = doc["data"]
        self.assertEqual(d["roles"]["primary"], "#214ea2")
        self.assertEqual({g["path"]: g["state"] for g in d["generated"]}["design-systems/mini-brand/brand.css"], "stale")
        self.assertIn("brand generate", doc["actions"][0]["cli"])

    def test_brand_generate_writes_the_theme_and_the_specimen_from_the_tokens(self):  # 0014 FR-028, 0041 FR-035
        code, doc = self.go("brand", "generate", "mini-brand")
        self.assertEqual(code, 0)
        self.assertEqual(sorted(c["path"] for c in doc["data"]["changes"]),
                         ["design-systems/mini-brand/assurance/fixtures/specimen.html", "design-systems/mini-brand/brand.css",
                          "design-systems/mini-brand/brand.tex"])
        css = (self.brand / "brand.css").read_text()
        self.assertIn("--brand-primary: #214ea2;", css)
        self.assertIn("brand-theme generator from tokens.json", css)
        self.assertIn("brand generate mini-brand", css)
        self.assertIn("brand-theme generator", (self.brand / "brand.tex").read_text())
        self.assertIn("brand-specimen generator", (self.brand / "assurance/fixtures/specimen.html").read_text())
        self.assertEqual(self.go("brand", "generate")[1]["data"]["changes"], [])  # idempotent

    def test_brand_generate_dry_run_writes_nothing(self):  # 0041 FR-015
        before = tree(self.root)
        code, doc = self.go("brand", "generate", "--dry-run")
        self.assertEqual((code, doc["data"]["dry_run"]), (0, True))
        self.assertEqual(len(doc["data"]["changes"]), 3)
        self.assertEqual(tree(self.root), before)

    def test_the_theme_is_derived_from_the_tokens_and_nothing_else(self):
        t = brands.tokens_of(self.brand)
        files = brand_theme.generate(self.brand)
        self.assertEqual(set(p.name for p in files), {"brand.css", "brand.tex"})
        self.assertIn("\\newcommand{\\brandfontsans}{Inter}", files[self.brand / "brand.tex"])
        self.assertEqual(len(brand_specimen.generate(self.brand)), 1)
        self.assertEqual(brand_theme.resolve(t, "{color.deep-ink}"), t["color"]["deep-ink"]["$value"])

    def test_a_brand_generator_refuses_a_name_that_is_no_brand(self):
        self.assertEqual(self.go("brand", "generate", "nope")[0], 2)
        self.assertEqual(self.go("brand", "show", "nope")[0], 2)


class Ink(Repo):
    def test_ink_list_and_show(self):
        code, doc = self.go("ink", "list", "mini-brand")
        self.assertEqual((code, doc["data"]["count"], doc["data"]["verified"]), (0, 5, 0))
        code, doc = self.go("ink", "show", "mini-brand/primary")
        self.assertEqual((doc["data"]["color"], doc["data"]["verified"]), ("#214ea2", False))
        self.assertEqual(self.go("ink", "show", "mini-brand/nope")[0], 2)

    def test_ink_show_matches_a_palette_by_ciede2000(self):
        pal = self.root / "card.gpl"
        pal.write_text(GPL)
        code, doc = self.go("ink", "show", "mini-brand/primary", "--palette", str(pal))
        m = doc["data"]["matches"]
        self.assertEqual((code, m[0]["color"], m[0]["rgb"], m[0]["delta-e"]), (0, "Blue 1", "#214ea2", 0.0))
        self.assertEqual(m[0]["palette"], "Test card")
        self.assertIn("candidate", doc["data"]["note"])
        self.assertEqual(self.go("ink", "show", "mini-brand/primary", "--palette", "/no/such.gpl")[0], 2)

    def test_ink_record_writes_the_match_the_name_and_the_date_to_the_tokens(self):  # 0042 FR-012
        args = ["ink", "record", "mini-brand/primary", "--spot", "7686 C", "--thread", "3999", "--by", "A. Checker", "--on", "2026-10-10"]
        code, doc = self.go(*args)
        self.assertEqual(code, 0)
        entry = json.loads((self.brand / "tokens.json").read_text())["$extensions"][decoration.KIT]["inks"]["primary"]
        self.assertEqual((entry["verified"], entry["verified-by"], entry["verified-on"]), (True, "A. Checker", "2026-10-10"))
        self.assertEqual(entry["thread"], {"system": "Isacord polyester", "number": "3999"})  # the old color name goes
        self.assertEqual(self.go("ink", "list", "mini-brand")[1]["data"]["verified"], 1)

    def test_ink_record_dry_run_and_a_bad_date_write_nothing(self):  # 0041 FR-015
        before = tree(self.root)
        args = ["ink", "record", "mini-brand/primary", "--spot", "s", "--thread", "1", "--by", "A", "--on"]
        code, doc = self.go(*args, "2026-10-10", "--dry-run")
        self.assertEqual((code, doc["data"]["dry_run"], len(doc["data"]["changes"])), (0, True, 1))
        self.assertEqual(self.go(*args, "2026-13-45")[0], 2)
        self.assertEqual(self.go(*args, "10 Oct")[0], 2)
        self.assertEqual(tree(self.root), before)

    def test_ink_record_is_a_decision_and_never_over_mcp(self):  # 0042 FR-007
        reg = Registry.load(HOME)
        c = reg.find("ink record")
        self.assertEqual(c.category, "decision")
        self.assertNotIn("mcp", reg.surfaces_of(c))
        self.assertFalse(next(o for o in c.options if o.flag == "--by").log)

    def test_only_ink_record_takes_a_person_to_write(self):  # 0042 FR-012
        reg = Registry.load(HOME)
        for c in reg.commands.values():
            if c.id != "ink record":
                self.assertNotIn("--by", [o.flag for o in c.options] if c.id != "requirement set" else [], c.id)

    def test_the_log_never_holds_who_checked(self):  # 0041 FR-042
        import io
        from agora.core.cli import main
        main(["ink", "record", "mini-brand/text", "--spot", "s", "--thread", "1", "--by", "Q. Person", "--on", "2026-10-10"],
             home=self.root, stdout=io.StringIO(), stderr=io.StringIO(), env={"PATH": "/usr/bin", "AGORA_PLAN_GROUP": "brand"})
        logs = "".join(f.read_text() for f in (self.root / ".agora" / "logs").glob("*.ndjson"))
        self.assertIn("ink record", logs)
        self.assertNotIn("Q. Person", logs)

    def test_ciede2000_and_the_palette_reader(self):
        self.assertAlmostEqual(decoration.ciede2000(decoration.lab("#ff0000"), decoration.lab("#ff0000")), 0.0)
        self.assertGreater(decoration.ciede2000(decoration.lab("#ff0000"), decoration.lab("#0000ff")), 30)
        pal = self.root / "p.gpl"
        pal.write_text(GPL)
        self.assertEqual(len(decoration.palette_colors([pal])), 3)
        self.assertEqual(decoration.match("#c80a0a", [pal], 1)[0]["color"], "Red 3")


@unittest.skipUnless(HAS_PILLOW, "needs Pillow")
class Imagery(Repo):
    def setUp(self):
        super().setUp()
        (self.brand / "imagery").mkdir()
        self.catalog = {"$description": "d", "fields": {}, "environments": ["forest", "desert-canyon"], "pieces": []}
        self.write_catalog()

    def write_catalog(self):
        (self.brand / "imagery" / "catalog.json").write_text(imagery.dumps(self.catalog))

    def master(self, name="forest-fire-tower.png", transparent=True) -> Path:
        p = self.root / name
        png(p, "40x30", transparent=transparent)
        return p

    ADD = ["--name", "Fire Tower", "--environment", "forest", "--description", "A tower over trees.",
           "--visual-anchor", "fire tower", "--route", "a trail", "--built-structure", "tower", "--infrastructure-type", "lookout",
           "--colored-element", "trail", "--metaphor", "watching", "--suggested-subject", "safety", "--generator", "a tool",
           "--supplied", "2026-10-04"]

    def test_imagery_add_copies_measures_and_catalogs_the_master(self):  # 0042 FR-006, 0014 FR-043
        m = self.master()
        code, doc = self.go("imagery", "add", "mini-brand", "--master", str(m), *self.ADD)
        self.assertEqual(code, 0, doc)
        self.assertEqual((self.brand / "imagery" / m.name).read_bytes(), m.read_bytes())  # byte for byte
        (piece,) = json.loads((self.brand / "imagery" / "catalog.json").read_text())["pieces"]
        self.assertEqual((piece["id"], piece["pixel_size"], piece["file"]), ("forest-fire-tower", [40, 30], "forest-fire-tower.png"))
        self.assertEqual(piece["content_box"], imagery.measure(m)["content_box"])
        self.assertEqual([w["file"] for w in piece["web"]], ["web/forest-fire-tower-20.webp", "web/forest-fire-tower-40.webp"])
        self.assertEqual(piece["water"], {"present": False})
        self.assertEqual(piece["source"], {"supplied": "2026-10-04", "generator": "a tool"})
        self.assertEqual(imagery.check(self.brand)[0].split(":")[0], "images/share-card.png")  # only the build is missing

    def test_imagery_add_dry_run_only_measures(self):  # 0041 FR-015
        m = self.master()
        before = tree(self.root)
        code, doc = self.go("imagery", "add", "mini-brand", "--master", str(m), *self.ADD, "--dry-run")
        self.assertEqual((code, doc["data"]["measure"]["transparent"]), (0, True))
        self.assertEqual(len(doc["data"]["changes"]), 2)
        self.assertEqual(tree(self.root), before)

    def test_imagery_add_refuses_what_the_check_would_refuse(self):
        add = lambda *a, m=None: self.go("imagery", "add", "mini-brand", "--master", str(m or self.master()), *a)[0]
        self.assertEqual(add(*self.ADD, m=self.master(transparent=False)), 1)  # flattened
        self.assertEqual(add(*[("desert-x" if a == "forest" else a) for a in self.ADD]), 2)  # environment not in the catalog
        self.assertEqual(add(*self.ADD[:self.ADD.index("--built-structure")], *self.ADD[self.ADD.index("--infrastructure-type"):]), 2)
        self.assertEqual(add(*self.ADD, m=self.master("Bad Name.png")), 2)
        self.assertEqual(self.go("imagery", "add", "mini-brand", "--master", "/no/such.png", *self.ADD)[0], 2)
        self.assertEqual(add(*self.ADD), 0)
        self.assertEqual(add(*self.ADD), 2)  # already there

    def test_imagery_list_and_show_measure_the_master(self):
        self.go("imagery", "add", "mini-brand", "--master", str(self.master()), *self.ADD)
        code, doc = self.go("imagery", "list", "mini-brand")
        self.assertEqual((code, doc["data"]["count"], doc["data"]["pieces"][0]["id"]), (0, 1, "forest-fire-tower"))
        code, doc = self.go("imagery", "show", "mini-brand/forest-fire-tower")
        d = doc["data"]
        self.assertEqual((code, d["agrees"], d["measure"]["pixel_size"], d["measure"]["transparent"]), (0, True, [40, 30], True))
        self.assertEqual([w["present"] for w in d["web"]], [False, False])
        self.assertEqual(self.go("imagery", "show", "mini-brand/nope")[0], 2)

    def test_imagery_show_says_where_the_catalog_and_the_master_disagree(self):
        self.go("imagery", "add", "mini-brand", "--master", str(self.master()), *self.ADD)
        self.catalog = json.loads((self.brand / "imagery" / "catalog.json").read_text())
        self.catalog["pieces"][0]["pixel_size"] = [1, 1]
        self.write_catalog()
        d = self.go("imagery", "show", "mini-brand/forest-fire-tower")[1]["data"]
        self.assertFalse(d["agrees"])
        self.assertIn("pixel_size", d["problems"][0])

    @unittest.skipUnless(webp_works(), "needs Pillow with WebP support")
    def test_imagery_build_writes_the_webp_files_and_the_share_card(self):  # 0014 FR-037, FR-043
        self.go("imagery", "add", "mini-brand", "--master", str(self.master()), *self.ADD)
        before = tree(self.root)
        code, doc = self.go("imagery", "build", "mini-brand", "--dry-run")
        self.assertEqual((code, doc["data"]["webp"]), (0, 2))
        self.assertEqual(sorted(c["path"].split("/")[-1] for c in doc["data"]["changes"]),
                         ["forest-fire-tower-20.webp", "forest-fire-tower-40.webp", "share-card.png"])
        self.assertEqual(tree(self.root), before)
        self.assertEqual(self.go("imagery", "build", "mini-brand")[0], 0)
        self.assertEqual(imagery.check(self.brand), [])
        self.assertEqual(imagery.size(self.brand / "images" / "share-card.png"), [1200, 630])
        self.assertEqual(self.go("imagery", "build", "mini-brand")[1]["data"]["changes"], [])  # nothing left to write

    @unittest.skipUnless(webp_works(), "needs Pillow with WebP support")
    def test_the_files_pillow_writes_are_what_the_catalog_and_the_tokens_say(self):  # 0042 FR-030: Pillow in place of ImageMagick
        from PIL import Image
        self.go("imagery", "add", "mini-brand", "--master", str(self.master()), *self.ADD)
        self.assertEqual(self.go("imagery", "build", "mini-brand")[0], 0)
        for name, size in (("forest-fire-tower-20.webp", (20, 15)), ("forest-fire-tower-40.webp", (40, 30))):
            with Image.open(self.brand / "imagery" / "web" / name) as im:
                self.assertEqual((im.format, im.size), ("WEBP", size))
                self.assertIn("A", im.convert("RGBA").getbands())
                self.assertLess(im.convert("RGBA").getchannel("A").getextrema()[0], 16)  # the transparency survived
        with Image.open(self.brand / "images" / "share-card.png") as im:
            self.assertEqual((im.format, im.size), ("PNG", (1200, 630)))
        again = {p: p.read_bytes() for p in (self.brand / "imagery" / "web").glob("*.webp")}
        self.go("imagery", "build", "mini-brand")
        self.assertEqual({p: p.read_bytes() for p in again}, again)  # the same bytes every time

    def test_building_in_place_and_building_elsewhere_write_the_same_bytes(self):
        if not webp_works():
            self.skipTest("needs Pillow with WebP support")
        self.go("imagery", "add", "mini-brand", "--master", str(self.master()), *self.ADD)
        imagery.build(self.brand)
        for path, data in imagery.build_changes(self.brand).items():
            self.assertEqual(path.read_bytes(), data, path.name)


class NoHostPrograms(Repo):
    def test_the_image_and_decoration_commands_run_no_program_of_the_host(self):  # 0042 FR-030
        reg = Registry.load(HOME)
        for cid in ("imagery build", "imagery show", "imagery add", "decoration generate", "decoration show"):
            self.assertEqual(reg.commands[cid].toolchain, (), cid)
        self.assertEqual(reg.commands["openedx build"].toolchain, ("paragon",))  # Paragon, pinned in the toolchain
        self.assertIn("Pillow", reg.groups["brand"].packages)
        self.assertTrue({"Pillow", "potracer", "resvg-py", "uharfbuzz"} <= set(reg.groups["decoration"].packages))

    def test_a_command_run_with_no_path_still_runs(self):  # nothing is found on the host's PATH
        from unittest import mock
        with mock.patch.dict(os.environ, {"PATH": "/nonexistent"}):
            self.assertEqual(self.go("imagery", "build", "mini-brand", "--dry-run")[0], 0)
            self.assertEqual(self.go("decoration", "generate", "mini-brand", "--only", "set", "--dry-run")[0], 0)


class Decoration(Repo):
    TRACE = {"file": "logos/master.png", "threshold": 0.5, "scale": 4, "speckle-px": 2}

    def setUp(self):
        super().setUp()
        t = brands.tokens_of(self.brand)
        kit = t["$extensions"][decoration.KIT]
        for part in ("lockup", "icon"):
            kit[part]["traced-from"] = dict(self.TRACE)
            kit[part]["finest-detail"] = 0
        (self.brand / "tokens.json").write_text(decoration.dumps(t))
        png(self.brand / "logos" / "master.png", "40x30", transparent=True)  # a red block on nothing: ink to trace
        from unittest import mock
        patch = mock.patch.object(decoration, "MEASURE_WIDTH", 160)  # the measure is slow at full size
        patch.start()
        self.addCleanup(patch.stop)

    def test_decoration_show_reports_the_kit(self):
        code, doc = self.go("decoration", "show", "mini-brand", plan="decoration")
        self.assertEqual(code, 0)
        self.assertEqual([p["part"] for p in doc["data"]["parts"]], ["lockup", "icon"])
        self.assertEqual(sorted(doc["data"]["inks"]), ["primary", "secondary", "surface", "tertiary", "text"])
        self.assertEqual(self.go("decoration", "show", "mini-brand", "--dry-run", plan="decoration")[0], 2)  # a read has no dry run

    def test_decoration_generate_traces_and_measures_what_the_tokens_name(self):  # 0014 FR-047
        code, doc = self.go("decoration", "generate", "mini-brand", "--only", "trace", plan="decoration")
        self.assertEqual(code, 0, doc)
        svg = (self.brand / "logos" / "vector" / "if-lockup-one-color-2026-Sept.svg").read_text()
        self.assertIn('fill="currentColor"', svg)
        self.assertIn("traced from logos/master.png", svg)
        self.assertNotIn("metadata", svg)
        kit = brands.tokens_of(self.brand)["$extensions"][decoration.KIT]
        self.assertTrue(0 < kit["lockup"]["finest-detail"] <= 1)  # measured from the render, and written back
        self.assertEqual(kit["lockup"]["finest-detail"], kit["icon"]["finest-detail"])
        self.assertEqual(len(doc["data"]["made"]), 2)

    def test_decoration_generate_dry_run_writes_nothing(self):  # 0041 FR-015
        before = tree(self.root)
        code, doc = self.go("decoration", "generate", "mini-brand", "--dry-run", plan="decoration")
        self.assertEqual((code, doc["data"]["dry_run"]), (0, True))
        self.assertEqual(len(doc["data"]["changes"]), 3)  # two SVGs and tokens.json
        self.assertEqual(tree(self.root), before)

    def test_only_set_with_nothing_to_set_changes_nothing(self):
        code, doc = self.go("decoration", "generate", "mini-brand", "--only", "set", plan="decoration")
        self.assertEqual((code, doc["data"]["changes"]), (0, []))

    def test_a_brand_without_a_kit_is_refused(self):
        t = brands.tokens_of(self.brand)
        del t["$extensions"][decoration.KIT]
        (self.brand / "tokens.json").write_text(decoration.dumps(t))
        self.assertEqual(self.go("decoration", "generate", "mini-brand", plan="decoration")[0], 2)

    def test_the_wordmark_is_set_by_harfbuzz_to_the_committed_bytes(self):  # uharfbuzz is the decoration group's package
        b = HOME / "design-systems" / "frontiers-brand"
        a = json.loads((b / "tokens.json").read_text(encoding="utf-8"))["$extensions"][decoration.KIT]["wordmark"]
        spec = a["set-from"]
        name = " / ".join(l if isinstance(l, str) else l["text"] for l in spec["lines"])
        text = decoration.typeset(b, spec, f"{b.name} wordmark, one color, set in {spec['font']} (opsz {spec['opsz']}, wght {spec['wght']}): {name}")
        self.assertEqual(text, (b / "logos" / "vector" / "if-wordmark-one-color-2026-Sept.svg").read_text())

    def test_the_trace_draws_the_ink_of_the_master_and_nothing_else(self):  # 0042 FR-030: potracer in place of potrace
        import io
        import resvg_py
        from PIL import Image, ImageDraw
        master = self.root / "ring.png"
        ring = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
        d = ImageDraw.Draw(ring)
        d.ellipse((6, 8, 41, 39), fill="#101010")
        d.ellipse((17, 18, 30, 29), fill=(0, 0, 0, 0))  # a hole, so the winding of the outlines matters
        ring.save(master)
        width, height, svg = decoration.trace_master(master, 4, 0.5, 2)
        self.assertEqual((width, height), (48, 48))
        art = decoration.clean(svg, width, height, "ring").replace("currentColor", "#000000")
        drawn = Image.open(io.BytesIO(bytes(resvg_py.svg_to_bytes(svg_string=art, width=48, background="white")))).convert("L")
        want = Image.new("RGBA", ring.size, "white")
        want.alpha_composite(ring)
        want = want.convert("L")
        wrong = sum(abs(a - b) > 128 for a, b in zip(drawn.tobytes(), want.tobytes()))
        self.assertLess(wrong, 48 * 48 * 0.02)  # the trace agrees with the master almost everywhere, hole and all
        self.assertEqual(svg.count("<path"), 1)
        self.assertNotIn("potrace", svg.lower())

    def test_the_trace_is_repeatable(self):
        master = self.brand / "logos" / "master.png"
        self.assertEqual(decoration.trace_master(master, 4, 0.5, 2), decoration.trace_master(master, 4, 0.5, 2))


class OpenEdx(Repo):
    openedx = True

    def test_openedx_generate_writes_the_package_sources_and_removes_what_it_does_not_write(self):  # frontiers-brand FR-020
        (self.brand / "openedx" / "stray.txt").write_text("x")
        (self.brand / "openedx" / "dist").mkdir()
        (self.brand / "openedx" / "dist" / "core.css").write_text("built")
        code, doc = self.go("openedx", "generate", "mini-brand")
        self.assertEqual(code, 0)
        ch = {c["path"].split("openedx/", 1)[1]: c["change"] for c in doc["data"]["changes"]}
        self.assertEqual(ch["stray.txt"], "delete")
        self.assertEqual(ch["package.json"], "create")
        self.assertIn("paragon/tokens/themes/light/global/color.json", ch)
        self.assertNotIn("dist/core.css", ch)  # built output is Paragon's, not this command's
        self.assertFalse((self.brand / "openedx" / "stray.txt").exists())
        self.assertEqual((self.brand / "openedx" / "dist" / "core.css").read_text(), "built")
        pkg = json.loads((self.brand / "openedx" / "package.json").read_text())
        self.assertEqual(pkg["name"], "mini-brand-openedx")
        self.assertEqual(self.go("openedx", "generate", "mini-brand")[1]["data"]["changes"], [])

    def test_openedx_generate_dry_run_writes_nothing(self):  # 0041 FR-015
        before = tree(self.root)
        code, doc = self.go("openedx", "generate", "mini-brand", "--dry-run")
        self.assertEqual((code, doc["data"]["dry_run"]), (0, True))
        self.assertGreater(len(doc["data"]["changes"]), 10)
        self.assertEqual(tree(self.root), before)

    def test_openedx_build_without_paragon_uses_the_pinned_one_and_names_it_when_it_cannot(self):
        from .toolchain_fixture import FakeHost
        (self.root / "host").mkdir()
        host = FakeHost(self.root / "host")
        host.add("node", files={"bin/node": b"#!/bin/sh\n"}, bin="bin")
        host.add("paragon", ready=False, needs=("node",), provides={"paragon": "node_modules/.bin/paragon"})
        offline = host.env(AGORA_OFFLINE="1")
        code, doc = self.go("openedx", "build", "mini-brand", env=offline)
        self.assertEqual((code, doc["data"]["code"]), (3, "toolchain"))
        self.assertIn("paragon", doc["data"]["message"])
        self.assertIn("ws-host toolchain ensure paragon --provider agora", doc["data"]["message"])
        # a Paragon of the person's own is named explicitly, and stands in for the pinned one: nothing is installed or asked for
        code, doc = self.go("openedx", "build", "mini-brand", "--paragon", "/no/paragon", env=offline)
        self.assertEqual((code, doc["data"]["code"]), (3, "missing-program"))
        self.assertIn("paragon", doc["data"]["message"].lower())

    def test_openedx_build_runs_paragons_cli_in_a_scratch_copy_and_writes_dist(self):
        cli = self.root / "paragon"
        cli.write_text("#!/bin/sh\nset -e\ncase \"$1\" in\n  build-tokens) mkdir -p paragon/build/themes/light; echo t > paragon/build/themes/light/light.css ;;\n"
                       "  build-scss) mkdir -p dist/themes/light; echo '/* Built on today */' > dist/core.css; echo l > dist/themes/light/light.css ;;\nesac\n")
        cli.chmod(0o755)
        from .toolchain_fixture import FakeHost
        import tempfile
        from pathlib import Path
        hosttmp = tempfile.TemporaryDirectory()
        self.addCleanup(hosttmp.cleanup)
        host = FakeHost(Path(hosttmp.name))
        host.add("node", files={"bin/node": b"#!/bin/sh\n"}, bin="bin")
        env = host.env()
        before = tree(self.root)
        code, doc = self.go("openedx", "build", "mini-brand", "--paragon", str(cli), "--dry-run", env=env)
        self.assertEqual(code, 0, doc)
        self.assertEqual(tree(self.root), before)
        self.assertEqual(self.go("openedx", "build", "mini-brand", "--paragon", str(cli), env=env)[0], 0)
        self.assertTrue((self.brand / "openedx" / "dist" / "core.css").is_file())
        self.assertTrue((self.brand / "openedx" / "dist" / "logo.svg").is_file())
        self.assertFalse((self.brand / "openedx" / "paragon" / "build").exists())
        self.assertEqual(self.go("fresh", "openedx-sources")[0], 0)  # dist/ is Paragon's, not a source

    def test_the_favicon_a_brand_has_is_used_as_it_is_and_one_it_lacks_is_drawn_by_pillow(self):
        self.assertEqual(openedx.favicon(self.brand), b"ico")  # make_repo gave this brand a favicon.ico
        (self.brand / "images" / "favicon.ico").unlink()
        png(self.brand / "images" / "favicon.png", "64x64", transparent=True)
        import io
        from PIL import Image
        with Image.open(io.BytesIO(openedx.favicon(self.brand))) as ico:
            self.assertEqual(sorted(ico.info["sizes"]), [(16, 16), (32, 32), (48, 48)])

    def test_paragon_runs_on_the_pinned_node_not_the_hosts(self):  # 0042 FR-030
        cli = self.root / "paragon"
        cli.write_text("#!/usr/bin/env node\nrequire('fs').writeFileSync('node-used.txt', process.execPath)\n")
        cli.chmod(0o755)
        pinned = self.root / "pinned-bin"
        pinned.mkdir()
        (pinned / "node").write_text("#!/bin/sh\necho pinned > node-used.txt\n")
        (pinned / "node").chmod(0o755)
        out = self.root / "pkg"
        out.mkdir()
        env = {"PATH": f"{pinned}:/usr/bin:/bin"}
        try:
            openedx.build(out, cli, env)
        except (OSError, Exception):
            pass  # the stand-in writes no CSS; only which node ran it matters
        self.assertEqual((out / "node-used.txt").read_text().strip(), "pinned")


class Types(Repo):
    def test_piece_and_ink_types_validate_and_complete(self):
        reg = Registry.load(self.root)
        from agora.core.ctx import Ctx
        ctx = Ctx(reg, self.root, self.root)
        self.assertEqual(reg.types["INK"].validate(ctx, "mini-brand/text"), "mini-brand/text")
        self.assertIn("mini-brand/primary", reg.types["INK"].complete(ctx, "mini-brand/p"))
        with self.assertRaises(ValueError):
            reg.types["PIECE"].validate(ctx, "mini-brand/nope")
        self.assertEqual(reg.types["PIECE"].choices(ctx), [])
        self.assertEqual(reg.types["DATE"].validate(ctx, "2026-10-10"), "2026-10-10")
