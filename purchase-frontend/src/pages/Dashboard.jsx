import React, { useEffect, useState } from 'react';
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
} from 'recharts';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff4d4f', '#00C49F'];

const Dashboard = () => {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await axios.get('/api/dashboard/summary');
        setSummary(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch dashboard data:', err);
      }
    };
    fetchSummary();
  }, []);

  if (!summary) return <p className="p-6">Loading dashboard...</p>;

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-purple-700 mb-6">📊 Dashboard Overview</h1>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-8">
          <Card title="Total Requests" value={summary.total_requests} />
          <Card title="Approved" value={summary.approved_requests} />
          <Card title="Pending" value={summary.pending_requests} />
          <Card title="Rejected" value={summary.rejected_requests} />
          <Card title="Avg Approval Time (days)" value={summary.avg_approval_time_days.toFixed(2)} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-lg font-semibold mb-2">Monthly Spending</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={summary.spending_by_month}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_cost" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Top Requesting Departments</h2>
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
            <h2 className="text-lg font-semibold mb-2">Rejected Requests</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={summary.rejections_by_month}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="rejected_count" stroke="#ff4d4f" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
};

const Card = ({ title, value }) => (
  <div className="bg-white shadow rounded p-4 text-center">
    <h3 className="text-sm text-gray-500">{title}</h3>
    <p className="text-xl font-bold text-blue-600">{value}</p>
  </div>
);

export default Dashboard;