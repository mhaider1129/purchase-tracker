import React, { useEffect, useState } from 'react';
import { listApInvoices, submitInvoice } from '../api/procureToPay';
import { createSupplier } from '../api/suppliers';
import { useSuppliers } from '../hooks/useSuppliers';

const EMPTY_SUPPLIER_FORM = { name: '', contact_email: '', contact_phone: '' };

const ProcureToPayInvoicesPage = () => {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ search: '', supplier: '', status: 'ALL' });
  const [form, setForm] = useState({
    request_id: '',
    supplier_id: '',
    supplier: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().slice(0, 10),
    subtotal_amount: '',
  });
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER_FORM);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [error, setError] = useState('');

  const loadInvoices = async () => {
    const res = await listApInvoices({
      search: filters.search || undefined,
      supplier: filters.supplier || undefined,
      status: filters.status === 'ALL' ? undefined : filters.status,
    });
    setRows(res?.data || []);
  };

  const { suppliers, reloadSuppliers, suppliersError } = useSuppliers();

  useEffect(() => {
    loadInvoices();
  }, []);

  const selectedSupplier = suppliers.find((entry) => Number(entry.id) === Number(form.supplier_id));

  const onCreateInvoice = async () => {
    try {
      setError('');
      await submitInvoice(Number(form.request_id), {
        supplier_id: form.supplier_id ? Number(form.supplier_id) : undefined,
        supplier: selectedSupplier?.name || form.supplier,
        invoice_number: form.invoice_number,
        invoice_date: form.invoice_date,
        subtotal_amount: Number(form.subtotal_amount),
        total_amount: Number(form.subtotal_amount),
        items: [],
      });
      setForm((prev) => ({ ...prev, invoice_number: '', subtotal_amount: '' }));
      await loadInvoices();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create invoice');
    }
  };

  const onCreateSupplier = async () => {
    try {
      setError('');
      const created = await createSupplier(supplierForm);
      await reloadSuppliers();
      setForm((prev) => ({ ...prev, supplier_id: String(created.id), supplier: created.name }));
      setSupplierForm(EMPTY_SUPPLIER_FORM);
      setShowSupplierForm(false);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create supplier');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">A/P Invoices</h1>
      <div className="bg-white p-4 rounded shadow grid md:grid-cols-4 gap-2">
        <input className="border rounded px-2 py-1" placeholder="Search invoice" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
        <input className="border rounded px-2 py-1" placeholder="Supplier" value={filters.supplier} onChange={(e) => setFilters((p) => ({ ...p, supplier: e.target.value }))} />
        <select className="border rounded px-2 py-1" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}><option>ALL</option><option>SUBMITTED</option><option>PENDING_MATCH</option><option>EXCEPTION</option></select>
        <button className="bg-indigo-600 text-white rounded px-3 py-1" onClick={loadInvoices}>Search</button>
      </div>

      <div className="bg-white p-4 rounded shadow space-y-3">
        <h2 className="font-semibold">Create invoice</h2>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {suppliersError ? <p className="text-sm text-amber-700">{suppliersError}</p> : null}
        <div className="grid md:grid-cols-5 gap-2">
          <input className="border rounded px-2 py-1" placeholder="Request ID" value={form.request_id} onChange={(e) => setForm((p) => ({ ...p, request_id: e.target.value }))} />
          <select className="border rounded px-2 py-1" value={form.supplier_id} onChange={(e) => {
            const supplierId = e.target.value;
            const found = suppliers.find((entry) => String(entry.id) === supplierId);
            setForm((p) => ({ ...p, supplier_id: supplierId, supplier: found?.name || '' }));
          }}>
            <option value="">Select supplier</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
          <input className="border rounded px-2 py-1" placeholder="Invoice Number" value={form.invoice_number} onChange={(e) => setForm((p) => ({ ...p, invoice_number: e.target.value }))} />
          <input className="border rounded px-2 py-1" type="date" value={form.invoice_date} onChange={(e) => setForm((p) => ({ ...p, invoice_date: e.target.value }))} />
          <input className="border rounded px-2 py-1" placeholder="Amount" value={form.subtotal_amount} onChange={(e) => setForm((p) => ({ ...p, subtotal_amount: e.target.value }))} />
        </div>
        <div className="flex items-center gap-2">
          <button className="bg-blue-600 text-white rounded px-3 py-1" onClick={onCreateInvoice}>Create</button>
          <button className="border rounded px-3 py-1" onClick={() => setShowSupplierForm((value) => !value)}>
            {showSupplierForm ? 'Cancel new supplier' : 'Create new supplier'}
          </button>
        </div>

        {showSupplierForm ? (
          <div className="rounded border p-3 bg-gray-50 space-y-2">
            <p className="text-sm font-medium">New supplier (SRM rules: name required, optional contact details)</p>
            <div className="grid md:grid-cols-3 gap-2">
              <input className="border rounded px-2 py-1" placeholder="Supplier name" value={supplierForm.name} onChange={(e) => setSupplierForm((p) => ({ ...p, name: e.target.value }))} />
              <input className="border rounded px-2 py-1" placeholder="Contact email" value={supplierForm.contact_email} onChange={(e) => setSupplierForm((p) => ({ ...p, contact_email: e.target.value }))} />
              <input className="border rounded px-2 py-1" placeholder="Contact phone" value={supplierForm.contact_phone} onChange={(e) => setSupplierForm((p) => ({ ...p, contact_phone: e.target.value }))} />
            </div>
            <button className="bg-emerald-600 text-white rounded px-3 py-1" onClick={onCreateSupplier}>Save supplier</button>
          </div>
        ) : null}
      </div>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-left">Invoice Number</th><th className="p-2 text-left">Supplier</th><th className="p-2 text-left">PO/GRPO Ref</th><th className="p-2 text-left">Invoice Date</th><th className="p-2 text-left">Due Date</th><th className="p-2 text-left">Status</th><th className="p-2 text-right">Amount</th><th className="p-2 text-left">Actions</th></tr></thead><tbody>
          {rows.map((row) => <tr key={row.id} className="border-t"><td className="p-2">{row.invoice_number}</td><td className="p-2">{row.supplier}</td><td className="p-2">{row.po_number || row.receipt_number || '-'}</td><td className="p-2">{row.invoice_date}</td><td className="p-2">{row.due_date || '-'}</td><td className="p-2">{row.status}</td><td className="p-2 text-right">{Number(row.total_amount).toFixed(2)}</td><td className="p-2">Open</td></tr>)}
        </tbody></table>
      </div>
    </div>
  );
};

export default ProcureToPayInvoicesPage;