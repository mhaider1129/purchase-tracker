# Phase3C-01 — external staging preparation

Starting master: `e0b72af812cfa430e43f373e9f1a8db3e62a2cd6`. Phase3B documents 12–16 and `deploy/persistent/` remain authoritative. This phase inventories and tests those definitions; it neither replaces the pull-agent architecture nor authorizes provisioning, service startup, SQL, settings changes or external activation.

## Scope and machine-readable evidence

The offline auditor is `scripts/readiness/preflight.cjs`. Its only input configuration is the strictly synthetic schema exemplified by `scripts/readiness/preflight.synthetic.json`: disabled flags, documentation-only CIDRs/resolvers, `.invalid` hostname/registry, a synthetic digest and a synthetic database name. It accepts no token, database URL, owner password, cloud identifier or approval evidence. It never connects to a provider API, Docker daemon, host, Supabase or database. There is no apply, deploy, migrate, approve or enable command.

Run these preparation commands from the combined repository after its existing backend dependencies are installed:

```bash
node --test scripts/readiness/preflight.test.cjs
node scripts/readiness/preflight.cjs report --compose
node scripts/readiness/preflight.cjs check --compose
```

`report` writes `quality-results/persistent/preflight/readiness.json` and prints the same JSON. Exit0 means **report generation and any requested offline tool rendering completed**, not that infrastructure controls passed. Failed rendering exits1 after retaining the assessment when possible. Every report says `EXTERNAL_ACTIVATION_BLOCKED`, `activation_allowed:false`, `provisioning_allowed:false`, and `production_allowed:false`. `check` is the strict assessment: exit1 for any FAIL; otherwise exit2 while blocked/external prerequisites remain. This phase never returns activation success. Invalid/incomplete synthetic input, unreadable/malformed source, missing hard stops or unsupported commands exit1, including report generation. Do not put this report in a release-approval or database-attestation field.

Each control records its ID, description, source evidence and SHA-256, result, severity, remediation, owner and activation dependencies. The report also binds the actual Git commit, dirty-state flag, complete source inventory/hash, synthetic configuration hash and any Compose projection evidence. A dirty local report is review evidence only. CI uploads the clean-commit report as `phase3c-offline-readiness-attempt-<attempt>` from the existing Release quality integrity job; its summary explicitly reports blocked activation. Authenticate the run, source SHA and artifact ZIP digest before relying on its identity. The report itself does not mint an attestation or certify external conditions.

Result meanings:

| Result | Meaning |
| --- | --- |
| PASS | The narrowly described static property or offline projection was observed; it is not external acceptance |
| FAIL | A source/configuration check identified a gap; remediation must be reviewed before activation |
| BLOCKED | Required design, manual preparation, authority or evidence is missing |
| EXTERNAL_VALIDATION_REQUIRED | The property cannot be established without separately authorized dedicated-host evidence |

Severity describes the control's security/availability importance. A PASS on a critical static control does not mean all related external risks are resolved. The six current source failures and four blocked preparation areas are detailed in [the gap assessment](18-phase3c-infrastructure-assessment.md). They remain visible rather than being waived to produce a green readiness report.

## Safe offline Compose and Terraform validation

The Compose wrapper points explicitly at `unix:///nonexistent-scop-preflight.sock`, clears inherited Docker/Compose/proxy/credential variables, uses a temporary empty CLI env file and isolated Docker configuration, and invokes only `compose version` and `compose config`. It creates no images, containers, networks, mounts or volumes and never loads real `/etc` files.

A default-profile configuration renders zero services. The wrapper tests all16 combinations of the four explicit profiles. Compose still checks the database owner-env file's existence with `--no-env-resolution`; therefore a temporary semantic copy replaces **only** `services.database.env_file` with an empty temporary fixture. A regression test compares the entire copied document against the original with just that substitution. Base paths, mounts, labels, networks, ports, commands, profiles and image references are not rewritten. The original Compose SHA and allowed substitution are recorded; normalized projection hashes omit the random temporary env-file path. This proves profile/schema projection, not actual secret loading or runtime connectivity.

Terraform's checked-in provider lock is `hetznercloud/hcloud`1.50.1 under `~>1.50.0`; the module declares Terraform>=1.6,<2. Offline schema validation uses checksum-pinned Terraform1.10.5, `init -backend=false -input=false -lockfile=readonly`, then `validate`. Provider-plugin distribution downloads are tool installation, not access to the Hetzner resource API. Do not run plan, apply, import, refresh, state operations or provider data queries in this phase. No provider token is supplied. Schema validation cannot establish SKU availability, account isolation, firewall enforcement or live provider compatibility.

