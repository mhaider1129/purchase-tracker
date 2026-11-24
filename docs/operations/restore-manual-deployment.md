# Restore the existing manual deployment workflow

This change restores owner-invoked deployment on the existing Ubuntu/PM2/Nginx server. It does not activate a workflow, provision infrastructure, run SQL, or deploy itself. No server was accessed during implementation. Repository and mocked-host tests are not production acceptance.

## Root cause and corrected startup behavior

Governance commit `c8189b30` introduced `databaseReleaseService.startWhenReady()` before the HTTP listener and workers. Subsequent changes added worker and release controls. The startup gate eventually required migration receipts and an attestation matching the exact application release, source manifest and observed database. `db:verify` is an explicit read-only audit tool requiring `DB_RELEASE_READONLY_URL`, environment and release arguments. Putting that command in routine deployment made an operator certification workflow a prerequisite for every application update.

Normal startup now calls `assertRuntimeCompatible()`. It automatically verifies locked source integrity, the selected schema contract, reference permissions, RLS/grants, function/constraint/index/trigger definitions and actual runtime authority in a single read-only transaction. Genuine incompatibility prevents listen and workers. Runtime startup does not read migration receipt rows, require an attestation, or require `DB_RELEASE_READONLY_URL`. Inaccessible certification rows alone do not block routine startup. Business-reference visibility and authorization checks remain enforced.

The explicit `db:verify` / `assertReady()` audit remains strict, including authentic receipts and attestations. Runtime reports `AUTOMATIC_RUNTIME_COMPATIBILITY` and `SCHEMA_VERIFIED_UNATTESTED`, not release certification. There is no flag to disable compatibility, authentication, authorization, runtime SQL guards or financial audit controls. No schema is repaired at startup.

This removes the certification regression, not real schema differences. The canonical/hosted profile must still match the actual database. Do not change the profile blindly, remove RLS, use an owner role to bypass checks, or weaken demand-planning access to make a deployment pass. If automatic compatibility fails, this script leaves recovery serving and exits unsuccessfully. Any genuine database correction is a separate reviewed operation; this deployment never executes migrations or invents receipts.

## Supplied server layout

| Path/service | Treatment |
| --- | --- |
| `/var/www/wici-procurement/backend` | Original repository and dependency/environment store; never reset, cleaned, npm-installed or renamed by the new deployment. |
| `/opt/wici-recovery/app.recovery-test.js`, cwd `/opt/wici-recovery` | Original recovery files and PM2 definition are retained. Its `.env` and `node_modules` links into the original backend stay valid. Recovery is only stopped after candidate acceptance, and restarted on rollback. |
| `/var/www/wici-procurement/frontend_repo` | Original frontend checkout remains untouched. |
| `/var/www/wici-procurement/frontend_build` | Actual Nginx publication path; old physical directory preserved on first transition, then atomically points to each release's static build. |
| `/var/www/wici-procurement/backend_release` | Existing prepared candidate directory is preserved on first transition, then points to the new backend release. |
| Node `20.20.2` | Supported and tested; Node22 is also supported. No production Node upgrade required. |
| Existing Nginx API upstream `127.0.0.1:5051` | Changed to `127.0.0.1:5000` only after the replacement backend is healthy; restored on rollback. No unrelated server-block content is replaced. |
| `wici-recovery` / `purchase-backend` | Never run production workers concurrently during cutover. Candidate uses a unique PM2 name, port5001 and `RUNTIME_BACKGROUND_WORKERS_ENABLED=false`. |

New directories are ordinary release/cache/private-journal directories on the same server, not a deployment framework. No Docker, staging or external service is added.

## Routine owner workflow after review/merge

From your local combined checkout, after the PR has been merged:

```bash
git switch master
git pull --ff-only origin master
# Review GitHub tests and complete local testing before publishing.
node scripts/devops/manual-sync.cjs --plan
node scripts/devops/manual-sync.cjs --publish
ssh deployer@178.105.124.131 /home/deployer/deploy.sh
```

