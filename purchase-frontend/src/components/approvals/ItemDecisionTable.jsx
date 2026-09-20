import React from "react";
import { Button } from "../ui/Button";
import { FEEDBACK_TEXT_STYLES } from "../../hooks/useApprovalsData";
import {
  CheckCircle2,
  CircleDashed,
  ListChecks,
  Save,
  XCircle,
} from "lucide-react";

const STATUS_HIGHLIGHTS = {
  Approved: "bg-green-50",
  Rejected: "bg-red-50",
  Pending: "",
};

const ItemDecisionTable = ({
  items = [],
  decisions = {},
  quantityDrafts = {},
  canEdit,
  isItemLockedForUser,
  onStatusChange,
  onCommentChange,
  onQuantityChange,
  onWarehouseConversionToggle,
  canConvertToWarehouseSupply = false,
  warehouseConversionSelections = {},
  onSave,
  saving,
  summary,
  feedback,
  labels = {},
}) => {
  if (!items.length) {
    return (
      <p className="mt-2 text-sm text-slate-500">
        {labels.emptyLabel || "No items found for this request."}
      </p>
    );
  }

  const {
    heading = "Requested Items",
    quantityLabel = "Qty",
    availableLabel = "Available Qty",
    unitCostLabel = "Unit Cost",
    totalCostLabel = "Total",
    decisionLabel = "Decision",
    commentsLabel = "Comments",
    saveLabel = "Save Item Decisions",
    approvedLabel = "Approved",
    rejectedLabel = "Rejected",
    pendingLabel = "Pending",
    convertToWarehouseSupplyLabel = "Convert to warehouse supply",
  } = labels;

  const totalDecisions = summary
    ? summary.approved + summary.rejected + summary.pending
    : 0;
  const completedDecisions = summary ? summary.approved + summary.rejected : 0;
  const completion = totalDecisions
    ? Math.round((completedDecisions / totalDecisions) * 100)
    : 0;

  return (
    <section aria-labelledby="item-decisions-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4
          id="item-decisions-heading"
          className="flex items-center gap-2 text-sm font-semibold text-slate-800"
        >
          <ListChecks className="h-4 w-4 text-blue-600" aria-hidden />
          {heading}
        </h4>
        {summary && (
          <span className="text-xs font-medium text-slate-500">
            {completion}% reviewed
          </span>
        )}
      </div>
      <div className="mt-2 space-y-3">
        {summary && (
          <div>
            <div
              className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100"
              aria-label={`${completion}% reviewed`}
            >
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                {approvedLabel}: {summary.approved}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-rose-700">
                <XCircle className="h-3.5 w-3.5" aria-hidden />
                {rejectedLabel}: {summary.rejected}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                <CircleDashed className="h-3.5 w-3.5" aria-hidden />
                {pendingLabel}: {summary.pending}
              </span>
            </div>
          </div>
        )}
        <div className="max-h-[34rem] overflow-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgb(226,232,240)]">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">
                  Item
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">
                  Brand
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">
                  Specs
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">
                  {quantityLabel}
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">
                  {availableLabel}
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">
                  {unitCostLabel}
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">
                  {totalCostLabel}
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">
                  {decisionLabel}
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">
                  {commentsLabel}
                </th>
                {canConvertToWarehouseSupply && (
                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                    {convertToWarehouseSupplyLabel}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const decision = decisions[item.id] || {
                  status: item.approval_status || "Pending",
                  comments: item.approval_comments || "",
                };
                const normalizedStatus =
                  typeof decision.status === "string"
                    ? `${decision.status.charAt(0).toUpperCase()}${decision.status.slice(1).toLowerCase()}`
                    : "Pending";
                const rowHighlight = STATUS_HIGHLIGHTS[normalizedStatus] || "";
                const decisionLocked = canEdit && isItemLockedForUser?.(item);
                const quantityValue =
                  quantityDrafts[item.id] ?? item.quantity ?? "";
                const convertSelected = Boolean(
                  warehouseConversionSelections[item.id],
                );

                return (
                  <tr
                    key={item.id || item.item_name}
                    className={`${rowHighlight} transition-colors`}
                  >
                    <td className="px-3 py-3 text-slate-800">
                      <div className="font-medium">{item.item_name}</div>
                      {(item.brand || item.specs) && (
                        <div className="mt-1 text-xs text-slate-500">
                          {item.brand && (
                            <span className="mr-2">{item.brand}</span>
                          )}
                          {item.specs && <span>{item.specs}</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {item.brand || "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {item.specs || "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {canEdit ? (
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={quantityValue}
                          onChange={(event) =>
                            onQuantityChange(item.id, event.target.value)
                          }
                          className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={decisionLocked || convertSelected}
                        />
                      ) : (
                        <span>{item.quantity ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {item.available_quantity ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {item.unit_cost}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {item.total_cost}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {canEdit ? (
                        <select
                          className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={decision.status || "Pending"}
                          onChange={(event) =>
                            onStatusChange(item.id, event.target.value)
                          }
                          disabled={decisionLocked || convertSelected}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Approved">Approved</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${normalizedStatus === "Approved" ? "bg-emerald-100 text-emerald-700" : normalizedStatus === "Rejected" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}
                        >
                          {decision.status || "Pending"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {canEdit ? (
                        <textarea
                          className="mt-0 w-full rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                          placeholder="Optional comments"
                          value={decision.comments || ""}
                          onChange={(event) =>
                            onCommentChange(item.id, event.target.value)
                          }
                          disabled={decisionLocked || convertSelected}
                        />
                      ) : (
                        <span>{decision.comments || "—"}</span>
                      )}
                      {decisionLocked && (
                        <p className="mt-1 text-xs font-medium text-amber-600">
                          Rejected by a previous approver — only they can update
                          this item.
                        </p>
                      )}
                    </td>
                    {canConvertToWarehouseSupply && (
                      <td className="px-3 py-3 text-slate-600">
                        <label className="inline-flex items-start gap-2 text-xs font-medium text-slate-700">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={convertSelected}
                            onChange={(event) =>
                              onWarehouseConversionToggle?.(
                                item.id,
                                event.target.checked,
                              )
                            }
                            disabled={decisionLocked}
                          />
                          <span>Use stock and reject from purchase</span>
                        </label>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="sticky bottom-0 flex justify-end rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
            <Button variant="secondary" onClick={onSave} isLoading={saving}>
              <Save className="mr-2 h-4 w-4" aria-hidden />
              {saveLabel}
            </Button>
          </div>
        )}
        {feedback?.message && (
          <p
            role="status"
            className={`rounded-lg bg-slate-50 px-3 py-2 text-sm ${FEEDBACK_TEXT_STYLES[feedback.type] || FEEDBACK_TEXT_STYLES.info}`}
          >
            {feedback.message}
          </p>
        )}
      </div>
    </section>
  );
};

export default ItemDecisionTable;