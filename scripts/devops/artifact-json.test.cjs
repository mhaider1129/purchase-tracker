"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { createHash } = require("node:crypto"),
  { deflateRawSync } = require("node:zlib"),
  { parse } = require("./artifact-json.cjs");
function archive(
  name = "schema.json",
  value = { testedCommit: "synthetic" },
  method = 8,
) {
  const n = Buffer.from(name),
    b = Buffer.from(JSON.stringify(value)),
    data = method === 8 ? deflateRawSync(b) : b;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(b.length, 22);
  local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(b.length, 24);
  central.writeUInt16LE(n.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + n.length, 12);
  end.writeUInt32LE(local.length + n.length + data.length, 16);
  const bytes = Buffer.concat([local, n, data, central, n, end]);
  return {
    bytes,
    digest: "sha256:" + createHash("sha256").update(bytes).digest("hex"),
  };
}
for (const method of [0, 8])
  test("authenticated single JSON archive method " + method, () => {
    const a = archive("schema.json", { ok: true }, method);
    assert.deepEqual(parse(a.bytes, a.digest, "schema.json"), { ok: true });
  });
test("tampering, wrong filename, traversal, compression and ambiguous entry counts fail closed", () => {
  const a = archive();
  assert.throws(() =>
    parse(a.bytes, "sha256:" + "0".repeat(64), "schema.json"),
  );
  assert.throws(() => parse(a.bytes, a.digest, "events.json"));
  for (const [name, method] of [
    ["../schema.json", 8],
    ["schema.json", 99],
  ]) {
    const b = archive(name, {}, method);
    assert.throws(() => parse(b.bytes, b.digest, "schema.json"));
  }
  const b = archive();
  b.bytes.writeUInt16LE(2, b.bytes.length - 12);
  b.digest = "sha256:" + createHash("sha256").update(b.bytes).digest("hex");
  assert.throws(() => parse(b.bytes, b.digest, "schema.json"));
});
