//src/pages/ClosedRequestsPage.jsx
import React, { useEffect, useState } from 'react';
import axios from '../api/axios';
import Navbar from '../components/Navbar';
import { saveAs } from 'file-saver';

const ClosedRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const exportCSV = (data) => {
    const rows = [
      ['ID', 'Type', 'Status', 'Updated At'],
      ...data.map((r) => [
        r.id,
        r.request_type,
        r.status,
        new Date(r.updated_at).toLocaleString(),
      ]),
    ];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'Closed_Requests.csv');
  };

  useEffect(() => {
    const fetchClosed = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/requests/closed');
        setRequests(res.data);
        setFiltered(res.data);
      } catch (err) {
        console.error('Failed to fetch closed requests:', err);
        alert('Error loading closed requests.');
      } finally {
        setLoading(false);
      }
    };
    fetchClosed();
  }, []);

  useEffect(() => {
    if (!search) {
      setFiltered(requests);
      return;
    }
    const term = search.toLowerCase();
    setFiltered(
      requests.filter(
        (r) =>
          r.request_type.toLowerCase().includes(term) ||
          r.justification.toLowerCase().includes(term) ||
          r.status.toLowerCase().includes(term)
      )
    );
  }, [search, requests]);

  return (
    <>
      <Navbar />
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Closed Requests</h1>
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            className="border p-2 rounded"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={() => exportCSV(filtered)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Export CSV
          </button>
        </div>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500">No closed requests found.</p>
        ) : (
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border">ID</th>
                  <th className="p-2 border">Type</th>
                  <th className="p-2 border">Status</th>
                  <th className="p-2 border">Updated At</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((req) => (
                  <tr key={req.id}>
                    <td className="p-2 border">{req.id}</td>
                    <td className="p-2 border">{req.request_type}</td>
                    <td className="p-2 border">{req.status}</td>
                    <td className="p-2 border">
                      {new Date(req.updated_at).toLocaleDateString('en-GB')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default ClosedRequestsPage;