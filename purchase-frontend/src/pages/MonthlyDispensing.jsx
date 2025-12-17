import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axios from '../api/axios';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const buildMonthString = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
};

const createEmptyRow = () => ({
  month: buildMonthString(),
  itemName: '',
  quantity: '',
  unit: '',
  facility: '',
  notes: '',
});

const NumberBadge = ({ value }) => (
  <span className="text-lg font-semibold text-indigo-700">{value}</span>
);

const MonthlyDispensing = () => {
  const [rows, setRows] = useState([createEmptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [recent, setRecent] = useState([]);

  const monthlyData = useMemo(() => {
    if (!analytics?.monthlyTotals) return [];
    return analytics.monthlyTotals.map((row) => ({
      month: row.month,
      total: Number(row.total_quantity) || 0,
    }));
  }, [analytics]);

  const facilityData = useMemo(() => {
    if (!analytics?.facilityBreakdown) return [];
    return analytics.facilityBreakdown.map((row) => ({
      facility: row.facility,
      total: Number(row.total_quantity) || 0,
    }));
  }, [analytics]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [analyticsRes, entriesRes] = await Promise.all([
          axios.get('/api/dispensing/monthly/analytics'),
          axios.get('/api/dispensing/monthly'),
        ]);
        setAnalytics(analyticsRes.data);
        setRecent(entriesRes.data || []);
      } catch (err) {
        console.error('Failed to load dispensing analytics', err);
        setError('Failed to load dispensing analytics');
      }
    };

    fetchAnalytics();
  }, []);

  const updateRow = (index, field, value) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);

  const removeRow = (index) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const submitRows = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');

    const payloadRows = rows
      .map((row) => ({
        month: row.month,
        itemName: row.itemName,
        quantity: Number(row.quantity),
        unit: row.unit,
        facility: row.facility,
        notes: row.notes,
      }))
      .filter((row) => row.itemName && Number.isFinite(row.quantity));

    if (payloadRows.length === 0) {
      setError('Please enter at least one item with a quantity.');
      setSubmitting(false);
      return;
    }

    try {
      await axios.post('/api/dispensing/monthly/import', { rows: payloadRows });
      setMessage('Dispensing data saved successfully.');
      setRows([createEmptyRow()]);

      const [analyticsRes, entriesRes] = await Promise.all([
        axios.get('/api/dispensing/monthly/analytics'),
        axios.get('/api/dispensing/monthly'),
      ]);
      setAnalytics(analyticsRes.data);
      setRecent(entriesRes.data || []);
    } catch (err) {
      console.error('Failed to submit dispensing data', err);
      setError(err.response?.data?.message || 'Failed to save dispensing data.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="bg-white shadow rounded-lg p-6 space-y-3">
          <h1 className="text-2xl font-bold text-indigo-700">Monthly Dispensing</h1>
          <p className="text-gray-600">
            Upload monthly dispensing snapshots from your HIS or pharmacy exports to
            keep consumption analytics current.
          </p>
          <p className="text-sm text-gray-500">
            Use YYYY-MM for the month column. Quantities will replace existing values for
            the same month, item, and facility.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <span className="text-xs uppercase tracking-wide text-gray-500">Demand planning</span>
            <Link
              to="/planning"
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100"
            >
              Use these totals in forecasts
            </Link>
          </div>
        </div>

        <form onSubmit={submitRows} className="bg-white shadow rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Monthly rows</h2>
            <button
              type="button"
              onClick={addRow}
              className="px-3 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Add Row
            </button>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
          {message && <div className="text-sm text-green-700">{message}</div>}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="p-2">Month (YYYY-MM)</th>
                  <th className="p-2">Item</th>
                  <th className="p-2">Quantity</th>
                  <th className="p-2">Unit</th>
                  <th className="p-2">Facility</th>
                  <th className="p-2">Notes</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.month}
                        onChange={(e) => updateRow(index, 'month', e.target.value)}
                        className="border rounded px-2 py-1 w-32"
                        placeholder="2024-08"
                        required
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.itemName}
                        onChange={(e) => updateRow(index, 'itemName', e.target.value)}
                        className="border rounded px-2 py-1 w-48"
                        placeholder="Medication name"
                        required
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={row.quantity}
                        onChange={(e) => updateRow(index, 'quantity', e.target.value)}
                        className="border rounded px-2 py-1 w-28"
                        min="0"
                        step="any"
                        required
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.unit}
                        onChange={(e) => updateRow(index, 'unit', e.target.value)}
                        className="border rounded px-2 py-1 w-24"
                        placeholder="packs"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.facility}
                        onChange={(e) => updateRow(index, 'facility', e.target.value)}
                        className="border rounded px-2 py-1 w-32"
                        placeholder="Main store"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(e) => updateRow(index, 'notes', e.target.value)}
                        className="border rounded px-2 py-1 w-48"
                        placeholder="Optional notes"
                      />
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="text-red-600 hover:underline"
                        disabled={rows.length === 1}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Save monthly data'}
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white shadow rounded-lg p-6 space-y-3">
            <h3 className="text-sm font-semibold text-gray-600">Tracked months</h3>
            <NumberBadge value={monthlyData.length} />
            <p className="text-xs text-gray-500">Unique months loaded from your HIS exports.</p>
          </div>
          <div className="bg-white shadow rounded-lg p-6 space-y-3">
            <h3 className="text-sm font-semibold text-gray-600">Top items</h3>
            <NumberBadge value={analytics?.topItems?.length || 0} />
            <p className="text-xs text-gray-500">Items with the highest dispensing volumes.</p>
          </div>
          <div className="bg-white shadow rounded-lg p-6 space-y-3">
            <h3 className="text-sm font-semibold text-gray-600">Facilities reporting</h3>
            <NumberBadge value={facilityData.length} />
            <p className="text-xs text-gray-500">Facilities or stores included in monthly feeds.</p>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Monthly trend</h2>
            <span className="text-sm text-gray-500">Total quantity across all items</span>
          </div>
          {monthlyData.length === 0 ? (
            <p className="text-sm text-gray-500">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => Number(value).toLocaleString()} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#6366f1"
                  fillOpacity={1}
                  fill="url(#colorTotal)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white shadow rounded-lg p-6 space-y-3">
            <h2 className="text-lg font-semibold text-gray-800">Top dispensed items</h2>
            {analytics?.topItems?.length ? (
              <ul className="divide-y divide-gray-100">
                {analytics.topItems.map((item, idx) => (
                  <li key={item.item_name} className="py-2 flex justify-between text-sm">
                    <span>{idx + 1}. {item.item_name}</span>
                    <span className="font-medium text-gray-700">{Number(item.total_quantity).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No items yet.</p>
            )}
          </div>
          <div className="bg-white shadow rounded-lg p-6 space-y-3">
            <h2 className="text-lg font-semibold text-gray-800">Facility coverage</h2>
            {facilityData.length ? (
              <ul className="divide-y divide-gray-100">
                {facilityData.map((facility) => (
                  <li key={facility.facility} className="py-2 flex justify-between text-sm">
                    <span>{facility.facility}</span>
                    <span className="font-medium text-gray-700">{facility.total.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No facility data yet.</p>
            )}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">Recent entries</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-500">Start by adding your first month.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="p-2">Month</th>
                    <th className="p-2">Item</th>
                    <th className="p-2">Quantity</th>
                    <th className="p-2">Unit</th>
                    <th className="p-2">Facility</th>
                    <th className="p-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recent.map((entry) => (
                    <tr key={entry.id}>
                      <td className="p-2">{entry.month_start?.slice(0, 7)}</td>
                      <td className="p-2">{entry.item_name}</td>
                      <td className="p-2">{Number(entry.quantity).toLocaleString()}</td>
                      <td className="p-2">{entry.unit || '—'}</td>
                      <td className="p-2">{entry.facility_name || '—'}</td>
                      <td className="p-2">{entry.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MonthlyDispensing;