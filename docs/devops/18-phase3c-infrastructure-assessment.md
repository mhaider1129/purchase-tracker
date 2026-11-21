# Phase3C-01 — infrastructure inventory and gaps

Authoritative baseline: master `e0b72af812cfa430e43f373e9f1a8db3e62a2cd6`, containing the reviewed Phase3B recovery correction. No competing deployment design is introduced. Source inspection is evidence of template intent; it is not proof of external behavior.

## Existing source inventory and ownership

The machine report inventories the following files individually with byte counts and SHA-256. Its inventory hash and actual source commit identify the evaluated snapshot; CI artifacts are generated after checkout, not hand-edited as release evidence.

| Sources | Existing control/owner and relevant boundary |
| --- | --- |
| `deploy/persistent/terraform/main.tf.json`, `.terraform.lock.hcl` | Platform: one staging server/firewall/volume/attachment, sensitive provider token variable, false provisioning guard, pinned provider, prevent_destroy, explicit manual mount |
| `cloud-init.yaml` | Platform: OS packages, purpose/pending markers, password/root SSH disabled; no secrets, clone, SQL or activation |
| `compose.yaml` | Platform: four explicit profiles, pinned base images, private data/ingress/control networks, HTTPS-only publication, volume paths, no Docker auto-restart |
| `config.example.json`, `policy.json` | Security/platform: disabled runtime example, fixed staging paths/purpose, placeholder approval/App identity, external/production flags false |
| `firewall.sh`, `squid.conf` | Network/security: purpose/approval guards, host and DOCKER-USER chains, reply/loopback handling, restricted CONNECT proxy, private destination denial, IPv6 output/forward denial |
| `verify-storage.sh`, both `.service` files | Storage/platform: UUID/PG_VERSION checks, mount/approval dependencies, infrastructure/controller startup separation and controller restart behavior |
| `agent.Dockerfile`, `scripts/persistent/build-agent.cjs` | Security: bounded control context, OS flock; Docker socket authority remains privileged; offline auditor/fixture live outside its existing whitelist |
| `core.cjs`, `agent.cjs` | Platform: durable command identity/outcome, preserved recovery origin, pending-effect/host-epoch fences, terminal resolution, independent health and acknowledgment retry |
| `runtime.cjs`, `gateway-probe.cjs` | Platform/security: exact image/resource ownership, read-only DB preflight, stopped-before-start handoff, real HTTPS/mTLS and release identity, verified cleanup |
| `github.cjs`, `select.cjs`, `package.cjs`, `rehearsal.cjs`, `extract.py` | Repository/security: scoped App, independent approval, immutable run/artifact/source bindings, strict ZIP/tar/image checks, synthetic rehearsal provenance |
| `image-store.cjs`, `ci-docker-store.cjs` | Security: canonical config-ID protocol; setup helper restricted to empty disposable GitHub-hosted Linux runners and excluded from external controller |
| `*.test.cjs`, `control.integration.cjs`, `gateway.integration.cjs` | Quality: mock/fault, local HTTPS and disposable runtime tests; none imply external readiness or authorize execution in this phase |
| Documents12–16 | Hospital/platform/DB owners: architecture, explicit installation prerequisites, governance/recovery, UAT and prior validation limits |
| `staging-persistent.yml`, `staging-release.yml` | Repository: literal-false external staging executors remain unchanged |
| `production-release.yml`, `production-database-release.yml` | Repository: read-only release selection separated from literal-false production and SQL executors |
| `repository-sync.yml`, `deploy/sync/policy.json` | Repository: independent read-only planner; publishing guard/policy false and separate bootstrap approval pending |
| `release-quality.yml`, `database-release-paths.yml` | Quality: backend/frontend/build/security, Linux/Windows source integrity and offline governance; this phase adds auditor regression/report generation; no executor is enabled |
| `isolated-database-validation.yml`, `staging-rehearsal.yml`, `persistent-local-validation.yml` | Quality: existing disposable database/runtime suites, source/run provenance and fail-closed readiness; running these entails synthetic SQL and is distinct from offline checks; gateway automatic triggers exclude preparation/control-only changes, while same-commit evidence remains mandatory for deployment |
| `deploy/staging/policy.json`, backend locked inventory | Security/DB: synthetic-only rehearsal flags, external/production false,105 locked artifacts, SQL073 manual-only |

The source report also includes the new auditor/test and synthetic fixture plus documents17–18. It does not enumerate or read host `.env`, keys, Terraform state, actual database rows or cloud resources.

## Confirmed static failures — activation blockers

These defects are retained and exposed as FAIL controls; this assessment does not silently edit the approved Phase3B deployment definitions.

