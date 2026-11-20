"""Only the exact staging capsule members; no links, traversal or eager reads."""
import pathlib,sys,zipfile,stat,tarfile,json,gzip
archive,output=sys.argv[1:]
root=pathlib.Path(output);root.mkdir(mode=0o700,exist_ok=False)
with zipfile.ZipFile(archive) as z:
 entries=z.infolist()
 if len(entries) not in (1,2) or len({e.filename for e in entries})!=len(entries) or {e.filename for e in entries} not in ({'capsule.json'},{'capsule.json','images.tar.gz'}) or sum(e.file_size for e in entries)>1024**3:raise ValueError('CAPSULE_MEMBERS_INVALID')
 for e in entries:
  if stat.S_ISLNK(e.external_attr>>16) or e.is_dir():raise ValueError('CAPSULE_LINK_REJECTED')
  if e.filename=='capsule.json' and e.file_size>1024**2:raise ValueError('CAPSULE_METADATA_LIMIT')
  with z.open(e) as src,(root/e.filename).open('xb') as dst:
   while data:=src.read(65536):dst.write(data)
m=json.loads((root/'capsule.json').read_text())
if len(entries)==1:
 if m.get('kind')!='wici-staging-request' or m.get('operation') not in ('rollback','recover'):raise ValueError('INVALID_NO_IMAGE_REQUEST')
 sys.exit(0)
# Inspect Docker-save metadata before docker load can alter local tags. OCI
# config digests are checked again by Docker; only instance-independent staging
# capsule tags are permitted. No archive member is extracted to the host.
seen=set();manifest=None;size=0
with tarfile.open(root/'images.tar.gz','r|gz') as t:
 for e in t:
  p=pathlib.PurePosixPath(e.name)
  if p.is_absolute() or '..' in p.parts or e.issym() or e.islnk() or not (e.isfile() or e.isdir()) or e.name in seen:raise ValueError('IMAGE_TAR_PATH_REJECTED')
  seen.add(e.name);size+=e.size
  if len(seen)>50000 or size>3*1024**3:raise ValueError('IMAGE_TAR_LIMIT')
  if e.name=='manifest.json':
   if e.size>1024**2:raise ValueError('IMAGE_MANIFEST_LIMIT')
   manifest=json.load(t.extractfile(e))
if not manifest or len(manifest)!=2:raise ValueError('TWO_RUNTIME_IMAGES_REQUIRED')
tags=set()
for e in manifest:
 if not e.get('RepoTags') or any(tag not in ['scop-capsule-backend:'+m['commit'],'scop-capsule-frontend:'+m['commit']] for tag in e['RepoTags']):raise ValueError('UNEXPECTED_IMAGE_TAG')
 for tag in e['RepoTags']:
  if tag in tags:raise ValueError('DUPLICATE_IMAGE_TAG')
  tags.add(tag)
  role='backend' if tag.startswith('scop-capsule-backend:') else 'frontend'
  config=pathlib.PurePosixPath(e['Config']).name.removesuffix('.json')
  if 'sha256:'+config!=m['images'][role]:raise ValueError('IMAGE_CONFIG_ID_MISMATCH')
if len(tags)!=2:raise ValueError('MISSING_IMAGE_TAG')
