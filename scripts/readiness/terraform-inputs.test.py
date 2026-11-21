"""Evaluate actual input predicates in a provider/resource-free temporary module.

No plan, provider token/API, state backend or infrastructure operation exists.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]


def main(binary):
    original = json.loads((ROOT / "deploy/persistent/terraform/main.tf.json").read_text())
    values = {"staging_hcloud_token": "SYNTHETIC_NO_PROVIDER", "instance": "hospital-test", "admin_cidrs": ["192.0.2.0/28"], "staff_cidrs": ["198.51.100.0/24"], "https_cidrs": ["203.0.113.0/24"], "dns_resolvers": ["192.0.2.53"], "time_servers": ["192.0.2.123"], "admin_ssh_keys": ["12345"]}
    checks = []
    for key, definition in original["variable"].items():
        if "validation" in definition:
            condition = definition["validation"]["condition"][2:-1]
            checks.append(("good_" + key, condition, True))
    negatives = {
        "admin_ssh_keys": [[], [""], ["name-not-approved-id"], ["0"], ["1", "1"]],
        "volume_size_gb": [39, 201, 40.5],
        "instance": ["x", "host-", "../host", "host;accept", "a" * 26],
        "admin_cidrs": [[], ["0.0.0.0/0"], ["192.0.2.1/24"], ["192.0.2.0/23"], ["10.0.0.0/24"], ["::/0"], ["192.0.2.999/32"], ["192.0.2.0/24"] * 2],
        "staff_cidrs": [["127.0.0.1/32"], ["100.64.0.0/24"]],
        "https_cidrs": [["0.0.0.0/0"], ["169.254.169.254/32"], ["224.0.0.0/24"]],
        "dns_resolvers": [[], ["192.0.2.1/32"], ["192.0.2.999"], ["192.000.2.1"], ["192.0.2.1"] * 2, ["10.0.0.1"]],
        "time_servers": [["::1"], ["192.0.2.1;accept"]],
    }
    for key, bad_values in negatives.items():
        condition = original["variable"][key]["validation"]["condition"][2:-1]
        for i, bad in enumerate(bad_values):
            checks.append(("bad_" + key + "_" + str(i), condition.replace("var." + key, json.dumps(bad)), False))
    expression = "jsonencode({" + ",".join(name + "=(" + condition + ")" for name, condition, _ in checks) + "})\n"
    with tempfile.TemporaryDirectory(prefix="scop-terraform-inputs-") as tmp:
        directory = Path(tmp)
        # Copy declarations ONLY: there is no hcloud provider/resource/data block.
        (directory / "variables.tf.json").write_text(json.dumps({"terraform": {"required_version": ">=1.6,<2"}, "variable": original["variable"]}))
        (directory / "synthetic.tfvars.json").write_text(json.dumps(values))
        (directory / "empty.rc").write_text("")
        env = {"PATH": os.environ.get("PATH", ""), "TF_DATA_DIR": str(directory / "data"), "TF_CLI_CONFIG_FILE": str(directory / "empty.rc"), "TF_IN_AUTOMATION": "1"}
        subprocess.run([binary, "-chdir=" + tmp, "init", "-backend=false", "-input=false"], env=env, capture_output=True, check=True, text=True, timeout=30)
        r = subprocess.run([binary, "-chdir=" + tmp, "console", "-state=" + str(directory / "synthetic.tfstate"), "-var-file=" + str(directory / "synthetic.tfvars.json")], input=expression, env=env, capture_output=True, check=True, text=True, timeout=30)
        actual = json.loads(json.loads(r.stdout))
        for name, _, expected in checks:
            if actual.get(name) is not expected:
                raise AssertionError("Terraform predicate mismatch: " + name)
        print(json.dumps({"kind": "provider-free-terraform-inputs", "passed": len(checks), "failed": 0, "providerConnected": False, "planExecuted": False}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--terraform", required=True)
    main(parser.parse_args().terraform)
