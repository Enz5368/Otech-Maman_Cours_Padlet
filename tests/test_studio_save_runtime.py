"""Execute the actual JavaScript save functions, including their async paths."""

import shutil
import subprocess
from pathlib import Path

import pytest


def test_studio_save_runtime() -> None:
    node = shutil.which("node")
    if node is None:
        pytest.skip("Node.js is required for the studio runtime tests")
    result = subprocess.run(
        [node, "--test", str(Path(__file__).with_name("studio_save_runtime.cjs"))],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
        encoding="utf-8",
    )
    assert result.returncode == 0, result.stdout + result.stderr
