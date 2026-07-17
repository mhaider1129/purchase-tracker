import React, { useEffect, useState } from 'react';
import axios from '../api/axios';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const Card = ({ title, value, helper }) => (
  <div className="bg-white shadow rounded p-4 text-center">
    <h3 className="text-sm text-gray-500">{title}</h3>
    <p className="text-xl font-bold text-blue-600">{value}</p>
    {helper ? <p className="mt-2 text-xs text-gray-500">{helper}</p> : null}
  </div>
);

const formatDays = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : 'N/A';
};

const LifecycleAnalytics = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('/dashboard/lifecycle');
        setData(res.data);
      } catch (err) {
        console.error('❌ Failed to load lifecycle analytics:', err);
        setError('Failed to load analytics');
      }
    };
    fetchData();
  }, []);

  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!data) return <p className="p-6">Loading analytics...</p>;

  const bottleneckLabel = data.bottleneck_stage
    ? `Level ${data.bottleneck_stage.stage} (${data.bottleneck_stage.avg_days.toFixed(2)}d)`
    : 'N/A';

  return (
    <>
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-purple-700 mb-2">Lifecycle Analytics</h1>
        <p className="mb-6 text-sm text-gray-600">Use this page to monitor PR-to-final-approval and PR-to-PO KPI timing. Direct Purchase PO and CSCC actions feed the PR-to-PO card as soon as the lightweight PO is created.</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card
            title="Avg PR to Final Approval (days)"
            value={formatDays(data.avg_pr_to_final_approval_days ?? data.avg_approval_time_days)}
            helper="Request created → final approval timestamp"
          />
          <Card
            title="Avg Approval Time (days)"
            value={formatDays(data.avg_approval_time_days)}
            helper="Kept for existing dashboard compatibility"
          />
          <Card
            title="Avg PR to PO Cycle (days)"
            value={formatDays(data.avg_pr_to_po_cycle_days)}
            helper="Request created → first PO / CSCC send / direct PO"
          />
          <Card title="Bottleneck Stage" value={bottleneckLabel} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-lg font-semibold mb-2">Stage Durations</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.stage_durations}>
                <XAxis dataKey="stage" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avg_days" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-2">Spend by Category</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.spend_by_category}>
                <XAxis dataKey="category" hide={false} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_cost" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
};

export default LifecycleAnalytics;