The manual sync helper uses the same `git subtree split` approach previously used in Git Bash. It needs Node and Git with subtree support locally. It verifies clean latest merged master, checks both standalone histories, and defaults to a read-only destination plan. Only the explicitly invoked `--publish` writes to standalone main. It never force-pushes, deletes branches, resets destinations or invokes deployment. Existing hard-disabled Actions publishing/deployment switches remain disabled.

If destination-only recovery changes diverge, the plan blocks both writes. Reconcile those changes through review into the combined repository and standalone history first; do not force-push an export over them or bypass the tree checks. The previous independent recovery worktree is never accessed by this helper. After backend publication but frontend failure, the helper reports partial/uncertain completion; rerun the plan. The already-published component becomes NO_CHANGES, and the remaining fast-forward can be published. There is no unsafe attempt to rewind remote history. Deployment itself refuses a mixed pair.

The server fetches immutable backend/frontend main commits and one combined master commit into private Git caches, verifies both standalone root trees exactly match that combined commit's subtrees, and archives those exact commits. Branch movement after selection does not change the release. A mixed or divergent pair fails before touching live services. Read access to the combined repository is required for this identity check and the existing frontend credential scanner. Use existing authorized Git credentials; no token is placed in this script or config.

## One-time installation — commands for the owner, not executed by Codex

Use the reviewed local checkout containing this change. Review `deploy/manual/deploy.sh` first. Preserve `/home/deployer/deploy.sh.bak`; the commands below do not overwrite it and do not deploy.

On the local PC in the combined checkout:

```bash
scp deploy/manual/deploy.sh deployer@178.105.124.131:/home/deployer/deploy.sh.new
ssh deployer@178.105.124.131 'set -eu; bash -n /home/deployer/deploy.sh.new; test ! -e /home/deployer/deploy.sh.before-manual-restore; cp -p /home/deployer/deploy.sh /home/deployer/deploy.sh.before-manual-restore; install -m 700 /home/deployer/deploy.sh.new /home/deployer/deploy.sh'
```

If that backup name already exists, stop and preserve/inspect it; use another unique backup filename after review. Do not delete it just to rerun installation.

No config is required for the supplied paths when exactly one active Nginx server-block file contains `root /var/www/wici-procurement/frontend_build` and the known API upstream. The script reads `sudo nginx -T` privately and identifies that file. If discovery is ambiguous or uses indirect/variable configuration, it refuses to change anything. In that case use the optional [deploy.conf.example](../../deploy/manual/deploy.conf.example) as `~/.config/wici-deploy.conf`, owner deployer, mode600, with the real `NGINX_SITE`. Do not guess a site name. A config file is trusted shell configuration, not a place for database credentials.

Before the first actual deployment, review these existing-host prerequisites:

- Deployer can write the application root and use Git, npm, Node20.20.2, Python3, PM2, curl and flock.
- Existing noninteractive sudo authorization permits the necessary Nginx test/discovery/reload and narrowly scoped site-file backup/restore operations. The script uses `sudo -n` and fails if approval is unavailable. Do not grant blanket passwordless sudo as a shortcut.
- Exactly one known application is online. The recovery working directory must not overlap candidate/publication paths. Unknown/stale probe processes block deployment for investigation.
- Original `backend/.env`, `backend/node_modules`, and upload store remain intact. Default uploads are `backend/uploads`; configure `SHARED_UPLOADS` to the actual stable store if different. Public Nginx aliases to uploads, if any, need their existing directory traversal permissions; this script does not infer or broaden attachment authorization.
- Port5001 is available for the worker-disabled probe and port5000 for the replacement. Full production environment settings remain in the existing backend `.env`; no new read-only database URL or release certification is required.
- Adequate disk space exists for both retained releases and npm/build output. No automatic old-release deletion is performed.

After separately approving activation, the deployment command remains exactly:

```bash
ssh deployer@178.105.124.131 /home/deployer/deploy.sh
```

