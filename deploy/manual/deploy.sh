#!/usr/bin/env bash
# Owner-invoked deployment only. Never executes SQL or modifies database data.
set -Eeuo pipefail
umask 077
if [[ ${1:-} == --help ]]; then
  echo 'Usage: deploy.sh [--rollback]  (configuration: ~/.config/wici-deploy.conf)'
  exit 0
fi
[[ $# == 0 || ( $# == 1 && $1 == --rollback ) ]] || { echo 'Unsupported argument' >&2; exit 2; }
CONFIG=${WICI_DEPLOY_CONFIG:-$HOME/.config/wici-deploy.conf}
if [[ -e "$CONFIG" || -L "$CONFIG" ]]; then
[[ -f "$CONFIG" && ! -L "$CONFIG" ]] || { echo "Invalid trusted configuration: $CONFIG" >&2; exit 2; }
python3 - "$CONFIG" <<'PY'
import os,stat,sys
s=os.stat(sys.argv[1]); assert s.st_uid==os.getuid() and not s.st_mode & 0o077, 'Config must be owned by deployer with mode 600'
PY
# Configuration is trusted owner-maintained shell assignments, never fetched from Git.
source "$CONFIG"
fi
: "${ROOT:=/var/www/wici-procurement}"
: "${BACKEND_BRANCH:=main}" "${FRONTEND_BRANCH:=main}" "${COMBINED_BRANCH:=master}"
# Preserve the original server's authenticated Git transport/deploy keys.
: "${BACKEND_REPO:=$(git -C "$ROOT/backend" remote get-url origin)}"
: "${FRONTEND_REPO:=$(git -C "$ROOT/frontend_repo" remote get-url origin)}"
if [[ -z ${COMBINED_REPO:-} ]]; then
  case "$BACKEND_REPO" in
    *mhaider1129/purchase-backend.git) COMBINED_REPO="${BACKEND_REPO%purchase-backend.git}purchase-tracker.git" ;;
    *mhaider1129/purchase-backend) COMBINED_REPO="${BACKEND_REPO%purchase-backend}purchase-tracker" ;;
    *) echo 'Set COMBINED_REPO to the authenticated combined repository URL' >&2; exit 2 ;;
  esac
