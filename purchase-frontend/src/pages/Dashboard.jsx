import React, { useEffect, useMemo, useState } from 'react';
import axios from '../api/axios';
import Navbar from '../components/Navbar';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import usePageTranslation from '../utils/usePageTranslation';
import Card from '../components/Card';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff4d4f', '#00C49F'];

const Dashboard = () => {
  const translate = usePageTranslation('dashboard');
  const [summary, setSummary] = useState(null);
  const [departmentSpending, setDepartmentSpending] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [error, setError] = useState('');

  const formatAmount = (value) =>
    Number(value || 0).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    });

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await axios.get('/api/dashboard/summary');
        setSummary(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch dashboard data:', err);
        setError(
          translate('failedToLoad', { defaultValue: 'Failed to load dashboard' })
        );
      }
    };
    fetchSummary();
  }, []);

  useEffect(() => {
    const fetchSpending = async () => {
      try {
        const res = await axios.get('/api/dashboard/department-spending', {
          params: { year },
        });
        setDepartmentSpending(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch department spending:', err);
      }
    };
    fetchSpending();
  }, [year]);

  const { deptChartData, deptNames } = useMemo(() => {
    if (!departmentSpending.length) return { deptChartData: [], deptNames: [] };
    const months = Array.from(
      new Set(departmentSpending.map((d) => d.month))
    ).sort();
    const departments = Array.from(
      new Set(departmentSpending.map((d) => d.department))
    );
    const data = months.map((m) => {
      const entry = { month: m };
      departmentSpending
        .filter((d) => d.month === m)
        .forEach((d) => {
          entry[d.department] = Number(d.total_cost);
        });
      return entry;
    });
    return { deptChartData: data, deptNames: departments };
  }, [departmentSpending]);

  const pendingTrend = summary?.pending_vs_completed_trend || [];
  const oldestPending = summary?.oldest_pending_requests || [];
  const completionRate = Number(summary?.completion_rate || 0);
  const avgPendingAge = Number(summary?.avg_pending_age_days || 0);
  const approvalTimeDays = Number(summary?.avg_approval_time_days || 0);
  const totalRequests = Number(summary?.total_requests || 0);
  const approvedRequests = Number(summary?.approved_requests || 0);
  const pendingRequests = Number(summary?.pending_requests || 0);
  const completedRequests = Number(summary?.completed_requests || 0);
  const rejectedRequests = Number(summary?.rejected_requests || 0);

  const { totalSpend, topMonth, topDepartment } = useMemo(() => {
    if (!summary) {
      return { totalSpend: 0, topMonth: null, topDepartment: null };
    }

    const spendingByMonth = summary.spending_by_month || [];
    const total = spendingByMonth.reduce(
      (sum, item) => sum + Number(item.total_cost || 0),
      0
    );
    const monthWithHighestSpend = spendingByMonth.reduce((best, current) => {
      if (!best) return current;
      const currentValue = Number(current.total_cost || 0);
      const bestValue = Number(best.total_cost || 0);
      return currentValue > bestValue ? current : best;
    }, null);

    const departmentTotals = departmentSpending.reduce((acc, entry) => {
      const cost = Number(entry.total_cost || 0);
      acc[entry.department] = (acc[entry.department] || 0) + cost;
      return acc;
    }, {});

    const [leadingDepartment, leadingSpend] =
      Object.entries(departmentTotals).sort((a, b) => b[1] - a[1])[0] || [];

    return {
      totalSpend: total,
      topMonth: monthWithHighestSpend,
      topDepartment: leadingDepartment
        ? { name: leadingDepartment, total: leadingSpend }
        : null,
    };
  }, [departmentSpending, summary]);

  const backlogChange = useMemo(() => {
    if (!pendingTrend || pendingTrend.length < 2) return null;
    const last = pendingTrend[pendingTrend.length - 1];
    const previous = pendingTrend[pendingTrend.length - 2];
    if (
      last?.pending_count === undefined ||
      previous?.pending_count === undefined
    )
      return null;
    const diff = Number(last.pending_count) - Number(previous.pending_count);
    const pct = previous.pending_count
      ? (diff / Number(previous.pending_count)) * 100
      : null;
    return { diff, pct };
  }, [pendingTrend]);

  const completionSpark = useMemo(
    () =>
      pendingTrend.slice(-6).map((item) => ({
        month: item.month,
        completions: Number(item.completed_count || 0),
      })),
    [pendingTrend]
  );

  const backlogSpark = useMemo(
    () =>
      pendingTrend.slice(-6).map((item) => ({
        month: item.month,
        pending: Number(item.pending_count || 0),
      })),
    [pendingTrend]
  );

  const spendingSpark = useMemo(
    () => (summary?.spending_by_month || []).slice(-6),
    [summary]
  );

  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!summary)
    return (
      <p className="p-6">
        {translate('loadingDashboard', { defaultValue: 'Loading dashboard...' })}
      </p>
    );

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-purple-700 mb-6">
          {translate('overviewTitle', { defaultValue: '📊 Dashboard Overview' })}
        </h1>

        {/* Overview Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 border border-purple-100 shadow-sm">
            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-purple-100 blur-3xl" aria-hidden />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-purple-700 font-medium">
                  {translate('completionPerformance', {
                    defaultValue: 'Completion performance',
                  })}
                </p>
                <p className="text-3xl font-bold text-purple-900">
                  {`${completionRate.toFixed(1)}%`}
                </p>
                <p className="text-xs text-purple-600">
                  {translate('completionHelper', {
                    defaultValue: 'Share of requests completed so far',
                  })}
                </p>
              </div>
              <span
                className={`px-2 py-1 text-xs rounded-full font-semibold shadow-sm ${
                  completionRate >= 90
                    ? 'bg-green-100 text-green-700'
                    : completionRate >= 70
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {completionRate >= 90
                  ? translate('statusOnTrack', { defaultValue: 'On track' })
                  : completionRate >= 70
                  ? translate('statusWatchlist', { defaultValue: 'Watchlist' })
                  : translate('statusActionNeeded', {
                      defaultValue: 'Action needed',
                    })}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <div className="relative w-20 h-20">
                <svg viewBox="0 0 36 36" className="w-full h-full">
                  <path
                    className="text-purple-100"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-purple-600"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.min(completionRate, 100)}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <text
                    x="18"
                    y="20.35"
                    className="text-xs font-semibold fill-purple-700"
                    textAnchor="middle"
                  >
                    {`${completionRate.toFixed(0)}%`}
                  </text>
                </svg>
              </div>
              <div className="flex-1">
                <div className="h-2 w-full bg-purple-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                    style={{ width: `${Math.min(completionRate, 100)}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-purple-700 flex items-center justify-between">
                  <span>
                    {translate('approvalSpeed', {
                      defaultValue:
                        'Average approval time of {{days}} days keeps work moving',
                      days: approvalTimeDays.toFixed(1),
                    })}
                  </span>
                  {backlogChange?.pct !== null && backlogChange?.pct !== undefined && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-white border text-[10px] text-purple-700 shadow-sm">
                      {translate('changeSinceLastMonth', {
                        defaultValue: '{{pct}} vs last month',
                        pct: `${(backlogChange.pct || 0).toFixed(1)}%`,
                      })}
                    </span>
                  )}
                </p>
                <div className="mt-2 h-16">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={completionSpark}
                      margin={{ top: 5, right: 0, left: -10, bottom: 0 }}
                    >
                      <Tooltip cursor={false} />
                      <Line
                        type="monotone"
                        dataKey="completions"
                        stroke="#7c3aed"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border border-blue-50 bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium mb-2">
                  {translate('spendHighlights', { defaultValue: 'Spending insights' })}
                </p>
                <p className="text-2xl font-bold text-blue-800">
                  {translate('yearToDateSpend', {
                    defaultValue: 'YTD {{amount}}',
                    amount: formatAmount(totalSpend),
                  })}
                </p>
                <p className="text-xs text-blue-600">
                  {translate('viewingYear', { defaultValue: 'Viewing {{year}}', year })}
                </p>
              </div>
              {topMonth && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-white border border-blue-100 text-blue-700 shadow-sm">
                  <span>🏆</span>
                  {translate('topSpendingMonth', {
                    defaultValue: 'Highest spend in {{month}}',
                    month: topMonth.month,
                  })}
                </span>
              )}
            </div>
            <div className="mt-3 h-16">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={spendingSpark}
                  margin={{ top: 0, right: 0, left: -15, bottom: 0 }}
                >
                  <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} />
                  <Bar
                    dataKey="total_cost"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-500">
              {topMonth
                ? translate('topSpendingMonth', {
                    defaultValue: 'Highest spend in {{month}}',
                    month: topMonth.month,
                  })
                : translate('topSpendingMonthFallback', {
                    defaultValue: 'Monthly spending will appear as data arrives',
                  })}
            </p>
            {topDepartment && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-800 font-semibold">
                  {translate('leadingDepartment', {
                    defaultValue: 'Leading department',
                  })}
                </p>
                <p className="text-sm text-blue-900">
                  {translate('departmentSpend', {
                    defaultValue: '{{name}} with {{amount}} spent',
                    name: topDepartment.name,
                    amount: formatAmount(topDepartment.total),
                  })}
                </p>
              </div>
            )}
          </Card>

          <Card className="border border-amber-50 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-amber-700 font-medium mb-2">
                  {translate('backlogPulse', { defaultValue: 'Backlog pulse' })}
                </p>
                <p className="text-2xl font-bold text-amber-800">
                  {backlogChange
                    ? `${backlogChange.diff > 0 ? '+' : ''}${backlogChange.diff.toFixed(0)}`
                    : translate('backlogStable', { defaultValue: 'Stable' })}
                </p>
                <p className="text-xs text-amber-700 mb-3">
                  {backlogChange
                    ? backlogChange.diff > 0
                      ? translate('backlogGrowing', {
                          defaultValue: 'Pending queue grew vs last month',
                        })
                      : translate('backlogImproving', {
                          defaultValue: 'Pending queue is shrinking',
                        })
                    : translate('backlogNoChange', {
                        defaultValue:
                          'Tracking changes once two months are available',
                      })}
                </p>
              </div>
              {backlogChange?.pct !== null && backlogChange?.pct !== undefined && (
                <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-white border border-amber-100 text-amber-700 shadow-sm">
                  {translate('pendingChange', {
                    defaultValue: '{{pct}} change',
                    pct: `${(backlogChange.pct || 0).toFixed(1)}%`,
                  })}
                </span>
              )}
            </div>
            <div className="mt-3 h-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={backlogSpark}
                  margin={{ top: 0, right: 0, left: -10, bottom: 0 }}
                >
                  <Tooltip cursor={false} />
                  <Line
                    type="monotone"
                    dataKey="pending"
                    stroke="#d97706"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>{translate('pendingNow', { defaultValue: 'Current pending' })}</span>
              <span className="font-semibold text-gray-800">
                {formatAmount(pendingRequests)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
              <span>{translate('agingIndicator', { defaultValue: 'Avg pending age' })}</span>
              <span className="font-semibold text-gray-800">
                {translate('daysValue', {
                  defaultValue: '{{days}} days',
                  days: avgPendingAge.toFixed(1),
                })}
              </span>
            </div>
          </Card>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="text-center border border-slate-100 shadow-sm bg-white/70 backdrop-blur">
            <h3 className="text-sm text-gray-500">
              {translate('totalRequests', { defaultValue: 'Total Requests' })}
            </h3>
            <p className="text-xl font-bold text-blue-600">{formatAmount(totalRequests)}</p>
            <p className="text-xs text-gray-400">
              {translate('requestsLabel', { defaultValue: 'requests' })}
            </p>
          </Card>
          <Card className="text-center border border-green-100 shadow-sm bg-green-50">
            <h3 className="text-sm text-gray-600">
              {translate('approved', { defaultValue: 'Approved' })}
            </h3>
            <p className="text-xl font-bold text-green-700">{formatAmount(approvedRequests)}</p>
            <p className="text-xs text-green-600">
              {translate('completionHelper', {
                defaultValue: 'Share of requests completed so far',
              })}
            </p>
          </Card>
          <Card className="text-center border border-amber-100 shadow-sm bg-amber-50">
            <h3 className="text-sm text-gray-600">
              {translate('pending', { defaultValue: 'Pending' })}
            </h3>
            <p className="text-xl font-bold text-amber-700">{formatAmount(pendingRequests)}</p>
            <p className="text-xs text-amber-700">
              {translate('agingIndicator', { defaultValue: 'Avg pending age' })}
            </p>
          </Card>
          <Card className="text-center border border-blue-100 shadow-sm bg-blue-50">
            <h3 className="text-sm text-gray-600">
              {translate('completed', { defaultValue: 'Completed' })}
            </h3>
            <p className="text-xl font-bold text-blue-700">{formatAmount(completedRequests)}</p>
            <p className="text-xs text-blue-600">
              {translate('trendLabel', { defaultValue: 'Last 6 months trend' })}
            </p>
          </Card>
          <Card className="text-center border border-rose-100 shadow-sm bg-rose-50">
            <h3 className="text-sm text-gray-600">
              {translate('rejected', { defaultValue: 'Rejected' })}
            </h3>
            <p className="text-xl font-bold text-rose-700">{formatAmount(rejectedRequests)}</p>
            <p className="text-xs text-rose-600">
              {translate('changeSinceLastMonth', { defaultValue: 'vs last month' })}
            </p>
          </Card>
          <Card className="text-center border border-indigo-100 shadow-sm bg-indigo-50">
            <h3 className="text-sm text-gray-600">
              {translate('completionRate', { defaultValue: 'Completion Rate' })}
            </h3>
            <p className="text-xl font-bold text-indigo-700">{`${completionRate.toFixed(1)}%`}</p>
            <p className="text-xs text-indigo-600">
              {translate('completionSparkLabel', { defaultValue: 'Completion velocity' })}
            </p>
          </Card>
          <Card className="text-center border border-sky-100 shadow-sm bg-sky-50">
            <h3 className="text-sm text-gray-600">
              {translate('avgApprovalTime', { defaultValue: 'Avg Approval Time (days)' })}
            </h3>
            <p className="text-xl font-bold text-sky-700">{approvalTimeDays.toFixed(2)}</p>
            <p className="text-xs text-sky-600">
              {translate('approvalSpeed', {
                defaultValue:
                  'Average approval time of {{days}} days keeps work moving',
                days: approvalTimeDays.toFixed(1),
              })}
            </p>
          </Card>
          <Card className="text-center border border-amber-100 shadow-sm bg-amber-50/70">
            <h3 className="text-sm text-gray-600">
              {translate('avgPendingAge', { defaultValue: 'Avg Pending Age (days)' })}
            </h3>
            <p className="text-xl font-bold text-amber-700">{avgPendingAge.toFixed(1)}</p>
            <p className="text-xs text-amber-600">
              {translate('pendingChange', {
                defaultValue: '{{pct}} change',
                pct:
                  backlogChange?.pct !== null && backlogChange?.pct !== undefined
                    ? `${(backlogChange.pct || 0).toFixed(1)}%`
                    : '--',
              })}
            </p>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-lg font-semibold mb-2">
              {translate('monthlySpending', { defaultValue: 'Monthly Spending' })}
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={summary?.spending_by_month || []}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_cost" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">
                {translate('departmentSpending', { defaultValue: 'Department Spending' })}
              </h2>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="border rounded p-1 text-sm"
              >
                {Array.from({ length: 5 }).map((_, i) => {
                  const y = new Date().getFullYear() - i;
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={deptChartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                {deptNames.map((d, idx) => (
                  <Line key={d} type="monotone" dataKey={d} stroke={COLORS[idx % COLORS.length]} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="md:col-span-2">
            <h2 className="text-lg font-semibold mb-2">
              {translate('pendingVsCompleted', { defaultValue: 'Pending vs Completed Trend' })}
            </h2>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={pendingTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="pending_count"
                  stroke="#ffbb28"
                  name={translate('pending', { defaultValue: 'Pending' })}
                />
                <Line
                  type="monotone"
                  dataKey="completed_count"
                  stroke="#00C49F"
                  name={translate('completed', { defaultValue: 'Completed' })}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">
              {translate('topDepartments', { defaultValue: 'Top Requesting Departments' })}
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={summary.top_departments}
                  dataKey="request_count"
                  nameKey="name"
                  outerRadius={100}
                  label
                >
                  {summary.top_departments.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">
              {translate('rejectedRequests', { defaultValue: 'Rejected Requests' })}
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={summary.rejections_by_month}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="rejected_count" stroke="#ff4d4f" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="md:col-span-2">
            <h2 className="text-lg font-semibold mb-2">
              {translate('oldestPending', { defaultValue: 'Oldest Pending Requests' })}
            </h2>
            <div className="bg-white shadow rounded p-4">
              {oldestPending.length ? (
                <ul className="space-y-3">
                  {oldestPending.map((request) => (
                    <li key={request.id} className="border-b last:border-b-0 pb-3 last:pb-0">
                      <p className="text-sm font-semibold text-gray-700">
                        {translate('requestWithDepartment', {
                          defaultValue: 'Request #{{id}} • {{department}}',
                          id: request.id,
                          department: request.department,
                        })}
                      </p>
                      <p className="text-sm text-gray-500 truncate">{request.justification}</p>
                      <p className="text-xs text-gray-400">
                        {translate('waitingDays', {
                          defaultValue: 'Waiting {{days}} days',
                          days: request.age_days.toFixed(1),
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">
                  {translate('noPendingBacklog', { defaultValue: 'No pending backlog 🎉' })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;