"""CI-only syntax check in an empty network namespace; NEVER installs rules."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess

if __name__ == "__main__":
    if not (os.environ.get("GITHUB_ACTIONS") == "true" and os.environ.get("RUNNER_ENVIRONMENT") == "github-hosted" and os.geteuid() == 0 and os.readlink("/proc/self/ns/net") != os.readlink("/proc/1/ns/net")):
        raise SystemExit("ISOLATED_HOSTED_CI_NAMESPACE_REQUIRED")
    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location("hp", root / "deploy/persistent/host-policy.py")
    hp = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(hp)
    fixture = json.loads((root / "deploy/persistent/network-policy.example.json").read_text())
    batch = hp.render(fixture)
    # This helper deliberately has no apply branch; --check does not install.
    subprocess.run(["/usr/sbin/nft", "--check", "-f", "-"], input=batch, text=True, check=True, timeout=30)
    version = subprocess.check_output(["/usr/sbin/nft", "--version"], text=True).strip()
    print(json.dumps({"kind": "synthetic-nft-syntax", "status": "PASSED_NOT_EXTERNAL_NETWORK_ACCEPTANCE", "version": version, "batchSha256": hashlib.sha256(batch.encode()).hexdigest(), "emptyNamespace": True, "rulesInstalled": False}))
