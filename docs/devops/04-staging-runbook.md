# Isolated staging runbook — execution disabled

## Prerequisites requiring owner approval

Approve a dedicated staging host/namespace, restricted access URL, network isolation, separate credentials and PostgreSQL major/extensions. The production/recovery host has not been inspected. Do not allocate resources or reuse its services by inference. Verify a synthetic fixture strategy, least-privilege runtime role, schema contracts and authenticated tester accounts. Do not restore identifiable patient, supplier, bank or payment data into staging. Sanitization requires its own approved evidence.

`deploy/staging/compose.yaml`, `staging.env.example` and `candidate.example.json` are definitions only, not a provisioning command. All services use an explicit owner-approved profile, required image inputs, isolated internal networks and a staging-only data volume. No production data mounts, host Docker socket, recovery port/path or external services are configured. Bindings 15051/15080 are loopback only. Do not execute Compose as part of this assignment.

Image variables SCOP_POSTGRES_IMAGE, SCOP_BACKEND_IMAGE and SCOP_FRONTEND_IMAGE must be immutable approved digests, not mutable tags. Image construction/publishing and frontend reverse proxy behavior remain an explicit follow-up; the template does not assume images already exist. Create a local ignored staging.env from the template only after approval, with independent credentials. Template placeholders are not working accounts. Never copy production .env files.

The staging database initially has no canonical ERP schema or governed roles. Prepare reviewed synthetic schema/roles only through separately approved isolated validation. The template cannot legitimately pass startup verification on an empty database. Resolve that prerequisite rather than weakening RLS, startup contracts or attestation. PostgreSQL 16 is the existing fixture reference; PG17/hosted extension differences require explicit compatibility review.

## Future approved staging sequence

1. Bind an exact combined source SHA and artifact/image digest to successful code CI and complete disposable-database evidence. Fetch only verified artifacts from the expected repository/run/commit; do not execute arbitrary artifacts from forks.
2. Verify target identity, database isolation, disabled external integrations, mail dry-run and all rollout flags false. Prevent outbound access to production/SAP/SMTP/RFID endpoints.
3. Apply only approved additive synthetic staging migrations under a separate operation. Do not replay frozen history or operator recovery SQL implicitly.
4. Verify runtime authority, RLS, schema/permissions, legitimate staging evidence and startup readiness. No hosted-production check is implied.
5. Launch the approved isolated images, run health/readiness checks and verify matching frontend/backend release IDs. Avoid test log/health responses containing tokens, connection strings or patient data.
6. Run the smoke/UAT matrix below, record source/artifact IDs, tester authority, results and known limitations. Any failure blocks promotion.
7. Obtain owner UAT acceptance. Retain the staging release and logs needed for repeatable review and rollback. This is distinct from production approval.

| Workflow | Synthetic acceptance evidence |
| --- | --- |
| Authentication and roles | Login, deactivated/unauthorized actor rejection and institute isolation |
| Demand and approvals | Request/draft creation, specialized fields and canonical approval routing |
| Procurement | Assignment, RFx, award provenance and PO technical-clearance gates |
| Receipt and warehouse | Partial receipt/acceptance, quarantine/rejection, stock issue only after acceptance |
| Finance and contracts | Invoice capture, AP posting/allocation totals, duplicate settlement prevention and contract lifecycle |
| Workers and audit | RFID/outbox crash recovery, no duplicate mutation, transactional audit rollback |
| Reporting | Completion versus departmental fulfillment, institute/currency isolation and exports |

No staging URL, target or credential was approved/provisioned here. `staging-release.yml` is hard disabled. Removing that guard requires a separate reviewed implementation and verified environment protections; it does not itself provision a safe target.
