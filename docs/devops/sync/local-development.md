# Local development and review (Windows Git Bash)

Use the combined repository for application development. Standalone repositories are downstream review destinations, not alternate working sources. Node **22 LTS**/npm10 is recommended; CI also tests Node20. Do not infer support for every newer Node major from a permissive package engine range.

## Update the local source and dependencies

In Git Bash, the supplied workspace is `/d/WICI-Projects`:

```bash
cd /d/WICI-Projects/purchase-tracker
git status --short
git switch master
git pull --ff-only origin master
node --version
npm --version
(cd purchase-backend && npm ci)
(cd purchase-frontend && npm ci)
```

Inspect and preserve local work before switching; do not reset/stash/delete it blindly. `npm ci` installs development dependencies; it does not provision or certify a database. Never execute `deploy.sh`. Never copy `.env`, credentials, `node_modules`, generated artifacts or production data between repositories.

## Database prerequisites and backend startup

The owner's separately authorized Development Supabase project is independent from Production. Follow the [Development reconciliation runbook](development-database.md) before startup. A separately provisioned synthetic loopback database is also suitable for the existing guarded integration runners; that does not supply compatibility evidence for the hosted Development project.

Keep private Development configuration outside all Git repositories, e.g. `$HOME/.wici/development.env`, under owner-only OS permissions. Use only Development credentials; do not copy production `.env` files. Set `NODE_ENV=development`, `HOST=127.0.0.1`, `PORT=5000`, `DB_RELEASE_ENVIRONMENT=development`, the actual reviewed `APP_RELEASE_REF`, an independent local `JWT_SECRET`, `LIVE_ROUTING_ENABLED=false`, `EMAIL_DRY_RUN=true` and `SMTP_DRY_RUN=true`. Configure CORS/FRONTEND_URL for `http://127.0.0.1:3000`. Do not include Production/SAP/real mail credentials. Do not select the hosted recovery profile unless the captured Development schema and reviewed change plan justify it. No startup gate may be disabled.

After read-only **actual-runtime** Development verification returns DATABASE_READY/restart_eligible=true and any separately approved reconciliation is complete, start backend from a new Git Bash window:

```bash
cd /d/WICI-Projects/purchase-tracker/purchase-backend
export DOTENV_CONFIG_PATH="$HOME/.wici/development.env"
node -r dotenv/config -e 'require("dotenv").config({quiet:true}); require("../scripts/devops/development-db.cjs").localConfiguration(process.env); require("./app").startServer(5000,"127.0.0.1").catch(()=>{console.error("Development startup blocked; inspect private local logs");process.exitCode=1;});'
```

The guard validates the Development database endpoint, any configured Supabase storage URL, Development environment and dry-run outbound flags before loading the app. The explicit dotenv load merges configuration before these checks so later default dotenv loading does not fill unchecked storage settings. Database compatibility, runtime role, migration receipts and current source/schema attestation are still checked by `startServer`; `NODE_ENV=development` does not bypass them. Startup subsequently synchronizes canonical reference permissions and starts existing workers **in Development**, so it requires approved Development-only access. This is a manual local development command, not executed by the audit or this task. Do not run it before reconciliation. Inspect any existing checkout `.env*` files for conflicting non-database outbound settings; the application itself uses dotenv. No production configuration should exist in this checkout.

Backend startup against the reported incompatible Development database is currently BLOCKED. A successful connection alone is insufficient. This task does not claim that running the command now will fix it.

## Frontend and local testing

In another Git Bash window:

```bash
cd /d/WICI-Projects/purchase-tracker/purchase-frontend
HOST=127.0.0.1 PORT=3000 BROWSER=none REACT_APP_API_BASE_URL=http://127.0.0.1:5000/api npm start
```

Explicit HOST matters: the existing frontend launcher otherwise chooses a LAN address. Open `http://127.0.0.1:3000`. Inspect Network requests to confirm only the local backend; do not embed server secrets in `REACT_APP_*` variables. Test the priority management dialog, keyboard focus/close, unsaved draft navigation, failed saves and stale previews with synthetic Development users/data after database acceptance.

From the combined root run the sanitized local quality gates (do not edit release inputs while a gate runs):

```bash
node scripts/quality/release.cjs group backend
node scripts/quality/release.cjs group frontend
node --test scripts/devops/sync-audit.test.cjs scripts/devops/sync-publish.test.cjs scripts/devops/sync-evidence.test.cjs scripts/devops/development-db.test.cjs scripts/devops/security-regression.test.cjs
node scripts/devops/integrity.cjs --base f852b6add8596f61d389cb00f5f652ac75cd6cf5
```

The existing PostgreSQL regression group uses disposable synthetic databases only; its runner performs SQL inside those disposable databases, never against hosted Development or Production. Run it only with the documented isolated local container prerequisites. It does not reconcile hosted Development.

## Read-only sibling synchronization audit — no TTY redirection

If the standalone sibling clones do not exist, clone their main branches into `/d/WICI-Projects/purchase-backend` and `purchase-frontend` first. These clones are not the recovery worktree. Update only after inspecting local status:

```bash
git -C /d/WICI-Projects/purchase-backend status --short
git -C /d/WICI-Projects/purchase-backend pull --ff-only origin main
git -C /d/WICI-Projects/purchase-frontend status --short
git -C /d/WICI-Projects/purchase-frontend pull --ff-only origin main
cd /d/WICI-Projects/purchase-tracker
node scripts/devops/sync-audit.cjs --source /d/WICI-Projects/purchase-tracker --backend /d/WICI-Projects/purchase-backend --frontend /d/WICI-Projects/purchase-frontend --output /d/WICI-Projects/sync-review-001
```

Use a new output directory each time. Node writes `audit.json`, `backend-plan.json`, `frontend-plan.json` directly, without shell redirection. Native Windows paths with spaces work when quoted. Optional `--source-sha`, `--backend-sha`, `--frontend-sha` must be full 40-character commit IDs already present locally. Default selection is each clone's committed HEAD, not necessarily latest remote main; independently inspect/pull first. The audit performs **no network fetch, ref update, credential load, working-tree copy or publisher call**.

Exit0 means reports were generated; inspect each plan's status, conflicts and exact source/destination SHAs. It is not publication approval. Modified/untracked files are not part of these committed-object plans, so commit/review intended source work through the normal combined PR before expecting it to appear. Excluded credentials/generated files remain excluded, and complete-tree collision protections still apply. Compare every addition/update/deletion and protected-content digest. Backend independent branch integration and the pending bootstrap approvals cannot be supplied by this command.

## Request publication and update downstream clones

Today: request the outstanding canonical integration, destination CI/settings approvals and immutable bootstrap review through Codex PRs. Publishing is disabled, so no request or repository variable can activate it. After **separate** authorization/activation, successful merged-master push CI produces a plan and the protected environment requires an independent approval; revalidation can still reject changed source, destination or expired evidence. Review destination draft PRs and their CI before human merge. No manual subtree force-push or repository reset is required.

Only after those real destination PRs merge, repeat `git status` and `git pull --ff-only origin main` in the standalone sibling clones. Do not edit/rebase/force-push destination main to simulate the merge. Local testing and synchronization approval remain independent from staging/production deployment approval.
