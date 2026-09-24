import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";
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

const statusStyles = {
  Finalized: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "In Review": "bg-amber-50 text-amber-700 ring-amber-200",
  Draft: "bg-slate-100 text-slate-600 ring-slate-200",
};

const formatMoney = (value, currency = "USD") => {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
};

const ProcurementEvaluationsPage = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [form, setForm] = useState(emptyCase);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calculatingId, setCalculatingId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [typeFilter, setTypeFilter] = useState("All types");
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
    setCalculatingId(id);
    try {
      await procurementEvaluationsApi.calculate(id);
      await loadCases();
    } catch (err) {
      setError(err.response?.data?.message || "Calculation failed.");
    } finally {
      setCalculatingId(null);
    }
  };

  const statuses = useMemo(
    () => [...new Set(cases.map((item) => item.status).filter(Boolean))],
    [cases],
  );
  const types = useMemo(
    () => [...new Set(cases.map((item) => item.evaluation_type).filter(Boolean))],
    [cases],
  );
  const filteredCases = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cases.filter((item) => {
      const matchesQuery = !needle || [item.title, item.category, item.department_name, item.created_by_name]
        .some((value) => String(value || "").toLowerCase().includes(needle));
      const matchesStatus = statusFilter === "All statuses" || item.status === statusFilter;
      const matchesType = typeFilter === "All types" || item.evaluation_type === typeFilter;
      return matchesQuery && matchesStatus && matchesType;
    });
  }, [cases, query, statusFilter, typeFilter]);

  const metrics = useMemo(() => {
    const finalized = cases.filter((item) => ["Finalized", "Completed"].includes(item.status)).length;
    const inReview = cases.filter((item) => item.status === "In Review").length;
    const scored = cases.filter((item) => item.best_score !== null && item.best_score !== undefined);
    return {
      active: Math.max(0, cases.length - finalized),
      inReview,
      finalized,
      averageScore: scored.length
        ? scored.reduce((sum, item) => sum + Number(item.best_score || 0), 0) / scored.length
        : 0,
    };
  }, [cases]);

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("All statuses");
    setTypeFilter("All types");
  };
  const hasFilters = query || statusFilter !== "All statuses" || typeFilter !== "All types";

  return (
    <div className="min-h-screen bg-[#f4f7fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px] space-y-6">
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl shadow-slate-200 sm:px-8">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute bottom-0 right-1/3 h-28 w-28 rounded-full bg-cyan-400/10 blur-2xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">
                <Sparkles size={15} /> Decision intelligence workspace
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Procurement Evaluation Engine</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Compare commercial scenarios, quantify whole-life cost, and turn weighted evidence into an auditable award recommendation.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={loadCases} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold backdrop-blur hover:bg-white/10 disabled:opacity-60">
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
              <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold shadow-lg shadow-indigo-950/30 hover:bg-indigo-400">
                <Plus size={17} /> New evaluation
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Evaluation summary">
          {[
            { label: "Active evaluations", value: metrics.active, detail: `${cases.length} total cases`, icon: BarChart3, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Awaiting decision", value: metrics.inReview, detail: "In review", icon: Clock3, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Finalized awards", value: metrics.finalized, detail: "Decision recorded", icon: FileCheck2, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Average best score", value: metrics.averageScore ? metrics.averageScore.toFixed(1) : "—", detail: "Across scored cases", icon: Target, color: "text-cyan-600", bg: "bg-cyan-50" },
          ].map(({ label, value, detail, icon: Icon, color, bg }) => (
            <article key={label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{loading ? "…" : value}</p>
                  <p className="mt-1 text-xs text-slate-400">{detail}</p>
                </div>
                <span className={`rounded-xl p-3 ${bg} ${color}`}><Icon size={21} /></span>
              </div>
            </article>
          ))}
        </section>

        {error && <div role="alert" className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Evaluation portfolio</h2>
                <p className="mt-1 text-sm text-slate-500">Monitor readiness, compare outcomes, and continue work in progress.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative min-w-64">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
                  <span className="sr-only">Search evaluations</span>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, category, department…" className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                </label>
                <label className="relative">
                  <Filter className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={16} />
                  <span className="sr-only">Filter by status</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 py-2 pl-9 pr-8 text-sm text-slate-700 outline-none focus:border-indigo-400">
                    <option>All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Filter by evaluation type</span>
                  <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 sm:w-auto">
                    <option>All types</option>{types.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>{filteredCases.length} of {cases.length} evaluations</span>
              {hasFilters && <button onClick={clearFilters} className="font-semibold text-indigo-600 hover:text-indigo-800">Clear filters</button>}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr><th className="px-6 py-3.5">Evaluation</th><th className="px-4 py-3.5">Owner & scope</th><th className="px-4 py-3.5">Status</th><th className="px-4 py-3.5">Leading outcome</th><th className="px-4 py-3.5">Score</th><th className="px-4 py-3.5">Created</th><th className="px-6 py-3.5 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  [...Array(4)].map((_, index) => <tr key={index} className="animate-pulse"><td colSpan="7" className="px-6 py-4"><div className="h-10 rounded-lg bg-slate-100" /></td></tr>)
                ) : filteredCases.length === 0 ? (
                  <tr><td colSpan="7" className="px-6 py-16 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Search size={22} /></div><p className="font-semibold text-slate-700">No evaluations found</p><p className="mt-1 text-sm text-slate-500">Try changing your filters or create a new evaluation.</p>{hasFilters && <button onClick={clearFilters} className="mt-3 text-sm font-semibold text-indigo-600">Reset filters</button>}</td></tr>
                ) : filteredCases.map((item) => (
                  <tr key={item.id} className="group hover:bg-indigo-50/30">
                    <td className="px-6 py-4"><Link to={`/procurement-evaluations/${item.id}`} className="font-bold text-slate-900 group-hover:text-indigo-700">{item.title}</Link><div className="mt-1 flex items-center gap-2 text-xs text-slate-500"><span>{item.category}</span><span className="text-slate-300">•</span><span>{item.evaluation_type}</span></div></td>
                    <td className="px-4 py-4"><p className="font-medium text-slate-700">{item.department_name || item.department_id || "Cross-functional"}</p><p className="mt-1 text-xs text-slate-400">{item.created_by_name || "Unassigned"} · {item.request_id ? `Request #${item.request_id}` : "Manual case"}</p></td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${statusStyles[item.status] || statusStyles.Draft}`}>{item.status || "Draft"}</span></td>
                    <td className="px-4 py-4"><p className="font-semibold text-slate-800">{item.selected_offer_name || "Decision pending"}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><CircleDollarSign size={13} /> {formatMoney(item.best_tco, item.currency)}</p></td>
                    <td className="px-4 py-4">{item.best_score ? <div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, Number(item.best_score))}%` }} /></div><span className="font-bold text-slate-700">{Number(item.best_score).toFixed(1)}</span></div> : <span className="text-slate-400">—</span>}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">{item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                    <td className="px-6 py-4 text-right"><div className="flex items-center justify-end gap-3"><button disabled={calculatingId === item.id} onClick={() => handleCalculate(item.id)} className="text-xs font-bold text-emerald-700 hover:text-emerald-900 disabled:opacity-50">{calculatingId === item.id ? "Calculating…" : "Recalculate"}</button><Link aria-label={`Open ${item.title}`} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-600" to={`/procurement-evaluations/${item.id}`}>Open <ArrowRight size={13} /></Link></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showCreate && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && setShowCreate(false)}>
        <aside role="dialog" aria-modal="true" aria-labelledby="create-evaluation-title" className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl sm:p-8">
          <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">New decision case</p><h2 id="create-evaluation-title" className="mt-2 text-2xl font-bold text-slate-900">Create an evaluation</h2><p className="mt-2 text-sm text-slate-500">Set the decision horizon and scope. Offers, criteria, and evidence come next.</p></div><button onClick={() => setShowCreate(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X size={20} /></button></div>
          <form onSubmit={handleCreate} className="mt-8 space-y-5">
            <label className="block text-sm font-semibold text-slate-700">Evaluation title<input autoFocus required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Laboratory analyzer replacement" className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></label>
            <label className="block text-sm font-semibold text-slate-700">Description<textarea rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What decision needs to be made?" className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">Category<input required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-indigo-400" /></label>
              <label className="block text-sm font-semibold text-slate-700">Evaluation type<select value={form.evaluation_type} onChange={(event) => setForm({ ...form, evaluation_type: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-indigo-400">{["General", "Laboratory Device", "Medical Device", "IT System", "Service Contract", "Maintenance Contract", "Consumables", "Medication", "Capital Equipment"].map((type) => <option key={type}>{type}</option>)}</select></label>
              <label className="block text-sm font-semibold text-slate-700">Evaluation horizon<input type="number" min="1" max="25" value={form.evaluation_period_years} onChange={(event) => setForm({ ...form, evaluation_period_years: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-indigo-400" /><span className="mt-1 block text-xs font-normal text-slate-400">Years included in TCO</span></label>
              <label className="block text-sm font-semibold text-slate-700">Currency<select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-indigo-400">{["USD", "EUR", "GBP", "SAR", "AED"].map((currency) => <option key={currency}>{currency}</option>)}</select></label>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-800"><div className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0" size={17} /><p><strong>Guided setup:</strong> Laboratory device evaluations start with a balanced 100% criteria template that you can tailor before scoring.</p></div></div>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button><button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:bg-slate-300">{saving ? "Creating…" : "Create & configure"}</button></div>
          </form>
        </aside>
      </div>}
    </div>
  );
};

export default ProcurementEvaluationsPage;