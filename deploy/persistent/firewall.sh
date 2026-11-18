#!/bin/sh
# STAGING HOST ONLY. Not invoked by CI. Install after separate authorization.
set -eu
test -f /etc/scop-staging/ACTIVATION_APPROVED
test "$(cat /etc/scop-staging/host-purpose)" = wici-isolated-staging-v1
# Docker bridge filtering complements the provider ingress firewall. HTTPS
# gateway cannot initiate outbound connections; only the strict CONNECT proxy
# may reach public TLS services. All business networks are Docker internal.
iptables -N WICI_SCOP_EDGE 2>/dev/null || true
iptables -F WICI_SCOP_EDGE
iptables -A WICI_SCOP_EDGE -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
for network in 10.0.0.0/8 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.168.0.0/16; do
  iptables -A WICI_SCOP_EDGE -d "$network" -j REJECT
done
iptables -A WICI_SCOP_EDGE -s 172.30.60.20 -p tcp --dport 443 -j RETURN
iptables -A WICI_SCOP_EDGE -j REJECT
iptables -C DOCKER-USER -s 172.30.60.0/24 -j WICI_SCOP_EDGE 2>/dev/null || iptables -I DOCKER-USER 1 -s 172.30.60.0/24 -j WICI_SCOP_EDGE
# Dedicated host itself also has no direct outbound web/database/SAP route.
# Resolve through explicitly approved recursive DNS; HTTPS uses the proxy only.
test -s /etc/scop-staging/dns-resolvers
iptables -N WICI_SCOP_HOST 2>/dev/null || true
iptables -F WICI_SCOP_HOST
iptables -A WICI_SCOP_HOST -o lo -j RETURN
iptables -A WICI_SCOP_HOST -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
while IFS= read -r resolver; do
  case "$resolver" in ''|*[!0-9.]*) exit 1;; esac
  iptables -A WICI_SCOP_HOST -d "$resolver" -p udp --dport 53 -j RETURN
done < /etc/scop-staging/dns-resolvers
iptables -A WICI_SCOP_HOST -d 172.30.60.20 -p tcp --dport 3128 -j RETURN
iptables -A WICI_SCOP_HOST -j REJECT
iptables -C OUTPUT -j WICI_SCOP_HOST 2>/dev/null || iptables -I OUTPUT 1 -j WICI_SCOP_HOST
ip6tables -P OUTPUT DROP
ip6tables -P FORWARD DROP
