export const REQUEST_MODE_STATUS = Object.freeze({
  generic_item: "catalogued",
  generic_item_with_preference: "catalogued",
  specific_approved_product: "catalogued",
  free_text: "pending_mapping",
  pending_item_creation: "pending_mapping",
  approved_free_text_exception: "approved_exception",
  service: "approved_exception",
});

export function withRequestItemIdentity(item) {
  const mode = item.request_mode || "free_text";
  return {
    ...item,
    request_mode: mode,
    catalog_status: REQUEST_MODE_STATUS[mode],
    stocking_policy:
      mode === "service" ? "service" : item.stocking_policy || "non_stock",
  };
}

// Existing-line edits carry their stable ID. The server merges the complete
// stored identity, including legacy NULLs, rather than trusting hidden fields.
export function stableRequestItemId(item) {
  return { id: item.id ?? item.item_id };
}
