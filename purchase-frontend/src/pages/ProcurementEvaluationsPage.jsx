import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import procurementEvaluationsApi from "../api/procurementEvaluations";

const emptyCase = {
  title: "",
  description: "",
  category: "Laboratory",
  evaluation_type: "Laboratory Device",
  evaluation_period_years: 5,
  expected_annual_growth_rate: 0,
  currency: "USD",
};

const ProcurementEvaluationsPage = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [form, setForm] = useState(emptyCase);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadCases = async () => {
    setLoading(true);
    try {
      const response = await procurementEvaluationsApi.list();
      setCases(response.data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load procurement evaluations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await procurementEvaluationsApi.create(form);
      setForm(emptyCase);
      navigate(`/procurement-evaluations/${response.data.id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create evaluation.");
    } finally {
      setSaving(false);
    }
  };

  const handleCalculate = async (id) => {
    try {
      await procurementEvaluationsApi.calculate(id);
      await loadCases();
    } catch (err) {
      setError(err.response?.data?.message || "Calculation failed.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Procurement Evaluation Engine</p>
              <h1 className="text-3xl font-bold text-slate-900">Procurement Evaluations</h1>
              <p className="mt-2 text-sm text-slate-600">Compare laboratory analyzers, medical devices, IT systems, contracts, consumables, medications, and capital equipment using TCO and weighted decision criteria.</p>
            </div>
            <button onClick={loadCases} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Refresh</button>
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleCreate} className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:grid-cols-6">
          <input className="rounded-lg border border-slate-300 p-2 md:col-span-2" placeholder="Evaluation title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input className="rounded-lg border border-slate-300 p-2" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
          <select className="rounded-lg border border-slate-300 p-2" value={form.evaluation_type} onChange={(e) => setForm({ ...form, evaluation_type: e.target.value })}>
            {['General','Laboratory Device','Medical Device','IT System','Service Contract','Maintenance Contract','Consumables','Medication','Capital Equipment'].map((type) => <option key={type}>{type}</option>)}
          </select>
          <input type="number" min="1" className="rounded-lg border border-slate-300 p-2" value={form.evaluation_period_years} onChange={(e) => setForm({ ...form, evaluation_period_years: e.target.value })} />
          <button disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300">{saving ? "Creating…" : "New Evaluation"}</button>
        </form>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Evaluation Type</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Linked Request</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created By</th>
                  <th className="px-4 py-3">Selected Offer</th>
                  <th className="px-4 py-3">Best TCO</th>
                  <th className="px-4 py-3">Best Score</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan="12" className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>
                ) : cases.length === 0 ? (
                  <tr><td colSpan="12" className="px-4 py-8 text-center text-slate-500">No evaluations yet.</td></tr>
                ) : cases.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900"><Link to={`/procurement-evaluations/${item.id}`} className="text-indigo-700 hover:underline">{item.title}</Link></td>
                    <td className="px-4 py-3">{item.category}</td>
                    <td className="px-4 py-3">{item.evaluation_type}</td>
                    <td className="px-4 py-3">{item.department_name || item.department_id || "—"}</td>
                    <td className="px-4 py-3">{item.request_id ? `#${item.request_id}` : "Manual"}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{item.status}</span></td>
                    <td className="px-4 py-3">{item.created_by_name || item.created_by || "—"}</td>
                    <td className="px-4 py-3">{item.selected_offer_name || "—"}</td>
                    <td className="px-4 py-3">{item.best_tco ? Number(item.best_tco).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3">{item.best_score ? Number(item.best_score).toFixed(2) : "—"}</td>
                    <td className="px-4 py-3">{item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}</td>
                    <td className="space-x-2 whitespace-nowrap px-4 py-3">
                      <Link className="font-semibold text-indigo-700 hover:underline" to={`/procurement-evaluations/${item.id}`}>Open</Link>
                      <button className="font-semibold text-emerald-700 hover:underline" onClick={() => handleCalculate(item.id)}>Calculate</button>
                      <Link className="font-semibold text-slate-700 hover:underline" to={`/procurement-evaluations/${item.id}#recommendation`}>Finalize</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcurementEvaluationsPage;