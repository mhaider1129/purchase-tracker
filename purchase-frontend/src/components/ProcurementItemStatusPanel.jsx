// src/components/ProcurementItemStatusPanel.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "../api/axios";
import usePageTranslation from "../utils/usePageTranslation";
import AmountInput from "./ui/AmountInput";

const ProcurementItemStatusPanel = ({ item, onUpdate }) => {
  const [status, setStatus] = useState(item.procurement_status || "");
  const [comment, setComment] = useState(item.procurement_comment || "");
  const [poIssuanceMethod, setPoIssuanceMethod] = useState(
    item.po_issuance_method || "",
  );
  const [poNumber, setPoNumber] = useState(item.po_number || "");
  const [invoiceNumber, setInvoiceNumber] = useState(item.invoice_number || "");
  const [currency, setCurrency] = useState(item.currency || "");
  const [committedCost, setCommittedCost] = useState(
    item.committed_cost ?? "",
  );
  const [paidCost, setPaidCost] = useState(item.paid_cost ?? "");
  const [savingsDriver, setSavingsDriver] = useState(
    item.savings_driver || "",
  );
  const [savingsNotes, setSavingsNotes] = useState(item.savings_notes || "");
  const [contractId, setContractId] = useState(item.contract_id ?? "");
  const [contractValueSnapshot, setContractValueSnapshot] = useState(
    item.contract_value_snapshot ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [updaterName, setUpdaterName] = useState("");
  const [unitCost, setUnitCost] = useState(item.unit_cost ?? "");
  const [purchasedQty, setPurchasedQty] = useState(
    item.purchased_quantity ?? item.quantity ?? "",
  );
  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState("");
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [showProcurementEntryModal, setShowProcurementEntryModal] = useState(false);
  const [showProcurementHistoryModal, setShowProcurementHistoryModal] = useState(false);
  const [entryForm, setEntryForm] = useState({
    event_quantity: "",
    unit_cost: item.unit_cost ?? "",
    supplier_name: "",
    procurement_date: new Date().toISOString().slice(0, 10),
    procurement_note: "",
  });
  const [savingEntry, setSavingEntry] = useState(false);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const attachmentInputRef = useRef(null);
  const itemId = item?.id;
  const tr = usePageTranslation("assignedRequests");

  const normalizeDownloadEndpoint = (endpoint = "") => {
    if (!endpoint || typeof endpoint !== "string") return null;
    if (/^https?:\/\//i.test(endpoint)) return endpoint;

    const prefixedEndpoint = endpoint.startsWith("/")
      ? endpoint
      : `/${endpoint}`;
    return prefixedEndpoint.replace(/^\/api\//, "/");
  };

  const updatedAt = item.procurement_updated_at
    ? new Date(item.procurement_updated_at).toLocaleString()
    : null;

  useEffect(() => {
    const fetchUpdater = async () => {
      if (item.procurement_updated_by) {
        try {
          const res = await axios.get(
            `/users/${item.procurement_updated_by}`,
          );
          setUpdaterName(
            res.data.name || tr("itemPanel.lastUpdatedUnknown", "Unknown"),
          );
        } catch (err) {
          console.warn("⚠️ Could not fetch updater name:", err);
        }
      }
    };
    fetchUpdater();
  }, [item.procurement_updated_by, tr]);

  useEffect(() => {
    setUnitCost(item.unit_cost ?? "");
  }, [item.unit_cost]);

  useEffect(() => {
    setPurchasedQty(item.purchased_quantity ?? 0);
  }, [item.purchased_quantity]);

  useEffect(() => {
    setEntryForm((prev) => ({
      ...prev,
      unit_cost: item.unit_cost ?? prev.unit_cost ?? "",
    }));
  }, [item.unit_cost]);

  useEffect(() => {
    setStatus(item.procurement_status || "");
    setComment(item.procurement_comment || "");
    setPoIssuanceMethod(item.po_issuance_method || "");
  }, [item.procurement_status, item.procurement_comment, item.po_issuance_method]);

  useEffect(() => {
    setPoNumber(item.po_number || "");
    setInvoiceNumber(item.invoice_number || "");
    setCurrency(item.currency || "");
    setCommittedCost(item.committed_cost ?? "");
    setPaidCost(item.paid_cost ?? "");
    setSavingsDriver(item.savings_driver || "");
    setSavingsNotes(item.savings_notes || "");
    setContractId(item.contract_id ?? "");
    setContractValueSnapshot(item.contract_value_snapshot ?? "");
  }, [
    item.po_number,
    item.invoice_number,
    item.currency,
    item.committed_cost,
    item.paid_cost,
    item.savings_driver,
    item.savings_notes,
    item.contract_id,
    item.contract_value_snapshot,
  ]);

  const fetchItemAttachments = useCallback(async () => {
    if (!itemId) {
      setAttachments([]);
      return;
    }

    setLoadingAttachments(true);
    setAttachmentsError("");

    try {
      const res = await axios.get(`/attachments/item/${itemId}`);
      setAttachments(res.data || []);
    } catch (err) {
      console.error(`❌ Error fetching attachments for item ${itemId}:`, err);
      setAttachments([]);
      setAttachmentsError(
        tr("itemPanel.attachments.error", "Failed to load attachments."),
      );
    } finally {
      setLoadingAttachments(false);
    }
  }, [itemId, tr]);

  useEffect(() => {
    fetchItemAttachments();
  }, [fetchItemAttachments]);

  const handleUploadAttachment = async (event) => {
    const file = event.target.files?.[0];

    if (!file || !itemId) {
      return;
    }

    setUploadingAttachment(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      await axios.post(`/attachments/item/${itemId}`, formData);

      setUploadSuccess(
        tr(
          "itemPanel.attachments.uploadSuccess",
          "Attachment uploaded successfully.",
        ),
      );
      await fetchItemAttachments();
    } catch (err) {
      console.error(`❌ Failed to upload attachment for item ${itemId}:`, err);
      setUploadError(
        tr(
          "itemPanel.attachments.uploadFailed",
          "Failed to upload attachment.",
        ),
      );
    } finally {
      setUploadingAttachment(false);
      event.target.value = "";
    }
  };

  const handleDownloadAttachment = async (attachment) => {
    const storedPath = attachment?.file_path || "";
    const filename = storedPath.split(/[\\/]/).pop();
    const idBasedEndpoint = attachment?.id ? `/attachments/${attachment.id}/download` : null;
    const isLegacyFilenameEndpoint =
      typeof attachment?.download_url === "string" &&
      /\/attachments\/download\//.test(attachment.download_url);
    const downloadEndpoint = normalizeDownloadEndpoint(
      (isLegacyFilenameEndpoint ? idBasedEndpoint : null) ||
        attachment?.download_url ||
        idBasedEndpoint ||
        (filename ? `/attachments/download/${encodeURIComponent(filename)}` : null),
    );

    if (!downloadEndpoint) {
      alert(tr("itemPanel.attachments.missing", "Attachment file is missing."));
      return;
    }

    setDownloadingAttachmentId(attachment.id);

    try {
      const response = await axios.get(downloadEndpoint, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || "application/octet-stream",
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = attachment.file_name || filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(`❌ Error downloading attachment ${attachment.id}:`, err);
      alert(
        tr(
          "itemPanel.attachments.downloadFailed",
          "Failed to download attachment. Please try again.",
        ),
      );
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const parseNumber = useCallback((value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }

    const numeric = Number(value);
    return Number.isNaN(numeric) ? null : numeric;
  }, []);

  const totalCost = useMemo(() => {
    const qty = parseNumber(purchasedQty ?? 0);
    if (qty === null) {
      return null;
    }

    const cost = parseNumber(unitCost);
    if (cost === null) {
      return null;
    }

    return Number((qty * cost).toFixed(2));
  }, [parseNumber, purchasedQty, unitCost]);

  const requestedQty = useMemo(
    () => parseNumber(item.quantity),
    [item.quantity, parseNumber],
  );
  const purchasedQtyNumber = useMemo(
    () => parseNumber(purchasedQty),
    [parseNumber, purchasedQty],
  );
  const outstandingQty = useMemo(() => {
    if (requestedQty === null || purchasedQtyNumber === null) {
      return null;
    }

    return Math.max(Number((requestedQty - purchasedQtyNumber).toFixed(2)), 0);
  }, [purchasedQtyNumber, requestedQty]);

  const remainingQty = item.remaining_quantity !== undefined && item.remaining_quantity !== null
    ? Number(item.remaining_quantity)
    : outstandingQty;
  const latestProcurementDate = item.latest_procurement_date
    ? new Date(item.latest_procurement_date).toLocaleDateString()
    : "—";
  const procurementEventsCount = Number(item.procurement_events_count || 0);

  const originalUnitCost = useMemo(
    () => parseNumber(item.unit_cost),
    [item.unit_cost, parseNumber],
  );
  const formatNumber = useCallback((value, options = {}) => {
    if (value === null || value === undefined) {
      return "—";
    }

    return Number(value).toLocaleString(undefined, options);
  }, []);

  const metaDetails = useMemo(() => {
    const details = [
      { label: tr("itemPanel.meta.brand", "Brand"), value: item.brand },
      { label: tr("itemPanel.meta.specs", "Specs"), value: item.specs },
      {
        label: tr("itemPanel.meta.category", "Category"),
        value: item.category,
      },
      {
        label: tr("itemPanel.meta.supplier", "Supplier"),
        value: item.preferred_supplier,
      },
    ];

    return details.filter((detail) => detail.value);
  }, [item.brand, item.category, item.preferred_supplier, item.specs, tr]);

  const statusOptions = useMemo(
    () => [
      {
        value: "pending",
        label: tr("itemPanel.statusOptions.pending", "Pending Purchase"),
      },
      {
        value: "partially_procured",
        label: tr("itemPanel.statusOptions.partiallyProcured", "Partially Procured"),
      },
      {
        value: "purchased",
        label: tr("itemPanel.statusOptions.purchased", "Purchased"),
      },
      {
        value: "not_procured",
        label: tr("itemPanel.statusOptions.notProcured", "Not Procured"),
      },
      {
        value: "completed",
        label: tr("itemPanel.statusOptions.completed", "Completed"),
      },
      {
        value: "canceled",
        label: tr("itemPanel.statusOptions.canceled", "Canceled"),
      },
    ],
    [tr],
  );

  const statusStyles = useMemo(
    () => ({
      pending: "border-amber-200 bg-amber-50 text-amber-700",
      partially_procured: "border-amber-200 bg-amber-50 text-amber-700",
      purchased: "border-emerald-200 bg-emerald-50 text-emerald-700",
      not_procured: "border-rose-200 bg-rose-50 text-rose-700",
      completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
      canceled: "border-rose-200 bg-rose-50 text-rose-700",
    }),
    [],
  );

  const savingsDriverOptions = useMemo(
    () => [
      {
        value: "",
        label: tr("itemPanel.savingsDrivers.none", "-- Select Driver --"),
      },
      {
        value: "negotiated_vs_list",
        label: tr(
          "itemPanel.savingsDrivers.negotiated",
          "Negotiated vs. list price",
        ),
      },
      {
        value: "contract_vs_spot",
        label: tr(
          "itemPanel.savingsDrivers.contract",
          "Contract price vs. spot",
        ),
      },
      {
        value: "volume_discount",
        label: tr("itemPanel.savingsDrivers.volume", "Volume/scale discount"),
      },
      {
        value: "spec_change",
        label: tr("itemPanel.savingsDrivers.specChange", "Specification change"),
      },
      {
        value: "alternative_supplier",
        label: tr(
          "itemPanel.savingsDrivers.altSupplier",
          "Alternative supplier",
        ),
      },
    ],
    [tr],
  );

  const handleSave = async () => {
    if (!status) {
      setMessage({
        type: "error",
        text: tr("itemPanel.messages.selectStatus", "Please select a status."),
      });
      return;
    }

    const hasUnitCost =
      unitCost !== "" && unitCost !== null && unitCost !== undefined;
    const numericUnitCost = hasUnitCost ? Number(unitCost) : null;
    const numericQty = Number(purchasedQty);

    if (hasUnitCost && (Number.isNaN(numericUnitCost) || numericUnitCost < 0)) {
      setMessage({
        type: "error",
        text: tr(
          "itemPanel.messages.unitCostInvalid",
          "Enter a valid unit cost (zero or above).",
        ),
      });
      return;
    }

    if (Number.isNaN(numericQty) || numericQty < 0) {
      setMessage({
        type: "error",
        text: tr(
          "itemPanel.messages.purchasedQtyInvalid",
          "Enter a valid purchased quantity (zero or above).",
        ),
      });
      return;
    }

    if (status === "purchased") {
      if (numericQty <= 0) {
        setMessage({
          type: "error",
          text: tr(
            "itemPanel.messages.purchasedQtyRequired",
            "Purchased items require a purchased quantity greater than zero.",
          ),
        });
        return;
      }
    }

    const numericCommitted =
      committedCost === "" || committedCost === null
        ? null
        : Number(committedCost);
    if (
      numericCommitted !== null &&
      (Number.isNaN(numericCommitted) || numericCommitted < 0)
    ) {
      setMessage({
        type: "error",
        text: tr(
          "itemPanel.messages.committedCostInvalid",
          "Enter a valid committed cost (zero or above).",
        ),
      });
      return;
    }

    const numericPaid =
      paidCost === "" || paidCost === null ? null : Number(paidCost);
    if (numericPaid !== null && (Number.isNaN(numericPaid) || numericPaid < 0)) {
      setMessage({
        type: "error",
        text: tr(
          "itemPanel.messages.paidCostInvalid",
          "Enter a valid paid amount (zero or above).",
        ),
      });
      return;
    }

    const numericContractId =
      contractId === "" || contractId === null ? null : Number(contractId);
    if (
      numericContractId !== null &&
      (Number.isNaN(numericContractId) ||
        !Number.isInteger(numericContractId) ||
        numericContractId <= 0)
    ) {
      setMessage({
        type: "error",
        text: tr(
          "itemPanel.messages.contractIdInvalid",
          "Contract ID must be a positive integer.",
        ),
      });
      return;
    }

    const numericContractSnapshot =
      contractValueSnapshot === "" || contractValueSnapshot === null
        ? null
        : Number(contractValueSnapshot);
    if (
      numericContractSnapshot !== null &&
      (Number.isNaN(numericContractSnapshot) || numericContractSnapshot < 0)
    ) {
      setMessage({
        type: "error",
        text: tr(
          "itemPanel.messages.contractSnapshotInvalid",
          "Enter a valid contract value snapshot (zero or above).",
        ),
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      if (hasUnitCost) {
        await axios.put(`/requested-items/${item.id}/cost`, {
          unit_cost: numericUnitCost,
        });
      }

      await axios.put(`/requested-items/${item.id}/procurement-status`, {
        procurement_status: status,
        procurement_comment: comment,
        po_issuance_method: poIssuanceMethod,
        po_number: poNumber || null,
        invoice_number: invoiceNumber || null,
        currency: currency || null,
        committed_cost: numericCommitted,
        paid_cost: numericPaid,
        savings_driver: savingsDriver || null,
        savings_notes: savingsNotes || null,
        contract_id: numericContractId,
        contract_value_snapshot: numericContractSnapshot,
      });

      setMessage({
        type: "success",
        text: tr(
          "itemPanel.messages.updateSuccess",
          "✅ Updated successfully.",
        ),
      });
      if (onUpdate) onUpdate(); // Notify parent to refresh data
    } catch (err) {
      console.error("❌ Update error:", err);
      setMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          tr("itemPanel.messages.updateFailed", "❌ Failed to update."),
      });
    } finally {
      setSaving(false);
    }
  };

  const fetchProcurementHistory = useCallback(async () => {
    if (!item.request_id || !item.id) return;
    setLoadingHistory(true);
    try {
      const res = await axios.get(
        `/requests/${item.request_id}/items/${item.id}/procurement-events`,
      );
      setHistoryEvents(res.data.events || []);
      setHistoryLoaded(true);
    } catch (err) {
      console.error("❌ Failed to fetch procurement history:", err);
      setHistoryEvents([]);
      setMessage({
        type: "error",
        text: err.response?.data?.message || tr("itemPanel.procurementHistory.loadFailed", "Failed to load procurement history."),
      });
    } finally {
      setLoadingHistory(false);
    }
  }, [item.id, item.request_id, tr]);

  const openProcurementHistory = async () => {
    setShowProcurementHistoryModal(true);
    await fetchProcurementHistory();
  };

  const handleAddProcurementEntry = async () => {
    const quantityToAdd = Number(entryForm.event_quantity);
    const numericRemaining = Number(remainingQty ?? 0);
    const numericUnitCost = entryForm.unit_cost === "" || entryForm.unit_cost === null
      ? null
      : Number(entryForm.unit_cost);

    if (!Number.isInteger(quantityToAdd) || quantityToAdd <= 0) {
      setMessage({ type: "error", text: tr("itemPanel.procurementEntry.quantityPositive", "Quantity to add must be a positive whole number.") });
      return;
    }

    if (quantityToAdd > numericRemaining) {
      setMessage({ type: "error", text: tr("itemPanel.procurementEntry.quantityTooHigh", "Quantity to add cannot exceed the remaining quantity.") });
      return;
    }

    if (numericUnitCost !== null && (Number.isNaN(numericUnitCost) || numericUnitCost < 0)) {
      setMessage({ type: "error", text: tr("itemPanel.messages.unitCostInvalid", "Enter a valid unit cost (zero or above).") });
      return;
    }

    setSavingEntry(true);
    setMessage(null);
    try {
      await axios.post(`/requests/${item.request_id}/items/${item.id}/procurement-events`, {
        event_quantity: quantityToAdd,
        unit_cost: numericUnitCost,
        supplier_name: entryForm.supplier_name || null,
        procurement_date: entryForm.procurement_date || null,
        procurement_note: entryForm.procurement_note || null,
      });

      setShowProcurementEntryModal(false);
      setEntryForm({
        event_quantity: "",
        unit_cost: numericUnitCost ?? "",
        supplier_name: "",
        procurement_date: new Date().toISOString().slice(0, 10),
        procurement_note: "",
      });
      setMessage({ type: "success", text: tr("itemPanel.procurementEntry.success", "✅ Procurement entry added successfully.") });
      if (onUpdate) onUpdate();
      if (historyLoaded) await fetchProcurementHistory();
    } catch (err) {
      console.error("❌ Failed to add procurement entry:", err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || tr("itemPanel.procurementEntry.failed", "Failed to add procurement entry."),
      });
    } finally {
      setSavingEntry(false);
    }
  };

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h4 className="text-lg font-semibold text-slate-800">
              {item.item_name}
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              {tr("itemPanel.requestedQuantityPrefix", "Requested quantity:")}{" "}
              <span className="font-medium text-slate-700">
                {formatNumber(requestedQty)}
              </span>
            </p>
            {metaDetails.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                {metaDetails.map((detail) => (
                  <span
                    key={detail.label}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium"
                  >
                    <span className="uppercase tracking-wide text-[10px] text-slate-400">
                      {detail.label}:
                    </span>{" "}
                    <span className="text-slate-600">{detail.value}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col items-start gap-2 text-xs text-slate-500 md:items-end">
            {status && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold capitalize ${
                  statusStyles[status] ||
                  "border-slate-200 bg-slate-100 text-slate-700"
                }`}
              >
                {statusOptions.find((opt) => opt.value === status)?.label ||
                  status.replace("_", " ")}
              </span>
            )}
            {(updaterName || updatedAt) && (
              <div className="text-xs italic text-slate-500">
                {tr(
                  "itemPanel.lastUpdated",
                  "Last updated by {{name}} at {{time}}",
                  {
                    name:
                      updaterName ||
                      tr("itemPanel.lastUpdatedUnknown", "Unknown"),
                    time:
                      updatedAt ||
                      tr("itemPanel.lastUpdatedUnknownTime", "Unknown time"),
                  },
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              {tr("itemPanel.cards.requestedQty", "Requested Qty")}
            </p>
            <p className="mt-1 text-base font-semibold text-slate-700">
              {formatNumber(requestedQty)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              {tr("itemPanel.cards.purchasedQty", "Purchased Qty")}
            </p>
            <p className="mt-1 text-base font-semibold text-emerald-700">
              {formatNumber(purchasedQtyNumber)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              {tr("itemPanel.cards.remainingQty", "Remaining Qty")}
            </p>
            <p className="mt-1 text-base font-semibold text-amber-700">
              {formatNumber(remainingQty)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              {tr("itemPanel.cards.latestProcurementDate", "Latest Procurement Date")}
            </p>
            <p className="mt-1 text-base font-semibold text-slate-700">
              {latestProcurementDate}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              {tr("itemPanel.inputs.unitCost", "Unit Cost")}
            </label>
            <AmountInput
              min={0}
              step="0.01"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {originalUnitCost !== null && (
              <p className="mt-1 text-xs text-slate-500">
                {tr(
                  "itemPanel.inputs.originalUnitCost",
                  "Originally requested at {{cost}}",
                  {
                    cost: formatNumber(originalUnitCost, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }),
                  },
                )}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              {tr("itemPanel.inputs.purchasedQuantitySummary", "Purchased Quantity Summary")}
            </label>
            <input
              type="number"
              min={0}
              value={purchasedQty}
              readOnly
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700"
            />
            <p className="mt-1 text-xs text-slate-500">
              {tr("itemPanel.inputs.purchasedQuantityHelper", "This summary is updated by adding procurement entries, not by overwriting old quantities.")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowProcurementEntryModal(true)}
                disabled={Number(remainingQty || 0) <= 0}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {tr("itemPanel.procurementEntry.open", "Add Procurement Entry")}
              </button>
              <button
                type="button"
                onClick={openProcurementHistory}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {tr("itemPanel.procurementHistory.open", "Procurement History")} ({procurementEventsCount})
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              {tr("itemPanel.inputs.procurementStatus", "Procurement Status")}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">
                {tr("itemPanel.inputs.selectStatus", "-- Select Status --")}
              </option>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <label className="mt-3 block text-sm font-medium text-slate-700">
              {tr(
                "itemPanel.inputs.poIssuanceMethod",
                "PO Issuance Method",
              )}
            </label>
            <input
              type="text"
              value={poIssuanceMethod}
              onChange={(e) => setPoIssuanceMethod(e.target.value)}
              placeholder={tr(
                "itemPanel.inputs.poIssuancePlaceholder",
                "e.g., email, supplier portal, courier",
              )}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              {tr("itemPanel.inputs.comment", "Comment")}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <button
            type="button"
            onClick={() => setShowMoreDetails((prev) => !prev)}
            className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-700"
            aria-expanded={showMoreDetails}
          >
            <span>
              {tr("itemPanel.moreDetails.title", "Additional procurement details")}
            </span>
            <span className="text-xs text-slate-500">
              {showMoreDetails
                ? tr("itemPanel.moreDetails.hide", "Hide")
                : tr("itemPanel.moreDetails.show", "Show")}
            </span>
          </button>
          <p className="mt-1 text-xs text-slate-500">
            {tr(
              "itemPanel.moreDetails.helper",
              "Includes PO, invoice, contract, savings, and attachment information.",
            )}
          </p>
        </div>

        {showMoreDetails && (
          <>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                {tr("itemPanel.inputs.poNumber", "PO Number")}
              </label>
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                {tr("itemPanel.inputs.invoiceNumber", "Invoice Number")}
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                {tr("itemPanel.inputs.currency", "Currency")}
              </label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder={tr("itemPanel.inputs.currencyPlaceholder", "e.g., USD")}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                {tr("itemPanel.inputs.committedCost", "Committed Cost")}
              </label>
              <AmountInput
                min={0}
                step="0.01"
                value={committedCost}
                onChange={(e) => setCommittedCost(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                {tr("itemPanel.inputs.paidCost", "Paid Cost")}
              </label>
              <AmountInput
                min={0}
                step="0.01"
                value={paidCost}
                onChange={(e) => setPaidCost(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  {tr("itemPanel.inputs.contractId", "Contract ID")}
                </label>
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={contractId}
                  onChange={(e) => setContractId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  {tr(
                    "itemPanel.inputs.contractSnapshot",
                    "Contract Value Snapshot",
                  )}
                </label>
                <AmountInput
                  min={0}
                  step="0.01"
                  value={contractValueSnapshot}
                  onChange={(e) => setContractValueSnapshot(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              {tr("itemPanel.inputs.savingsDriver", "Savings Driver")}
            </label>
            <select
              value={savingsDriver}
              onChange={(e) => setSavingsDriver(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {savingsDriverOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {tr(
                "itemPanel.inputs.savingsHelper",
                "Track whether savings came from negotiation, contract coverage, or other drivers.",
              )}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              {tr("itemPanel.inputs.savingsNotes", "Savings Notes")}
            </label>
            <textarea
              value={savingsNotes}
              onChange={(e) => setSavingsNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
          </>
        )}

        <div className="mt-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-700">
              {tr("itemPanel.recordedLineTotal", "Recorded Line Total:")}
            </span>{" "}
            {formatNumber(totalCost, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 ${
              saving
                ? "bg-green-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700"
            }`}
            type="button"
          >
            {saving
              ? tr("itemPanel.buttons.saving", "Saving…")
              : tr("itemPanel.buttons.save", "Save Updates")}
          </button>
        </div>



        {showProcurementEntryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{tr("itemPanel.procurementEntry.title", "Add Procurement Entry")}</h3>
                  <p className="text-sm text-slate-500">{item.item_name}</p>
                </div>
                <button type="button" onClick={() => setShowProcurementEntryModal(false)} className="text-slate-500 hover:text-slate-700">×</button>
              </div>

              <div className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-3">
                <div><span className="block text-xs uppercase text-slate-400">Requested quantity</span><strong>{formatNumber(requestedQty)}</strong></div>
                <div><span className="block text-xs uppercase text-slate-400">Already purchased</span><strong>{formatNumber(purchasedQtyNumber)}</strong></div>
                <div><span className="block text-xs uppercase text-slate-400">Remaining quantity</span><strong>{formatNumber(remainingQty)}</strong></div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Quantity to add</label>
                  <input type="number" min={1} step={1} max={remainingQty || undefined} value={entryForm.event_quantity} onChange={(e) => setEntryForm((prev) => ({ ...prev, event_quantity: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Unit cost</label>
                  <AmountInput min={0} step="0.01" value={entryForm.unit_cost} onChange={(e) => setEntryForm((prev) => ({ ...prev, unit_cost: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Supplier name</label>
                  <input type="text" value={entryForm.supplier_name} onChange={(e) => setEntryForm((prev) => ({ ...prev, supplier_name: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Procurement date</label>
                  <input type="date" value={entryForm.procurement_date} onChange={(e) => setEntryForm((prev) => ({ ...prev, procurement_date: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>

              <label className="mt-3 block text-sm font-medium text-slate-700">Note</label>
              <textarea value={entryForm.procurement_note} onChange={(e) => setEntryForm((prev) => ({ ...prev, procurement_note: e.target.value }))} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />

              {Number(entryForm.event_quantity || 0) > 0 && Number(entryForm.event_quantity || 0) < Number(remainingQty || 0) && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  This will register a partial procurement entry. The remaining quantity will stay open.
                </div>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setShowProcurementEntryModal(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                <button type="button" onClick={handleAddProcurementEntry} disabled={savingEntry || Number(remainingQty || 0) <= 0} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">{savingEntry ? "Saving…" : "Add Entry"}</button>
              </div>
            </div>
          </div>
        )}

        {showProcurementHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-5xl rounded-xl bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{tr("itemPanel.procurementHistory.title", "Procurement History")}</h3>
                  <p className="text-sm text-slate-500">{item.item_name}</p>
                </div>
                <button type="button" onClick={() => setShowProcurementHistoryModal(false)} className="text-slate-500 hover:text-slate-700">×</button>
              </div>

              <div className="mt-4 max-h-[60vh] overflow-auto">
                {loadingHistory ? (
                  <p className="text-sm text-slate-500">Loading procurement history…</p>
                ) : historyEvents.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">No detailed procurement events recorded.</p>
                ) : (
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Event Qty</th><th className="px-3 py-2 text-left">Previous</th><th className="px-3 py-2 text-left">New</th><th className="px-3 py-2 text-left">Remaining</th><th className="px-3 py-2 text-left">Unit Cost</th><th className="px-3 py-2 text-left">Total Cost</th><th className="px-3 py-2 text-left">Supplier</th><th className="px-3 py-2 text-left">User</th><th className="px-3 py-2 text-left">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyEvents.map((event) => (
                        <tr key={event.id}>
                          <td className="px-3 py-2">{event.procurement_date ? new Date(event.procurement_date).toLocaleDateString() : "—"}</td>
                          <td className="px-3 py-2">{formatNumber(event.event_quantity)}</td>
                          <td className="px-3 py-2">{formatNumber(event.previous_purchased_quantity)}</td>
                          <td className="px-3 py-2">{formatNumber(event.new_purchased_quantity)}</td>
                          <td className="px-3 py-2">{formatNumber(event.remaining_quantity)}</td>
                          <td className="px-3 py-2">{formatNumber(event.unit_cost, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2">{formatNumber(event.total_cost, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2">{event.supplier_name || event.supplier_id || "—"}</td>
                          <td className="px-3 py-2">{event.procurement_user_name || event.procurement_user_id || "—"}</td>
                          <td className="px-3 py-2">{event.procurement_note || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {message && (
          <div
            className={`mt-2 text-sm font-medium ${
              message.type === "error" ? "text-red-600" : "text-green-600"
            }`}
          >
            {message.text}
          </div>
        )}

        {showMoreDetails && (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
          <h4 className="text-sm font-semibold text-slate-700">
            {tr("itemPanel.attachments.title", "Item Attachments")}
          </h4>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              ref={attachmentInputRef}
              type="file"
              className="hidden"
              onChange={handleUploadAttachment}
            />
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              disabled={uploadingAttachment || !itemId}
            >
              {uploadingAttachment
                ? tr("itemPanel.attachments.uploading", "Uploading…")
                : tr("itemPanel.attachments.uploadLabel", "Upload attachment")}
            </button>
            {uploadSuccess && (
              <span className="text-xs text-green-600">{uploadSuccess}</span>
            )}
            {uploadError && (
              <span className="text-xs text-rose-600">{uploadError}</span>
            )}
          </div>
          {loadingAttachments ? (
            <p className="text-xs text-slate-500">
              {tr("itemPanel.attachments.loading", "Loading attachments…")}
            </p>
          ) : attachmentsError ? (
            <p className="text-xs text-rose-600">{attachmentsError}</p>
          ) : attachments.length === 0 ? (
            <p className="text-xs text-slate-500">
              {tr(
                "itemPanel.attachments.empty",
                "No attachments uploaded for this item.",
              )}
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {attachments.map((attachment) => {
                const filename = attachment.file_path?.split(/[\\/]/).pop();
                return (
                  <li key={attachment.id}>
                    <button
                      type="button"
                      onClick={() => handleDownloadAttachment(attachment)}
                      className="text-blue-600 underline decoration-1 underline-offset-2 transition hover:text-blue-800 disabled:opacity-50"
                      disabled={downloadingAttachmentId === attachment.id}
                    >
                      {downloadingAttachmentId === attachment.id
                        ? tr(
                            "itemPanel.attachments.downloading",
                            "Downloading…",
                          )
                        : attachment.file_name ||
                          filename ||
                          tr("itemPanel.attachments.fallback", "Attachment")}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

export default ProcurementItemStatusPanel;
