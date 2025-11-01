// src/api/itemRecalls.js
import api from './axios';

const toPositiveIntegerOrNull = (value) => {
  if (value === undefined || value === null || value === '') {
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
}) => {
  const payload = {
    reason,
    notes,
    item_name: itemName,
  };

  const parsedItemId = toPositiveIntegerOrNull(itemId);
  if (parsedItemId !== undefined) {
    payload.item_id = parsedItemId;
  }

  const parsedQuantity = toPositiveIntegerOrNull(quantity);
  if (parsedQuantity !== undefined) {
    payload.quantity = parsedQuantity;
  }

  const { data } = await api.post('/api/item-recalls/department', payload);
  return data;
};

export const submitWarehouseRecall = async ({
  itemId,
  itemName,
  quantity,
  reason,
  notes,
  warehouseNotes,
}) => {
  const payload = {
    reason,
    notes,
    warehouse_notes: warehouseNotes,
    item_name: itemName,
  };

  const parsedItemId = toPositiveIntegerOrNull(itemId);
  if (parsedItemId !== undefined) {
    payload.item_id = parsedItemId;
  }

  const parsedQuantity = toPositiveIntegerOrNull(quantity);
  if (parsedQuantity !== undefined) {
    payload.quantity = parsedQuantity;
  }

  const { data } = await api.post('/api/item-recalls/warehouse', payload);
  return data;
};

export const escalateRecallToProcurement = async ({ recallId, warehouseNotes }) => {
  const parsedRecallId = toPositiveIntegerOrNull(recallId);
  if (parsedRecallId === undefined) {
    throw new Error('A valid recall ID is required');
  }

  const payload = {};
  if (warehouseNotes && warehouseNotes.trim()) {
    payload.warehouse_notes = warehouseNotes.trim();
  }

  const { data } = await api.post(`/api/item-recalls/${parsedRecallId}/escalate`, payload);
  return data;
};