Do not execute `firewall.sh`, `verify-storage.sh`, cloud-init or systemd units on a workstation/CI host. Only shell syntax and static inspection are authorized here. Do not start Compose profiles. The auditor resides outside the privileged controller build context and is not a runtime authorization gate.

## Staging-only bill of materials

This inventory is a request for later review, not a purchase/provisioning instruction. No production resource identifier, credential, account or route is needed.

| Item | Quantity / proposed requirement | Approval/evidence owner |
| --- | --- | --- |
| Independent staging cloud project | 1 dedicated project; separate staging-only token; no shared private-network attachment | Hospital owner + security |
| Staging VPS | 1 Ubuntu24.04 host, initial4vCPU/8GB planning target; actual SKU/region/quote unverified | Platform engineer |
| Persistent volume | 1 dedicated40–80GB synthetic-data volume; exact device/UUID mount, encrypted backups and restore target | Storage operator |
| Provider firewall | Restricted administrator SSH and hospital/VPN HTTPS sources; reviewed egress; IPv6 off until equivalent policy exists | Network engineer |
| Host firewall | Reviewed atomic installation, safe startup ordering, approved DNS/time/patch paths, Docker restart and reboot persistence | Network engineer |
| Docker/Compose | Reviewed distribution/version and canonical config-ID image store; not an unverified containerd-store substitution | Platform engineer |
| Base images | PostgreSQL16, Caddy and Squid at the exact source digests; provenance/scan and preload strategy required | Security + platform |
| Controller image | Separately built/reviewed digest; source/ownership record; Docker socket is root-equivalent on this dedicated host | Security reviewer |
| DNS/TLS/access | Staging-only hostname, server TLS trust, separate client-auth CA, individual staff certificates and probe certificate | Hospital IT |
| GitHub identity | Combined-repository-only App: Actions read, Contents read, Deployments write, Metadata read; root-protected private key on staging | Repository owner |
| Protected approvals | Master checks; independent staging environment reviewer; separate UAT acceptance; no author self-approval | Repository + hospital owners |
| Synthetic database | Canonical schema, restricted runtime role, legitimate migration receipts and selected-SHA attestation; separately reviewed initialization | Database owner |
| Host configuration | Reviewed config, instance, mount UUID, DNS resolvers, controller digest and purpose/approval markers | Platform + security |
| Secret material | Distinct staging owner/application passwords, JWT key, App key and TLS/probe keys; rotation and file permissions | Named secret custodians |
| Operations | Staging-only logs, disk/DB/queue/clock/TLS/backup monitoring, retention, on-call and restore procedure | Platform operator |
| UAT users/data | Authorized hospital testers and two synthetic institutes; no patient, supplier-bank or production datasets | Functional leads |

Planning allowances remain those in document12, not current provider quotes. No resource is purchased, imported or activated by this phase.

## Approval sequence and operator roles

1. **Repository reviewer:** approve this preparation code and its exact source inventory. Verify tests, all105 locked artifacts, SQL073 manual-only classification and every existing hard stop. Green code tests do not waive failed infrastructure controls.
2. **Platform/network/storage owners:** prepare separately reviewed corrections for the FAIL controls. Prove no root-filesystem fallback, no unfiltered startup/reconfiguration window, defined DNS/time/image/patch access and complete ownership/input validation. Keep deployment flags false while reviewing changes.
3. **Hospital owner + security:** approve the staging-only bill, provider/project boundaries, allowed operator/staff networks, privilege model, certificate/secrets policies and an explicit external validation scope. Only a later authorized task may contact the provider API or provision resources.
4. **Database owner:** approve a synthetic-only initialization and real release-evidence process. Preserve all historical SQL/locked checksums; never treat missing receipts as proof of non-execution. This phase executes no SQL and creates no receipts or attestations.
5. **Platform operator under separate authorization:** install reviewed artifacts in the dedicated environment following document13 only after its ordering/mount/firewall gaps are corrected. Do not use the current templates as an already accepted activation recipe.
6. **Independent validators:** collect the external evidence below, resolve every FAIL/BLOCKED/EXTERNAL item, and retain an immutable review record. Any failure leaves activation blocked.
7. **Repository/hospital owners:** separately review activation source changes, App/environment settings and real host readiness. This phase changes none of those settings or switches. Production and synchronization publishing remain separately disabled.

Routine development remains in the combined repository. The owner is not asked to synchronize standalone repositories or run routine Git/SSH commands. One-time external installation and exceptional recovery belong to separately authorized operators; they are not hidden inside the offline auditor.

## External evidence requirements — not passed here

