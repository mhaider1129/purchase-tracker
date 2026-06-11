import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDepartmentBudgets, saveDepartmentBudget } from "../api/budgetControl";
import api from "../api/axios";
import AmountInput from "../components/ui/AmountInput";

const BudgetControlPage = () => {
  const [fiscalYear, setFiscalYear] = useState(new Date().getUTCFullYear());
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ department_id: "", fiscal_year: new Date().getUTCFullYear(), allocated_amount: "" });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [budgetRows, departmentRows] = await Promise.all([
        fetchDepartmentBudgets(fiscalYear),
        api.get("/departments").then((res) => res.data || []),
      ]);
      setRows(budgetRows);
      setDepartments(departmentRows || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load budget control data.");
      setRows([]);
    }
  }, [fiscalYear]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => rows.reduce((acc, r) => {
    acc.allocated += Number(r.allocated_amount) || 0;
    acc.actual += Number(r.actual) || 0;
    acc.reserved += Number(r.reserved) || 0;
    return acc;
  }, { allocated: 0, actual: 0, reserved: 0 }), [rows]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus("Saving...");
    setError("");
    try {
      await saveDepartmentBudget({
        department_id: Number(form.department_id),
        fiscal_year: Number(form.fiscal_year),
        allocated_amount: Number(form.allocated_amount),
        currency: "USD",
      });
      setStatus("Saved.");
      await load();
    } catch (err) {
      setStatus("");
      setError(err?.response?.data?.message || "Failed to save budget envelope.");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Budget Control</h1>
      <p className="text-sm text-gray-600">SCM can allocate department budgets and monitor reserved/encumbered/actual spend.</p>

      <div className="flex gap-3 items-end">
        <label className="text-sm">Fiscal Year
          <input className="border rounded ml-2 px-2 py-1" type="number" value={fiscalYear} onChange={(e) => setFiscalYear(Number(e.target.value))} />
        </label>
      </div>

      <form onSubmit={onSubmit} className="border rounded p-4 grid md:grid-cols-4 gap-3">
        <select className="border rounded px-2 py-1" value={form.department_id} onChange={(e) => setForm((p) => ({ ...p, department_id: e.target.value }))} required>
          <option value="">Select department</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input className="border rounded px-2 py-1" type="number" value={form.fiscal_year} onChange={(e) => setForm((p) => ({ ...p, fiscal_year: e.target.value }))} required />
        <AmountInput className="border rounded px-2 py-1" min="0" placeholder="Allocated amount" value={form.allocated_amount} onChange={(e) => setForm((p) => ({ ...p, allocated_amount: e.target.value }))} required />
        <button className="bg-blue-600 text-white rounded px-3 py-1" type="submit">Save Budget</button>
      </form>
      {status && <div className="text-sm text-gray-700">{status}</div>}
      {error && <div className="text-sm text-red-700">{error}</div>}

      <div className="text-sm">Totals — Allocated: {totals.allocated.toFixed(2)} | Reserved: {totals.reserved.toFixed(2)} | Actual: {totals.actual.toFixed(2)}</div>
      <div className="overflow-auto">
        <table className="min-w-full border">
          <thead><tr className="bg-gray-100"><th className="p-2 text-left">Department</th><th className="p-2">Allocated</th><th className="p-2">Reserved</th><th className="p-2">Encumbered</th><th className="p-2">Actual</th><th className="p-2">Available (strict)</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.department_name}</td>
                <td className="p-2 text-right">{Number(r.allocated_amount).toFixed(2)}</td>
                <td className="p-2 text-right">{Number(r.reserved).toFixed(2)}</td>
                <td className="p-2 text-right">{Number(r.encumbered).toFixed(2)}</td>
                <td className="p-2 text-right">{Number(r.actual).toFixed(2)}</td>
                <td className="p-2 text-right">{Number(r.available_strict).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BudgetControlPage;