import os
import sys

# The launcher leaves a marker before it hands over to ws-host; agora started, so it removes it (see the launcher).
_marker = os.environ.pop("AGORA_STARTED_MARKER", "")
if _marker:
    try:
        os.unlink(_marker)
    except OSError:
        pass

from agora.core.cli import main

try:
    code = main()
    sys.stdout.flush()
except BrokenPipeError:  # `agora ... | head`: the reader left; not an error
    os.dup2(os.open(os.devnull, os.O_WRONLY), sys.stdout.fileno())
    code = 0
sys.exit(code)
