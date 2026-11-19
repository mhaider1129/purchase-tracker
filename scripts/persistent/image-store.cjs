"use strict";
// Current capsule protocol binds Docker's canonical config IDs. OCI index/
// manifest references require a separately reviewed protocol, not relaxed hashes.
function canonicalStore(info) {
  return (
    !!info &&
    ["overlay2", "vfs"].includes(info.Driver) &&
    (info.DriverStatus == null ||
      (Array.isArray(info.DriverStatus) &&
        !info.DriverStatus.some(
          (row) => !Array.isArray(row) || row[0] === "driver-type",
        )))
  );
}
function requireCanonicalStore(info) {
  if (!canonicalStore(info))
    throw Error("CANONICAL_DOCKER_CONFIG_ID_STORE_REQUIRED");
  return info;
}
module.exports = { canonicalStore, requireCanonicalStore };
