"""The toolchain lock: fetch, verify, cache, offline, override and the `system` setup, with local archives and no network
(0041-command-line FR-066 to FR-069; 0025-tooling-environment FR-015 to FR-021; 0042-agora FR-013, FR-030)."""
import dataclasses
import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from agora.core import system, toolchain as tcore
from agora.core.ctx import Ctx
from agora.core.registry import Generator, Registry
from agora.core.toolchain import Archive, Entry, ToolchainError
from agora.groups.toolchain import commands as tcmd

from .helpers import HOME, run, run_json
from .toolchain_fixture import PLATFORM, entry, make_tar, make_zip, toolchain

UBUNTU_2404 = {"ID": "ubuntu", "VERSION_ID": "24.04", "ID_LIKE": "debian", "PRETTY_NAME": "Ubuntu 24.04 LTS"}
DEBIAN_12 = {"ID": "debian", "VERSION_ID": "12", "PRETTY_NAME": "Debian GNU/Linux 12"}
FEDORA = {"ID": "fedora", "VERSION_ID": "41", "PRETTY_NAME": "Fedora Linux 41"}


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)
        self.cache = self.dir / "cache"
        self.lines: list[str] = []

    def tar_entry(self, name="tool", files=None, **kw):
        files = files if files is not None else {f"bin/{name}": b"#!/bin/sh\necho hi\n", "data.txt": b"data"}
        archive = self.dir / f"{name}.tar.gz"
        sha = make_tar(archive, files)
        return entry(name, archive, sha, **kw)

    def tc(self, *entries, **kw):
        return toolchain({e.name: e for e in entries}, self.cache, lines=self.lines, **kw)


class FetchVerifyUnpack(Base):
    def test_an_entry_is_fetched_verified_unpacked_into_a_directory_named_for_entry_version_platform(self):
        e = self.tar_entry(version="2.3")
        tc = self.tc(e)
        self.assertEqual(tc.state(e), "missing")
        r = tc.ensure(["tool"])
        final = self.cache / f"tool-2.3-{PLATFORM}"
        self.assertEqual(r.dirs["tool"], final)
        self.assertEqual((final / "data.txt").read_bytes(), b"data")
        self.assertTrue(os.access(final / "bin" / "tool", os.X_OK))
        self.assertEqual(r.path_of("tool"), final / "bin" / "tool")
        self.assertEqual(tc.state(e), "ready")
        self.assertTrue(any(l.startswith("fetching tool 2.3") for l in self.lines))

    def test_a_cached_entry_is_not_fetched_again(self):
        e = self.tar_entry()
        self.tc(e).ensure(["tool"])
        self.lines.clear()
        with mock.patch("urllib.request.urlopen", side_effect=AssertionError("fetched twice")):
            self.tc(e).ensure(["tool"])
        self.assertEqual(self.lines, [])

    def test_a_zip_with_a_prefix_and_only_unpacks_what_is_wanted(self):
        archive = self.dir / "z.zip"
        sha = make_zip(archive, {"bin/z": b"x", "doc/readme": b"y"}, prefix="top/")
        e = dataclasses.replace(entry("z", archive, sha, form="zip", prefix="top"),
                                platforms={PLATFORM: (Archive(archive.as_uri(), sha, "zip", prefix="top", only=("bin",)),)})
        tc = self.tc(e)
        tc.ensure(["z"])
        final = self.cache / f"z-1.0-{PLATFORM}"
        self.assertTrue((final / "bin" / "z").is_file())
        self.assertFalse((final / "doc").exists())

    def test_a_checksum_that_does_not_match_deletes_what_was_fetched_and_names_everything(self):
        e = self.tar_entry()
        wrong = "0" * 64
        bad = dataclasses.replace(e, platforms={PLATFORM: (dataclasses.replace(e.platforms[PLATFORM][0], sha256=wrong),)})
        tc = self.tc(bad)
        with self.assertRaises(ToolchainError) as cm:
            tc.ensure(["tool"])
        err = cm.exception
        self.assertEqual((err.code, err.exit), ("checksum", 1))
        for text in ("tool 1.0", e.platforms[PLATFORM][0].url, wrong, hashlib.sha256((self.dir / "tool.tar.gz").read_bytes()).hexdigest()):
            self.assertIn(text, err.message)
        self.assertEqual(sorted(p.name for p in self.cache.iterdir() if not p.name.startswith(".lock")), [])  # nothing left
        self.assertEqual(tc.state(bad), "missing")

    def test_an_interrupted_fetch_leaves_nothing_a_later_run_could_use(self):
        def boom(tc, scratch, platform):
            (scratch / "half").write_text("x")
            raise RuntimeError("the network went away")
        e = self.tar_entry(installer=boom)
        tc = self.tc(e)
        with self.assertRaises(RuntimeError):
            tc.fetch(e)
        self.assertEqual(tc.state(e), "missing")
        self.assertFalse((self.cache / f"tool-1.0-{PLATFORM}").exists())
        self.assertEqual([p for p in self.cache.iterdir() if p.name.startswith(".tmp-")], [])

    def test_a_member_that_would_leave_the_directory_is_refused(self):
        archive = self.dir / "evil.tar.gz"
        sha = make_tar(archive, {"../escape.txt": b"x"})
        e = entry("evil", archive, sha)
        tc = self.tc(e)
        with self.assertRaises(ToolchainError) as cm:
            tc.fetch(e)
        self.assertIn("outside its directory", cm.exception.message)
        self.assertFalse((self.cache.parent / "escape.txt").exists())

    def test_a_link_that_leaves_the_entry_is_dropped(self):
        archive = self.dir / "l.tar.gz"
        sha = make_tar(archive, {"bin/l": b"x", "etc": ("symlink", "/etc"), "ok": ("symlink", "bin/l")})
        e = entry("l", archive, sha)
        self.tc(e).fetch(e)
        final = self.cache / f"l-1.0-{PLATFORM}"
        self.assertFalse((final / "etc").exists() or (final / "etc").is_symlink())
        self.assertTrue((final / "ok").is_symlink())

    def test_a_directory_made_from_other_pins_is_stale_and_is_replaced(self):
        e = self.tar_entry()
        tc = self.tc(e)
        tc.fetch(e)
        archive = self.dir / "tool2.tar.gz"
        sha = make_tar(archive, {"bin/tool": b"new"})
        newer = entry("tool", archive, sha)
        tc2 = self.tc(newer)
        self.assertEqual(tc2.state(newer), "missing")  # same name, version and platform; other checksum
        tc2.ensure(["tool"])
        self.assertEqual((self.cache / f"tool-1.0-{PLATFORM}" / "bin" / "tool").read_bytes(), b"new")

    def test_the_marker_records_what_was_fetched(self):
        e = self.tar_entry()
        tc = self.tc(e)
        tc.fetch(e)
        m = tc.marker(e)
        self.assertEqual((m["name"], m["version"], m["platform"], m["sha256"]), ("tool", "1.0", PLATFORM, [e.platforms[PLATFORM][0].sha256]))
        self.assertIn("seconds", m)
        self.assertGreater(m["bytes"], 0)

    def test_entries_are_fetched_after_what_they_need(self):
        a, b = self.tar_entry("a"), self.tar_entry("b", needs=("a",))
        tc = self.tc(a, b)
        self.assertEqual(tc.expand(["b"]), ["a", "b"])
        r = tc.ensure(["b"])
        self.assertEqual(set(r.dirs), {"a", "b"})

    def test_entries_that_need_each_other_in_a_loop_are_refused(self):
        a, b = self.tar_entry("a", needs=("b",)), self.tar_entry("b", needs=("a",))
        with self.assertRaises(ToolchainError):
            self.tc(a, b).expand(["a"])

    def test_the_environment_carries_each_entrys_variables_and_not_the_hosts_tex_or_playwright(self):
        e = self.tar_entry(env=lambda r, path, platform: {"PATH": str(path / "bin"), "TOOL_HOME": str(path)})
        host = {"PATH": "/usr/bin", "TEXMFHOME": "/host/tex", "PLAYWRIGHT_BROWSERS_PATH": "/opt/pw", "CHROMIUM": "/usr/bin/chromium",
                "NODE_PATH": "/host/node"}
        tc = self.tc(e, env=host)
        env = tc.ensure(["tool"]).env()
        self.assertTrue(env["PATH"].startswith(str(self.cache / f"tool-1.0-{PLATFORM}" / "bin")))
        self.assertEqual(env["TOOL_HOME"], str(self.cache / f"tool-1.0-{PLATFORM}"))
        for gone in ("PLAYWRIGHT_BROWSERS_PATH", "CHROMIUM", "NODE_PATH"):
            self.assertNotIn(gone, env)
        self.assertNotEqual(env["TEXMFHOME"] if "TEXMFHOME" in env else "", "/host/tex")
        self.assertTrue(env["TEXMFVAR"].startswith(str(self.cache)))


