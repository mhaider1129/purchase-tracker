// src/pages/ClosedRequestsPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from '../api/axios';
import Navbar from '../components/Navbar';
import { saveAs } from 'file-saver';
import { useTranslation } from 'react-i18next';

const ClosedRequestsPage = () => {
  const { t } = useTranslation();
  const tr = useMemo(
    () => (key) => t(`closedRequests.${key}`),
    [t]
  );
  const [requests, setRequests] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const exportCSV = (data) => {
    const rows = [
      [tr('id'), tr('type'), tr('status'), tr('updated')],
      ...data.map((r) => [
        r.id,
        r.request_type,
        r.status,
        new Date(r.updated_at).toLocaleString(),
      ]),
    ];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${tr('csvFileName')}.csv`);
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
        alert(tr('errorLoading'));
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
        <h1 className="text-2xl font-semibold mb-4">{tr('title')}</h1>
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            className="border p-2 rounded"
            placeholder={tr('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={() => exportCSV(filtered)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {tr('exportCSV')}
          </button>
        </div>
        {loading ? (
          <p className="text-gray-500">{tr('loading')}</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500">{tr('noRequests')}</p>
        ) : (
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border">{tr('id')}</th>
                  <th className="p-2 border">{tr('type')}</th>
                  <th className="p-2 border">{tr('status')}</th>
                  <th className="p-2 border">{tr('updated')}</th>
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