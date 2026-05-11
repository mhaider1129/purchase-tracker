import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  createGoodsReceipt,
  getPurchaseOrderDetail,
  listGoodsReceipts,
  listOpenPosForReceipt,
} from '../api/procureToPay';

const USER_ROLES = [
  'Warehouse keeper',
  'Receiving clerk',
  'Pharmacist / technical inspector',
  'Biomedical engineer',
  'Quality officer',
];

const WORKFLOW_STEPS = [
  {
    code: 'A',
    title: 'User receives delivery',
    points: ['Search the purchase order in the system.', 'Select the PO to start the receipt and inspection process.'],
  },
  {
    code: 'B',
    title: 'System displays expected items',
    points: ['Compare ordered quantity with delivered quantity.', 'Verify batch / serial, expiry, and physical condition.'],
  },
  {
    code: 'C',
    title: 'Inspection is performed',
    points: ['Quantity check', 'Technical inspection', 'Quality inspection', 'Documentation review'],
  },
  {
    code: 'D',
    title: 'User records receipt result',
    points: ['Full receipt', 'Partial receipt', 'Rejected', 'Accepted with discrepancy'],
  },
  {
    code: 'E',
    title: 'Goods Receipt Note is posted',
    points: ['Inventory updates automatically after posting.', 'The receipt becomes part of the procure-to-pay audit trail.'],
  },
  {
    code: 'F',
    title: 'Discrepancies are routed',
    points: ['Procurement', 'Finance', 'Supplier manager'],
  },
];

const OUTCOME_OPTIONS = [
  { value: 'FULL_RECEIPT', label: 'Full receipt' },
  { value: 'PARTIAL_RECEIPT', label: 'Partial receipt' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ACCEPTED_WITH_DISCREPANCY', label: 'Accepted with discrepancy' },
];

const CONDITION_OPTIONS = ['Good', 'Damaged', 'Expired', 'Needs technical review', 'Missing documents'];
const INSPECTION_OPTIONS = ['Quantity check', 'Technical inspection', 'Quality inspection', 'Documentation review'];

const formatDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
};

const createLineFromPoItem = (item) => {
  const orderedQuantity = Number(item.quantity) || 0;
  const receivedToDate = Number(item.received_quantity) || 0;
  const remainingQuantity = Math.max(orderedQuantity - receivedToDate, 0);

  return {
    purchase_order_item_id: item.id,
    requested_item_id: item.requested_item_id || null,
    item_name: item.item_name || item.description || `PO Item #${item.id}`,
    ordered_quantity: orderedQuantity,
    previously_received_quantity: receivedToDate,
    remaining_quantity: remainingQuantity,
    delivered_quantity: remainingQuantity,
    damaged_quantity: 0,
    short_quantity: 0,
    unit_price: Number(item.unit_price) || 0,
    batch_or_serial: '',
    expiry_date: '',
    condition: 'Good',
    inspection_notes: '',
  };
};