class Offline(Base):
    def test_offline_with_a_cold_cache_fails_naming_the_entry_version_platform_and_the_command(self):
        e = self.tar_entry(version="9.9")
        tc = self.tc(e, offline=True)
        with mock.patch("urllib.request.urlopen", side_effect=AssertionError("downloaded")):
            with self.assertRaises(ToolchainError) as cm:
                tc.ensure(["tool"])
        err = cm.exception
        self.assertEqual((err.code, err.exit), ("offline", 3))
        for text in ("tool 9.9", PLATFORM, "agora toolchain add tool"):
            self.assertIn(text, err.message)
        self.assertEqual(err.detail["entries"], ["tool"])
        self.assertEqual(err.resource().actions[0].call.command, "toolchain add")

    def test_offline_names_every_missing_entry(self):
        a, b = self.tar_entry("a"), self.tar_entry("b")
        with self.assertRaises(ToolchainError) as cm:
            self.tc(a, b, offline=True).ensure(["a", "b"])
        self.assertIn("a 1.0", cm.exception.message)
        self.assertIn("b 1.0", cm.exception.message)
        self.assertIn("agora toolchain add a b", cm.exception.message)

    def test_offline_with_a_warm_cache_uses_only_the_cache(self):
        e = self.tar_entry()
        self.tc(e).ensure(["tool"])
        warm = self.tc(e, offline=True)
        with mock.patch("urllib.request.urlopen", side_effect=AssertionError("downloaded")):
            self.assertEqual(warm.ensure(["tool"]).path_of("tool").name, "tool")

    def test_offline_comes_from_the_environment_variable_too(self):
        e = self.tar_entry()
        tc = tcore.Toolchain({"tool": e}, cache=self.cache, env={"AGORA_OFFLINE": "1"})
        self.assertTrue(tc.offline)
        self.assertFalse(tcore.Toolchain({"tool": e}, cache=self.cache, env={}).offline)

    def test_a_platform_with_no_build_fails_naming_the_entry_the_platform_and_the_override(self):
        e = self.tar_entry()
        tc = self.tc(e, platform="macos-arm64")
        with self.assertRaises(ToolchainError) as cm:
            tc.ensure(["tool"])
        for text in ("tool 1.0", "macos-arm64", "AGORA_TOOL"):
            self.assertIn(text, cm.exception.message)
        self.assertEqual(cm.exception.exit, 3)

    def test_a_download_that_fails_is_exit_3_naming_the_address_and_the_command(self):
        e = entry("gone", self.dir / "no-such-file.tar.gz", "0" * 64)
        with mock.patch("time.sleep"):
            with self.assertRaises(ToolchainError) as cm:
                self.tc(e).ensure(["gone"])
        self.assertEqual(cm.exception.exit, 3)
        self.assertIn("agora toolchain add gone", cm.exception.message)


