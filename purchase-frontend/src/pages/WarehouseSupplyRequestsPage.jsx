import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Navbar from '../components/Navbar';

const WarehouseSupplyRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/warehouse-supply');
      setRequests(res.data || []);
    } catch (err) {
      console.error('Failed to load requests:', err);
      alert('Failed to load warehouse supply requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Warehouse Supply Requests</h1>
        {loading ? (
          <p className="text-gray-600">Loading...</p>
        ) : requests.length === 0 ? (
          <p>No requests found.</p>
        ) : (
          requests.map((req) => (
            <div key={req.id} className="border rounded p-4 mb-4 shadow">
              <p><strong>ID:</strong> {req.id}</p>
              <p><strong>Department:</strong> {req.department_name}</p>
              <p><strong>Section:</strong> {req.section_name || '—'}</p>
              <p><strong>Warehouse:</strong> {req.request_domain}</p>
              <p><strong>Justification:</strong> {req.justification}</p>
              <p><strong>Submitted:</strong> {new Date(req.created_at).toLocaleString()}</p>
              <button
                onClick={() => navigate(`/warehouse-supply/${req.id}`)}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Record Supplied Items
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
};

export default WarehouseSupplyRequestsPage;