fi
: "${PUBLIC_URL:=https://wici-procurement.org}"
: "${NGINX_SITE:=}"
: "${BACKEND_ENV:=$ROOT/backend/.env}"
: "${SHARED_UPLOADS:=$ROOT/backend/uploads}"
: "${READY_SECONDS:=120}" "${CANDIDATE_PORT:=5001}"
[[ "$ROOT" == /* && "$ROOT" != / && ! -L "$ROOT" && -d "$ROOT" ]] || exit 2
[[ "$PUBLIC_URL" == https://* && "$CANDIDATE_PORT" =~ ^[0-9]+$ && "$CANDIDATE_PORT" != 5000 && "$CANDIDATE_PORT" != 5051 ]] || exit 2
(( CANDIDATE_PORT > 1023 && CANDIDATE_PORT < 65536 )) || exit 2
[[ "$READY_SECONDS" =~ ^[0-9]+$ ]] || exit 2
for cmd in git npm node python3 pm2 curl flock sudo; do command -v "$cmd" >/dev/null; done
node -e 'const [major,minor,patch]=process.versions.node.split(".").map(Number);if(!((major===20&&(minor>20||(minor===20&&patch>=2)))||major===22))process.exit(1)' || { echo 'Node 20.20.2+ (20.x) or Node 22 is required' >&2; exit 2; }
[[ ${1:-} == --rollback || -f "$BACKEND_ENV" ]] || { echo 'Existing environment file required' >&2; exit 2; }
BACKEND_LIVE="$ROOT/backend_release"; FRONTEND_LIVE="$ROOT/frontend_build"
STATE="$ROOT/deployments"; mkdir -p "$STATE" "$ROOT/releases" "$ROOT/repo-cache"; chmod 700 "$STATE"
exec 9>"$STATE/deploy.lock"; flock -n 9 || { echo 'Another deployment/rollback is running' >&2; exit 2; }
if [[ -z "$NGINX_SITE" && ${1:-} != --rollback ]]; then
  # nginx -T is inspected privately; its exact active file, not a guessed filename, is selected.
  sudo -n nginx -T > "$STATE/nginx-discovery.private"
  NGINX_SITE=$(python3 - "$STATE/nginx-discovery.private" "$FRONTEND_LIVE" <<'PY'
import pathlib,re,sys
s=pathlib.Path(sys.argv[1]).read_text(); candidates=[]
for match in re.finditer(r'^# configuration file ([^\n]+):\n(.*?)(?=^# configuration file |\Z)',s,re.M|re.S):
 if re.search(r'\broot\s+'+re.escape(sys.argv[2])+r'/?\s*;',match[2]) and re.search(r'\bproxy_pass\s+http://127\.0\.0\.1:(5000|5051)(?=[/;])',match[2]):candidates.append(match[1])
assert len(candidates)==1, 'Cannot uniquely identify the active WICI server block; set NGINX_SITE in owner configuration'
print(candidates[0])
PY
  )
  rm "$STATE/nginx-discovery.private"
fi
if [[ ${1:-} != --rollback ]]; then
  NGINX_SITE=$(readlink -f "$NGINX_SITE")
  [[ "$NGINX_SITE" == /etc/nginx/* && -f "$NGINX_SITE" ]] || exit 2
fi
# A durable pointer prevents another deployment overtaking an interrupted cutover.
atomic_write() {
  python3 - "$1" "$2" <<'PY'
import os,sys,tempfile
p,v=sys.argv[1:]; fd,t=tempfile.mkstemp(dir=os.path.dirname(p))
try:
 with os.fdopen(fd,'w') as f: f.write(v+'\n'); f.flush(); os.fsync(f.fileno())
 os.replace(t,p)
 d=os.open(os.path.dirname(p),os.O_DIRECTORY); os.fsync(d); os.close(d)
finally:
 if os.path.exists(t): os.unlink(t)
PY
}
phase() { atomic_write "$TXN/phase" "$1"; }
link_to() {
  python3 - "$1" "$2" <<'PY'
import os,sys,tempfile
live,target=sys.argv[1:]; tmp=tempfile.mkdtemp(prefix='.wici-link-',dir=os.path.dirname(live)); link=tmp+'/link'
try:
 os.symlink(target,link); os.replace(link,live)
 fd=os.open(os.path.dirname(live),os.O_DIRECTORY); os.fsync(fd); os.close(fd)
finally:
 if os.path.islink(link):os.unlink(link)
 os.rmdir(tmp)
PY
}
health() {
  local url=$1 expected=${2:-} worker=${3:-} body deadline=$((SECONDS+READY_SECONDS))
  while (( SECONDS < deadline )); do
    if body=$(curl --silent --show-error --fail --connect-timeout 2 --max-time 3 "$url/health" 2>/dev/null); then
      if HEALTH_JSON="$body" node - "$expected" "$worker" <<'JS'
try { const j=JSON.parse(process.env.HEALTH_JSON); if(!j.status || (process.argv[2] && j.release!==process.argv[2]) || (process.argv[3] && String(j.workers)!==process.argv[3])) process.exit(1); } catch { process.exit(1); }
JS
      then return 0; fi
    fi
    sleep 1
  done
  return 1
}
remove_owned_process() {
  local name=$1
  pm2 jlist > "$TXN/process-check.json" || return 1
  python3 - "$TXN/process-check.json" "$name" "$RELEASE/backend" "${2:-}" "$TXN/previous-backend.json" <<'PY'
import json,sys
rows=[p for p in json.load(open(sys.argv[1])) if p.get('name')==sys.argv[2]]
assert len(rows)<=1
if rows and rows[0]['pm2_env']['pm_cwd']!=sys.argv[3]:
 if sys.argv[4]=='allow-previous':
  previous=json.load(open(sys.argv[5]))['apps'][0]; actual=rows[0]['pm2_env']
  assert actual['pm_cwd']==previous['cwd'] and actual['pm_exec_path']==previous['script'], 'Foreign PM2 process: cleanup refused'
  sys.exit(2)
 raise AssertionError('Foreign PM2 process: cleanup refused')
PY
  local ownership=$?
  if [[ $ownership == 2 && ${2:-} == allow-previous ]]; then rm -f "$TXN/process-check.json"; return 0; fi
  [[ $ownership == 0 ]] || return 1
  if python3 - "$TXN/process-check.json" "$name" <<'PY'
import json,sys
sys.exit(0 if any(p.get('name')==sys.argv[2] for p in json.load(open(sys.argv[1]))) else 1)
PY
  then pm2 delete "$name" >/dev/null || return 1; fi
  rm -f "$TXN/process-check.json"
}
restore_path() {
  local live=$1 old=$2 backup=$3 original_id=$4
  if [[ -d "$backup" && ! -L "$backup" ]]; then
    [[ ! -e "$live" || -L "$live" ]] || return 1
    rm -f "$live"; mv "$backup" "$live"
  elif [[ -n "$old" ]]; then
    [[ ! -e "$live" || -L "$live" ]] || return 1
    link_to "$live" "$old"
  else
    if [[ -d "$live" && ! -L "$live" && $(stat -Lc '%d:%i' "$live") == "$original_id" ]]; then return 0; fi
    [[ ! -e "$live" || -L "$live" ]] || return 1
    rm -f "$live"
  fi
}
rollback() (
  # Never stop midway through recovery because one restoration command failed.
  set +e; trap - ERR INT TERM EXIT
  local failed=0 changed
  changed=$(cat "$TXN/phase")
  remove_owned_process "$CANDIDATE" || failed=1
  if [[ "$changed" != PREPARED ]]; then
    if [[ "$OLD_ACTIVE" == purchase-backend ]]; then
      remove_owned_process purchase-backend allow-previous || failed=1
    else
      remove_owned_process purchase-backend || failed=1
    fi
    restore_path "$BACKEND_LIVE" "$OLD_BACKEND" "$TXN/legacy-backend" "$OLD_BACKEND_ID" || failed=1
    restore_path "$FRONTEND_LIVE" "$OLD_FRONTEND" "$TXN/legacy-frontend" "$OLD_FRONTEND_ID" || failed=1
    if [[ "$OLD_PORT" == 5051 ]]; then
      sudo -n /usr/local/sbin/wici-nginx-control recovery || failed=1
    else
      sudo -n /usr/local/sbin/wici-nginx-control production || failed=1
    fi
    # Restart only the original application; never resurrect unrelated PM2 processes.
    if [[ "$OLD_ACTIVE" == wici-recovery ]]; then
      pm2 restart wici-recovery >/dev/null || failed=1
    elif [[ "$OLD_ACTIVE" == purchase-backend ]]; then
      pm2 start "$TXN/previous-backend.json" >/dev/null || failed=1
    fi
    sudo -n nginx -t && sudo -n systemctl reload nginx || failed=1
    health "http://127.0.0.1:$OLD_PORT" || failed=1
    # Recovery may predate /api/health: verify its real API authorization boundary.
    [[ $(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 "$PUBLIC_URL/api/auth/me") == 401 ]] || failed=1
  fi
  if (( failed )); then
    echo "ROLLBACK INCOMPLETE. Keep deployment blocked; inspect $TXN. Recovery service was not deleted." >&2
    return 1
  fi
  pm2 save >/dev/null || return 1
  phase ROLLED_BACK || return 1
  rm -f "$STATE/pending"
  echo "Rollback verified; previous service restored. Journal: $TXN"
)
if [[ ${1:-} == --rollback ]]; then
  POINTER="$STATE/pending"; [[ -f "$POINTER" ]] || POINTER="$STATE/latest"
  [[ -f "$POINTER" ]] || { echo 'No recorded deployment to roll back' >&2; exit 2; }
  TXN=$(cat "$POINTER")
  [[ "$TXN" == "$STATE/"* && -f "$TXN/meta" ]] || exit 2
  source "$TXN/meta"
  [[ $(cat "$TXN/phase") != ROLLED_BACK ]] || { [[ ! -f "$STATE/pending" ]] || rm "$STATE/pending"; echo 'Already rolled back'; exit 0; }
  rollback; exit $?
fi
[[ ! -e "$STATE/pending" ]] || { echo 'Interrupted deployment: run deploy.sh --rollback before retrying' >&2; exit 2; }
sudo -n nginx -t
TXN=$(mktemp -d "$STATE/attempt-XXXXXXXX"); RELEASE="$ROOT/releases/$(basename "$TXN")"
mkdir "$RELEASE"
CANDIDATE="wici-probe-$(basename "$TXN")"
# Capture PM2 definitions privately: they can contain credentials; never print them.
pm2 jlist > "$TXN/pm2.private.json"
python3 - "$TXN" "$BACKEND_LIVE" "$FRONTEND_LIVE" <<'PY'
import json,os,sys
p,backend,frontend=sys.argv[1:]; rows=json.load(open(p+'/pm2.private.json'))
active=[r for r in rows if r.get('name') in ['purchase-backend','wici-recovery'] and r['pm2_env']['status']=='online']
assert len(active)==1, 'Exactly one known application must be online before deployment'
assert not any(r.get('name','').startswith('wici-probe-') for r in rows), 'Stale candidate requires reviewed cleanup'
recovery=[r for r in rows if r.get('name')=='wici-recovery']
for r in recovery:
 cwd=os.path.realpath(r['pm2_env']['pm_cwd'])
 assert not any(os.path.commonpath([cwd,os.path.realpath(x)])==os.path.realpath(x) for x in [backend,frontend]), 'Recovery cwd overlaps a replaced path'
r=active[0]; e=r['pm2_env']; name=r['name']
json.dump({'name':name,'port':5051 if name=='wici-recovery' else 5000},open(p+'/original-service.json','w'))
if name=='purchase-backend':
 json.dump({'apps':[{'name':name,'script':e['pm_exec_path'],'args':e.get('args',[]),'cwd':e['pm_cwd'],'interpreter':e.get('exec_interpreter','node'),'exec_mode':'fork','instances':1,'env':e.get('env',{})}]},open(p+'/previous-backend.json','w'))
os.unlink(p+'/pm2.private.json')
PY
OLD_ACTIVE=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["name"])' "$TXN/original-service.json")
OLD_PORT=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["port"])' "$TXN/original-service.json")
OLD_BACKEND=''; OLD_FRONTEND=''
OLD_BACKEND_ID=$(stat -Lc '%d:%i' "$BACKEND_LIVE"); OLD_FRONTEND_ID=$(stat -Lc '%d:%i' "$FRONTEND_LIVE")
[[ ! -L "$BACKEND_LIVE" ]] || OLD_BACKEND=$(readlink -f "$BACKEND_LIVE")
[[ ! -L "$FRONTEND_LIVE" ]] || OLD_FRONTEND=$(readlink -f "$FRONTEND_LIVE")
# A real directory is preserved by rename during cutover, never erased/reset.
for live in "$BACKEND_LIVE" "$FRONTEND_LIVE"; do [[ -d "$live" ]] || { echo "Existing deployment path required: $live" >&2; exit 2; }; done
fetch_commit() {
  local name=$1 url=$2 branch=$3 cache="$ROOT/repo-cache/$1.git"
  git check-ref-format "refs/heads/$branch" >/dev/null
  [[ -d "$cache" ]] || git init --bare --quiet "$cache"
  git -C "$cache" fetch --quiet --no-tags "$url" "refs/heads/$branch"
  git -C "$cache" rev-parse --verify 'FETCH_HEAD^{commit}'
}
SOURCE_SHA=$(fetch_commit combined "$COMBINED_REPO" "$COMBINED_BRANCH")
BACKEND_SHA=$(fetch_commit backend "$BACKEND_REPO" "$BACKEND_BRANCH")
FRONTEND_SHA=$(fetch_commit frontend "$FRONTEND_REPO" "$FRONTEND_BRANCH")
# Bind both standalone roots to one immutable combined commit, not mutable branch names.
for component in backend frontend; do
  if [[ $component == backend ]]; then sha=$BACKEND_SHA; else sha=$FRONTEND_SHA; fi
  expected=$(git -C "$ROOT/repo-cache/combined.git" rev-parse "$SOURCE_SHA:purchase-$component")
  actual=$(git -C "$ROOT/repo-cache/$component.git" rev-parse "$sha^{tree}")
  [[ "$expected" == "$actual" ]] || { echo "$component tree differs from combined master; preserve/reconcile destination work before deploying" >&2; exit 2; }
  if git -C "$ROOT/repo-cache/$component.git" ls-tree -r --name-only "$sha" | grep -Eq '(^|/)\.env$'; then echo 'Tracked environment file forbidden' >&2; exit 2; fi
  mkdir "$RELEASE/$component"
  git -C "$ROOT/repo-cache/$component.git" archive "$sha" | tar -xf - -C "$RELEASE/$component"
done
install -m 600 "$BACKEND_ENV" "$RELEASE/backend/.env"
# Retain the old physical upload store across symlink switching. Never delete its files.
if [[ -n ${SHARED_UPLOADS:-} ]]; then
  [[ "$SHARED_UPLOADS" == /* && -d "$SHARED_UPLOADS" && "$SHARED_UPLOADS" != "$BACKEND_LIVE"/* ]] || exit 2
  UPLOADS_AFTER=$SHARED_UPLOADS; UPLOADS_BEFORE=$SHARED_UPLOADS
elif [[ -n "$OLD_BACKEND" ]]; then
  UPLOADS_AFTER="$OLD_BACKEND/uploads"; UPLOADS_BEFORE=$UPLOADS_AFTER
else
  UPLOADS_AFTER="$TXN/legacy-backend/uploads"; UPLOADS_BEFORE="$BACKEND_LIVE/uploads"
fi
[[ -d "$UPLOADS_BEFORE" && ! -e "$RELEASE/backend/uploads" ]] || { echo 'Confirm the existing upload directory in configuration' >&2; exit 2; }
ln -s "$UPLOADS_BEFORE" "$RELEASE/backend/uploads"
(cd "$RELEASE/backend"; npm ci --ignore-scripts; node --check app.js)
(cd "$RELEASE/frontend"; npm ci --ignore-scripts; CI=true REACT_APP_API_BASE_URL=/api npm run build)
# Reuse the merged credential scanner from the exact paired source commit.
git -C "$ROOT/repo-cache/combined.git" show "$SOURCE_SHA:scripts/devops/security.cjs" > "$TXN/frontend-security.cjs"
node - "$TXN/frontend-security.cjs" "$RELEASE/frontend/build" <<'JS'
const result=require(process.argv[2]).build(process.argv[3]);
if(result.status!=='PASSED'){console.error('Frontend credential scan blocked deployment',result.findings);process.exit(1);}
JS
# Only the static build is public-readable. Private journals/env/PM2 snapshots stay 0700/0600.
chmod 755 "$ROOT/releases" "$RELEASE" "$RELEASE/frontend"
find "$RELEASE/frontend/build" -type d -exec chmod 755 {} +
find "$RELEASE/frontend/build" -type f -exec chmod 644 {} +
python3 - "$RELEASE/frontend/build/release.json" "$SOURCE_SHA" <<'PY'
import json,sys
json.dump({'release':sys.argv[2]},open(sys.argv[1],'w'))
PY
chmod 644 "$RELEASE/frontend/build/release.json"
sudo -n /usr/local/sbin/wici-nginx-control read > "$TXN/nginx.before"
# Validate the actual existing integration; do not replace an entire server block blindly.
sudo -n /usr/local/sbin/wici-nginx-control read > "$TXN/nginx.input"
python3 - "$TXN" "$FRONTEND_LIVE" "$OLD_PORT" <<'PY'
import pathlib,re,sys
p=pathlib.Path(sys.argv[1]); s=(p/'nginx.input').read_text()
assert re.search(r'\broot\s+'+re.escape(sys.argv[2])+r'/?\s*;',s), 'Unexpected frontend root; configure/review the real site first'
pattern=r'(\bproxy_pass\s+http://127\.0\.0\.1:)'+sys.argv[3]+r'(?=[/;])'
s,n=re.subn(pattern,lambda m:m[1]+'5000',s)
assert n==1, 'Expected exactly one known application proxy_pass'
(p/'nginx.after').write_text(s)
PY
{
  for key in ROOT BACKEND_LIVE FRONTEND_LIVE STATE TXN RELEASE CANDIDATE NGINX_SITE OLD_BACKEND OLD_FRONTEND OLD_BACKEND_ID OLD_FRONTEND_ID OLD_ACTIVE OLD_PORT PUBLIC_URL READY_SECONDS SOURCE_SHA BACKEND_SHA FRONTEND_SHA; do printf '%s=%q\n' "$key" "${!key}"; done
} > "$TXN/meta"
phase PREPARED
atomic_write "$STATE/pending" "$TXN"
failed() {
  local code=$?; trap - ERR INT TERM EXIT
  (( code != 0 )) || code=1
  echo "Deployment interrupted/failed; attempting recorded rollback. Journal: $TXN" >&2
  rollback || echo 'URGENT: rollback incomplete; operator intervention required' >&2
  exit "${code:-1}"
}
trap failed ERR INT TERM
# Preflight candidate has no RFID, scheduling, reminders or outbox worker execution.
NODE_ENV=production HOST=127.0.0.1 PORT="$CANDIDATE_PORT" APP_RELEASE_REF="$SOURCE_SHA" DB_RELEASE_ENVIRONMENT=production RUNTIME_BACKGROUND_WORKERS_ENABLED=false \
  pm2 start "$RELEASE/backend/app.js" --cwd "$RELEASE/backend" --name "$CANDIDATE" --interpreter "$(command -v node)" --no-autorestart --kill-timeout 15000 >/dev/null
health "http://127.0.0.1:$CANDIDATE_PORT" "$SOURCE_SHA" false
[[ $(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 "http://127.0.0.1:$CANDIDATE_PORT/api/auth/me") == 401 ]]
remove_owned_process "$CANDIDATE"
# Checkpoint precedes stopping the known previous service. Never overlap workers.
phase CUTOVER_STARTED
pm2 stop "$OLD_ACTIVE" >/dev/null
if [[ "$OLD_ACTIVE" == purchase-backend ]]; then pm2 delete purchase-backend >/dev/null; fi
if [[ ! -L "$BACKEND_LIVE" ]]; then mv "$BACKEND_LIVE" "$TXN/legacy-backend"; fi
if [[ ! -L "$FRONTEND_LIVE" ]]; then mv "$FRONTEND_LIVE" "$TXN/legacy-frontend"; fi
rm "$RELEASE/backend/uploads"; ln -s "$UPLOADS_AFTER" "$RELEASE/backend/uploads"
link_to "$BACKEND_LIVE" "$RELEASE/backend"
link_to "$FRONTEND_LIVE" "$RELEASE/frontend/build"
NODE_ENV=production HOST=127.0.0.1 PORT=5000 APP_RELEASE_REF="$SOURCE_SHA" DB_RELEASE_ENVIRONMENT=production RUNTIME_BACKGROUND_WORKERS_ENABLED=true \
  pm2 start "$RELEASE/backend/app.js" --cwd "$RELEASE/backend" --name purchase-backend --interpreter "$(command -v node)" --exp-backoff-restart-delay 1000 --max-restarts 10 --min-uptime 10000 --kill-timeout 15000 >/dev/null
health http://127.0.0.1:5000 "$SOURCE_SHA" true
sudo -n /usr/local/sbin/wici-nginx-control production
sudo -n nginx -t
sudo -n systemctl reload nginx
health "$PUBLIC_URL/api" "$SOURCE_SHA" true
marker=$(curl --silent --show-error --fail --max-time 10 "$PUBLIC_URL/release.json")
MARKER="$marker" node -e 'if(JSON.parse(process.env.MARKER).release!==process.argv[1])process.exit(1)' "$SOURCE_SHA"
[[ $(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 "$PUBLIC_URL/api/auth/me") == 401 ]]
pm2 save >/dev/null
atomic_write "$STATE/latest" "$TXN"
phase SUCCEEDED
rm "$STATE/pending"
trap - ERR INT TERM
printf 'Deployment healthy. Combined=%s backend=%s frontend=%s\nRollback: %s --rollback\nJournal: %s\n' "$SOURCE_SHA" "$BACKEND_SHA" "$FRONTEND_SHA" "$0" "$TXN"
