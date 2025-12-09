// src/api/itemRecalls.js
import api from "./axios";

const toPositiveIntegerOrNull = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined;
  }

  return Math.floor(numeric);
};

export const submitDepartmentRecall = async ({
  itemId,
  itemName,
  quantity,
  reason,
  notes,
  recallNotice,
  supplierLetters,
  ncrReference,
  capaReference,
  finalReport,
}) => {
  const payload = {
    reason,
    notes,
    item_name: itemName,
  };

  const appendIfPresent = (key, value) => {
    if (value && value.trim()) {
      payload[key] = value.trim();
    }
  };

  const parsedItemId = toPositiveIntegerOrNull(itemId);
  if (parsedItemId !== undefined) {
    payload.item_id = parsedItemId;
  }

  const parsedQuantity = toPositiveIntegerOrNull(quantity);
  if (parsedQuantity !== undefined) {
    payload.quantity = parsedQuantity;
  }

  appendIfPresent("recall_notice", recallNotice);
  appendIfPresent("supplier_letters", supplierLetters);
  appendIfPresent("ncr_reference", ncrReference);
  appendIfPresent("capa_reference", capaReference);
  appendIfPresent("final_report", finalReport);

  const { data } = await api.post("/api/item-recalls/department", payload);
  return data;
};

export const submitWarehouseRecall = async ({
  itemId,
  itemName,
  quantity,
  reason,
  notes,
  warehouseNotes,
  recallNotice,
  supplierLetters,
  ncrReference,
  capaReference,
  finalReport,
}) => {
  const payload = {
    reason,
    notes,
    warehouse_notes: warehouseNotes,
    item_name: itemName,
  };

  const appendIfPresent = (key, value) => {
    if (value && value.trim()) {
      payload[key] = value.trim();
    }
  };

  const parsedItemId = toPositiveIntegerOrNull(itemId);
  if (parsedItemId !== undefined) {
    payload.item_id = parsedItemId;
  }

  const parsedQuantity = toPositiveIntegerOrNull(quantity);
  if (parsedQuantity !== undefined) {
    payload.quantity = parsedQuantity;
  }

  appendIfPresent("recall_notice", recallNotice);
  appendIfPresent("supplier_letters", supplierLetters);
  appendIfPresent("ncr_reference", ncrReference);
  appendIfPresent("capa_reference", capaReference);
  appendIfPresent("final_report", finalReport);

  const { data } = await api.post("/api/item-recalls/warehouse", payload);
  return data;
};

export const fetchRecallWorkspaceItems = async ({ signal } = {}) => {
  const config = {};
  if (signal) {
    config.signal = signal;
  }

  const { data } = await api.get("/api/item-recalls", config);
  return data;
};

export const escalateRecallToProcurement = async ({
  recallId,
  warehouseNotes,
}) => {
  const parsedRecallId = toPositiveIntegerOrNull(recallId);
  if (parsedRecallId === undefined) {
    throw new Error("A valid recall ID is required");
  }

  const payload = {};
  if (warehouseNotes && warehouseNotes.trim()) {
    payload.warehouse_notes = warehouseNotes.trim();
  }

  const { data } = await api.post(
    `/api/item-recalls/${parsedRecallId}/escalate`,
    payload,
  );
  return data;
};