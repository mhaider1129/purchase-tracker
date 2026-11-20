# Phase 3B — persistent isolated staging

Base: master `6bd9e0623300dbbe81a76f0f833d1e6b251e0a3f`. Phase 3A's canonical database contracts, 105 locked artifacts, synthetic rehearsal, runtime-role checks and external production/publishing hard stops are retained. This phase adds infrastructure definitions and a disabled persistent-staging control plane. No external host, credentials, protected environment, DNS or live database was created or accessed.

## Recommendation and planning budget

Use **one separate Hetzner project and VPS**, an attached persistent staging volume, and an independently restricted staging hostname. Keep it in a different trust boundary from the hospital production/recovery host. Start with roughly 4 vCPU / 8 GB RAM, 40–80 GB persistent storage and a small synthetic dataset. Right-size from observed staging CPU/memory. One host is economical but not HA; an outage is acceptable for staging, never a production availability design.

Indicative monthly planning ranges below are budget allowances, **not verified November 2026 provider quotes**. Region, IPv4, VAT, bandwidth, backups and selected plans must be quoted before authorization.

| Option | Planning allowance | Operational tradeoff |
| --- | --- | --- |
| Separate Hetzner VPS + volume | approximately EUR 10–25/month; backup/storage allowance extra | Recommended: economical isolation and Docker/PostgreSQL control; hospital must own patching, encrypted backups, TLS and recovery |
| DigitalOcean/Linode-class VPS | approximately USD 25–60/month plus backup/storage | Similar architecture, generally higher budget; select for support/region needs |
| Managed app host + managed PostgreSQL | approximately USD 40–120/month | Less OS work, but private networking, persistent uploads, approval-gated immutable images and egress restrictions need provider-specific validation |
| Existing production VPS | No additional host bill | Rejected: shared Docker/OS/credentials/storage and failure domain can threaten recovery service and live hospital operations |

## Trust and data flow

Merged master → successful Release quality → same-commit Phase 3A PG16/17 + sixteen-suite rehearsal → protected `scop-staging` approval → exact runtime images built/smoke-tested once and exported → immutable GitHub request artifact → staging host independently verifies run, reviewer, artifact digest, CI source and image IDs → read-only persistent database verification → bounded worker handoff → atomic gateway configuration/reload → health and deployment status → hospital browser/UAT acceptance.

Actions never connects to the host: there is no deployment SSH key, inbound management API, mutable Git pull, source synchronization or host build. The **pull agent** uses a short-lived installation token from a staging-only GitHub App. The App has `Actions: read`, `Contents: read`, `Deployments: write`, `Metadata: read`, installed only on the combined repository. Tokens are requested for that one repository and those permissions. The private key stays in a root-protected file on staging, outside images and Actions. Its deployment permission can technically write repository deployment metadata for other environments; GitHub cannot scope this permission to one environment. Treat the key as privileged, rotate it, and retain existing production checks that reject this custom App's records. It has no production target, credentials, content/settings write or workflow-dispatch permission.

The request artifact binds the actual tested commit, source CI run/attempt/artifact IDs/digests, rehearsal receipts, request workflow commit/run/attempt and the IDs of **the same images exercised by smoke tests**. A narrowly scoped in-process export hook executes before Phase 3A removes its images; normal cleanup still runs and a hook failure blocks the report. Metadata and Docker-save archives are authenticated again by the host before image loading. Only the two expected staging tags/config IDs are accepted. No mutable tag is used to start application containers. The host rejects rerun request attempts: retry with a fresh protected dispatch and fresh independent approval.

The agent's Docker socket is root-equivalent administrative authority **on the dedicated staging host**. `cap_drop` does not make that socket unprivileged. Never install it on the production/recovery host, on a shared Docker daemon, or on a PR runner. Agent code, configuration, identity and image digest are independently reviewed/pinned; application artifacts cannot update the controller.

## Isolation and access

