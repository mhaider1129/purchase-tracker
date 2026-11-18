"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const {
  names,
  resourceIdentity,
  labels,
  assertOwned,
  cleanupOwned,
} = require("./runtime.cjs");
const config = { instance: "a".repeat(24) };
const release = {
  commit: "f".repeat(40),
  request: { runId: "12345678901234", attempt: 1 },
  images: {
    backend: "sha256:" + "a".repeat(64),
    frontend: "sha256:" + "b".repeat(64),
  },
};
test("legacy valid instance creates an overlong DNS label; every corrected name is DNS-safe", () => {
  assert(`scop-review-12345678-${release.commit}-fe`.length > 63);
  for (const value of Object.values(names(config, release)))
    assert(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value), value);
});
test("base32 retains every SHA256 identity bit rather than truncating a prefix", () => {
  const id = resourceIdentity(config, release),
    alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let bits = 0,
    value = 0;
  const bytes = [];
  for (const c of id.dns) {
    value = (value << 5) | alphabet.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 255);
    }
    value &= (1 << bits) - 1;
  }
  assert.equal(Buffer.from(bytes).toString("hex"), id.key);
  assert.equal(id.key.length, 64);
  assert.equal(id.dns.length, 52);
  assert.equal(
    id.key,
    crypto
      .createHash("sha256")
      .update(
        JSON.stringify([
          config.instance,
          release.commit,
          "12345678901234",
          "1",
          release.images.backend,
          release.images.frontend,
        ]),
      )
      .digest("hex"),
  );
});
test("same attempt is stable; full commit tails, different attempts, runs, instances and images change names", () => {
  const original = names(config, release);
  assert.deepEqual(original, names({ ...config }, structuredClone(release)));
  for (const mutate of [
    (r) => r.request.attempt++,
    (r) => (r.request.runId = "12345678901235"),
    (r) => (r.commit = "f".repeat(39) + "e"),
    (r) => (r.images.backend = "sha256:" + "c".repeat(64)),
  ]) {
    const r = structuredClone(release);
    mutate(r);
    assert.notEqual(names(config, r).fe, original.fe);
  }
  assert.notEqual(
    names({ instance: "another-instance" }, release).fe,
    original.fe,
  );
  assert.notEqual(original.fe, original.be);
  assert.notEqual(original.fe, original.network);
});
test("provenance labels retain full SHA, request and full digest; stale or foreign resources are refused", () => {
  const n = names(config, release),
    meta = {
      Name: "/" + n.fe,
      Config: { Labels: labels(config, release) },
      State: { Running: false },
    };
  assert.equal(meta.Config.Labels["wici.scop.commit"], release.commit);
  assertOwned(meta, config, release, n.fe);
  for (const key of Object.keys(meta.Config.Labels)) {
    const copy = structuredClone(meta);
    copy.Config.Labels[key] = "foreign";
    assert.throws(() => assertOwned(copy, config, release, n.fe));
  }
  assert.throws(() =>
    assertOwned({ ...meta, Name: "another" }, config, release, n.fe),
  );
});
test("rollback cleanup preserves retained releases and validates all resources before any deletion", () => {
  const n = names(config, release),
    removed = [];
  const resources = Object.fromEntries(
    [n.fe, n.be, n.network].map((name) => [
      name,
      {
        Name: name,
        Labels: labels(config, release),
        State: { Running: false },
      },
    ]),
  );
  const run = (...args) => {
    if (args.includes("inspect"))
      return JSON.stringify([resources[args.at(-1)]]);
    removed.push(args);
    return "";
  };
  assert.throws(
    () => cleanupOwned(config, release, [release], run),
    /PRESERVED/,
  );
  assert.equal(removed.length, 0);
  resources[n.network].Labels["wici.scop.commit"] = "foreign";
  assert.throws(() => cleanupOwned(config, release, [], run), /FOREIGN/);
  assert.equal(removed.length, 0);
  resources[n.network].Labels = labels(config, release);
  resources[n.be].State.Running = true;
  assert.throws(() => cleanupOwned(config, release, [], run), /RUNNING/);
  assert.equal(removed.length, 0);
  resources[n.be].State.Running = false;
  cleanupOwned(config, release, [], run);
  assert.deepEqual(removed, [
    ["rm", n.fe],
    ["rm", n.be],
    ["network", "rm", n.network],
  ]);
});
test("invalid or missing identities cannot reach Docker service discovery", () => {
  for (const r of [
    { ...release, request: null },
    { ...release, commit: "main" },
    { ...release, images: { backend: "latest" } },
    { ...release, request: { runId: "../x", attempt: 1 } },
  ])
    assert.throws(() => names(config, r));
  assert.throws(() => names({ instance: "invalid.name" }, release));
});