class Override(Base):
    def test_an_opt_in_variable_names_the_host_program_and_nothing_is_fetched(self):
        e = self.tar_entry(env=lambda r, path, platform: {"PATH": str(path if r.is_overridden("tool") else path / "bin")})
        host = self.dir / "mine"
        host.mkdir()
        tc = self.tc(e, env={"AGORA_TOOL": str(host), "PATH": "/usr/bin"}, offline=True)
        self.assertEqual(e.variable, "AGORA_TOOL")
        self.assertEqual(tc.state(e), "override")
        r = tc.ensure(["tool"])
        self.assertEqual(r.overridden, {"tool": host})
        self.assertEqual(r.path_of("tool"), host / "tool")
        self.assertTrue(r.env()["PATH"].startswith(str(host)))
        self.assertEqual(tc.overrides(), [(e, host)])
        self.assertFalse(self.cache.exists())

    def test_a_program_on_the_hosts_path_is_never_used_without_the_variable(self):
        e = self.tar_entry()
        tc = self.tc(e, env={"PATH": "/usr/bin:/bin"}, offline=True)
        self.assertEqual(tc.overrides(), [])
        with self.assertRaises(ToolchainError):  # PATH may hold a "tool"; it is not looked at
            tc.ensure(["tool"])

    def test_a_name_with_hyphens_makes_an_underscored_variable(self):
        self.assertEqual(self.tar_entry("tex-packages").variable, "AGORA_TEX_PACKAGES")

    def test_fresh_will_not_call_a_generator_current_under_an_override(self):  # 0025 FR-019
        from agora.core import generate
        e = self.tar_entry()
        host = self.dir / "mine"
        host.mkdir()
        gen = Generator("g", toolchain=("tool",), fn=lambda ctx, scope: self.fail("must not run"), group="core")
        reg = Registry.load(HOME)
        ctx = Ctx(reg, HOME, HOME, env={})
        ctx.__dict__["_toolchain"] = self.tc(e, env={"AGORA_TOOL": str(host)})
        row = generate.prove(ctx, gen)
        self.assertEqual(row["status"], "skipped")
        self.assertIn("AGORA_TOOL", row["reason"])
        self.assertIn("not called current", row["reason"])

    def test_fresh_proves_a_generator_under_the_locked_entry(self):
        from agora.core import generate
        from agora.core.generate import Generated
        e = self.tar_entry()
        gen = Generator("g", toolchain=("tool",), fn=lambda ctx, scope: Generated(files={}), group="core")
        ctx = Ctx(Registry.load(HOME), HOME, HOME, env={})
        ctx.__dict__["_toolchain"] = self.tc(e)
        row = generate.prove(ctx, gen)
        self.assertEqual(row["status"], "fresh")
        self.assertTrue((self.cache / f"tool-1.0-{PLATFORM}").is_dir())  # fetched on first use


class Declarations(unittest.TestCase):
    def good(self, **kw):
        a = Archive("https://example.org/a.tar.gz", "a" * 64, "tar.gz")
        base = dict(name="x", version="1.2.3", summary="x", platforms={"linux-x86_64": (a,)}, provides=lambda p: {"x": "bin/x"},
                    check=lambda r: "ok")
        base.update(kw)
        return Entry(**base)

    def problems(self, **kw):
        e = self.good(**kw)
        return tcore.problems({e.name: e})

    def test_a_complete_entry_has_no_problem(self):
        self.assertEqual(self.problems(), [])

    def test_an_incomplete_entry_is_named(self):
        self.assertTrue(any("no version" in p for p in self.problems(version="")))
        self.assertTrue(any("no summary" in p for p in self.problems(summary="")))
        self.assertTrue(any("no functional check" in p for p in self.problems(check=None)))
        self.assertTrue(any("provides no program" in p for p in self.problems(provides=lambda p: {})))

    def test_an_address_that_is_not_https_or_floats_is_refused(self):
        for url, word in (("http://example.org/a", "not https"), ("https://example.org/latest/a.tgz", "floating")):
            e = self.good(platforms={"linux-x86_64": (Archive(url, "a" * 64),)})
            self.assertTrue(any(word in p for p in tcore.problems({"x": e})), url)

    def test_a_range_or_a_floating_version_is_refused(self):
        for v in ("^1.2", ">=1", "1.*", "latest", "main", "1.0, 2.0"):
            self.assertTrue(any("range or a floating tag" in p for p in self.problems(version=v)), v)

    def test_linux_x86_64_is_required_and_platforms_are_known(self):
        a = Archive("https://example.org/a", "a" * 64)
        self.assertTrue(any("lacks the platform linux-x86_64" in p for p in self.problems(platforms={"macos-arm64": (a,)})))
        self.assertTrue(any("not a platform" in p for p in self.problems(platforms={"linux-x86_64": (a,), "windows": (a,)})))

    def test_a_checksum_that_is_not_a_sha256_is_refused(self):
        e = self.good(platforms={"linux-x86_64": (Archive("https://example.org/a", "xyz"),)})
        self.assertTrue(any("not a SHA-256" in p for p in tcore.problems({"x": e})))

    def test_a_need_that_is_not_an_entry_is_refused(self):
        self.assertTrue(any("needs nothing-here" in p for p in self.problems(needs=("nothing-here",))))

    def test_the_real_entries_are_complete_and_pinned(self):
        entries = tcore.discover()
        self.assertEqual(set(entries), {"tinytex", "tex-packages", "chromium", "npm-packages", "extension-build", "jre", "asciidoctor", "asciidoctor-pdf", "vscode"})
        self.assertEqual(tcore.problems(entries), [])
        for e in entries.values():
            self.assertIn("linux-x86_64", e.platforms, e.name)
            self.assertTrue(e.provides("linux-x86_64"), e.name)
            self.assertTrue(callable(e.check), e.name)

    def test_the_cache_is_per_user_and_overridable(self):
        self.assertEqual(tcore.cache_root({"AGORA_TOOLCHAIN_CACHE": "/x/y"}), Path("/x/y"))
        with mock.patch("sys.platform", "linux"):
            self.assertEqual(tcore.cache_root({"XDG_CACHE_HOME": "/xdg"}), Path("/xdg/agora/toolchain"))
            self.assertEqual(tcore.cache_root({}), Path.home() / ".cache" / "agora" / "toolchain")
        with mock.patch("sys.platform", "darwin"):
            self.assertEqual(tcore.cache_root({}), Path.home() / "Library" / "Caches" / "agora" / "toolchain")

    def test_the_host_platform_names_follow_the_spec(self):
        with mock.patch("sys.platform", "linux"), mock.patch("platform.machine", return_value="x86_64"):
            self.assertEqual(tcore.host_platform(), "linux-x86_64")
        with mock.patch("sys.platform", "darwin"), mock.patch("platform.machine", return_value="arm64"):
            self.assertEqual(tcore.host_platform(), "macos-arm64")

    def test_the_tex_packages_are_pinned_by_the_checksum_of_each_container(self):
        from agora.toolchain import tex_packages
        self.assertTrue(tex_packages.PACKAGES)
        for name, revision, sha, size in tex_packages.PACKAGES:
            self.assertEqual(len(sha), 64, name)
            self.assertIsInstance(revision, int)
            self.assertGreater(size, 0)
        self.assertEqual(len(tex_packages.ARCHIVES), len(tex_packages.PACKAGES))
        self.assertTrue(all(a.url.startswith("https://") and "tlnet-final" in a.url for a in tex_packages.ARCHIVES))

    def test_chromium_and_playwright_are_pinned_together(self):
        from agora.toolchain import chromium, npm_packages
        self.assertEqual(chromium.PLAYWRIGHT_VERSION, npm_packages.PLAYWRIGHT_VERSION)
        self.assertEqual(npm_packages.lock_problems(), [])


