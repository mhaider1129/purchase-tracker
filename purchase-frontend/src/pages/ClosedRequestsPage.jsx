//src/pages/ClosedRequestsPage.jsx
import React, { useEffect, useState } from 'react';
import axios from '../api/axios';
import Navbar from '../components/Navbar';

const ClosedRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchClosed = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/requests/my');
        const closed = res.data.filter((r) =>
          ['completed', 'rejected'].includes(r.status.toLowerCase())
        );
        setRequests(closed);
      } catch (err) {
        console.error('Failed to fetch closed requests:', err);
        alert('Error loading closed requests.');
      } finally {
        setLoading(false);
      }
    };
    fetchClosed();
  }, []);

  return (
    <>
      <Navbar />
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Closed Requests</h1>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : requests.length === 0 ? (
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
                {requests.map((req) => (
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