"""Dedicated staging only. Pure validation/rendering is safe to test offline.

The CLI is privileged and must NOT run during development/CI. It never creates
storage, starts containers, removes resources, runs SQL or changes global rules.
"""
import ipaddress
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

PURPOSE = "wici-isolated-staging-v1"
TABLE = "wici_scop"
INSTANCE = re.compile(r"[a-z][a-z0-9-]{1,23}[a-z0-9]\Z")
DENIED = tuple(ipaddress.ip_network(v) for v in (
    "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8",
    "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.88.99.0/24", "192.168.0.0/16",
    "198.18.0.0/15", "224.0.0.0/4", "240.0.0.0/4"))


def require(ok, code):
    if not ok:
        raise ValueError(code)


def document(value):
    def unique(pairs):
        result = {}
        for key, item in pairs:
            require(key not in result, "DUPLICATE_CONFIGURATION_KEY")
            result[key] = item
        return result
    return json.loads(value, object_pairs_hook=unique)


def addresses(values, cidr=False):
    require(isinstance(values, list) and 0 < len(values) <= (16 if cidr else 4), "BOUNDED_ADDRESSES_REQUIRED")
    require(all(isinstance(v, str) for v in values) and len(set(values)) == len(values), "UNIQUE_ADDRESSES_REQUIRED")
    result = []
    networks = []
    for value in values:
        net = ipaddress.ip_network(value, strict=True) if cidr else ipaddress.ip_network(str(ipaddress.IPv4Address(value)) + "/32")
        require(net.version == 4 and 24 <= net.prefixlen <= 32 and (str(net) == value if cidr else str(net.network_address) == value), "CANONICAL_RESTRICTED_IPV4_REQUIRED")
        require(not any(net.overlaps(bad) for bad in DENIED), "PRIVATE_OR_SPECIAL_DESTINATION_FORBIDDEN")
        require(not any(net.overlaps(previous) for previous in networks), "OVERLAPPING_ADDRESSES_FORBIDDEN")
        networks.append(net)
        result.append(str(net) if cidr else str(net.network_address))
    return result


def validate(value):
    require(isinstance(value, dict) and set(value) == {"version", "purpose", "instance", "adminCidrs", "staffCidrs", "dnsResolvers", "timeServers", "httpsCidrs"}, "EXACT_NETWORK_POLICY_REQUIRED")
    require(value["version"] == 1 and type(value["version"]) is int and value["purpose"] == PURPOSE and isinstance(value["instance"], str) and INSTANCE.fullmatch(value["instance"]), "STAGING_IDENTITY_REQUIRED")
    for key in ("adminCidrs", "staffCidrs", "httpsCidrs"):
        addresses(value[key], True)
    for key in ("dnsResolvers", "timeServers"):
        addresses(value[key])
    return value


def render(value, replace=False):
    p = validate(value)
    sets = []
    for name, key, cidr in (("admins", "adminCidrs", True), ("staff", "staffCidrs", True), ("dns", "dnsResolvers", False), ("time", "timeServers", False), ("https", "httpsCidrs", True)):
        sets.append("set %s { type ipv4_addr; flags interval; elements = { %s }; }" % (name, ", ".join(addresses(p[key], cidr))))
    return ("delete table inet wici_scop\n" if replace else "") + """table inet wici_scop {
comment "%s:%s"
%s
chain input {
type filter hook input priority -10; policy drop;
iifname "lo" accept
meta nfproto ipv6 drop
ct state invalid drop
ct state established,related accept
ip saddr @admins tcp dport 22 accept
}
chain output {
type filter hook output priority -10; policy drop;
oifname "lo" accept
meta nfproto ipv6 drop
ct state invalid drop
ip daddr @admins tcp sport 22 ct state established accept
ip daddr @dns udp dport 53 accept
ip daddr @dns tcp dport 53 accept
ip daddr @time udp dport 123 accept
ip daddr 172.30.60.20 tcp dport 3128 accept
ip protocol icmp ct state related accept
}
chain forward {
type filter hook forward priority -10; policy drop;
meta nfproto ipv6 drop
ct state invalid drop
ip saddr @staff ip daddr 172.30.60.10 tcp dport 443 accept
ip saddr 172.30.60.10 ip daddr @staff tcp sport 443 ct state established,related accept
ip saddr 172.30.60.20 ip daddr @https tcp dport 443 accept
ip saddr @https ip daddr 172.30.60.20 tcp sport 443 ct state established,related accept
ip saddr 172.30.60.20 ip daddr @dns udp dport 53 accept
ip saddr 172.30.60.20 ip daddr @dns tcp dport 53 accept
ip saddr @dns ip daddr 172.30.60.20 udp sport 53 ct state established,related accept
ip saddr @dns ip daddr 172.30.60.20 tcp sport 53 ct state established,related accept
# Docker's later filter/isolation chains still decide bridge-to-bridge traffic.
iifname "br-*" oifname "br-*" accept
}
}
""" % (PURPOSE, p["instance"], "\n".join(sets))