class SystemLibraries(Base):
    def test_a_library_a_browser_links_that_does_not_load_fails_naming_it_and_the_setup_command(self):
        e = self.tar_entry(needs_system=lambda p: ("libfoo.so.1", "libbar.so.2"))
        tc = self.tc(e)
        with self.assertRaises(ToolchainError) as cm:
            with mock.patch.object(system, "loads", lambda lib: lib != "libfoo.so.1"):
                tc.use(["tool"])
        err = cm.exception
        self.assertEqual((err.code, err.exit), ("system-libraries", 3))
        self.assertIn("libfoo.so.1", err.message)
        self.assertNotIn("libbar.so.2", err.message)
        self.assertIn("agora system add", err.message)
        self.assertEqual(err.resource().actions[0].call.command, "system add")

    def test_with_every_library_present_the_entry_is_used(self):
        e = self.tar_entry(needs_system=lambda p: ("libfoo.so.1",))
        with mock.patch.object(system, "loads", lambda lib: True):
            self.assertIn("tool", self.tc(e).use(["tool"]).dirs)

    def test_an_entry_with_no_libraries_is_never_asked(self):
        e = self.tar_entry()
        with mock.patch.object(system, "loads", side_effect=AssertionError("probed")):
            self.tc(e).use(["tool"])

    def test_libraries_are_none_off_linux_and_pinned_to_the_chromium_entry(self):
        self.assertEqual(system.chromium_libraries("macos-arm64"), ())
        self.assertIn("libnss3.so", system.chromium_libraries("linux-x86_64"))
        self.assertEqual(set(system.needed(tcore.discover(), "linux-x86_64")), set(system.APT_LIBRARIES) | set(system.APT_VSCODE_EXTRA))
        self.assertEqual(set(system.vscode_libraries("linux-x86_64")), set(system.APT_LIBRARIES) | set(system.APT_VSCODE_EXTRA))
        self.assertEqual(system.vscode_libraries("macos-arm64"), ())
        self.assertIn("Xvfb", system.APT_VSCODE_EXTRA)  # a program, not a soname: found on PATH


class Families(unittest.TestCase):
    def test_ubuntu_2404_and_debian_13_use_the_t64_names(self):
        fam = system.family(UBUNTU_2404)
        self.assertEqual((fam.name, fam.packages["libasound.so.2"], fam.packages["libnss3.so"]), ("apt", "libasound2t64", "libnss3"))
        self.assertEqual(system.family({"ID": "debian", "VERSION_ID": "13"}).packages["libcups.so.2"], "libcups2t64")

    def test_debian_12_and_ubuntu_22_keep_the_older_names(self):
        self.assertEqual(system.family(DEBIAN_12).packages["libasound.so.2"], "libasound2")
        self.assertEqual(system.family({"ID": "ubuntu", "VERSION_ID": "22.04"}).packages["libcups.so.2"], "libcups2")

    def test_a_derivative_is_the_family_it_says_it_is_like(self):
        self.assertEqual(system.family({"ID": "linuxmint", "ID_LIKE": "ubuntu debian", "VERSION_ID": "21"}).name, "apt")

    def test_another_family_has_no_list(self):
        fam = system.family(FEDORA)
        self.assertEqual((fam.name, dict(fam.packages), fam.install), ("fedora", {}, ()))

    def test_the_commands_are_an_index_refresh_and_one_install_of_the_sorted_unique_packages(self):
        fam = system.family(UBUNTU_2404)
        gone = [("libnss3.so", "libnss3"), ("libnssutil3.so", "libnss3"), ("libgbm.so.1", "libgbm1")]
        self.assertEqual(system.commands(gone, fam, root=False),
                         [["sudo", "apt-get", "update"],
                          ["sudo", "apt-get", "install", "-y", "--no-install-recommends", "libgbm1", "libnss3"]])
        self.assertEqual(system.commands(gone, fam, root=True)[0], ["apt-get", "update"])
        self.assertEqual(system.commands([], fam, root=False), [])
        self.assertEqual(system.commands(gone, system.family(FEDORA), root=False), [])


