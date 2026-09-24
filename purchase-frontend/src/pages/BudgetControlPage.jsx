import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownToLine, Building2, CalendarDays, CheckCircle2, CircleDollarSign, Gauge, Plus, RefreshCw, WalletCards } from "lucide-react";
import { fetchDepartmentBudgets, saveDepartmentBudget } from "../api/budgetControl";
import api from "../api/axios";
import AmountInput from "../components/ui/AmountInput";

const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);
const percent = (used, total) => total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

const BudgetControlPage = () => {
  const currentYear = new Date().getUTCFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ department_id: "", fiscal_year: currentYear, allocated_amount: "" });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

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

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.allocated += Number(row.allocated_amount) || 0;
    acc.actual += Number(row.actual) || 0;
    acc.reserved += Number(row.reserved) || 0;
    acc.encumbered += Number(row.encumbered) || 0;
    acc.available += Number(row.available_strict) || 0;
    return acc;
  }, { allocated: 0, actual: 0, reserved: 0, encumbered: 0, available: 0 }), [rows]);

  const onSubmit = async (event) => {
    event.preventDefault(); setStatus("Saving..."); setError("");
    try {
      await saveDepartmentBudget({ department_id: Number(form.department_id), fiscal_year: Number(form.fiscal_year), allocated_amount: Number(form.allocated_amount), currency: "USD" });
      setStatus("Budget envelope saved successfully."); setShowForm(false); setForm((value) => ({ ...value, department_id: "", allocated_amount: "" }));
      await load();
    } catch (err) { setStatus(""); setError(err?.response?.data?.message || "Failed to save budget envelope."); }
  };

  const exportCsv = () => {
    const header = ["Department", "Allocated", "Reserved", "Encumbered", "Actual", "Available"];
    const body = rows.map((row) => [row.department_name, row.allocated_amount, row.reserved, row.encumbered, row.actual, row.available_strict]);
    const csv = [header, ...body].map((line) => line.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = `department-budgets-${fiscalYear}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-900 px-6 py-7 text-white shadow-xl sm:px-8">
      <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-emerald-300/10 blur-2xl" aria-hidden="true" />
      <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200"><WalletCards className="h-4 w-4" /> Financial governance</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Budget Control</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Allocate department envelopes and monitor commitments, reservations, and actual spend from one control center.</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={exportCsv} disabled={!rows.length} className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold disabled:opacity-50"><ArrowDownToLine className="h-4 w-4" /> Export</button><button onClick={() => setShowForm((value) => !value)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold shadow-lg"><Plus className="h-4 w-4" /> Set Budget</button></div>
      </div>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Budget summary">
      {[["Total allocation", money(totals.allocated), CircleDollarSign, "bg-blue-50 text-blue-700"], ["Committed", money(totals.reserved + totals.encumbered), Gauge, "bg-amber-50 text-amber-700"], ["Actual spend", money(totals.actual), CheckCircle2, "bg-violet-50 text-violet-700"], ["Strict availability", money(totals.available), WalletCards, totals.available < 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"]].map(([label, value, Icon, tone]) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></div><span className={`rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" /></span></div></article>)}
    </section>

    <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="rounded-lg bg-slate-100 p-2 text-slate-600"><CalendarDays className="h-5 w-5" /></span><label className="text-sm font-semibold text-slate-700">Fiscal year <select className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" value={fiscalYear} onChange={(e) => setFiscalYear(Number(e.target.value))}>{[currentYear - 1, currentYear, currentYear + 1].map((year) => <option key={year}>{year}</option>)}</select></label></div><button className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh data</button></section>

    {showForm && <form onSubmit={onSubmit} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5"><div className="mb-4"><h2 className="font-semibold text-slate-900">Set department budget</h2><p className="mt-1 text-sm text-slate-500">Create or update the annual spending envelope.</p></div><div className="grid gap-4 md:grid-cols-4"><label className="text-sm font-medium text-slate-700">Department<select aria-label="Department" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={form.department_id} onChange={(e) => setForm((p) => ({ ...p, department_id: e.target.value }))} required><option value="">Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Fiscal year<input aria-label="Budget fiscal year" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" value={form.fiscal_year} onChange={(e) => setForm((p) => ({ ...p, fiscal_year: e.target.value }))} required /></label><label className="text-sm font-medium text-slate-700">Allocated amount<AmountInput aria-label="Allocated amount" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" min="0" placeholder="0.00" value={form.allocated_amount} onChange={(e) => setForm((p) => ({ ...p, allocated_amount: e.target.value }))} required /></label><div className="flex items-end gap-2"><button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" type="submit">Save Budget</button><button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold" onClick={() => setShowForm(false)}>Cancel</button></div></div></form>}
    {status && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{status}</div>}{error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertTriangle className="h-4 w-4" />{error}</div>}

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-semibold text-slate-900">Department envelopes</h2><p className="mt-1 text-sm text-slate-500">Utilization includes reserved, encumbered, and actual spend.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{rows.length} departments</span></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500"><th className="px-5 py-3">Department</th><th className="px-5 py-3 text-right">Allocated</th><th className="px-5 py-3 text-right">Reserved</th><th className="px-5 py-3 text-right">Encumbered</th><th className="px-5 py-3 text-right">Actual</th><th className="px-5 py-3">Utilization</th><th className="px-5 py-3 text-right">Available (strict)</th></tr></thead><tbody>{rows.map((row) => { const used = Number(row.reserved || 0) + Number(row.encumbered || 0) + Number(row.actual || 0); const utilization = percent(used, Number(row.allocated_amount)); return <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><Building2 className="h-4 w-4" /></span><span className="font-semibold text-slate-900">{row.department_name}</span></div></td><td className="px-5 py-4 text-right font-medium">{money(row.allocated_amount)}</td><td className="px-5 py-4 text-right text-slate-600">{money(row.reserved)}</td><td className="px-5 py-4 text-right text-slate-600">{money(row.encumbered)}</td><td className="px-5 py-4 text-right text-slate-600">{money(row.actual)}</td><td className="min-w-[150px] px-5 py-4"><div className="mb-1 flex justify-between text-xs"><span>{utilization}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${utilization >= 90 ? "bg-red-500" : utilization >= 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${utilization}%` }} /></div></td><td className={`px-5 py-4 text-right font-bold ${Number(row.available_strict) < 0 ? "text-red-700" : "text-emerald-700"}`}>{money(row.available_strict)}</td></tr>; })}</tbody></table>{rows.length === 0 && !error && <div className="px-6 py-14 text-center text-sm text-slate-500">No budget envelopes found for {fiscalYear}.</div>}</div></section>
  </main>;
};

export default BudgetControlPage;