| ID / severity | Evidence | Minimum reviewed correction before activation |
| --- | --- | --- |
| TF-04 / medium | `terraform/main.tf.json:27`: SSH-key list accepts empty input; volume size has no explicit reviewed validation bound | Add nonempty key/input and bounded volume validation; verify actual keys, account/region and storage separately |
| CMP-03 / medium | `compose.yaml:62` and `:90`: agent/egress lack the instance ownership label carried by database/gateway | Add and validate staging ownership before external lifecycle/cleanup; never adopt an unknown container |
| START-01 / high | `scop-staging-infra.service:14` starts networked services; firewall installation occurs afterward in ExecStartPost | Review firewall-before-connectivity ordering, preloaded images and safe dependency/failure handling |
| NET-03 / high | `firewall.sh:10` and `:22` flush live chains, then append rules one at a time | Review atomic/staged updates, failure recovery, initial hook ordering and persistence through Docker/host restart |
| NET-04 / medium | `firewall.sh:27` and Terraform egress rules allow UDP53 only; resolver validation checks characters only | Approve exact resolver identities, strict address validation, bounded TCP/UDP policy and DNS fallback tests |
| STO-01 / high | `verify-storage.sh:5` uses findmnt --target; a containing/root filesystem can satisfy a supplied UUID | Require exact dedicated mountpoint/device and non-root validation, then externally test absent/wrong mount and boot behavior |

The control descriptions identify static checks, not a formal shell interpreter or network proof. Regex/source observations must not substitute for reviewing arbitrary future firewall rewrites. A new implementation changing these mechanisms needs review and external validation even if a syntactic check becomes PASS.

STO-01 specifically uses full reviewed verifier and enforced pre-start-unit source identities, not a substring/regex heuristic. The original P2 was reproduced before correction: appending only `# TODO: add exact mountpoint validation` changed FAIL to PASS without changing executable behavior. That reproduction now remains FAIL. Comments, quoted/unused text, no-ops, unreachable/ignored checks, root/containing lookups, altered paths and missing UUID/root checks cannot satisfy the known identities. A positive constrained fixture and synthetic execution failures are tested without installing it or changing the authoritative verifier. See document17 for identity hashes and review boundaries. This correction changes assessment accuracy; it does not remediate the existing storage implementation or reduce the six FAIL controls.

## Missing preparation and external evidence

- **NET-05 BLOCKED:** no reviewed trusted-time path, base-image preload/update path or patching procedure under restricted egress. Initial cloud-init package transport may also conflict with provider egress. Do not solve this by granting unrestricted web access.
- **START-02 BLOCKED:** manual mount/fstab preparation, first boot and service readiness are not implemented by a canonical installer. Systemd mount ordering is present, but Compose up -d is not an application/DB readiness barrier. Runtime verification correctly fails closed; that does not prove startup usability.
- **DB-02 BLOCKED:** no approved persistent canonical synthetic-schema initializer, actual runtime role/permissions, genuine execution evidence or selected-SHA release attestation. SQL073 cannot enter an automatic plan.
- **OPS-01 BLOCKED:** App installation, independent reviewers, certificates, staging-only secrets, alerting and custody/rotation are not provisioned or accepted.
- **Nine EXTERNAL_VALIDATION_REQUIRED controls:** provider/project, real network policy, storage, boot, real images, host recovery, actual database, access/UAT and monitoring. No fixture value or caller-supplied report option can mark them PASS.

With successful offline Compose rendering the current source assessment is14 PASS,6 FAIL,4 BLOCKED and9 EXTERNAL_VALIDATION_REQUIRED. Without rendering, CMP-04 is additionally BLOCKED. These counts describe this baseline, not an approval threshold. Actual generated results are authoritative for the evaluated source hash; future remediation may change counts without making external activation authorized.

## Offline validation coverage and limitations

Synthetic validation rejects unknown/missing fields, enabled or prepared states, authorization changes, malformed/overlong instances, mutable/non-synthetic image references, real host/database/resolver values, empty/wide/invalid CIDRs and every changed executor hard stop. Regression mutations cover published DB ports, external/internal network changes, secret/mount scope, data-path creation and boot-ID removal. Actual offline Compose checks all16 profile combinations against a nonexistent socket and records normalized projection hashes; no real secret file is read.

Provider constraint/lock consistency is checked statically. Terraform init/validate independently checks local schema compatibility with pinned tooling and without a provider token/API/plan/apply. Neither this nor synthetic CIDRs proves that the selected size exists, management return traffic works, DNS resolves, firewall rules survive a reboot or storage is durable.

The independent locked-artifact check must continue to return105 artifacts, highest manual number73 and zero findings. Backend/frontend and infrastructure/security regressions must pass. Unit tests can successfully prove that a current infrastructure control FAILs; green test/report-generation jobs mean the auditor works, **not** that the host is ready. The strict `check` command remains nonzero.

No production identity, address, route, credential, Supabase access, existing recovery service, standalone repository or live database is needed for this phase. Changes to infrastructure hardening, provisioning, external validation, schema initialization or activation are separately reviewed work. No migration is required by the auditor.