class SystemCommands(unittest.TestCase):
    """`system list` and `system add` (0041 FR-069; 0025 FR-021): what they print, what they ask, what they run."""

    def setUp(self):
        self.env = {"AGORA_TOOLCHAIN_CACHE": tempfile.mkdtemp()}
        self.ran: list[list[str]] = []
        self.present = set()  # sonames that load
        self.patches = [
            mock.patch.object(system, "os_release", lambda *a, **k: UBUNTU_2404),
            mock.patch.object(system, "loads", lambda lib: lib in self.present),
            mock.patch.object(tcmd, "RUN", self.fake_run),
            mock.patch.object(tcmd, "INTERACTIVE", lambda: False),
            mock.patch("os.geteuid", lambda: 1000),
        ]
        for p in self.patches:
            p.start()
            self.addCleanup(p.stop)

    def fake_run(self, argv, **kw):
        self.ran.append(list(argv))
        if argv[:2] == ["sudo", "apt-get"] and "install" in argv:
            self.present.update(system.APT_LIBRARIES, system.APT_VSCODE_EXTRA)  # the install worked
        return mock.Mock(returncode=0)

    def test_list_names_each_library_its_package_and_whether_it_loads(self):
        self.present = {"libnss3.so"}
        code, doc = run_json(["system", "list"], env=self.env)
        self.assertEqual(code, 0)
        rows = {r["library"]: r for r in doc["data"]["libraries"]}
        self.assertTrue(rows["libnss3.so"]["present"])
        self.assertFalse(rows["libgbm.so.1"]["present"])
        self.assertEqual(rows["libasound.so.2"]["package"], "libasound2t64")
        self.assertEqual(doc["data"]["missing"], len(rows) - 1)
        self.assertEqual(doc["actions"][0]["command"], "system add")

    def test_dry_run_prints_exactly_what_it_would_run_and_runs_nothing(self):
        code, doc = run_json(["system", "add", "--dry-run"], env=self.env)
        self.assertEqual(code, 0)
        self.assertEqual(self.ran, [])
        cmds = doc["data"]["commands"]
        self.assertEqual(cmds[0], "sudo apt-get update")
        self.assertTrue(cmds[1].startswith("sudo apt-get install -y --no-install-recommends libasound2t64 "))
        self.assertFalse(doc["data"]["ran"])
        text = run(["system", "add", "--dry-run"], env=self.env)[1]
        self.assertIn("sudo apt-get update", text)

    def test_without_yes_and_no_terminal_it_refuses_and_runs_nothing(self):
        code, doc = run_json(["system", "add"], env=self.env)
        self.assertEqual((code, doc["data"]["code"]), (2, "not-confirmed"))
        self.assertEqual(self.ran, [])
        self.assertIn("system add --yes", doc["data"]["message"])

    def test_at_a_terminal_it_asks_after_showing_the_commands_and_a_no_runs_nothing(self):
        asked = []
        with mock.patch.object(tcmd, "INTERACTIVE", lambda: True), mock.patch.object(tcmd, "ASK", lambda q: asked.append(q) or "n"):
            code, doc = run_json(["system", "add"], env=self.env)
        self.assertEqual((code, self.ran), (2, []))
        self.assertEqual(len(asked), 1)
        self.assertIn("not confirmed", doc["data"]["message"])

    def test_at_a_terminal_a_yes_runs_the_commands_in_order(self):
        with mock.patch.object(tcmd, "INTERACTIVE", lambda: True), mock.patch.object(tcmd, "ASK", lambda q: "y"):
            code, doc = run_json(["system", "add"], env=self.env)
        self.assertEqual(code, 0)
        self.assertEqual([c[:3] for c in self.ran], [["sudo", "apt-get", "update"], ["sudo", "apt-get", "install"]])
        self.assertTrue(doc["data"]["ran"])

    def test_yes_skips_the_question(self):
        with mock.patch.object(tcmd, "ASK", side_effect=AssertionError("asked")):
            code, doc = run_json(["system", "add", "--yes"], env=self.env)
        self.assertEqual((code, len(self.ran)), (0, 2))
        self.assertEqual(doc["data"]["message"], "installed")

    def test_as_root_no_sudo_is_run_and_it_says_so(self):
        with mock.patch("os.geteuid", lambda: 0):
            code, doc = run_json(["system", "add", "--dry-run"], env=self.env)
        self.assertEqual(doc["data"]["commands"][0], "apt-get update")
        self.assertIn("no sudo is needed", doc["data"]["message"])

    def test_a_failing_install_is_an_error_naming_the_command(self):
        with mock.patch.object(tcmd, "RUN", lambda argv, **kw: mock.Mock(returncode=100)):
            code, doc = run_json(["system", "add", "--yes"], env=self.env)
        self.assertEqual((code, doc["data"]["code"]), (1, "install-failed"))
        self.assertIn("apt-get update", doc["data"]["message"])

    def test_nothing_is_run_when_every_library_loads(self):
        self.present = set(system.APT_LIBRARIES) | set(system.APT_VSCODE_EXTRA)
        code, doc = run_json(["system", "add", "--yes"], env=self.env)
        self.assertEqual((code, self.ran), (0, []))
        self.assertIn("nothing to install", doc["data"]["message"])

    def test_another_family_names_the_libraries_and_stops(self):
        with mock.patch.object(system, "os_release", lambda *a, **k: FEDORA):
            code, doc = run_json(["system", "add", "--yes"], env=self.env)
        self.assertEqual((code, doc["data"]["code"]), (3, "no-list"))
        self.assertEqual(self.ran, [])
        self.assertIn("libnss3.so", doc["data"]["message"])
        self.assertIn("Fedora", doc["data"]["message"])

    def test_it_is_refused_over_mcp_and_listed_on_no_surface_but_the_terminal(self):
        reg = Registry.load(HOME)
        self.assertEqual(reg.surfaces_of(reg.commands["system add"]), ())
        self.assertEqual(reg.surfaces_of(reg.commands["toolchain add"]), ("editor",))  # widened to the editor, never MCP (0041 FR-022)
        for words in ("system add", "toolchain add"):
            self.assertEqual(reg.commands[words].category, "setup")
        ctx = Ctx(reg, HOME, HOME, surface="mcp", env=dict(self.env))
        from agora.core.resource import AgoraError
        with self.assertRaises(AgoraError) as cm:
            tcmd.system_add(ctx, True)
        self.assertEqual(cm.exception.code, "refused")
        self.assertEqual(self.ran, [])

    def test_system_add_is_the_only_command_that_can_run_sudo(self):
        import re
        hits = []
        for path in (HOME / "tools" / "agora").rglob("*.py"):
            rel = path.relative_to(HOME).as_posix()
            if "/tests/" in rel or rel.endswith("toolchain_rules.py"):
                continue
            if re.search(r"""["']sudo["']""", path.read_text(encoding="utf-8")):
                hits.append(rel)
        self.assertEqual(sorted(hits), ["tools/agora/core/system.py"])


