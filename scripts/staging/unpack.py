"""Bounded authenticated artifact extraction; input ZIP digest checked by caller."""
import pathlib
import stat
import sys
import zipfile

archive, output = sys.argv[1:]
root = pathlib.Path(output)
root.mkdir(mode=0o700, exist_ok=False)
with zipfile.ZipFile(archive) as z:
    entries = z.infolist()
    if len(entries) > 10000 or sum(e.file_size for e in entries) > 256 * 1024 * 1024:
        raise ValueError("ARTIFACT_LIMIT")
    names = set()
    for e in entries:
        p = pathlib.PurePosixPath(e.filename)
        if (e.filename in names or not e.filename or "\\" in e.filename
                or p.is_absolute() or any(x in ("..", ".") for x in e.filename.rstrip("/").split("/"))
                or ":" in e.filename or stat.S_ISLNK(e.external_attr >> 16)
                or any(ord(c) < 32 for c in e.filename)):
            raise ValueError("UNSAFE_ARTIFACT_PATH")
        names.add(e.filename)
    for e in entries:
        dest = root / e.filename
        if e.is_dir():
            dest.mkdir(parents=True, exist_ok=True)
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            with dest.open("xb") as f:
                f.write(z.read(e))