Every evidence record needs control ID, tested source/controller/image SHA, inventory/report digest, dedicated staging identity, operator and independent reviewer, UTC timestamp, tool versions, expected/actual result, sanitized logs, remediation and retest reference. Never attach secret values, tokens, patient information or production data. Hash/sign the retained evidence through the approved governance process; this report has no command to manufacture acceptance.

- **EXT-PROVIDER:** separate project/account/token ownership; approved SKU/region/cost; no inherited/shared private routing; actual provider schema and lifecycle review. Do not import production state.
- **EXT-NETWORK:** authorized and unauthorized SSH/HTTPS clients; return traffic/conntrack; provider/host/Docker rules; private/public denied destinations using approved nonproduction canaries; proxy CONNECT policy and credential stripping; Docker DNS and approved resolver TCP/UDP behavior; IPv6 denial; reboot/reload persistence. No test connection to production endpoints is authorized by this checklist.
- **EXT-STORAGE:** exact dedicated mount/device/UUID and non-root proof; absent/wrong mount failures; file ownership; full disk/write/fsync failure; cold power loss; backup encryption and restore in another isolated target. `prevent_destroy`, PG_VERSION and modeled writes are insufficient evidence.
- **EXT-BOOT:** first boot with restricted package transport, image preload, firewall-before-connectivity, DB/proxy/gateway readiness before the agent, missing secret/volume and failed service handling; Docker restart and reboot ordering. Retain management-console recovery access.
- **EXT-IMAGES:** actual source/digest/SBOM/scan records, canonical Docker image-store inspection, exact preloaded controller/base/runtime image IDs, failed/missing image behavior. The synthetic digest is not an image approval.
- **EXT-RECOVERY:** actual host boot-ID bind and local-daemon identity; durable state across reboot; delayed unknown effects; no overlapping workers; previous-release preservation; strict reviewed recovery and status retry. Node process kills and modeled boot UUIDs do not establish real host quiescence. Follow document14's assumptions and operator-only restart policy.
- **EXT-DB:** isolated synthetic schema/runtime role, RLS/grants, actual read-only compatibility check, legitimate receipts and correct release attestation. No owner account in the app; no hosted database URLs accepted by runtime configuration.
- **EXT-ACCESS:** actual HTTPS/SNI/server trust/mTLS, individual/probe credential rotation, login/JWT and institute/role isolation, browser/UAT workflows in document15. Report generation and a local marker are not acceptance.
- **EXT-MONITORING:** tested disk/backup/queue/TLS/time/host alerts and assigned response owners; redacted staging-only log retention and recovery drills.

Final preparation disposition can be **READY FOR INDEPENDENT REVIEW — PHASE3C PREPARATION ONLY** while the report correctly remains blocked. It cannot authorize infrastructure or application activation. All failed source controls must be corrected and independently reviewed in subsequent authorized work before activation.

## CI scope under the no-migration boundary

This assignment permits offline tests and forbids migration execution. The existing gateway workflow runs disposable SQL fixtures, so its push/PR filters now ignore a diff containing only `docs/**`, `scripts/readiness/**`, `.github/workflows/release-quality.yml` and `.github/workflows/persistent-local-validation.yml`. The last two entries cover offline/control-workflow wiring, including this initial filter correction. No `[skip ci]` directive or branch-name bypass is used; Release quality still runs all backend/frontend, security and Linux/Windows integrity tests.

Backend/frontend, runtime, infrastructure, staging, deployment and governance inputs remain outside the ignore list. Their changes still select the existing full rehearsal, whose test body and permissions are unchanged. Manual dispatch remains available only under separate authorization. Release selection still demands a successful same-commit master-push gateway report: an offline/control-only commit cannot be deployed using stale or skipped evidence. Future workflow-only changes therefore also need separately authorized runtime rehearsal before they can be deployment candidates; do not weaken the selector to accept missing or dispatch-only evidence. A future authorized activation/runtime change will touch runtime inputs and trigger the required rehearsal. No generated report, skipped workflow or green offline test is that artifact.

Existing master-only PG16/17 and transaction rehearsal workflows are unchanged. A later owner-approved merge may trigger those existing master workflows; that is outside this unmerged preparation task and must be considered in the owner's merge authorization. No such workflow is dispatched here.

### Offline parser compatibility

The GitHub Ubuntu26 runner image `ubuntu26/20261116.202` ships Compose5.1.3. The initial v2-only preflight correctly failed rather than silently skipping rendering. The auditor now supports the existing v2 CLI family (actual local check2.40.3) and the explicitly tested5.1.3 parser. All other majors/unknown5.x versions remain rejected pending review. Actual offline profile checks are required even for an accepted version; a rendering failure makes report generation exit1. This changes neither the host's `docker-compose-v2` package target nor Docker image-store/config-ID security. Offline parsing on either version does not establish real host/runtime compatibility.
