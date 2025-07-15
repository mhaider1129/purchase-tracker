// src/pages/IncompleteOperationalRequestsPage.jsx
import React, { useEffect, useState } from 'react';
import axios from '../api/axios';
import Navbar from '../components/Navbar';
import RequestTable from '../components/RequestTableWithFilters';

const IncompleteOperationalRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOperationalRequests = async () => {
      try {
        const res = await axios.get('/api/requests/incomplete/operational');
        setRequests(res.data);
      } catch (err) {
        console.error('❌ Error fetching operational incomplete requests:', err);
        setError(err?.response?.data?.message || 'Failed to load operational requests');
      } finally {
        setLoading(false);
      }
    };

    fetchOperationalRequests();
  }, []);

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4 text-purple-800">Operational Incomplete Requests</h1>

        {loading ? (
          <p className="text-gray-600">Loading requests...</p>
        ) : error ? (
          <p className="text-red-600">❌ {error}</p>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-2">
              Total: {requests.length} {requests.length === 1 ? 'request' : 'requests'}
            </p>
            <RequestTable requests={requests} />
          </>
        )}
      </div>
    </>
  );
};

export default IncompleteOperationalRequestsPage;
