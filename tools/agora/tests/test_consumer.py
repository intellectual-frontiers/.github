"""What a repository that builds on this one reads: each toolchain entry's path, env, programs, version and state, and the
pinned packages and node version (0025-tooling-environment FR-027, FR-028)."""
import tempfile
import unittest

from .helpers import run_json


class ConsumerShape(unittest.TestCase):
    def test_list_exposes_the_pinned_packages_and_the_node_version(self):
        code, doc = run_json(["toolchain", "list"])
        d = doc["data"]
        self.assertEqual(code, 0)
        self.assertIn("nodejs-wheel-binaries", d["packages"])
        self.assertEqual(d["node"], d["packages"]["nodejs-wheel-binaries"])
        for row in d["entries"]:
            self.assertTrue({"version", "state", "path", "env", "provides"} <= set(row))

    def test_show_gives_path_env_provides_version_and_state_for_an_entry_in_the_cache(self):
        _, doc = run_json(["toolchain", "show", "chromium"])
        d = doc["data"]
        if d["state"] != "ready":
            self.skipTest("chromium is not in this host's cache")
        self.assertTrue(d["path"])
        self.assertTrue(all(isinstance(v, str) for v in d["env"].values()))
        self.assertTrue(all(p.startswith(d["path"]) for p in d["provides"].values()))

    def test_an_entry_not_in_the_cache_has_no_path_and_says_so(self):
        with tempfile.TemporaryDirectory() as cache:
            _, doc = run_json(["toolchain", "show", "chromium"], env={"AGORA_TOOLCHAIN_CACHE": cache})
        d = doc["data"]
        self.assertEqual((d["state"], d["path"], d["env"], d["provides"]), ("missing", None, {}, {}))

    def test_add_returns_the_same_fields_for_each_entry(self):
        _, doc = run_json(["toolchain", "ensure", "chromium", "--dry-run"])
        row = doc["data"]["entries"][0]
        self.assertTrue({"path", "env", "provides"} <= set(row))


if __name__ == "__main__":
    unittest.main()