class ToolchainCommands(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)
        self.env = {"AGORA_TOOLCHAIN_CACHE": str(self.dir / "cache")}
        a = self.dir / "a.tar.gz"
        b = self.dir / "b.tar.gz"
        self.a = entry("alpha", a, make_tar(a, {"bin/alpha": b"x"}), size=1234567)
        self.b = entry("beta", b, make_tar(b, {"bin/beta": b"y"}), needs=("alpha",), check=self.beta_check)
        self.entries = {"alpha": self.a, "beta": self.b}
        p = mock.patch.object(tcore, "discover", lambda: dict(self.entries))
        p.start()
        self.addCleanup(p.stop)

    def beta_check(self, r):
        return f"beta ran with {r.path_of('alpha').name}"

    def test_list_reports_each_entry_and_its_cache_state(self):
        code, doc = run_json(["toolchain", "list"], env=self.env)
        self.assertEqual(code, 0)
        rows = {r["name"]: r for r in doc["data"]["entries"]}
        self.assertEqual((rows["alpha"]["state"], rows["alpha"]["size"]), ("missing", "1.2 MB"))
        self.assertEqual(doc["data"]["platform"], tcore.host_platform())
        self.assertEqual(doc["data"]["cache"], str(self.dir / "cache"))

    def test_show_reports_version_address_checksum_and_the_override(self):
        code, doc = run_json(["toolchain", "show", "alpha"], env=self.env)
        self.assertEqual(code, 0)
        d = doc["data"]
        self.assertEqual((d["name"], d["version"]), ("alpha", "1.0"))
        self.assertTrue(d["platforms"][0]["url"].startswith("file://"))
        self.assertEqual(len(d["platforms"][0]["sha256"]), 64)
        self.assertTrue(d["override"].startswith("AGORA_ALPHA="))

    def test_show_an_unknown_entry_is_a_usage_error(self):
        code, doc = run_json(["toolchain", "show", "nope"], env=self.env)
        self.assertEqual(code, 2)

    def test_add_fetches_what_it_needs_and_runs_each_functional_check(self):
        code, doc = run_json(["toolchain", "add", "beta"], env=self.env)
        self.assertEqual(code, 0, doc)
        rows = {r["entry"]: r for r in doc["data"]["entries"]}
        self.assertEqual([r["did"] for r in rows.values()], ["fetched", "fetched"])
        self.assertEqual(rows["beta"]["check"], "passed: beta ran with alpha")
        self.assertGreater(rows["alpha"]["bytes"], 0)
        self.assertTrue((self.dir / "cache" / f"beta-1.0-{tcore.host_platform()}").is_dir())

    def test_add_with_no_name_fetches_every_entry_and_a_second_run_only_checks(self):
        self.assertEqual(run_json(["toolchain", "add"], env=self.env)[0], 0)
        code, doc = run_json(["toolchain", "add"], env=self.env)
        self.assertEqual(code, 0)
        self.assertEqual({r["did"] for r in doc["data"]["entries"]}, {"already in the cache"})
        self.assertTrue(all(r["check"].startswith("passed") for r in doc["data"]["entries"]))

    def test_add_dry_run_fetches_nothing(self):
        code, doc = run_json(["toolchain", "add", "--dry-run"], env=self.env)
        self.assertEqual(code, 0)
        self.assertEqual({r["did"] for r in doc["data"]["entries"]}, {"would fetch"})
        self.assertFalse((self.dir / "cache").exists())

    def test_add_does_not_fetch_an_entry_a_persons_own_program_stands_in_for(self):
        code, doc = run_json(["toolchain", "add", "alpha"], env={**self.env, "AGORA_ALPHA": "/mine/alpha"})
        self.assertEqual(code, 0)
        (row,) = doc["data"]["entries"]
        self.assertEqual((row["before"], row["did"]), ("override", "override"))
        self.assertIn("AGORA_ALPHA=/mine/alpha", row["check"])
        self.assertFalse((self.dir / "cache").exists())

    def test_add_refuses_to_run_offline(self):
        code, doc = run_json(["toolchain", "add", "--offline"], env=self.env)
        self.assertEqual((code, doc["data"]["code"]), (3, "offline"))
        code, doc = run_json(["toolchain", "add"], env={**self.env, "AGORA_OFFLINE": "1"})
        self.assertEqual(code, 3)

    def test_add_reports_a_functional_check_that_fails_and_exits_1(self):
        def bad(r):
            raise ToolchainError("it did not compile anything", entries=["alpha"], fetchable=False)
        self.entries["alpha"] = dataclasses.replace(self.a, check=bad)
        code, doc = run_json(["toolchain", "add", "alpha"], env=self.env)
        self.assertEqual(code, 1)
        self.assertIn("FAILED: it did not compile anything", doc["data"]["entries"][0]["check"])

    def test_add_names_the_system_libraries_a_browser_check_needs_and_exits_3(self):
        self.entries["alpha"] = dataclasses.replace(self.a, needs_system=lambda p: ("libfoo.so.1",))
        with mock.patch.object(system, "loads", lambda lib: False):
            code, doc = run_json(["toolchain", "add", "alpha"], env=self.env)
        self.assertEqual(code, 3)
        self.assertIn("agora system add", doc["data"]["entries"][0]["check"])
        self.assertEqual(doc["actions"][0]["command"], "system add")

    def test_a_check_that_needs_an_entry_fetches_it_on_first_use_unless_offline(self):
        from agora.core import runner
        from agora.core.registry import Section
        reg = Registry.load(HOME)
        reg.sections["imagery"] = dataclasses.replace(reg.sections["imagery"], toolchain=("alpha",), fn=lambda ctx, scope: self.fail("ran"))
        ctx = Ctx(reg, HOME, HOME, env=dict(self.env), offline=True)
        res = runner.run_check(ctx, ["imagery"], None, None, False, None)
        (s,) = res.data["sections"]
        self.assertEqual((s["status"], res.exit), ("skipped", 3))
        self.assertIn("alpha 1.0", s["reason"])
        self.assertIn("agora toolchain add alpha", s["reason"])

    def test_doctor_reports_each_entry_the_system_libraries_and_every_override(self):
        with mock.patch.object(system, "loads", lambda lib: True):
            code, doc = run_json(["doctor"], env={**self.env, "AGORA_BETA": "/my/beta"})
        d = doc["data"]
        rows = {r["entry"]: r for r in d["toolchain"]}
        self.assertEqual(rows["alpha"]["cache"], "not fetched")
        self.assertIn("agora toolchain add alpha", rows["alpha"]["hint"])
        self.assertEqual(rows["beta"]["cache"], "override")
        self.assertEqual(d["overrides"], [{"entry": "beta", "variable": "AGORA_BETA", "path": "/my/beta", "present": False}])
        self.assertEqual(d["toolchain cache"], str(self.dir / "cache"))
        self.assertEqual(d["system libraries"]["missing"], [])
        self.assertEqual(code, 0)

    def test_doctor_reports_missing_libraries_with_the_setup_command_and_exits_3(self):
        with mock.patch.object(system, "loads", lambda lib: False), mock.patch.object(system, "os_release", lambda *a, **k: UBUNTU_2404):
            code, doc = run_json(["doctor"], env=self.env)
        self.assertEqual((code, doc["data"]["status"]), (0, "ok"))  # these stand-in entries link nothing
        self.entries["alpha"] = dataclasses.replace(self.a, needs_system=lambda p: ("libnss3.so",))
        with mock.patch.object(system, "loads", lambda lib: False), mock.patch.object(system, "os_release", lambda *a, **k: UBUNTU_2404):
            code, doc = run_json(["doctor"], env=self.env)
        self.assertEqual((code, doc["data"]["status"]), (3, "missing"))
        self.assertIn("agora system add", doc["data"]["system libraries"]["hint"])
        self.assertIn("libnss3.so (libnss3)", doc["data"]["system libraries"]["missing"])


