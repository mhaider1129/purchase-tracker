export const AI_TOOL_LABELS = {
  get_request_summary: "Request Details",
  get_pending_approvals: "Pending Approvals",
  get_procurement_cases: "Procurement Cases",
  get_supplier_summary: "Supplier Information",
  get_supply_chain_kpis: "Supply Chain KPIs",
  get_attention_items: "Attention Items",
};

export const getToolLabel = (tool) =>
  AI_TOOL_LABELS[tool] || "Authorized system records";

// Only routes verified in App.js belong here. Unknown record types intentionally
// remain plain text rather than being linked to a guessed location.
export const getSourceRoute = (source) => {
  if (source?.type === "request" && /^\d+$/.test(String(source.id || ""))) {
    return `/requests/${source.id}`;
  }
  return null;
};

export const coverageEntries = (coverage) => {
  if (typeof coverage === "string" && coverage)
    return [{ label: "Evidence", status: coverage }];
  if (!coverage || typeof coverage !== "object") return [];
  return Object.entries(coverage).map(([key, detail]) => ({
    label: key.replaceAll("_", " "),
    status:
      typeof detail === "string" ? detail : detail?.coverage || "UNAVAILABLE",
  }));
};