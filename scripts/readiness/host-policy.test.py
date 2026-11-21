"""Pure host-policy regression tests: no subprocess, nft, Docker or host access."""
import copy
import importlib.util
import json
import re
from pathlib import Path
import stat
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("host_policy", ROOT / "deploy/persistent/host-policy.py")
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)
BASE = json.loads((ROOT / "deploy/persistent/network-policy.example.json").read_text())


class NetworkPolicy(unittest.TestCase):
    def test_duplicate_json_is_never_accepted_as_configuration_or_inspection(self):
        with self.assertRaises(ValueError):
            policy.document('{"instance":"foreign","instance":"hospital-test"}')

    def test_stock_global_flusher_must_be_permanently_masked(self):
        good = SimpleNamespace(lstat=lambda: SimpleNamespace(st_mode=stat.S_IFLNK | 0o777, st_uid=0), readlink=lambda: "/dev/null")
        policy.stock_firewall_mask(good)
        for mode, uid, target in ((stat.S_IFREG | 0o644, 0, "/dev/null"), (stat.S_IFLNK | 0o777, 1000, "/dev/null"), (stat.S_IFLNK | 0o777, 0, "/unreviewed/unit")):
            bad = SimpleNamespace(lstat=lambda: SimpleNamespace(st_mode=mode, st_uid=uid), readlink=lambda: Path(target))
            with self.assertRaises(ValueError):
                policy.stock_firewall_mask(bad)

    def test_synthetic_config_and_bounded_render(self):
        self.assertEqual(policy.validate(BASE), BASE)
        batch = policy.render(BASE)
        self.assertEqual(batch.count("policy drop;"), 3)
        self.assertNotIn("flush ruleset", batch)
        self.assertNotIn("0.0.0.0/0", batch)
        # The real kernel parser rejected the former reserved identifier time.
        self.assertEqual(len(re.findall(r"^set scop_[a-z]+ \{", batch, re.M)), 5)
        self.assertNotRegex(batch, r"(?m)^set (time|https|dns) \{")
        for text in ('ip daddr @scop_dns tcp dport 53', 'ip daddr @scop_dns udp dport 53', 'ip daddr @scop_time udp dport 123', 'ip daddr @scop_https tcp dport 443', 'ip saddr @scop_admins tcp dport 22', 'meta nfproto ipv6 drop'):
            self.assertIn(text, batch)
        self.assertNotIn('ct state established,related accept\nip saddr @scop_staff', batch)

    def test_incomplete_enabled_or_foreign_inputs(self):
        changes = [{"purpose": "production"}, {"instance": "host-"}, {"instance": "../x"}, {"instance": "x" * 26}, {"instance": "host; accept"}, {"version": True}, {"enabled": True}]
        for change in changes:
            with self.subTest(change=change), self.assertRaises(ValueError):
                policy.validate({**BASE, **change})
        for key in BASE:
            value = dict(BASE); del value[key]
            with self.subTest(missing=key), self.assertRaises(ValueError):
                policy.validate(value)

    def test_cidr_and_address_negatives(self):
        for key in ("adminCidrs", "staffCidrs", "httpsCidrs"):
            for values in ([], ["0.0.0.0/0"], ["192.0.2.1/24"], ["192.0.2.0/23"], ["::/0"], ["10.1.1.0/24"], ["127.0.0.1/32"], ["169.254.169.254/32"], ["100.64.0.0/24"], ["224.1.1.0/24"], ["192.0.2.0/24"] * 2, ["192.0.2.0/24", "192.0.2.1/32"], ["192.0.2.256/32"], ["192.0.2.1/32; accept"], "192.0.2.0/24"):
                with self.subTest(key=key, values=values), self.assertRaises(ValueError):
                    policy.validate({**BASE, key: values})
        for key in ("dnsResolvers", "timeServers"):
            for values in ([], ["192.0.2.1/32"], ["192.0.2.999"], ["192.000.2.1"], ["::1"], ["192.0.2.1; accept"], ["10.0.0.1"], ["192.0.2.1"] * 2):
                with self.subTest(key=key, values=values), self.assertRaises(ValueError):
                    policy.validate({**BASE, key: values})

    def test_transaction_is_single_atomic_owned_replacement(self):
        calls = []
        def run(args, **kw):
            calls.append((args, kw))
            if args[-1] == "tables":
                out = {"nftables": [{"table": {"family": "inet", "name": "wici_scop"}}]}
            elif args[-1] == "wici_scop":
                out = {"nftables": [{"table": {"comment": policy.PURPOSE + ":" + BASE["instance"]}}]}
            else:
                out = {}
            return SimpleNamespace(returncode=0, stdout=json.dumps(out), stderr="")
        policy.apply_policy(BASE, run)
        mutations = [(args, kw) for args, kw in calls if args == ["/usr/sbin/nft", "-f", "-"]]
        self.assertEqual(len(mutations), 1)
        self.assertEqual(calls[-2][0], ["/usr/sbin/nft", "--check", "-f", "-"])
        self.assertEqual(calls[-2][1]["input"], mutations[0][1]["input"])
        self.assertTrue(mutations[0][1]["input"].startswith("delete table inet wici_scop\ntable inet wici_scop"))
        self.assertTrue(all(a[0] == "/usr/sbin/nft" for a, _ in calls))

    def test_failure_at_each_boundary_never_flushes_or_falls_back(self):
        for fail_at in range(4):
            calls = []
            def run(args, **kw):
                calls.append(args)
                if len(calls) - 1 == fail_at:
                    return SimpleNamespace(returncode=1, stdout="", stderr="synthetic failure")
                out = {"nftables": [{"table": {"family": "inet", "name": "wici_scop", "comment": policy.PURPOSE + ":" + BASE["instance"]}}]}
                return SimpleNamespace(returncode=0, stdout=json.dumps(out), stderr="")
            with self.subTest(fail_at=fail_at), self.assertRaises(ValueError):
                policy.apply_policy(BASE, run)
            self.assertEqual(len(calls), fail_at + 1)
            self.assertFalse(any("flush" in a or "iptables" in a[0] for a in calls))

    def test_first_load_has_no_delete_and_check_failure_prevents_apply(self):
        calls = []
        def run(args, **kw):
            calls.append((args, kw))
            return SimpleNamespace(returncode=1 if "--check" in args else 0, stdout='{"nftables":[]}', stderr="")
        with self.assertRaises(ValueError):
            policy.apply_policy(BASE, run)
        self.assertEqual(len(calls), 2)
        self.assertNotIn("delete table", calls[-1][1]["input"])

    def test_foreign_table_and_invalid_settings_have_zero_mutations(self):
        for owner in (None, "foreign", policy.PURPOSE + ":other"):
            calls = []
            def run(args, **kw):
                calls.append(args)
                return SimpleNamespace(returncode=0, stdout=json.dumps({"nftables": [{"table": {"family": "inet", "name": "wici_scop", "comment": owner}}]}), stderr="")
            with self.assertRaises(ValueError):
                policy.apply_policy(BASE, run)
            self.assertFalse(any("-f" in a for a in calls))
        with self.assertRaises(ValueError):
            policy.apply_policy({**BASE, "httpsCidrs": ["0.0.0.0/0"]}, lambda *a, **k: self.fail("must reject before commands"))

    def test_resource_identity_and_private_networks(self):
        for role in ("database", "gateway", "agent", "egress", "data", "ingress", "control", "edge"):
            network = role in ("data", "ingress", "control", "edge")
            labels = {"wici.scop.instance": BASE["instance"], "wici.scop.purpose": policy.PURPOSE, "wici.scop.role": role}
            good = {"Name": "scop-" + BASE["instance"] + "-" + role, "Labels": labels, "Config": {"Labels": labels}, "Internal": role != "edge"}
            policy.owned(good, BASE["instance"], role, network)
            for key in labels:
                bad = copy.deepcopy(good)
                target = bad["Labels"] if network else bad["Config"]["Labels"]
                del target[key]
                with self.subTest(role=role, missing=key), self.assertRaises(ValueError):
                    policy.owned(bad, BASE["instance"], role, network)
                target[key] = "foreign"
                with self.assertRaises(ValueError):
                    policy.owned(bad, BASE["instance"], role, network)
            if network:
                with self.assertRaises(ValueError):
                    policy.owned({**good, "Internal": not good["Internal"]}, BASE["instance"], role, True)

    def test_missing_or_ambiguous_inspection_fail_closed(self):
        for result in (SimpleNamespace(returncode=1, stdout="", stderr="permission denied"), SimpleNamespace(returncode=0, stdout="[]", stderr=""), SimpleNamespace(returncode=0, stdout="not json", stderr="")):
            with self.assertRaises((ValueError, KeyError)):
                policy.ownership(BASE["instance"], False, lambda *a, **k: result)
        missing = SimpleNamespace(returncode=1, stdout="", stderr="No such network")
        policy.ownership(BASE["instance"], False, lambda *a, **k: missing)
        with self.assertRaises(ValueError):
            policy.ownership(BASE["instance"], True, lambda *a, **k: missing)

    def test_bad_owner_file_and_cli_rejected_without_host_reads(self):
        for mode, uid in ((stat.S_IFLNK | 0o600, 0), (stat.S_IFREG | 0o666, 0), (stat.S_IFREG | 0o600, 1000)):
            fake = SimpleNamespace(lstat=lambda: SimpleNamespace(st_mode=mode, st_uid=uid, st_size=10), read_text=lambda **k: self.fail("unsafe file must not be read"))
            with self.assertRaises(ValueError):
                policy.protected_text(fake)
        with self.assertRaises(ValueError):
            policy.main(["deploy"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
