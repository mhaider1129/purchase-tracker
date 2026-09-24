import React, { useEffect, useMemo, useState } from "react";
import axios from "../api/axios";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import usePageTranslation from "../utils/usePageTranslation";
import { BookmarkPlus, Filter, RefreshCw, Save, Users } from "lucide-react";
import AnalyticsPageHeader from "../components/analytics/AnalyticsPageHeader";
import { AnalyticsError, AnalyticsLoading, EmptyChart } from "../components/analytics/AnalyticsStates";

const StatCard = ({ label, value, tone = "slate" }) => {
  const toneMap = {
    slate: "bg-slate-50 text-slate-800 border-slate-100",
    amber: "bg-amber-50 text-amber-800 border-amber-100",
    rose: "bg-rose-50 text-rose-800 border-rose-100",
    indigo: "bg-indigo-50 text-indigo-800 border-indigo-100",
  };

  return (
    <div
      className={`rounded-lg border p-4 shadow-sm ${toneMap[tone] || toneMap.slate}`}
    >
      <p className="text-sm font-medium uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
};

const formatDays = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(1)}d` : "N/A";
};


const DEFAULT_FILTERS = { pendingStatuses: ["Pending", "On Hold"], approvedStatus: "Approved", completionWindowDays: 30 };
const GLOBAL_KEY = "workload-dashboard-default-filters";
const viewsKeyForUser = (userId) => `workload-dashboard-views:${userId || "anon"}`;

const WorkloadAnalysis = () => {
  const translate = usePageTranslation("workload");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const userId = localStorage.getItem("userId") || "anon";
  const [filters, setFilters] = useState(() => {
    const globalDefaults = JSON.parse(localStorage.getItem(GLOBAL_KEY) || "null") || DEFAULT_FILTERS;
    return { ...DEFAULT_FILTERS, ...globalDefaults };
  });
  const [viewName, setViewName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get("/dashboard/workload", { params: { pending_statuses: filters.pendingStatuses.join(","), approved_status: filters.approvedStatus, completion_window_days: filters.completionWindowDays } });
        setData(res.data);
      } catch (err) {
        console.error("❌ Failed to load workload analysis:", err);
        setError(
          translate("error", { defaultValue: "Failed to load workload analysis" }),
        );
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [translate, filters, refreshKey]);

  const topUsers = useMemo(() => {
    if (!data?.workload_by_user) return [];
    return data.workload_by_user.slice(0, 5);
  }, [data]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <AnalyticsPageHeader eyebrow="Team capacity" title={translate("title", { defaultValue: "Approval Workload" })} description={translate("subtitle", { defaultValue: "Monitor queues, aging, urgency, and completion velocity across approval teams." })} icon={Users} meta={[translate("permissionTag", { defaultValue: "Requires dashboard.view" }), `${filters.completionWindowDays}-day completion window`]} actions={<button type="button" onClick={()=>setRefreshKey(x=>x+1)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-blue-50"><RefreshCw className="h-4 w-4"/> Refresh</button>}/>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Workload filters">
        <div className="mb-4 flex items-center gap-2"><Filter className="h-4 w-4 text-blue-600"/><h2 className="font-semibold text-slate-900">Analysis filters</h2></div>
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <label className="text-xs font-semibold text-slate-600 xl:col-span-2">Pending statuses<input aria-label="Pending statuses" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={filters.pendingStatuses.join(", ")} onChange={(e) => setFilters((f) => ({ ...f, pendingStatuses: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) }))} /></label>
          <label className="text-xs font-semibold text-slate-600">Approved status<input aria-label="Approved status" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={filters.approvedStatus} onChange={(e) => setFilters((f) => ({ ...f, approvedStatus: e.target.value }))} /></label>
          <label className="text-xs font-semibold text-slate-600">Window (days)<input aria-label="Completion window" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min="1" max="365" value={filters.completionWindowDays} onChange={(e) => setFilters((f) => ({ ...f, completionWindowDays: Number(e.target.value) || 30 }))} /></label>
          <button type="button" className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => localStorage.setItem(GLOBAL_KEY, JSON.stringify(filters))}><Save className="h-4 w-4"/> Save defaults</button>
          <div className="flex gap-2 xl:col-span-2"><label className="flex-1 text-xs font-semibold text-slate-600">View name<input aria-label="View name" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={viewName} onChange={(e)=>setViewName(e.target.value)} placeholder="e.g. Weekly review" /></label><button aria-label="Save view" type="button" className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-3 text-white hover:bg-blue-700" onClick={() => { const key = viewsKeyForUser(userId); const views = JSON.parse(localStorage.getItem(key) || '{}'); views[viewName || `view-${Date.now()}`] = filters; localStorage.setItem(key, JSON.stringify(views)); }}><BookmarkPlus className="h-4 w-4"/></button></div>
        </div>
      </section>
      {error ? <AnalyticsError message={error} onRetry={()=>setRefreshKey(x=>x+1)}/> : loading || !data ? <AnalyticsLoading label="Calculating team workload…"/> : <div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label={translate("active", { defaultValue: "Active pending" })}
            value={data.total_active ?? 0}
            tone="indigo"
          />
          <StatCard
            label={translate("urgent", { defaultValue: "Urgent in queue" })}
            value={data.urgent_active ?? 0}
            tone="rose"
          />
          <StatCard
            label={translate("onHold", { defaultValue: "On hold" })}
            value={data.on_hold ?? 0}
            tone="amber"
          />
          <StatCard
            label={translate("avgAge", { defaultValue: "Avg age (days)" })}
            value={formatDays(data.avg_age_days)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-800">
                {translate("byLevel", { defaultValue: "Backlog by approval level" })}
              </h2>
              <span className="text-xs text-slate-500">
                {translate("averageAgeLabel", { defaultValue: "Avg age shown in tooltip" })}
              </span>
            </div>
            {data.workload_by_level?.length ? <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.workload_by_level}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="approval_level" label={{ value: translate("level", { defaultValue: "Level" }), position: "insideBottom", offset: -5 }} />
                <YAxis />
                <Tooltip
                  formatter={(value, name) =>
                    name === "avg_age_days" ? formatDays(value) : value
                  }
                />
                <Bar dataKey="pending_count" fill="#6366F1" name={translate("pending", { defaultValue: "Pending" })} />
                <Bar dataKey="urgent_count" fill="#F43F5E" name={translate("urgent", { defaultValue: "Urgent" })} />
              </BarChart>
            </ResponsiveContainer> : <EmptyChart label="No approval-level backlog"/>}
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-800">
                {translate("byDepartment", { defaultValue: "Backlog by department" })}
              </h2>
              <span className="text-xs text-slate-500">
                {translate("sortedByCount", { defaultValue: "Sorted by pending volume" })}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.backlog_by_department}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" hide />
                <YAxis />
                <Tooltip
                  formatter={(value, name) =>
                    name === "avg_age_days" ? formatDays(value) : value
                  }
                  labelFormatter={(label) => translate("departmentLabel", { defaultValue: "Department" }) + ": " + label}
                />
                <Bar dataKey="pending_count" fill="#0EA5E9" name={translate("pending", { defaultValue: "Pending" })} />
                <Bar dataKey="urgent_count" fill="#F59E0B" name={translate("urgent", { defaultValue: "Urgent" })} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-2">
              {(data.backlog_by_department || []).slice(0, 5).map((dept) => (
                <div
                  key={dept.department}
                  className="flex items-center justify-between rounded border border-slate-100 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-slate-700">{dept.department}</span>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span>{translate("pendingShort", { defaultValue: "Pending" })}: {dept.pending_count}</span>
                    <span>{translate("urgentShort", { defaultValue: "Urgent" })}: {dept.urgent_count}</span>
                    <span>{translate("ageShort", { defaultValue: "Age" })}: {formatDays(dept.avg_age_days)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-3">
              {translate("topApprovers", { defaultValue: "Top approver workloads" })}
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{translate("approver", { defaultValue: "Approver" })}</th>
                    <th className="px-3 py-2 font-semibold">{translate("role", { defaultValue: "Role" })}</th>
                    <th className="px-3 py-2 font-semibold">{translate("pendingShort", { defaultValue: "Pending" })}</th>
                    <th className="px-3 py-2 font-semibold">{translate("urgentShort", { defaultValue: "Urgent" })}</th>
                    <th className="px-3 py-2 font-semibold">{translate("ageShort", { defaultValue: "Age" })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topUsers.map((user) => (
                    <tr key={`${user.approver_id}-${user.approver_name}`}>
                      <td className="px-3 py-2 font-medium text-slate-800">{user.approver_name}</td>
                      <td className="px-3 py-2 text-slate-600">{user.role}</td>
                      <td className="px-3 py-2 text-slate-800">{user.pending_count}</td>
                      <td className="px-3 py-2 text-rose-600 font-semibold">{user.urgent_count}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDays(user.avg_age_days)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-800">
                {translate("completionTrend", { defaultValue: "Approval completions (30d)" })}
              </h2>
              <span className="text-xs text-slate-500">
                {translate("recentWindow", { defaultValue: "Past 30 days" })}
              </span>
            </div>
            {data.completions_trend?.length ? <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.completions_trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="approvals_completed"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                  name={translate("approvalsCompleted", { defaultValue: "Approvals completed" })}
                />
              </LineChart>
            </ResponsiveContainer> : <EmptyChart label="No completions in this window"/>}
          </div>
        </div>
      </div>}
    </main>
  );
};

export default WorkloadAnalysis;