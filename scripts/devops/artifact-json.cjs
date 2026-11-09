"use strict";
const { execFileSync } = require("node:child_process"),
  { createHash } = require("node:crypto"),
  { inflateRawSync } = require("node:zlib");
// gh authenticates only to GitHub and follows its signed artifact redirect.
// Verify the archive digest from authenticated API metadata BEFORE parsing.
function parse(bytes, digest, expected) {
  if (
    bytes.length > 16 * 1024 * 1024 ||
    "sha256:" + createHash("sha256").update(bytes).digest("hex") !== digest
  )
    throw Error("ARTIFACT_ARCHIVE_DIGEST_MISMATCH");
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  if (
    end < 0 ||
    bytes.readUInt16LE(end + 4) !== 0 ||
    bytes.readUInt16LE(end + 6) !== 0 ||
    bytes.readUInt16LE(end + 10) !== 1 ||
    end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length
  )
    throw Error("AMBIGUOUS_ARTIFACT_ARCHIVE");
  const c = bytes.readUInt32LE(end + 16);
  if (bytes.readUInt32LE(c) !== 0x02014b50)
    throw Error("INVALID_ARTIFACT_DIRECTORY");
  const flags = bytes.readUInt16LE(c + 8),
    method = bytes.readUInt16LE(c + 10),
    compressed = bytes.readUInt32LE(c + 20),
    size = bytes.readUInt32LE(c + 24),
    nameLen = bytes.readUInt16LE(c + 28),
    local = bytes.readUInt32LE(c + 42);
  const name = bytes.subarray(c + 46, c + 46 + nameLen).toString("utf8");
  if (
    name !== expected ||
    flags & 1 ||
    ![0, 8].includes(method) ||
    size > 1024 * 1024 ||
    ((bytes.readUInt32LE(c + 38) >>> 16) & 0xf000) === 0xa000 ||
    bytes.readUInt32LE(local) !== 0x04034b50
  )
    throw Error("UNSAFE_ARTIFACT_ENTRY");
  const offset =
    local +
    30 +
    bytes.readUInt16LE(local + 26) +
    bytes.readUInt16LE(local + 28);
  if (offset + compressed > c) throw Error("INVALID_ARTIFACT_BOUNDS");
  const payload = bytes.subarray(offset, offset + compressed),
    data =
      method === 8
        ? inflateRawSync(payload, { maxOutputLength: 1024 * 1024 })
        : payload;
  if (data.length !== size) throw Error("INVALID_ARTIFACT_SIZE");
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
}
function read(a, expected) {
  if (!Number.isSafeInteger(a.id) || a.id < 1)
    throw Error("INVALID_ARTIFACT_ID");
  let bytes;
  try {
    bytes = execFileSync(
      "gh",
      [
        "api",
        `repos/mhaider1129/purchase-tracker/actions/artifacts/${a.id}/zip`,
      ],
      {
        maxBuffer: 16 * 1024 * 1024,
        timeout: 30000,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (_) {
    throw Error("AUTHENTICATED_ARTIFACT_DOWNLOAD_FAILED");
  }
  return parse(bytes, a.digest, expected);
}
module.exports = { parse, read };
