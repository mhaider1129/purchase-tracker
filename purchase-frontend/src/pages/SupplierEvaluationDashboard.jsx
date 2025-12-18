import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';
import { AlertTriangle, CheckCircle2, PhoneCall, Users } from 'lucide-react';
import Navbar from '../components/Navbar';
import Card from '../components/Card';
import { getSuppliersDashboard } from '../api/suppliers';
import { getSupplierEvaluationDashboard } from '../api/supplierEvaluations';

const formatNumber = (value, fallback = 0) =>
  Number.isFinite(Number(value))
    ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })
    : fallback;

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const Metric = ({ label, value, icon: Icon, tone = 'text-slate-700' }) => (
  <div className="flex items-center gap-3">
    {Icon ? (
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-lg bg-white/70 shadow-sm ${tone.replace(
          'text',
          'border',
        )}`}
      >
        <Icon className={`h-5 w-5 ${tone}`} />
      </span>
    ) : null}
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  </div>
);

const SupplierEvaluationDashboard = () => {
  const [supplierStats, setSupplierStats] = useState(null);
  const [evaluationStats, setEvaluationStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');

      try {
        const [suppliers, evaluations] = await Promise.all([
          getSuppliersDashboard(),
          getSupplierEvaluationDashboard(),
        ]);
        setSupplierStats(suppliers || {});
        setEvaluationStats(evaluations || {});
      } catch (err) {
        console.error('❌ Failed to load supplier dashboards:', err);
        setError('Unable to load supplier dashboards. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const trendData = useMemo(() => {
    const trends = evaluationStats?.trends || [];
    return trends.map((item) => ({
      ...item,
      label: item.period_start
        ? new Date(item.period_start).toLocaleDateString(undefined, {
            month: 'short',
            year: 'numeric',
          })
        : 'n/a',
    }));
  }, [evaluationStats]);

  const coverageStats = useMemo(() => {
    const totalSuppliers = Number(supplierStats?.totals?.suppliers) || 0;
    const withContact = Number(supplierStats?.totals?.with_contact) || 0;
    const evaluatedSuppliers = Number(evaluationStats?.totals?.suppliers_evaluated) || 0;
    const withoutContact = Math.max(totalSuppliers - withContact, 0);
    const evaluationCoverage = totalSuppliers
      ? Math.round((evaluatedSuppliers / totalSuppliers) * 100)
      : 0;
    const contactCoverage = totalSuppliers ? Math.round((withContact / totalSuppliers) * 100) : 0;

    const recentThreshold = new Date();
    recentThreshold.setDate(recentThreshold.getDate() - 90);

    let recent = 0;
    let stale = 0;
    let none = 0;

    (supplierStats?.coverage || []).forEach((supplier) => {
      if (supplier.last_evaluation_date) {
        const parsed = new Date(supplier.last_evaluation_date);

        if (!Number.isNaN(parsed.getTime())) {
          if (parsed >= recentThreshold) {
            recent += 1;
          } else {
            stale += 1;
          }
          return;
        }
      }

      none += 1;
    });

    const cadenceTotal = recent + stale + none || 0;

    return {
      totalSuppliers,
      withContact,
      withoutContact,
      evaluatedSuppliers,
      evaluationCoverage,
      contactCoverage,
      cadence: {
        recent,
        stale,
        none,
        total: cadenceTotal,
      },
    };
  }, [evaluationStats?.totals?.suppliers_evaluated, supplierStats]);

  const indicatorData = useMemo(() => {
    const indicators = evaluationStats?.rating_insights?.indicator_averages || [];

    return indicators
      .map((item) => ({
        indicator: item.indicator,
        score: Number(item.average_score) || 0,
      }))
      .filter((item) => item.score > 0);
  }, [evaluationStats?.rating_insights?.indicator_averages]);

  const supplierIndicatorAverages = useMemo(
    () => evaluationStats?.rating_insights?.supplier_indicator_averages || [],
    [evaluationStats?.rating_insights?.supplier_indicator_averages]
  );

  const supplierAverageData = useMemo(() => {
    const suppliers = evaluationStats?.rating_insights?.supplier_averages || [];

    return suppliers
      .filter((supplier) => Number.isFinite(Number(supplier.avg_overall_score)))
      .sort((a, b) => (Number(b.avg_overall_score) || 0) - (Number(a.avg_overall_score) || 0))
      .slice(0, 8)
      .map((supplier) => ({
        name: supplier.supplier_name,
        score: Number(supplier.avg_overall_score) || 0,
      }));
  }, [evaluationStats?.rating_insights?.supplier_averages]);

  useEffect(() => {
    if (!selectedSupplier && supplierIndicatorAverages.length) {
      const topPerformer = supplierAverageData[0]?.name;
      const fallbackSupplier = supplierIndicatorAverages[0]?.supplier_name;
      setSelectedSupplier(topPerformer || fallbackSupplier || '');
    }
  }, [selectedSupplier, supplierAverageData, supplierIndicatorAverages]);

  const indicatorComparisonData = useMemo(() => {
    const overallAverages = indicatorData.reduce((acc, item) => {
      acc[item.indicator] = item.score;
      return acc;
    }, {});

    const supplierIndicators = supplierIndicatorAverages.find(
      (entry) => entry.supplier_name === selectedSupplier
    );

    const supplierScores = (supplierIndicators?.indicators || []).reduce((acc, item) => {
      acc[item.indicator] = Number(item.average_score) || 0;
      return acc;
    }, {});

    const indicatorKeys = Array.from(
      new Set([...Object.keys(overallAverages), ...Object.keys(supplierScores)])
    );

    return indicatorKeys.map((indicator) => ({
      indicator,
      averageScore: overallAverages[indicator] || 0,
      supplierScore: supplierScores[indicator] || 0,
    }));
  }, [indicatorData, selectedSupplier, supplierIndicatorAverages]);

  const yearlyAverageData = useMemo(() => {
    const years = evaluationStats?.rating_insights?.yearly_averages || [];

    return years
      .filter((entry) => Number.isFinite(Number(entry.avg_overall_score)))
      .sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0))
      .map((entry) => ({
        year: entry.year,
        score: Number(entry.avg_overall_score) || 0,
      }));
  }, [evaluationStats?.rating_insights?.yearly_averages]);

  const formatPercent = (value) =>
    Number.isFinite(value) ? `${Math.max(0, Math.min(100, value)).toFixed(0)}%` : '0%';

  if (loading) {
    return <p className="p-6">Loading supplier dashboards...</p>;
  }

  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">Suppliers</p>
            <h1 className="text-2xl font-bold text-slate-900">Supplier Performance Dashboard</h1>
            <p className="text-sm text-slate-500">
              Monitor supplier coverage, evaluation cadence, and performance trends in one place.
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-indigo-50 via-white to-white shadow-sm">
            <Metric
              label="Total suppliers"
              value={formatNumber(supplierStats?.totals?.suppliers, '0')}
              icon={Users}
              tone="text-indigo-600"
            />
          </Card>
          <Card className="bg-gradient-to-br from-emerald-50 via-white to-white shadow-sm">
            <Metric
              label="With contact info"
              value={formatNumber(supplierStats?.totals?.with_contact, '0')}
              icon={PhoneCall}
              tone="text-emerald-600"
            />
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 via-white to-white shadow-sm">
            <Metric
              label="Evaluations (90 days)"
              value={formatNumber(evaluationStats?.totals?.evaluations_last_90_days, '0')}
              icon={CheckCircle2}
              tone="text-amber-600"
            />
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 via-white to-white shadow-sm">
            <Metric
              label="Average weighted score"
              value={formatNumber(evaluationStats?.totals?.avg_weighted_score, '0')}
              icon={AlertTriangle}
              tone="text-purple-700"
            />
          </Card>
        </div>

        <Card>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Contact coverage</p>
              <p className="text-3xl font-semibold text-slate-900">
                {formatPercent(coverageStats.contactCoverage)}
              </p>
              <p className="text-sm text-slate-600">
                {formatNumber(coverageStats.withContact)} of {formatNumber(coverageStats.totalSuppliers)} suppliers
                have an email or phone on record.
              </p>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${coverageStats.contactCoverage || 0}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Evaluation coverage</p>
              <p className="text-3xl font-semibold text-slate-900">
                {formatPercent(coverageStats.evaluationCoverage)}
              </p>
              <p className="text-sm text-slate-600">
                {formatNumber(coverageStats.evaluatedSuppliers)} of {formatNumber(coverageStats.totalSuppliers)}
                suppliers have been evaluated.
              </p>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-indigo-500"
                  style={{ width: `${coverageStats.evaluationCoverage || 0}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Ready for outreach</p>
              <p className="text-3xl font-semibold text-slate-900">{formatNumber(coverageStats.withoutContact)}</p>
              <p className="text-sm text-slate-600">
                Suppliers missing contact details. Prioritize adding email or phone before the next evaluation.
              </p>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-amber-500"
                  style={{
                    width:
                      coverageStats.totalSuppliers > 0
                        ? `${Math.round((coverageStats.withoutContact / coverageStats.totalSuppliers) * 100)}%`
                        : '0%',
                  }}
                />
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Evaluation trend</h2>
              <p className="text-sm text-slate-500">Rolling 12 months</p>
            </div>
            <div className="mt-4 h-72">
              {trendData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis
                      yAxisId="left"
                      label={{ value: 'Avg score', angle: -90, position: 'insideLeft' }}
                      domain={[0, 100]}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      label={{ value: 'Evaluations', angle: 90, position: 'insideRight' }}
                      allowDecimals={false}
                    />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="avg_overall_score"
                      name="Average score"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      yAxisId="left"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="avg_weighted_score"
                      name="Weighted score"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      yAxisId="left"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="evaluation_count"
                      name="Evaluations"
                      stroke="#22c55e"
                      strokeWidth={2}
                      yAxisId="right"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-500">No evaluation trend data available yet.</p>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-900">KPI averages</h2>
            <div className="mt-4 space-y-3">
              <Metric
                label="On-time / in-full (OTIF)"
                value={formatNumber(evaluationStats?.kpi_averages?.otif_score, '0')}
                tone="text-sky-600"
              />
              <Metric
                label="Corrective actions"
                value={formatNumber(evaluationStats?.kpi_averages?.corrective_actions_score, '0')}
                tone="text-amber-600"
              />
              <Metric
                label="ESG compliance"
                value={formatNumber(evaluationStats?.kpi_averages?.esg_compliance_score, '0')}
                tone="text-emerald-600"
              />
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Average rating by indicator</h3>
                <p className="text-sm text-slate-500">Compare a supplier to the overall average</p>
              </div>
              {supplierIndicatorAverages.length ? (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <span>Supplier</span>
                  <select
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none"
                    value={selectedSupplier}
                    onChange={(event) => setSelectedSupplier(event.target.value)}
                  >
                    {supplierIndicatorAverages.map((supplier) => (
                      <option key={supplier.supplier_name} value={supplier.supplier_name}>
                        {supplier.supplier_name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="text-sm text-slate-500">Across all suppliers</p>
              )}
            </div>
            <div className="mt-4 h-80">
              {indicatorComparisonData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={indicatorComparisonData} outerRadius="70%">
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="indicator" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar
                      name="Average score"
                      dataKey="averageScore"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.2}
                    />
                    {selectedSupplier ? (
                      <Radar
                        name={`${selectedSupplier} score`}
                        dataKey="supplierScore"
                        stroke="#0ea5e9"
                        fill="#0ea5e9"
                        fillOpacity={0.2}
                      />
                    ) : null}
                    <Tooltip
                      formatter={(value) => `${formatNumber(value, '0')} pts`}
                      labelStyle={{ fontSize: 12 }}
                    />
                    <Legend verticalAlign="top" height={36} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-500">No indicator averages available yet.</p>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Average rating by supplier</h3>
              <p className="text-sm text-slate-500">Top performers</p>
            </div>
            <div className="mt-4 h-80">
              {supplierAverageData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={supplierAverageData} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={120} />
                    <Tooltip formatter={(value) => formatNumber(value, '0')} />
                    <Bar dataKey="score" fill="#ef4444" radius={[4, 4, 4, 4]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-500">No supplier averages available yet.</p>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Average rating by year</h3>
              <p className="text-sm text-slate-500">Overall scores</p>
            </div>
            <div className="mt-4 h-80">
              {yearlyAverageData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearlyAverageData} margin={{ left: 12, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => formatNumber(value, '0')} />
                    <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-500">No yearly averages available yet.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Top suppliers</h3>
              <p className="text-sm text-slate-500">By weighted score</p>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Supplier</th>
                    <th className="px-3 py-2">Evaluations</th>
                    <th className="px-3 py-2">Last evaluation</th>
                    <th className="px-3 py-2">Avg weighted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(evaluationStats?.top_suppliers || []).map((supplier) => (
                    <tr key={supplier.supplier_name} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-900">{supplier.supplier_name}</td>
                      <td className="px-3 py-2 text-slate-700">{supplier.evaluation_count}</td>
                      <td className="px-3 py-2 text-slate-700">{formatDate(supplier.last_evaluation_date)}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {formatNumber(supplier.avg_weighted_score, '0')}
                      </td>
                    </tr>
                  ))}
                  {!evaluationStats?.top_suppliers?.length ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                        No suppliers have been evaluated yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-900">Recent evaluations</h3>
            <div className="mt-3 space-y-2">
              {(evaluationStats?.recent_evaluations || []).map((evaluation) => (
                <div
                  key={evaluation.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{evaluation.supplier_name}</p>
                    <p className="text-xs text-slate-500">{formatDate(evaluation.evaluation_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Weighted</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {formatNumber(evaluation.weighted_overall_score, '0')}
                    </p>
                  </div>
                </div>
              ))}
              {!evaluationStats?.recent_evaluations?.length ? (
                <p className="text-sm text-slate-500">No evaluations recorded yet.</p>
              ) : null}
            </div>
          </Card>
        </div>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Evaluation cadence</h3>
              <p className="text-sm text-slate-500">Recency of the latest supplier evaluations</p>
            </div>
            <p className="text-sm text-slate-500">Last 90 days</p>
          </div>
          <div className="mt-4 space-y-3">
            {[
              { label: 'Evaluated in the last 90 days', key: 'recent', tone: 'bg-emerald-500' },
              { label: 'Evaluated >90 days ago', key: 'stale', tone: 'bg-amber-500' },
              { label: 'No evaluations yet', key: 'none', tone: 'bg-slate-300' },
            ].map((segment) => {
              const value = coverageStats.cadence[segment.key];
              const percent = coverageStats.cadence.total
                ? Math.round((value / coverageStats.cadence.total) * 100)
                : 0;

              return (
                <div key={segment.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <p className="font-medium text-slate-900">{segment.label}</p>
                    <p>
                      {formatNumber(value, '0')} ({percent}%)
                    </p>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${segment.tone}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {!coverageStats.cadence.total ? (
              <p className="text-sm text-slate-500">No supplier records available to calculate cadence yet.</p>
            ) : null}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Supplier coverage</h3>
            <p className="text-sm text-slate-500">Evaluation cadence and contacts</p>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Supplier</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Evaluations</th>
                  <th className="px-3 py-2">Last evaluation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(supplierStats?.coverage || []).map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900">{supplier.name}</td>
                    <td className="px-3 py-2 text-slate-700">{supplier.contact_email || '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{supplier.contact_phone || '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{supplier.evaluation_count}</td>
                    <td className="px-3 py-2 text-slate-700">{formatDate(supplier.last_evaluation_date)}</td>
                  </tr>
                ))}
                {!supplierStats?.coverage?.length ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                      No supplier records found yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
};

export default SupplierEvaluationDashboard;