def command(args, runner=subprocess.run, **options):
    r = runner(args, capture_output=True, text=True, timeout=30, env={"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}, **options)
    require(r.returncode == 0, "HOST_COMMAND_FAILED")
    return r.stdout


def apply_policy(value, runner=subprocess.run):
    """Caller holds flock. nft -f is one atomic kernel transaction.

    No flush-ruleset, live chain edits, permissive fallback or automatic undo.
    A rejected replacement retains the previous table; a rejected first load
    prevents the required firewall unit and thus Docker/socket from starting.
    """
    validate(value)
    rows = document(command(["/usr/sbin/nft", "-j", "list", "tables"], runner))["nftables"]
    exists = any(r.get("table", {}).get("name") == TABLE and r["table"].get("family") == "inet" for r in rows)
    if exists:
        detail = document(command(["/usr/sbin/nft", "-j", "list", "table", "inet", TABLE], runner))["nftables"]
        tables = [r["table"] for r in detail if "table" in r]
        require(len(tables) == 1 and tables[0].get("comment") == PURPOSE + ":" + value["instance"], "FOREIGN_FIREWALL_REFUSED")
    batch = render(value, exists)
    command(["/usr/sbin/nft", "--check", "-f", "-"], runner, input=batch)
    command(["/usr/sbin/nft", "-f", "-"], runner, input=batch)


def owned(info, instance, role, network=False):
    name = "scop-" + instance + "-" + role
    require(info.get("Name", "").lstrip("/") == name, "RESOURCE_NAME_MISMATCH")
    labels = info.get("Labels", {}) if network else info.get("Config", {}).get("Labels", {})
    require(isinstance(labels, dict), "RESOURCE_LABELS_REQUIRED")
    require(all(labels.get(k) == v for k, v in {"wici.scop.instance": instance, "wici.scop.purpose": PURPOSE, "wici.scop.role": role}.items()), "FOREIGN_INFRASTRUCTURE_REFUSED")
    if network:
        require(info.get("Internal") is (role != "edge"), "NETWORK_ISOLATION_MISMATCH")
    return info


def ownership(instance, required, runner=subprocess.run):
    require(isinstance(instance, str) and INSTANCE.fullmatch(instance), "INVALID_INSTANCE")
    for network, roles in ((True, ("data", "ingress", "control", "edge")), (False, ("database", "gateway", "egress", "agent"))):
        for role in roles:
            name = "scop-" + instance + "-" + role
            args = ["/usr/bin/docker", "--host=unix:///var/run/docker.sock"] + (["network", "inspect"] if network else ["inspect"]) + [name]
            r = runner(args, capture_output=True, text=True, timeout=30, env={"PATH": "/usr/bin:/bin", "LC_ALL": "C"})
            if r.returncode:
                missing = r.returncode == 1 and re.search(r"No such (?:object|container|network)|network .* not found", r.stderr, re.I)
                require(missing and (not required or (not network and role == "agent")), "INFRASTRUCTURE_INSPECTION_FAILED")
                continue
            rows = document(r.stdout)
            require(isinstance(rows, list) and len(rows) == 1, "AMBIGUOUS_INFRASTRUCTURE")
            owned(rows[0], instance, role, network)


def protected_text(file):
    s = file.lstat()
    require(stat.S_ISREG(s.st_mode) and s.st_uid == 0 and not s.st_mode & 0o022 and s.st_size <= 65536, "UNSAFE_HOST_CONFIGURATION")
    return file.read_text(encoding="utf-8", errors="strict")


def main(args):
    require(args in (["firewall"], ["ownership", "existing"], ["ownership", "required"]), "UNSUPPORTED_HOST_OPERATION")
    base = Path("/etc/scop-staging")
    s = base.lstat()
    require(stat.S_ISDIR(s.st_mode) and s.st_uid == 0 and not s.st_mode & 0o022, "UNSAFE_HOST_CONFIGURATION_DIRECTORY")
    protected_text(base / "ACTIVATION_APPROVED")
    require(protected_text(base / "host-purpose").strip() == PURPOSE, "STAGING_PURPOSE_REQUIRED")
    policy = validate(document(protected_text(base / "network-policy.json")))
    config = document(protected_text(base / "config.json"))
    require(config.get("purpose") == PURPOSE and config.get("instance") == policy["instance"], "HOST_INSTANCE_MISMATCH")
    if args == ["firewall"]:
        import fcntl  # Linux host only; pure functions remain portable in tests.
        with open("/run/scop-staging-firewall.lock", "a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            apply_policy(policy)
    else:
        require(os.environ.get("SCOP_INSTANCE") == policy["instance"], "COMPOSE_INSTANCE_MISMATCH")
        require(re.fullmatch(r"[^\s@]+@sha256:[a-f0-9]{64}", os.environ.get("SCOP_AGENT_IMAGE", "")), "PINNED_AGENT_IMAGE_REQUIRED")
        ownership(policy["instance"], args[1] == "required")


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except Exception:
        # Never emit command stderr, host configuration or secrets.
        print("STAGING_HOST_PREFLIGHT_BLOCKED", file=sys.stderr)
        sys.exit(1)