- App/database networks are Docker `internal`; database has no published port. Each release has a private frontend/backend network, and only the backend joins the shared staging database network.
- The frontend joins an internal ingress network to the staging Caddy gateway. Gateway publishes only HTTPS 443; TLS certificate/key are supplied separately and mounted read-only. Caddy client-certificate authentication is an additional perimeter gate; application login and institute permissions still apply. Hospital/VPN source CIDRs are restricted by the provider firewall. No public anonymous testing or patient identifiers.
- The agent's internal control network reaches only the CONNECT proxy. Proxy ACL permits API/artifact GitHub hosts on TLS 443 and denies private/link-local destinations. It cannot reach Supabase, SAP or general web targets. Host `DOCKER-USER` rules deny new gateway egress and allow only the fixed proxy address to public TLS. Disable IPv6 as templated until equivalent rules are reviewed.
- TLS is supplied out-of-band; the application gateway does not perform ACME or have arbitrary outbound access. Certificate renewal and expiry alerting must be arranged before activation. Do not disable certificate verification for browser tests.
- No production `.env`, database dump, supplier/bank/patient data, production VPN route, Supabase/SAP/SMTP credentials or recovery files enter staging. Store only synthetic records. User staff identities/access are protected staging credentials, not permission to copy real clinical records.

## Availability, state and audit

The deployment state and append-only application audit journal are fsynced to the attached volume. OS `flock` gives one controller process; the agent polls sequentially. Previous images, stopped containers, upload storage and release environment files are retained. There is no automated old-release deletion or database rollback.

Backend startup always starts scheduled workers. Therefore handoff uses **visible maintenance**, stops/verifies the previous backend exited, then starts the candidate. This prevents duplicate schedulers; it is not zero-downtime blue/green. On success, Caddy validates a new configuration, replaces the route file atomically and reloads; a release marker verifies the loaded configuration. On failure, candidate stops, previous starts and passes health before its route returns. Failure of recovery leaves explicit maintenance and `RECOVERY_REQUIRED`, with no successful status. The first failed deployment has no previous service and cannot promise availability.

A crash during a journalled transition is not silently replayed. A fresh approved `recover` request must select the exact preserved previous SHA. A crash after a durable terminal command-outcome write can be acknowledged idempotently without replaying mutations; ACTIVE without that outcome remains uncertain. Status-delivery failure persists a retryable acknowledgment and never repeats the deployment. Local audit/volume failure remains an incident: no distributed filesystem or host-HA guarantee is claimed.

## Production separation

Production workflows, `wici-recovery`, port 5051, Nginx/PM2, production Supabase and standalone repositories are untouched. Existing production selection does **not** accept this custom App/workflow as production staging authority; a separately reviewed adapter/protected UAT integration is required before any production release. No production executor or publishing flag is enabled here.

## Recovery corrections verified locally

Release names use a full SHA-256 digest of instance, complete source SHA, run ID, attempt and exact image IDs, encoded without truncation into 52 lowercase base32 characters. Role prefixes keep every DNS label below 63 characters. Immutable Docker labels retain full commit, request and digest; the gateway publishes both commit and attempt identity markers. Cleanup validates the complete owned removal set and excludes retained releases, images, volumes and shared database networks. The former full-SHA/instance concatenation can exceed DNS limits and is covered by a real legacy-502 reproduction.

The gateway uses mTLS client authentication, not HTTP Basic Auth: Basic and application Bearer JWTs would compete for the Authorization header. Client CA trust is separate from server TLS and app credentials. Local integration verifies TLS trust, denial without a client certificate, actual login/JWT requests, institute isolation, handoff/recovery and missing-attestation rejection. None of these local tests provision external staging.

## Corrected completion and monitoring boundaries

A release marker alone does not establish availability. The runtime adapter requires an actual HTTPS/mTLS probe through the gateway and frontend API proxy before persisting ACTIVE, and repeats that check during local monitoring. Valid loopback markers with an overlong/unreachable upstream are a tested failure. Command completion is durably bound to its request identity before status caching/acknowledgment; incomplete commands remain fenced until separately approved recovery. GitHub unavailability never prevents local health/maintenance reconciliation. See documents 13–14 for probe credential installation, the version-2 command ledger, and the distinction between terminal-operation deduplication and uncertain external effects.