class CheckSection(unittest.TestCase):
    """`check toolchain` (0041 FR-068; 0025 FR-016, FR-020, FR-022; 0042 FR-013)."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def workflow(self, text):
        p = self.root / ".github" / "workflows" / "w.yml"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")

    def wf(self):
        from agora.lib import toolchain_rules
        return [f.message for f in toolchain_rules.workflow_findings(self.root)]

    def test_the_real_repository_passes(self):
        code, doc = run_json(["check", "toolchain"])
        self.assertEqual((code, doc["data"]["status"]), (0, "passed"), doc["data"]["sections"][0]["findings"])

    def test_the_section_is_in_the_spec_suite(self):
        self.assertIn("toolchain", Registry.load(HOME).suites["spec"]["sections"])

    def test_a_workflow_that_installs_a_program_is_named(self):
        for line, word in (("run: sudo apt-get install -y texlive-xetex", "sudo"), ("run: apt-get install x", "apt-get"),
                           ("run: npm install playwright", "npm"), ("run: npx playwright install chromium", "npx"),
                           ("run: pip install uv", "pip"), ("run: brew install x", "brew"), ("run: curl -O https://x/y", "curl"),
                           ("- uses: actions/setup-node@v7", "setup-node"), ("container: ubuntu:24.04", "container"),
                           ("image: foo", "image"), ("run: docker run x", "docker")):
            self.workflow(f"jobs:\n  j:\n    steps:\n      - {line}\n")
            found = self.wf()
            self.assertTrue(found and word in found[0], (line, found))
            self.assertIn("0025 FR-022", found[0])

    def test_a_workflow_that_only_runs_the_launcher_passes(self):
        self.workflow("# apt-get install x is a comment\njobs:\n  j:\n    steps:\n"
                      "      - uses: actions/checkout@v7\n      - uses: actions/setup-python@v7\n      - uses: astral-sh/setup-uv@v7\n"
                      "      - uses: actions/cache@v5\n        with:\n          key: k-${{ hashFiles('tools/agora/npm/package-lock.json') }}\n"
                      "      - run: ./agora system add --yes\n      - run: ./agora check --suite browser\n")
        self.assertEqual(self.wf(), [])

    def test_sudo_is_allowed_only_through_the_setup_command(self):
        self.workflow("jobs:\n  j:\n    steps:\n      - run: sudo ./agora system add --yes\n")
        self.assertEqual(self.wf(), [])
        self.workflow("jobs:\n  j:\n    steps:\n      - run: sudo rm -rf x\n")
        self.assertTrue(self.wf())

    def test_code_that_runs_a_host_program_or_looks_one_up_is_named(self):
        from agora.lib import toolchain_rules
        code = self.root / "tools" / "agora" / "lib" / "x.py"
        code.parent.mkdir(parents=True)
        code.write_text('import subprocess, shutil\nsubprocess.run(["git", "status"])\nshutil.which("pdftotext")\nshutil.which("uv")\n'
                        '# the workspaces' + '-host kit supplies it\n', encoding="utf-8")
        found = [f.message for f in toolchain_rules.code_findings(self.root)]
        self.assertEqual(len(found), 3, found)
        self.assertTrue(any("host's git" in m for m in found))
        self.assertTrue(any("pdftotext" in m for m in found))
        self.assertTrue(any("reference environment" in m for m in found))

    def test_code_that_reaches_the_network_or_calls_a_package_manager_is_named_unless_it_is_the_toolchain(self):
        from agora.lib import toolchain_rules
        code = self.root / "tools" / "agora" / "lib" / "y.py"
        code.parent.mkdir(parents=True)
        code.write_text('import urllib.request\nimport subprocess\nsubprocess.run(["apt-get", "install", "x"])\n'
                        'subprocess.run(["pip", "install", "x"])\n', encoding="utf-8")
        allowed = self.root / "tools" / "agora" / "core" / "toolchain.py"
        allowed.parent.mkdir(parents=True)
        allowed.write_text("import urllib.request\n", encoding="utf-8")
        found = [(f.where, f.message) for f in toolchain_rules.code_findings(self.root)]
        self.assertEqual(len(found), 3, found)
        self.assertTrue(all(w.startswith("tools/agora/lib/y.py") for w, _ in found))
        self.assertTrue(any("reaches the network" in m for _, m in found))
        self.assertTrue(any("apt-get" in m for _, m in found) and any("pip" in m for _, m in found))

    def test_entries_the_registry_names_must_exist(self):
        from agora.lib import toolchain_rules
        reg = Registry.load(HOME)
        reg.sections["imagery"] = dataclasses.replace(reg.sections["imagery"], toolchain=("ghost",))
        reg.groups["assurance"].manifest["runners"]["browser"]["toolchain"] = ["ghost2"]
        found = [f.message for f in toolchain_rules.entry_findings(tcore.discover(), reg)]
        self.assertTrue(any("'ghost'" in m for m in found))
        self.assertTrue(any("'ghost2'" in m for m in found))

    def test_an_incomplete_entry_fails_the_section(self):
        from agora.lib import toolchain_rules
        bad = Entry("bad", "latest", "", {"macos-arm64": ()}, lambda p: {}, check=None)
        found = "\n".join(f.message for f in toolchain_rules.entry_findings({"bad": bad}, Registry.load(HOME)))
        for text in ("floating tag", "no summary", "lacks the platform linux-x86_64", "no functional check", "lists no archive"):
            self.assertIn(text, found)

    def test_a_lock_without_integrity_hashes_is_named(self):
        from agora.toolchain import npm_packages
        with tempfile.TemporaryDirectory() as d:
            for name in ("package.json", "package-lock.json"):
                (Path(d) / name).write_text((npm_packages.NPM_DIR / name).read_text())
            lock = json.loads((Path(d) / "package-lock.json").read_text())
            lock["packages"]["node_modules/left-pad"] = {"version": "1.0.0"}
            (Path(d) / "package-lock.json").write_text(json.dumps(lock))
            with mock.patch.object(npm_packages, "NPM_DIR", Path(d)):
                found = npm_packages.lock_problems()
        self.assertTrue(any("left-pad has no version and integrity hash" in m for m in found), found)

    def test_the_npm_lock_pins_exactly_playwright_and_paragon(self):
        from agora.toolchain import npm_packages
        deps = json.loads((npm_packages.NPM_DIR / "package.json").read_text())["dependencies"]
        self.assertEqual(deps, {"@openedx/paragon": npm_packages.PARAGON_VERSION, "playwright": npm_packages.PLAYWRIGHT_VERSION})
        lock = json.loads((npm_packages.NPM_DIR / "package-lock.json").read_text())
        self.assertTrue(lock["packages"])
        self.assertTrue(all(p.get("integrity") for k, p in lock["packages"].items() if k and not p.get("link")))

    def test_the_npm_entry_is_stale_when_the_lock_changes(self):
        from agora.toolchain import npm_packages
        a = npm_packages.ENTRY.archives("linux-x86_64")[0]
        self.assertEqual(a.form, "npm-lock")
        self.assertEqual(a.sha256, hashlib.sha256((npm_packages.NPM_DIR / "package-lock.json").read_bytes()).hexdigest())


if __name__ == "__main__":
    unittest.main()
