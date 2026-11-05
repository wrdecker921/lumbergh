"""Tests for Tailscale detection."""

import json
import subprocess
from unittest.mock import patch

from lumbergh.tailscale import detect_tailscale


def _status_result(payload: dict) -> subprocess.CompletedProcess:
    return subprocess.CompletedProcess(
        args=["tailscale", "status", "--json"],
        returncode=0,
        stdout=json.dumps(payload),
        stderr="",
    )


def test_detects_ipv4_and_hostname():
    payload = {
        "Self": {
            "TailscaleIPs": ["fd7a::1", "100.64.0.1"],
            "DNSName": "box.tail1234.ts.net.",
        }
    }
    with patch("lumbergh.tailscale.subprocess.run", return_value=_status_result(payload)):
        assert detect_tailscale() == {
            "ip": "100.64.0.1",
            "hostname": "box.tail1234.ts.net",
        }


def test_null_tailscale_ips_means_not_detected():
    # `tailscale status --json` reports Self.TailscaleIPs as null while the
    # daemon is stopped or logging in (the state right after a WSL restart).
    # That must read as "no Tailscale", not crash server startup.
    payload = {"Self": {"TailscaleIPs": None, "DNSName": ""}}
    with patch("lumbergh.tailscale.subprocess.run", return_value=_status_result(payload)):
        assert detect_tailscale() is None