## Deployment and recovery sequence

1. Acquire a host-local lock; reject an unresolved deployment journal.
2. Resolve and tree-check exact repository commits. Build in new release directories with locked `npm ci --ignore-scripts`; no fallback to unlocked `npm install`. Use a same-origin `/api` frontend and the existing credential scanner on built output. Backend installation includes dev dependencies for deterministic tooling; recovery's dependencies are untouched.
3. Copy the existing backend `.env` privately, reuse the stable uploads store, and preserve originals. Verify Node syntax and existing Nginx integration before any live process change.
4. Start a uniquely named candidate, loopback5001, workers disabled. Automatic database compatibility must pass before listen. Check actual health JSON/source identity and unauthenticated API rejection. No production business-write smoke tests are issued.
5. Stop/delete only the owned probe. Write the durable cutover checkpoint, stop the prior production worker process, preserve prior pointer/directory targets and start `purchase-backend` on5000 with workers enabled. Recovery code/dependencies remain untouched.
6. Require direct backend health, validate/reload Nginx, then require same-origin API health, matching frontend release marker and unauthorized-request rejection. Save PM2 state only after acceptance. Record source SHAs, previous paths and private PM2 restoration metadata.
7. Any normal cutover failure attempts rollback, restores publication and the original Nginx file, and restarts only the previous application. A failed rollback returns failure and retains the journal; it never reports success while recovery is unverified.

Manual rollback command:

```bash
ssh deployer@178.105.124.131 '/home/deployer/deploy.sh --rollback'
```

It uses the pending transaction first, otherwise the last successful deployment, preserving previous releases. Repeated rollback is a no-op after verified completion. It does not reverse database entries or deploy an arbitrary Git ref. An interrupted operation blocks another deploy until rollback/review. SIGKILL/reboot cannot execute shell traps; the journal supports owner-invoked recovery, not a claim of unattended reboot or zero-downtime recovery. In particular an interrupted traffic switch can require immediate operator rollback. No new supervisor is added.

## Source governance and validation

Only `app.js` and `services/databaseReleaseService.js` require new application-source hashes. Their actual bytes are re-attested; checksum enforcement remains enabled. Aggregate source digest changes from `a081d9611bd8aa364c68734749169f6d8456bf507e646a0ac958ecea03505760` to `c7d6fe0dabaff8c04c8a30ad0c36c1e8f6fb73688fe5036c304eb72eb5b48f99`.

The existing offline generator refreshes the generated operator bundle's source/release bindings under `wici-runtime-deployment-2026-11-24-r1`. A byte comparison proves these are its only differences; its SQL body, permissions, prerequisites and schema expectations are unchanged. **Do not execute that bundle for routine deployment.** All historical migration SQL/hashes, classifications and SQL073 manual-only protection remain unchanged. No database migration is required by this code change.

Backend regression tests prove: no attestation required for compatible routine startup; genuine schema/permission/RLS/type/function/runtime-role failures still block; strict explicit certification still requires evidence; one read-only connection is used and released before listen; worker flags fail closed. HTTP tests exercise actual Express `/api/health` and protected `/api/auth/me` with mocked database access.

Shell tests run the real Bash script and real disposable Git repositories with fake PM2/Nginx/sudo/curl/npm programs. They validate the supplied layout, unchanged recovery symlink targets, paired commits, frontend publication, non-overlapping workers, candidate/build/proxy failures, repeated deployments, rollback, source divergence, stale process rejection, active-site discovery and a controlled SIGKILL of the owned test subprocess. They do not validate a real production Nginx reload, real PM2 worker shutdown, the hosted database or external traffic. Exact final local counts and CI are reported in the PR.

Production PM2 restarts use bounded exponential backoff; the probe disables autorestart. Cleanup verifies process ownership explicitly even while rollback continues after errors. A foreign process is never deleted merely because its name resembles a deployment process; an unresolved ownership error keeps the journal fenced for investigation.
