"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(
  path.join(root, "deploy/manual/deploy.sh"),
  "utf8",
);
const git = (dir, ...args) =>
  execFileSync("git", ["-C", dir, ...args], {
    stdio: "pipe",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "fixture",
      GIT_AUTHOR_EMAIL: "fixture@example.invalid",
      GIT_COMMITTER_NAME: "fixture",
      GIT_COMMITTER_EMAIL: "fixture@example.invalid",
    },
  })
    .toString()
    .trim();
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wici-manual-"));
  const live = path.join(dir, "live"),
    bin = path.join(dir, "bin");
  for (const d of [
    "backend/uploads",
    "backend/node_modules",
    "backend_release",
    "frontend_repo",
    "frontend_build",
    "recovery",
  ])
    fs.mkdirSync(path.join(live, d), { recursive: true });
  fs.writeFileSync(
    path.join(live, "backend/node_modules/recovery-dependency"),
    "original dependency",
  );
  fs.symlinkSync(
    path.join(live, "backend/.env"),
    path.join(live, "recovery/.env"),
  );
  fs.symlinkSync(
    path.join(live, "backend/node_modules"),
    path.join(live, "recovery/node_modules"),
  );
  fs.writeFileSync(
    path.join(live, "frontend_repo/keep.txt"),
    "original frontend repository",
  );
  fs.mkdirSync(bin);
  fs.mkdirSync(path.join(dir, "nginx"));
  fs.writeFileSync(
    path.join(live, "backend/.env"),
    "SYNTHETIC_CONFIGURATION_ONLY=1\n",
  );
  fs.writeFileSync(
    path.join(live, "backend/uploads/preserved.txt"),
    "original upload",
  );
  fs.writeFileSync(
    path.join(live, "frontend_build/index.html"),
    "previous frontend",
  );
  const nginx = path.join(dir, "nginx/site");
  fs.writeFileSync(
    nginx,
    `server { root ${live}/frontend_build; location /api/ { proxy_pass http://127.0.0.1:5051/api/; } }\n`,
  );
  const repos = {};
  for (const name of ["combined", "backend", "frontend"]) {
    const p = path.join(dir, name);
    fs.mkdirSync(p);
    git(p, "init", "-b", name === "combined" ? "master" : "main");
    repos[name] = p;
  }
  const backend = {
    "app.js": "// fixture only\n",
    "package.json": '{"private":true}\n',
  };
  const frontend = {
    "index.txt": "fixture frontend\n",
    "package.json": '{"private":true}\n',
  };
  for (const [name, files] of Object.entries({ backend, frontend }))
    for (const [file, bytes] of Object.entries(files)) {
      fs.writeFileSync(path.join(repos[name], file), bytes);
      const dst = path.join(repos.combined, "purchase-" + name);
      fs.mkdirSync(dst, { recursive: true });
      fs.writeFileSync(path.join(dst, file), bytes);
    }
  fs.mkdirSync(path.join(repos.combined, "scripts/devops"), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(root, "scripts/devops/security.cjs"),
    path.join(repos.combined, "scripts/devops/security.cjs"),
  );
  for (const p of Object.values(repos)) {
    git(p, "add", ".");
    git(p, "commit", "-m", "fixture");
  }
  const config = path.join(dir, "config");
  fs.writeFileSync(
    config,
    `ROOT='${live}'\nNGINX_SITE='${nginx}'\nBACKEND_ENV='${live}/backend/.env'\nPUBLIC_URL=https://fixture.invalid\nBACKEND_REPO='${repos.backend}'\nFRONTEND_REPO='${repos.frontend}'\nCOMBINED_REPO='${repos.combined}'\nREADY_SECONDS=1\n`,
  );
  fs.chmodSync(config, 0o600);
  const state = path.join(dir, "pm2.json");
  fs.writeFileSync(
    state,
    JSON.stringify([
      {
        name: "wici-recovery",
        pm2_env: {
          status: "online",
          pm_cwd: live + "/recovery",
          pm_exec_path: live + "/recovery/app.js",
          env: { PORT: "5051", RUNTIME_BACKGROUND_WORKERS_ENABLED: "true" },
        },
      },
    ]),
  );
  const driver = path.join(dir, "driver.py");
  fs.writeFileSync(
    driver,
    `#!/usr/bin/env python3
import json,os,sys,pathlib,subprocess,re,signal
name=pathlib.Path(sys.argv[0]).name; args=sys.argv[1:]; d=pathlib.Path(os.environ['FIXTURE']); state=d/'pm2.json'; rows=json.loads(state.read_text())
with open(d/'commands.log','a') as f: f.write(name+' '+(' '.join(args) if name!='pm2' or 'jlist' not in args else 'jlist')+'\\n')
if name=='npm':
 if args==['run','build']:
  if os.getenv('FAIL_BUILD'): sys.exit(8)
  pathlib.Path('build').mkdir();pathlib.Path('build/index.html').write_text('new frontend')
 sys.exit(0)
if name=='sudo':
 assert args.pop(0)=='-n'
 if args[0]=='cp':
  assert str(d) in args[-1] or str(d) in args[-2]
  sys.exit(subprocess.call(['/bin/cp']+args[1:]))
 if args[0]=='cat': sys.stdout.write(pathlib.Path(args[1]).read_text());sys.exit(0)
 if args[0]=='nginx' and '-T' in args:
  print('# configuration file '+str(d/'nginx/site')+':');print((d/'nginx/site').read_text());sys.exit(0)
 assert args[0] in ['nginx','systemctl'];sys.exit(0)
if name=='pm2':
 op=args[0]
 if op=='jlist': print(json.dumps(rows));sys.exit(0)
 if op=='start':
  if args[1].endswith('.json'):
   for a in json.load(open(args[1]))['apps']:
    rows=[r for r in rows if r['name']!=a['name']];rows.append({'name':a['name'],'pm2_env':{'status':'online','pm_cwd':a['cwd'],'pm_exec_path':a['script'],'env':a['env']}})
  else:
   n=args[args.index('--name')+1];cwd=args[args.index('--cwd')+1]
   env={k:os.environ[k] for k in ['PORT','APP_RELEASE_REF','RUNTIME_BACKGROUND_WORKERS_ENABLED']}
   rows.append({'name':n,'pm2_env':{'status':'online','pm_cwd':cwd,'pm_exec_path':args[1],'env':env}})
 elif op in ['stop','restart']:
  for r in rows:
   if r['name']==args[1]:r['pm2_env']['status']='stopped' if op=='stop' else 'online'
 elif op=='delete':rows=[r for r in rows if r['name']!=args[1]]
 elif op!='save':raise Exception('Unsupported PM2 operation')
 active=[r for r in rows if r['pm2_env']['status']=='online' and r['pm2_env'].get('env',{}).get('RUNTIME_BACKGROUND_WORKERS_ENABLED')!='false']
 assert len(active)<=1,'Overlapping workers'
 state.write_text(json.dumps(rows))
 if op=='start' and '--name' in args and args[args.index('--name')+1]=='purchase-backend' and os.getenv('CRASH_AFTER_START'):
  cmd=pathlib.Path('/proc/'+str(os.getppid())+'/cmdline').read_bytes();assert str(d).encode() in cmd
  os.kill(os.getppid(),signal.SIGKILL)
 sys.exit(0)
if name=='curl':
 url=next(a for a in args if a.startswith('http'));public=url.startswith('https://fixture.invalid')
 assert public or url.startswith('http://127.0.0.1:'),'No real network allowed'
 port=int(re.search(r'127.0.0.1:(\\d+)',(d/'nginx/site').read_text()).group(1)) if public else int(re.search(r':(\\d+)',url).group(1))
 active=next((r for r in rows if r['pm2_env']['status']=='online' and int(r['pm2_env']['env']['PORT'])==port),None)
 if os.getenv('FOREIGN_CANDIDATE') and port==5001:
  for r in rows:
   if r['name'].startswith('wici-probe-'):r['pm2_env']['pm_cwd']='/foreign-owned'
  state.write_text(json.dumps(rows));sys.exit(22)
 if (os.getenv('FAIL_CANDIDATE') and port==5001) or (os.getenv('FAIL_PROXY') and public and port==5000):sys.exit(22)
 if not active:sys.exit(22)
 if url.endswith('/api/auth/me'):sys.stdout.write('401');sys.exit(0)
 if url.endswith('/release.json'):sys.stdout.write((d/'live/frontend_build/release.json').read_text());sys.exit(0)
 env=active['pm2_env']['env'];print(json.dumps({'status':'OK','release':env.get('APP_RELEASE_REF'),'workers':env.get('RUNTIME_BACKGROUND_WORKERS_ENABLED')!='false'}));sys.exit(0)
raise Exception('Unknown stub '+name)
`,
  );
  fs.chmodSync(driver, 0o700);
  for (const cmd of ["pm2", "npm", "sudo", "curl"])
    fs.symlinkSync(driver, path.join(bin, cmd));
  const script = path.join(dir, "deploy.sh");
  assert(source.includes("== /etc/nginx/*"));
  fs.writeFileSync(
    script,
    source.replace("== /etc/nginx/*", "== " + dir + "/nginx/*"),
  );
  const run = (args = [], extra = {}) =>
    spawnSync("bash", [script, ...args], {
      encoding: "utf8",
      timeout: 60000,
      env: {
        ...process.env,
        PATH: bin + path.delimiter + process.env.PATH,
        WICI_DEPLOY_CONFIG: config,
        FIXTURE: dir,
        ...extra,
      },
    });
  return { dir, live, bin, driver, state, config, nginx, repos, run };
}
function withFixture(fn) {
  const f = fixture();
  try {
    fn(f);
  } finally {
    assert.equal(
      fs.readFileSync(
        path.join(f.live, "backend/node_modules/recovery-dependency"),
        "utf8",
      ),
      "original dependency",
    );
    assert.equal(
      fs.realpathSync(path.join(f.live, "recovery/.env")),
      path.join(f.live, "backend/.env"),
    );
    assert.equal(
      fs.realpathSync(path.join(f.live, "recovery/node_modules")),
      path.join(f.live, "backend/node_modules"),
    );
    assert.equal(
      fs.readFileSync(path.join(f.live, "frontend_repo/keep.txt"), "utf8"),
      "original frontend repository",
    );
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
}
function good(r) {
  assert.equal(r.status, 0, r.stdout + "\n" + r.stderr);
}
function oldService(f) {
  const rows = JSON.parse(fs.readFileSync(f.state));
  assert.equal(
    rows.find((r) => r.name === "wici-recovery").pm2_env.status,
    "online",
  );
  assert(
    !rows.some(
      (r) => r.name === "purchase-backend" && r.pm2_env.status === "online",
    ),
  );
  assert.match(fs.readFileSync(f.nginx, "utf8"), /:5051/);
  assert.equal(
    fs.readFileSync(path.join(f.live, "frontend_build/index.html"), "utf8"),
    "previous frontend",
  );
}
test("script is syntactically valid and contains no SSH, SQL execution or database migration commands", () => {
  execFileSync("bash", ["-n", path.join(root, "deploy/manual/deploy.sh")]);
  assert.doesNotMatch(
    source,
    /\b(?:psql|supabase db|db:apply|ssh|terraform|docker)\b/,
  );
  assert.match(source, /RUNTIME_BACKGROUND_WORKERS_ENABLED=false/);
  assert.match(source, /RUNTIME_BACKGROUND_WORKERS_ENABLED=true/);
});
if (process.platform === "linux") {
  test("real shell and local Git: paired repositories deploy, retain recovery and support explicit rollback", () =>
    withFixture((f) => {
      good(f.run());
      const rows = JSON.parse(fs.readFileSync(f.state));
      assert.equal(
        rows.find((r) => r.name === "wici-recovery").pm2_env.status,
        "stopped",
      );
      assert.equal(
        rows.find((r) => r.name === "purchase-backend").pm2_env.env.PORT,
        "5000",
      );
      assert.equal(
        fs.readFileSync(
          path.join(f.live, "backend/uploads/preserved.txt"),
          "utf8",
        ),
        "original upload",
      );
      assert.match(fs.readFileSync(f.nginx, "utf8"), /:5000/);
      good(f.run(["--rollback"]));
      oldService(f);
      good(f.run(["--rollback"]));
    }));
  test("candidate incompatibility leaves recovery and live frontend untouched", () =>
    withFixture((f) => {
      const r = f.run([], { FAIL_CANDIDATE: "true" });
      assert.notEqual(r.status, 0);
      oldService(f);
      assert(!fs.existsSync(path.join(f.live, "deployments/pending")));
    }));
  test("external proxy health failure restores both paths and the original service", () =>
    withFixture((f) => {
      const r = f.run([], { FAIL_PROXY: "true" });
      assert.notEqual(r.status, 0, r.stdout);
      oldService(f);
      assert(!fs.existsSync(path.join(f.live, "deployments/pending")));
    }));
  test("build failure never stops the running application", () =>
    withFixture((f) => {
      assert.notEqual(f.run([], { FAIL_BUILD: "true" }).status, 0);
      oldService(f);
      assert(
        !fs
          .readFileSync(path.join(f.dir, "commands.log"), "utf8")
          .includes("pm2 stop"),
      );
    }));
  test("destination-only changes fail provenance checks without overwrite or cutover", () =>
    withFixture((f) => {
      fs.writeFileSync(
        path.join(f.repos.backend, "recovery-only.txt"),
        "preserve me",
      );
      git(f.repos.backend, "add", ".");
      git(f.repos.backend, "commit", "-m", "independent recovery");
      const r = f.run();
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /tree differs/);
      oldService(f);
      assert.equal(
        fs.readFileSync(
          path.join(f.repos.backend, "recovery-only.txt"),
          "utf8",
        ),
        "preserve me",
      );
    }));
  test("two successful deployments preserve the previous release and rollback its exact PM2 configuration", () =>
    withFixture((f) => {
      good(f.run());
      const first = fs.realpathSync(path.join(f.live, "backend_release"));
      good(f.run());
      assert.notEqual(
        fs.realpathSync(path.join(f.live, "backend_release")),
        first,
      );
      good(f.run(["--rollback"]));
      assert.equal(
        fs.realpathSync(path.join(f.live, "backend_release")),
        first,
      );
      assert.equal(
        JSON.parse(fs.readFileSync(f.state)).find(
          (r) => r.name === "purchase-backend",
        ).pm2_env.status,
        "online",
      );
    }));
  test("SIGKILL after new PM2 start leaves a durable fence; the next deployment cannot overtake recovery", () =>
    withFixture((f) => {
      assert.notEqual(f.run([], { CRASH_AFTER_START: "true" }).status, 0);
      assert(fs.existsSync(path.join(f.live, "deployments/pending")));
      const next = f.run();
      assert.notEqual(next.status, 0);
      assert.match(next.stderr, /Interrupted deployment/);
      good(f.run(["--rollback"]));
      oldService(f);
    }));
  test("active Nginx site is discovered without extra configuration and rollback restores frontend_build", () =>
    withFixture((f) => {
      const c = fs
        .readFileSync(f.config, "utf8")
        .replace(/^NGINX_SITE=.*\n/m, "");
      fs.writeFileSync(f.config, c);
      good(f.run());
      assert(
        fs.lstatSync(path.join(f.live, "frontend_build")).isSymbolicLink(),
      );
      assert.equal(
        fs.statSync(path.join(f.live, "frontend_build/index.html")).mode &
          0o777,
        0o644,
      );
      good(f.run(["--rollback"]));
      oldService(f);
    }));
  test("ambiguous existing proxy configuration fails before stopping recovery", () =>
    withFixture((f) => {
      fs.appendFileSync(
        f.nginx,
        "location /other/ { proxy_pass http://127.0.0.1:5051/; }\n",
      );
      const r = f.run();
      assert.notEqual(r.status, 0);
      oldService(f);
      assert(
        !fs
          .readFileSync(path.join(f.dir, "commands.log"), "utf8")
          .includes("pm2 stop"),
      );
    }));
  test("stale foreign candidate prevents deployment and is never deleted", () =>
    withFixture((f) => {
      const rows = JSON.parse(fs.readFileSync(f.state));
      rows.push({
        name: "wici-probe-foreign",
        pm2_env: { status: "stopped", pm_cwd: "/foreign" },
      });
      fs.writeFileSync(f.state, JSON.stringify(rows));
      assert.notEqual(f.run().status, 0);
      oldService(f);
      assert(
        JSON.parse(fs.readFileSync(f.state)).some(
          (r) => r.name === "wici-probe-foreign",
        ),
      );
    }));
  test("failed ownership check during rollback never deletes a foreign process and retains the recovery fence", () =>
    withFixture((f) => {
      const r = f.run([], { FOREIGN_CANDIDATE: "true" });
      assert.notEqual(r.status, 0);
      oldService(f);
      const candidate = JSON.parse(fs.readFileSync(f.state)).find((r) =>
        r.name.startsWith("wici-probe-"),
      );
      assert(candidate);
      assert.equal(candidate.pm2_env.pm_cwd, "/foreign-owned");
      assert(fs.existsSync(path.join(f.live, "deployments/pending")));
      assert(
        !fs
          .readFileSync(path.join(f.dir, "commands.log"), "utf8")
          .includes("pm2 delete " + candidate.name),
      );
    }));
}
