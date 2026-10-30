# October 2026 — security and authorization audit

Reviewed baseline `f254a6da68ae8268a8afc0149dd903ed10f42de5` on 30 October 2026 (Asia/Baghdad). Documentation-only audit. See [system audit](2026-10-system-audit.md) for finding definitions, complete evidence and test limitations.

## Assessment boundaries

No penetration test, hosted database access, credential access, live URL download or clinical-data inspection was performed. CONFIRMED below means application source behavior, not evidence of an exploited deployment. Backend database RLS and proxy rules were not inspected. A scoped UI or capability catalog does not establish object authorization; a shared NULL-owned supplier/product is not automatically a tenant leak.

## Verified positive controls

- authMiddleware restricts JWT algorithms (issuer/audience configurable), validates numeric user identity, loads the current active database user and permissions, rejects inactive accounts, and fails closed with 503 if permission retrieval fails.
- requestPolicy and inventoryPolicy explicitly compare institute/department/section or warehouse ownership and require explicit cross-scope authority.
- Technical review/task queries and fixed asset repositories scope institute and assigned/current responsibility; SCM cannot be the required technical inspector. New attested rounds retain immutable evidence/history.
- Inventory movement and canonical financial posting require structural traceability, guarded quantities, durable audit and idempotency. Permission validation and data-scope validation are distinct.
- RFID service ingestion is isolated from human JWT management routes. Observation-based exceptions do not directly authorize asset transfer.
- Browser access to new technical tables is restricted in SQL054; actual hosted role/policy installation is unknown.

## Application boundary matrix

| Boundary                             | Authentication/capability                                      | Object/institute enforcement                                                          | Assessment                                                                                                           |
| ------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Requests canonical lifecycle         | JWT + permission/ownership policy                              | Explicit scope and override policy in requestPolicy                                   | Positive control; legacy controller paths must not inherit this assurance automatically                              |
| P2P commercial/finance               | Controller capability or role fallback                         | No institute root predicate in inspected controller/repository                        | AUD-002 HIGH CONFIRMED                                                                                               |
| Physical inventory                   | Inventory permission + warehouse/institute policy              | Explicit actor institute/warehouse; special cross-scope capability                    | Positive physical-posting control; does not secure financial endpoints                                               |
| Technical tasks/profiles             | Assigned user/current responsibility or manager                | Institute scoped, authenticated attestation, independent SCM/receiver                 | Positive; generic file authorization remains separate AUD-003                                                        |
| Attachments/local uploads            | Public static local mount; JWT on API                          | API ID lookup without request/institute visibility                                    | AUD-003 HIGH CONFIRMED; clinical content/proxy exposure unverified                                                   |
| Legacy files                         | JWT                                                            | Unscoped ID lookup, but runtime storage export mismatch                               | AUD-015 MEDIUM CONFIRMED availability defect; functioning exploit not claimed                                        |
| Contracts                            | contracts.manage and stage/owner checks vary                   | No institute root boundary in contractsController                                     | AUD-005 HIGH CONFIRMED; contract finance also AUD-001                                                                |
| RFx internal management              | Permission/SCM/procurement role                                | Root event/request not institute-scoped; actor loses context                          | AUD-004 HIGH CONFIRMED                                                                                               |
| Public RFx response                  | Optional JWT; anonymous response explicitly admitted           | Name-based supplier identity                                                          | PARTIALLY VERIFIED policy risk: anonymous portal may be intended, but supplier attestation/invitation policy unknown |
| Planning and plans                   | JWT only on inspected routers                                  | Body warehouse/department and global IDs without scope/capability                     | AUD-006 HIGH CONFIRMED                                                                                               |
| Autoassignment management/resolution | Broad management permission/role                               | Global type/warehouse rules; unscoped assignee                                        | AUD-007 HIGH CONFIRMED                                                                                               |
| Budget controller                    | SCM/Admin/Finance/CFO role gate                                | Global department/year list and body department writes                                | Within AUD-002 cross-domain boundary work; role alone is insufficient                                                |
| Supplier/master catalogs             | Management permissions; shared legacy semantics                | Technical picker includes explicit institute or NULL, excludes foreign explicit owner | Positive bounded compatibility in PR73; remaining legacy SRM/evaluation scope not globally certified                 |
| Assets/maintenance                   | Explicit capabilities and institute repositories               | Scoped link validation, versions, canonical part inventory policy                     | Positive inspected paths; deployed hardware/custody data policy not verified                                         |
| Approvals V2                         | Explicit version/policy capabilities                           | Version/request institute scoping and shadow-only engine                              | Positive live boundary; readiness label AUD-013                                                                      |
| Audit delivery                       | Transactional business audit plus generic after-response audit | Audit payload sanitization by secret-like keys                                        | AUD-014: after-response persistence not a financial audit guarantee; clinical payload retention policy unverified    |

## Segregation of duties

Do not generalize a strong control from one workflow to another. New technical delivery requires assigned opinions, independent SCM final disposition and an authorized receiver application. Canonical AP requires match/voucher/posting prerequisites. Legacy contract payments instead accept contracts.manage and may set paid directly, bypassing those controls. Configurable permissions and role fallbacks coexist; revoking a catalog permission may not revoke every role-based fallback. Document intended break-glass/cross-institute policy before tightening it.

## Priority regression suite to add in remediation

Use two institutes, two departments, unrelated requesters, a reviewer assigned only to one request, an authorized receiver in one warehouse and identical privileged role names across institutes. For each object-root route test foreign root IDs, mismatched parent/child IDs, retry-key disclosure, current versus removed assignments, and read/list/export/download as well as mutations. Test anonymous local file access and all legacy aliases. For finance verify contract mutations cannot claim settlement without an effective posted payable and separate finance authority. Preserve legitimate same-institute cross-department procurement visibility only through documented capabilities.

No automatic permission grants, auth changes, database policies or rate-limit changes were implemented by this audit. See the main report for every finding's correction/dependencies/tests and AUD-020 for hosted assurance unknowns.
