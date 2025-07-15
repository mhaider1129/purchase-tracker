// src/pages/IncompleteMedicalRequestsPage.jsx
import React, { useEffect, useState } from 'react';
import axios from '../api/axios';
import Navbar from '../components/Navbar';
import RequestTable from '../components/RequestTableWithFilters';

const IncompleteMedicalRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const fetchMedicalRequests = async () => {
      try {
        const res = await axios.get('/api/requests/incomplete/medical');
        setRequests(res.data || []);
        setLastUpdated(new Date().toLocaleString());
      } catch (err) {
        console.error('❌ Error fetching medical incomplete requests:', err);
        setError('Failed to load medical requests');
      } finally {
        setLoading(false);
      }
    };

    fetchMedicalRequests();
  }, []);

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4 text-blue-800">Medical Incomplete Requests</h1>

        {loading ? (
          <p className="text-gray-500">Loading requests...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <>
            <div className="mb-2 flex justify-between items-center text-sm text-gray-600">
              <span>Total: {requests.length} request{requests.length !== 1 ? 's' : ''}</span>
              {lastUpdated && <span>Last updated: {lastUpdated}</span>}
            </div>

            <RequestTable requests={requests} />
          </>
        )}
      </div>
    </>
  );
};

export default IncompleteMedicalRequestsPage;
