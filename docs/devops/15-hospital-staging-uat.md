# Hospital browser/UAT acceptance — synthetic data only

Release SHA, capsule artifact ID/digest, CI/rehearsal run IDs, staging deployment ID, approver, tester role/institute, time and expected/actual outcomes must accompany acceptance. Keep evidence in restricted staging records; redact tokens/passwords and use synthetic patient/procedure references. Package/deploy success is not UAT acceptance or production authorization.

## Access and identity

- From an approved hospital/VPN address, open the trusted HTTPS staging URL. Check hostname/certificate expiry, perimeter access and application login. From an unauthorized network/account, prove access is refused. Confirm no production hostname or live service is contacted in browser Network.
- Verify active/inactive users, invalid/expired tokens, requester/approver/SCM/warehouse/finance roles and English/Arabic/mobile/keyboard entry. Test logout and inability to reopen protected records with the old session.
- Create separate synthetic institutes A and B. Exercise lists, searches, direct IDs, attachments and exports; neither institute may see the other's data. Supplier accounts cannot see competitor quotations, internal pricing recommendations or evaluation notes.

## Operational workflow checklist

| Workflow | Positive scenario | Required rejection/invariant |
| --- | --- | --- |
| Requests | Create draft with attachments; submit representative guided/legacy request families and required specialized fields | Bad quantity/UOM/date, unauthorized type, foreign item/department and unnecessary patient identifiers rejected |
| Approvals | Follow configured active route with independent approvers; verify history, next step and notices | Self/foreign/inactive/incorrect-step decisions denied; technical outcome does not overwrite PR approval |
| Procurement | Assign authorized buyer; RFx invitation/response, technical/commercial evaluation, partial award and PO | Technical clearance, source/supplier/item identity, approved quantities and duplicate award/PO prevention preserved |
| Warehouse | Partial receipt, pending/rejected/quarantine/acceptance, stock issue and departmental fulfillment | No issue before required acceptance; rejected/quarantined units excluded; purchasing/warehouse intake does not imply department fulfillment |
| Contracts | Scoped lifecycle, canonical financial projection, supporting evidence and explicit reconciliation | Foreign access and unauthorized lifecycle/financial edits rejected; legacy history preserved |
| Finance/P2P | Synthetic invoice verification, AP posting, partial/full allocations and currency-specific totals | Segregation of duties, overpayment/duplicate settlement and cross-institute checks; audit/outbox failure rolls back critical mutation |
| Reporting | Compare approval, sourcing, accepted delivery, issue/fulfillment and financial settlement dimensions | No cross-institute/competitor leakage or mixed-currency totals; partial progress remains partial |
| Workers/notices | Observe synthetic outbox/RFID retry and audit records | No external emails/SAP/Supabase calls; no duplicate stock/asset/payment mutation; stale work visible and scoped |

## Deployment/recovery acceptance

1. Confirm a deployment request requires an independent `scop-staging` approval; no author self-approval, fork, expired artifact, failed/incomplete CI or unverified commit may execute. Missing permissions, database evidence or attestation must block **before** maintenance.
2. Deploy release A, then approved B against synthetic staging. Observe the explicit maintenance handoff and one worker generation. Check the loaded gateway marker, healthy backend/frontend and preserved A containers/images/records.
3. Approve rollback to exact A; verify database compatibility preflight, service recovery, HTTPS/application access, queued jobs and unchanged synthetic business records. Requests for arbitrary/non-retained commits must fail.
4. Induce candidate/gateway health failure and verify A recovers, with failure status for B. Induce failed A recovery; maintenance plus RECOVERY_REQUIRED and an alert are required, never a false success.
5. Terminate the agent during each state; reboot host; simulate missing volume and network/DB/status acknowledgment loss. Verify locking, reviewed recovery, no duplicate business operation and correct GitHub status retry. No global prune or SQL rollback is permitted.
6. Confirm TLS expiry/host availability/database/outbox/backup/capacity alerts reach the assigned staging operators. Prove recovery from a synthetic staging backup in a separate isolated target.

## Sign-off

Authorized department requester, procurement lead, warehouse lead, finance reviewer and platform operator record pass/fail and blockers. An independent hospital owner accepts the tested staging SHA in a protected UAT process. Clinical/financial high-severity defects, isolation failure, missing audit/evidence, failed recovery or incomplete tests block acceptance.

External staging has not been provisioned or browser-tested in this assignment. This checklist and automated fixture/model tests are preparation only. Existing production selector does not accept the new App's records without a separately reviewed integration; production cutover remains independently disabled and unauthorized.
