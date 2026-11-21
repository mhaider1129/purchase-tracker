#!/bin/sh
set -eu
test -f /etc/scop-staging/ACTIVATION_APPROVED
test "$(cat /etc/scop-staging/host-purpose)" = wici-isolated-staging-v1
mount=/var/lib/scop-staging
test ! -L "$mount" || exit 1
target=$(findmnt --noheadings --raw --output TARGET --mountpoint "$mount") || exit 1
test "$target" = "$mount" || exit 1
device=$(findmnt --noheadings --raw --output MAJ:MIN --mountpoint "$mount") || exit 1
root_device=$(findmnt --noheadings --raw --output MAJ:MIN --mountpoint /) || exit 1
for identity in "$device" "$root_device"; do
  case "$identity" in ''|*[!0-9:]*|:*|*:|*:*:*) exit 1;; esac
  case "$identity" in *:*) ;; *) exit 1;; esac
done
test "$device" != "$root_device" || exit 1
expected_uuid=$(cat /etc/scop-staging/volume-uuid) || exit 1
test "${#expected_uuid}" -eq 36 || exit 1
printf '%s\n' "$expected_uuid" | LC_ALL=C grep -Eq '^[[:xdigit:]]{8}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{12}$' || exit 1
actual_uuid=$(findmnt --noheadings --raw --output UUID --mountpoint "$mount") || exit 1
test "$actual_uuid" = "$expected_uuid" || exit 1
test ! -L "$mount/postgres" || exit 1
test ! -L "$mount/postgres/PG_VERSION" || exit 1
data_target=$(findmnt --noheadings --raw --output TARGET --target "$mount/postgres") || exit 1
test "$data_target" = "$mount" || exit 1
test -s /var/lib/scop-staging/postgres/PG_VERSION