const ProcureToPayGoodsReceiptsPage = () => {
  const { requestId: requestIdParam } = useParams();
  const [rows, setRows] = useState([]);
  const [openPos, setOpenPos] = useState([]);
  const [filters, setFilters] = useState({
    supplier: '',
    po_id: '',
    status: '',
    date_from: '',
    date_to: '',
  });
  const [selectedPoId, setSelectedPoId] = useState('');
  const [selectedPo, setSelectedPo] = useState(null);
  const [poItems, setPoItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [receiptForm, setReceiptForm] = useState({
    warehouse_location: '',
    received_at: formatDateTimeLocal(new Date()),
    outcome: 'FULL_RECEIPT',
    inspection_types: ['Quantity check'],
    notes: '',
    discrepancy_notes: '',
  });

  const scopedRequestId = requestIdParam ? Number(requestIdParam) : null;

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [grRes, poRes] = await Promise.all([
        listGoodsReceipts({
          supplier: filters.supplier || undefined,
          po_id: filters.po_id || undefined,
          status: filters.status || undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
        }),
        listOpenPosForReceipt(),
      ]);

      const receiptRows = grRes?.data || [];
      const receiptList = scopedRequestId
        ? receiptRows.filter((row) => Number(row.request_id) === scopedRequestId)
        : receiptRows;
      const openPoRows = poRes?.data || [];
      const openPoList = scopedRequestId
        ? openPoRows.filter((po) => Number(po.request_id) === scopedRequestId)
        : openPoRows;

      setRows(receiptList);
      setOpenPos(openPoList);

      if (!selectedPoId && openPoList.length > 0) {
        const nextPoId = String(openPoList[0].id);
        setSelectedPoId(nextPoId);
      }
    } catch (loadError) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load goods receipt data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestIdParam]);

  useEffect(() => {
    const shouldLoadSelectedPo = selectedPoId && openPos.some((po) => String(po.id) === String(selectedPoId));
    if (!shouldLoadSelectedPo) {
      if (!selectedPoId) {
        setSelectedPo(null);
        setPoItems([]);
      }
      return;
    }

    const fetchPo = async () => {
      setError('');
      try {
        const response = await getPurchaseOrderDetail(selectedPoId);
        const purchaseOrder = response?.purchase_order || null;
        const items = (response?.items || []).map(createLineFromPoItem);
        setSelectedPo(purchaseOrder);
        setPoItems(items);
        setReceiptForm((prev) => ({
          ...prev,
          warehouse_location: prev.warehouse_location || purchaseOrder?.delivery_location || '',
        }));
      } catch (fetchError) {
        setError(fetchError?.response?.data?.message || fetchError?.message || 'Unable to load PO details for inspection.');
      }
    };

    fetchPo();
  }, [selectedPoId, openPos]);

  const selectedPoSummary = useMemo(
    () => openPos.find((po) => String(po.id) === String(selectedPoId)) || null,
    [openPos, selectedPoId]
  );

  const discrepancyDetected = useMemo(
    () =>
      receiptForm.outcome !== 'FULL_RECEIPT' ||
      poItems.some(
        (item) =>
          Number(item.damaged_quantity) > 0 ||
          Number(item.short_quantity) > 0 ||
          item.condition !== 'Good'
      ) ||
      Boolean(receiptForm.discrepancy_notes.trim()),
    [poItems, receiptForm.discrepancy_notes, receiptForm.outcome]
  );

  const totals = useMemo(() => {
    return poItems.reduce(
      (acc, item) => {
        acc.ordered += Number(item.ordered_quantity) || 0;
        acc.previouslyReceived += Number(item.previously_received_quantity) || 0;
        acc.delivered += Number(item.delivered_quantity) || 0;
        acc.damaged += Number(item.damaged_quantity) || 0;
        acc.short += Number(item.short_quantity) || 0;
        return acc;
      },
      { ordered: 0, previouslyReceived: 0, delivered: 0, damaged: 0, short: 0 }
    );
  }, [poItems]);

  const updateLine = (index, field, value) => {
    setPoItems((prev) =>
      prev.map((item, currentIndex) => {
        if (currentIndex !== index) return item;

        const nextItem = { ...item, [field]: value };
        if (field === 'delivered_quantity') {
          const delivered = Math.max(Number(value) || 0, 0);
          nextItem.delivered_quantity = delivered;
          if ((Number(nextItem.short_quantity) || 0) > delivered) {
            nextItem.short_quantity = delivered;
          }
          if ((Number(nextItem.damaged_quantity) || 0) > delivered) {
            nextItem.damaged_quantity = delivered;
          }
        }

        return nextItem;
      })
    );
  };

  const toggleInspectionType = (inspectionType) => {
    setReceiptForm((prev) => {
      const exists = prev.inspection_types.includes(inspectionType);
      return {
        ...prev,
        inspection_types: exists
          ? prev.inspection_types.filter((entry) => entry !== inspectionType)
          : [...prev.inspection_types, inspectionType],
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedPo || !selectedPo.id) {
      setError('Select a purchase order before posting a goods receipt.');
      return;
    }

    const requestId = Number(selectedPo.request_id || scopedRequestId);
    if (!requestId) {
      setError('The selected purchase order is not linked to a request.');
      return;
    }

    const receiptItems = poItems
      .filter((item) => Number(item.delivered_quantity) > 0)
      .map((item) => ({
        requested_item_id: item.requested_item_id,
        item_name: item.item_name,
        ordered_quantity: Number(item.ordered_quantity) || 0,
        received_quantity: Number(item.delivered_quantity) || 0,
        damaged_quantity: Number(item.damaged_quantity) || 0,
        short_quantity: Number(item.short_quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
        line_notes: [
          `Batch/Serial: ${item.batch_or_serial || 'N/A'}`,
          `Expiry: ${item.expiry_date || 'N/A'}`,
          `Condition: ${item.condition || 'N/A'}`,
          item.inspection_notes ? `Inspection notes: ${item.inspection_notes}` : null,
        ]
          .filter(Boolean)
          .join(' | '),
      }));

    if (receiptItems.length === 0) {
      setError('Enter a delivered quantity for at least one line item.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createGoodsReceipt(requestId, {
        purchase_order_id: selectedPo.id,
        warehouse_location: receiptForm.warehouse_location || null,
        received_at: receiptForm.received_at ? new Date(receiptForm.received_at).toISOString() : null,
        notes: [
          `Outcome: ${OUTCOME_OPTIONS.find((option) => option.value === receiptForm.outcome)?.label || receiptForm.outcome}`,
          `Inspection types: ${receiptForm.inspection_types.join(', ') || 'None selected'}`,
          receiptForm.notes || null,
        ]
          .filter(Boolean)
          .join(' | '),
        discrepancy_notes: receiptForm.discrepancy_notes || null,
        items: receiptItems,
      });

      setSuccess('Goods receipt posted. Inventory and discrepancy routing were updated.');
      setReceiptForm((prev) => ({
        ...prev,
        received_at: formatDateTimeLocal(new Date()),
        notes: '',
        discrepancy_notes: '',
        outcome: 'FULL_RECEIPT',
        inspection_types: ['Quantity check'],
      }));
      await load();
      const refreshedPo = await getPurchaseOrderDetail(selectedPo.id);
      setSelectedPo(refreshedPo?.purchase_order || null);
      setPoItems((refreshedPo?.items || []).map(createLineFromPoItem));
    } catch (submitError) {
      setError(submitError?.response?.data?.message || submitError?.message || 'Unable to post the goods receipt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Goods Receipt / Inspection Module</h1>
          <p className="max-w-4xl text-sm text-gray-600">
            Confirm what was actually delivered, verify that it meets quantity, technical, quality, and documentation requirements,
            then post the Goods Receipt Note so warehouse stock and discrepancy status stay accurate.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link to="/procure-to-pay/purchase-orders" className="rounded border px-3 py-1">Purchase Orders</Link>
          <Link to="/procure-to-pay/invoices" className="rounded border px-3 py-1">Invoice Matching</Link>
          <Link to="/procure-to-pay/document-flow" className="rounded bg-slate-800 px-3 py-1 text-white">Document Flow</Link>
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      <div className="grid gap-4 xl:grid-cols-[2fr,1fr]">
        <section className="rounded bg-white p-4 shadow space-y-3">
          <div>
            <h2 className="font-semibold text-slate-900">Main purpose</h2>
            <p className="mt-1 text-sm text-gray-600">Confirm what was actually delivered and whether it meets requirements before stock is posted.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Users involved</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {USER_ROLES.map((role) => (
                <span key={role} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{role}</span>
              ))}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {WORKFLOW_STEPS.map((step) => (
              <article key={step.code} className="rounded border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Step {step.code}</p>
                <h3 className="mt-1 font-medium text-slate-900">{step.title}</h3>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-gray-600">
                  {step.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <aside className="rounded bg-white p-4 shadow space-y-4">
          <div>
            <h2 className="font-semibold text-slate-900">Completion point</h2>
            <p className="mt-1 text-sm text-gray-600">Receipt is posted accurately and stock / discrepancy status is updated.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Feeds other modules</h3>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-gray-600">
              <li>Warehouse stock</li>
              <li>Invoice matching</li>
              <li>Supplier performance</li>
              <li>Audit logs</li>
              <li>Non-compliance records</li>
            </ul>
          </div>
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-medium">Discrepancy routing</p>
            <p className="mt-1">When a mismatch is captured, procurement, finance, and the supplier manager should be alerted for follow-up.</p>
          </div>
        </aside>
      </div>

      <section className="rounded bg-white p-4 shadow space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Receipt register</h2>
          {isLoading && <span className="text-sm text-gray-500">Loading receipts…</span>}
        </div>
        <div className="grid gap-2 md:grid-cols-5 xl:grid-cols-6">
          <input className="rounded border px-3 py-2 text-sm" placeholder="Supplier" value={filters.supplier} onChange={(event) => setFilters((prev) => ({ ...prev, supplier: event.target.value }))} />
          <input className="rounded border px-3 py-2 text-sm" placeholder="PO ID" value={filters.po_id} onChange={(event) => setFilters((prev) => ({ ...prev, po_id: event.target.value }))} />
          <select className="rounded border px-3 py-2 text-sm" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
            <option value="">All statuses</option>
            <option value="POSTED">Posted</option>
            <option value="FULLY_RECEIVED">Fully received</option>
            <option value="PARTIAL">Partial</option>
            <option value="NO_PO">No PO</option>
          </select>
          <input className="rounded border px-3 py-2 text-sm" type="date" value={filters.date_from} onChange={(event) => setFilters((prev) => ({ ...prev, date_from: event.target.value }))} />
          <input className="rounded border px-3 py-2 text-sm" type="date" value={filters.date_to} onChange={(event) => setFilters((prev) => ({ ...prev, date_to: event.target.value }))} />
          <button className="rounded bg-blue-600 px-3 py-2 text-sm text-white" onClick={load}>Search receipts</button>
        </div>

        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Receipt Number</th>
                <th className="p-2 text-left">PO Number</th>
                <th className="p-2 text-left">Supplier</th>
                <th className="p-2 text-left">Receipt Date</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Received By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-2">{row.receipt_number}</td>
                  <td className="p-2">{row.po_number || '-'}</td>
                  <td className="p-2">{row.supplier_name || '-'}</td>
                  <td className="p-2">{row.received_at ? new Date(row.received_at).toLocaleString() : '-'}</td>
                  <td className="p-2">{row.status}</td>
                  <td className="p-2">{row.received_by}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="p-3 text-center text-gray-500" colSpan={6}>No goods receipts found for the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr,1.9fr]">
        <section className="rounded bg-white p-4 shadow space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Open POs awaiting receipt</h2>
            <span className="text-sm text-gray-500">{openPos.length} open</span>
          </div>
          <p className="text-sm text-gray-600">Start with a purchase order, then compare expected items against the actual delivery and post the result.</p>

          <select
            className="w-full rounded border px-3 py-2 text-sm"
            value={selectedPoId}
            onChange={(event) => setSelectedPoId(event.target.value)}
          >
            <option value="">Select PO for inspection</option>
            {openPos.map((po) => (
              <option key={po.id} value={po.id}>
                {po.po_number} · {po.supplier_name || 'Supplier not set'} · {Number(po.received_qty || 0)}/{Number(po.ordered_qty || 0)} received
              </option>
            ))}
          </select>

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {openPos.map((po) => {
              const isActive = String(po.id) === String(selectedPoId);
              return (
                <button
                  key={po.id}
                  type="button"
                  onClick={() => setSelectedPoId(String(po.id))}
                  className={`w-full rounded border p-3 text-left text-sm transition ${isActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">{po.po_number}</span>
                    <span className="text-xs text-gray-500">Request #{po.request_id || 'N/A'}</span>
                  </div>
                  <p className="mt-1 text-gray-600">{po.supplier_name || 'Supplier not set'}</p>
                  <p className="mt-1 text-xs text-gray-500">Ordered: {Number(po.ordered_qty || 0).toFixed(2)} · Received: {Number(po.received_qty || 0).toFixed(2)}</p>
                </button>
              );
            })}
            {openPos.length === 0 && <p className="text-sm text-gray-500">No open purchase orders are waiting for receipt.</p>}
          </div>
        </section>

        <form className="rounded bg-white p-4 shadow space-y-4" onSubmit={handleSubmit}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Inspection and receipt posting</h2>
              <p className="mt-1 text-sm text-gray-600">Search the PO, review expected items, perform checks, record the result, then post the Goods Receipt Note.</p>
            </div>
            {selectedPoSummary && (
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <p><span className="font-medium">PO:</span> {selectedPoSummary.po_number}</p>
                <p><span className="font-medium">Supplier:</span> {selectedPoSummary.supplier_name || '-'}</p>
              </div>
            )}
          </div>

          {discrepancyDetected && (
            <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Discrepancy detected. On posting, follow-up should be routed to procurement, finance, and the supplier manager.
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm text-gray-700">
              Warehouse location
              <input className="mt-1 w-full rounded border px-3 py-2" value={receiptForm.warehouse_location} onChange={(event) => setReceiptForm((prev) => ({ ...prev, warehouse_location: event.target.value }))} placeholder="Receiving bay / warehouse" />
            </label>
            <label className="text-sm text-gray-700">
              Received at
              <input className="mt-1 w-full rounded border px-3 py-2" type="datetime-local" value={receiptForm.received_at} onChange={(event) => setReceiptForm((prev) => ({ ...prev, received_at: event.target.value }))} />
            </label>
            <label className="text-sm text-gray-700">
              Receipt result
              <select className="mt-1 w-full rounded border px-3 py-2" value={receiptForm.outcome} onChange={(event) => setReceiptForm((prev) => ({ ...prev, outcome: event.target.value }))}>
                {OUTCOME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <p className="font-medium">Receipt totals</p>
              <p>Ordered {totals.ordered.toFixed(2)} · Previously received {totals.previouslyReceived.toFixed(2)}</p>
              <p>Delivered now {totals.delivered.toFixed(2)} · Damaged {totals.damaged.toFixed(2)} · Short {totals.short.toFixed(2)}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-900">Inspection types performed</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {INSPECTION_OPTIONS.map((inspectionType) => {
                const active = receiptForm.inspection_types.includes(inspectionType);
                return (
                  <button
                    key={inspectionType}
                    type="button"
                    onClick={() => toggleInspectionType(inspectionType)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                  >
                    {inspectionType}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto rounded border">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Item</th>
                  <th className="p-2 text-right">Ordered</th>
                  <th className="p-2 text-right">Prev. received</th>
                  <th className="p-2 text-right">Delivered</th>
                  <th className="p-2 text-left">Batch / Serial</th>
                  <th className="p-2 text-left">Expiry</th>
                  <th className="p-2 text-left">Condition</th>
                  <th className="p-2 text-right">Damaged</th>
                  <th className="p-2 text-right">Short</th>
                </tr>
              </thead>
              <tbody>
                {poItems.map((item, index) => (
                  <React.Fragment key={`${item.purchase_order_item_id || item.item_name}-${index}`}>
                    <tr className="border-t align-top">
                      <td className="p-2">
                        <p className="font-medium text-slate-900">{item.item_name}</p>
                        <textarea className="mt-2 w-full rounded border px-2 py-1 text-xs" rows={2} placeholder="Inspection notes / documentation review findings" value={item.inspection_notes} onChange={(event) => updateLine(index, 'inspection_notes', event.target.value)} />
                      </td>
                      <td className="p-2 text-right">{Number(item.ordered_quantity || 0).toFixed(2)}</td>
                      <td className="p-2 text-right">{Number(item.previously_received_quantity || 0).toFixed(2)}</td>
                      <td className="p-2"><input className="w-24 rounded border px-2 py-1 text-right" type="number" min="0" step="0.01" value={item.delivered_quantity} onChange={(event) => updateLine(index, 'delivered_quantity', event.target.value)} /></td>
                      <td className="p-2"><input className="w-full rounded border px-2 py-1" value={item.batch_or_serial} onChange={(event) => updateLine(index, 'batch_or_serial', event.target.value)} placeholder="Batch / serial" /></td>
                      <td className="p-2"><input className="w-full rounded border px-2 py-1" type="date" value={item.expiry_date} onChange={(event) => updateLine(index, 'expiry_date', event.target.value)} /></td>
                      <td className="p-2">
                        <select className="w-full rounded border px-2 py-1" value={item.condition} onChange={(event) => updateLine(index, 'condition', event.target.value)}>
                          {CONDITION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </td>
                      <td className="p-2"><input className="w-24 rounded border px-2 py-1 text-right" type="number" min="0" step="0.01" value={item.damaged_quantity} onChange={(event) => updateLine(index, 'damaged_quantity', event.target.value)} /></td>
                      <td className="p-2"><input className="w-24 rounded border px-2 py-1 text-right" type="number" min="0" step="0.01" value={item.short_quantity} onChange={(event) => updateLine(index, 'short_quantity', event.target.value)} /></td>
                    </tr>
                  </React.Fragment>
                ))}
                {poItems.length === 0 && (
                  <tr>
                    <td className="p-3 text-center text-gray-500" colSpan={9}>Select an open PO to inspect delivery lines.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <label className="text-sm text-gray-700">
              Receipt notes
              <textarea className="mt-1 w-full rounded border px-3 py-2" rows={3} value={receiptForm.notes} onChange={(event) => setReceiptForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Record documentation review notes, acceptance rationale, or special handling instructions" />
            </label>
            <label className="text-sm text-gray-700">
              Discrepancy notes
              <textarea className="mt-1 w-full rounded border px-3 py-2" rows={3} value={receiptForm.discrepancy_notes} onChange={(event) => setReceiptForm((prev) => ({ ...prev, discrepancy_notes: event.target.value }))} placeholder="Capture mismatch details for procurement, finance, supplier manager, quality, or audit follow-up" />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60" type="submit" disabled={isSubmitting || !selectedPoId}>
              {isSubmitting ? 'Posting receipt…' : 'Post Goods Receipt Note'}
            </button>
            <span className="text-sm text-gray-500">Inventory updates automatically after posting.</span>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProcureToPayGoodsReceiptsPage;