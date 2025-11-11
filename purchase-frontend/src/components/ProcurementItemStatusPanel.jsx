// src/components/ProcurementItemStatusPanel.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from '../api/axios';

const ProcurementItemStatusPanel = ({ item, onUpdate }) => {
  const [status, setStatus] = useState(item.procurement_status || '');
  const [comment, setComment] = useState(item.procurement_comment || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [updaterName, setUpdaterName] = useState('');
  const [unitCost, setUnitCost] = useState(item.unit_cost ?? '');
  const [purchasedQty, setPurchasedQty] = useState(
    item.purchased_quantity ?? item.quantity ?? ''
  );
  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState('');
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState(null);
  const itemId = item?.id;

  const updatedAt = item.procurement_updated_at
    ? new Date(item.procurement_updated_at).toLocaleString()
    : null;

  useEffect(() => {
    const fetchUpdater = async () => {
      if (item.procurement_updated_by) {
        try {
          const res = await axios.get(`/api/users/${item.procurement_updated_by}`);
          setUpdaterName(res.data.name || 'Unknown');
        } catch (err) {
          console.warn('⚠️ Could not fetch updater name:', err);
        }
      }
    };
    fetchUpdater();
  }, [item.procurement_updated_by]);

  useEffect(() => {
    setUnitCost(item.unit_cost ?? '');
  }, [item.unit_cost]);

  useEffect(() => {
    setPurchasedQty(item.purchased_quantity ?? item.quantity ?? '');
  }, [item.purchased_quantity, item.quantity]);

  useEffect(() => {
    setStatus(item.procurement_status || '');
    setComment(item.procurement_comment || '');
  }, [item.procurement_status, item.procurement_comment]);

  useEffect(() => {
    const fetchItemAttachments = async () => {
      if (!itemId) {
        setAttachments([]);
        return;
      }

      setLoadingAttachments(true);
      setAttachmentsError('');

      try {
        const res = await axios.get(`/api/attachments/item/${itemId}`);
        setAttachments(res.data || []);
      } catch (err) {
        console.error(`❌ Error fetching attachments for item ${itemId}:`, err);
        setAttachments([]);
        setAttachmentsError('Failed to load attachments.');
      } finally {
        setLoadingAttachments(false);
      }
    };

    fetchItemAttachments();
  }, [itemId]);

  const handleDownloadAttachment = async (attachment) => {
    const storedPath = attachment?.file_path || '';
    const filename = storedPath.split(/[\\/]/).pop();
    const downloadEndpoint =
      attachment?.download_url || (filename ? `/api/attachments/download/${encodeURIComponent(filename)}` : null);

    if (!downloadEndpoint) {
      alert('Attachment file is missing.');
      return;
    }

    setDownloadingAttachmentId(attachment.id);

    try {
      const response = await axios.get(downloadEndpoint, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/octet-stream',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = attachment.file_name || filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(`❌ Error downloading attachment ${attachment.id}:`, err);
      alert('Failed to download attachment. Please try again.');
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const parseNumber = useCallback((value) => {
    if (value === '' || value === null || value === undefined) {
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

  const requestedQty = useMemo(() => parseNumber(item.quantity), [item.quantity, parseNumber]);
  const purchasedQtyNumber = useMemo(
    () => parseNumber(purchasedQty),
    [parseNumber, purchasedQty]
  );
  const outstandingQty = useMemo(() => {
    if (requestedQty === null || purchasedQtyNumber === null) {
      return null;
    }

    return Math.max(Number((requestedQty - purchasedQtyNumber).toFixed(2)), 0);
  }, [purchasedQtyNumber, requestedQty]);

  const originalUnitCost = useMemo(
    () => parseNumber(item.unit_cost),
    [item.unit_cost, parseNumber]
  );
  const requestedLineTotal = useMemo(() => {
    if (requestedQty === null || originalUnitCost === null) {
      return null;
    }

    return Number((requestedQty * originalUnitCost).toFixed(2));
  }, [originalUnitCost, requestedQty]);

  const formatNumber = useCallback((value, options = {}) => {
    if (value === null || value === undefined) {
      return '—';
    }

    return Number(value).toLocaleString(undefined, options);
  }, []);

  const metaDetails = useMemo(() => {
    const details = [
      { label: 'Brand', value: item.brand },
      { label: 'Specs', value: item.specs },
      { label: 'Category', value: item.category },
      { label: 'Supplier', value: item.preferred_supplier },
    ];

    return details.filter((detail) => detail.value);
  }, [item.brand, item.category, item.preferred_supplier, item.specs]);

  const statusOptions = useMemo(
    () => [
      { value: 'pending', label: 'Pending Purchase' },
      { value: 'purchased', label: 'Purchased' },
      { value: 'not_procured', label: 'Not Procured' },
    ],
    []
  );

  const statusStyles = useMemo(
    () => ({
      pending: 'border-amber-200 bg-amber-50 text-amber-700',
      purchased: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      not_procured: 'border-rose-200 bg-rose-50 text-rose-700',
      completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      canceled: 'border-rose-200 bg-rose-50 text-rose-700',
    }),
    []
  );

  const handleSave = async () => {
    if (!status) {
      setMessage({ type: 'error', text: 'Please select a status.' });
      return;
    }

    const hasUnitCost = unitCost !== '' && unitCost !== null && unitCost !== undefined;
    const numericUnitCost = hasUnitCost ? Number(unitCost) : null;
    const numericQty = Number(purchasedQty);

    if (hasUnitCost && (Number.isNaN(numericUnitCost) || numericUnitCost < 0)) {
      setMessage({ type: 'error', text: 'Enter a valid unit cost (zero or above).' });
      return;
    }

    if (Number.isNaN(numericQty) || numericQty < 0) {
      setMessage({ type: 'error', text: 'Enter a valid purchased quantity (zero or above).' });
      return;
    }

    if (status === 'purchased') {
      if (numericQty <= 0) {
        setMessage({ type: 'error', text: 'Purchased items require a purchased quantity greater than zero.' });
        return;
      }
    }

    setSaving(true);
    setMessage(null);

    try {
      if (hasUnitCost) {
        await axios.put(`/api/requested-items/${item.id}/cost`, {
          unit_cost: numericUnitCost,
        });
      }

      await axios.put(`/api/requested-items/${item.id}/purchased-quantity`, {
        purchased_quantity: numericQty,
      });

      await axios.put(`/api/requested-items/${item.id}/procurement-status`, {
        procurement_status: status,
        procurement_comment: comment,
      });

      setMessage({ type: 'success', text: '✅ Updated successfully.' });
      if (onUpdate) onUpdate(); // Notify parent to refresh data
    } catch (err) {
      console.error('❌ Update error:', err);
      setMessage({
        type: 'error',
        text: err.response?.data?.message || '❌ Failed to update.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h4 className="text-lg font-semibold text-slate-800">{item.item_name}</h4>
            <p className="mt-1 text-sm text-slate-500">
              Requested quantity: <span className="font-medium text-slate-700">{formatNumber(requestedQty)}</span>
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
                    </span>{' '}
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
                  statusStyles[status] || 'border-slate-200 bg-slate-100 text-slate-700'
                }`}
              >
                {status.replace('_', ' ')}
              </span>
            )}
            {(updaterName || updatedAt) && (
              <div className="text-xs italic text-slate-500">
                Last updated by {updaterName || 'Unknown'} at {updatedAt || 'Unknown time'}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Requested Qty</p>
            <p className="mt-1 text-base font-semibold text-slate-700">{formatNumber(requestedQty)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Purchased Qty</p>
            <p className="mt-1 text-base font-semibold text-emerald-700">
              {formatNumber(purchasedQtyNumber)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Remaining Qty</p>
            <p className="mt-1 text-base font-semibold text-amber-700">{formatNumber(outstandingQty)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Requested Line Total</p>
            <p className="mt-1 text-base font-semibold text-slate-700">
              {formatNumber(requestedLineTotal, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Unit Cost</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {originalUnitCost !== null && (
              <p className="mt-1 text-xs text-slate-500">
                Originally requested at {formatNumber(originalUnitCost, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Purchased Quantity</label>
            <input
              type="number"
              min={0}
              value={purchasedQty}
              onChange={(e) => setPurchasedQty(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Procurement Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- Select Status --</option>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Comment</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-700">Recorded Line Total:</span>{' '}
            {formatNumber(totalCost, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 ${
              saving ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
            }`}
            type="button"
          >
            {saving ? 'Saving…' : 'Save Updates'}
          </button>
        </div>

        {message && (
          <div
            className={`mt-2 text-sm font-medium ${
              message.type === 'error' ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
          <h4 className="text-sm font-semibold text-slate-700">Item Attachments</h4>
          {loadingAttachments ? (
            <p className="text-xs text-slate-500">Loading attachments…</p>
          ) : attachmentsError ? (
            <p className="text-xs text-rose-600">{attachmentsError}</p>
          ) : attachments.length === 0 ? (
            <p className="text-xs text-slate-500">No attachments uploaded for this item.</p>
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
                        ? 'Downloading…'
                        : attachment.file_name || filename || 'Attachment'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcurementItemStatusPanel;