"""Reading the standard library test runner's report (0041-command-line FR-034)."""
from __future__ import annotations

import re
from typing import Any


def summarize(returncode: int, stderr: str) -> dict[str, Any]:
    """What ran and what did not pass. A run that ran no test does not pass."""
    m = re.search(r"Ran (\d+) tests?", stderr)
    ran = int(m.group(1)) if m else 0
    counts = {k: int(v) for k, v in re.findall(r"(failures|errors|skipped)=(\d+)", stderr)}
    failed = returncode != 0 or ran == 0
    data: dict[str, Any] = {
        "status": "failed" if failed else "passed", "ran": ran, "failures": counts.get("failures", 0),
        "errors": counts.get("errors", 0), "skipped": counts.get("skipped", 0),
        "passed": max(ran - counts.get("failures", 0) - counts.get("errors", 0) - counts.get("skipped", 0), 0),
        "failing": re.findall(r"^(?:FAIL|ERROR): (.+)$", stderr, re.M),
        "tail": stderr.strip().splitlines()[-25:] if failed else [],
    }
    if ran == 0:
        data["message"] = "no test ran; a test run that ran nothing does not pass (0041 FR-034)"
    return data
