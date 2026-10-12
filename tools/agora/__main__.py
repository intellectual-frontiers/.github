import os
import sys

from agora.core.cli import main

try:
    code = main()
    sys.stdout.flush()
except BrokenPipeError:  # `agora ... | head`: the reader left; not an error
    os.dup2(os.open(os.devnull, os.O_WRONLY), sys.stdout.fileno())
    code = 0
sys.exit(code)
