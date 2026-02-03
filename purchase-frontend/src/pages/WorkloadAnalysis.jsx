import React, { useEffect, useMemo, useState } from "react";
import axios from "../api/axios";
import Navbar from "../components/Navbar";
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

const WorkloadAnalysis = () => {
  const translate = usePageTranslation("workload");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get("/api/dashboard/workload");
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
  }, [translate]);

  const topUsers = useMemo(() => {
    if (!data?.workload_by_user) return [];
    return data.workload_by_user.slice(0, 5);
  }, [data]);

  if (loading) return <p className="p-6">Loading workload analysis...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!data) return null;

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-sm text-slate-500">{translate("subtitle", { defaultValue: "Monitor approval queues" })}</p>
            <h1 className="text-2xl font-bold text-indigo-700">
              {translate("title", { defaultValue: "Approval Workload" })}
            </h1>
          </div>
          <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">
            {translate("permissionTag", { defaultValue: "Requires dashboard.view" })}
          </span>
        </div>

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
            <ResponsiveContainer width="100%" height={280}>
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
            </ResponsiveContainer>
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
              {data.backlog_by_department.slice(0, 5).map((dept) => (
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
            <ResponsiveContainer width="100%" height={280}>
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
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
};

export default WorkloadAnalysis;