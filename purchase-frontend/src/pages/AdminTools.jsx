// src/pages/AdminTools.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';

const AdminTools = () => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [logs, setLogs] = useState([]);
  const [logLoading, setLogLoading] = useState(false);

  const token = localStorage.getItem('token');
  const API_BASE = process.env.REACT_APP_API_BASE_URL || ''; // fallback for localhost
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setMessage('🔒 You must be logged in to access admin tools.');
      navigate('/login');
      return;
    }

    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      const role = decoded?.role || '';
      if (!['admin', 'SCM'].includes(role)) {
        alert('🚫 Access denied: Only Admin or SCM users allowed.');
        navigate('/');
      }
    } catch (err) {
      console.error('❌ Token decode failed:', err);
      navigate('/login');
    }
  }, [token, navigate]);

  const triggerReassignment = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await axios.post(`${API_BASE}/admin/reassign-approvals`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(res.data.message || '✅ Reassignment complete');
    } catch (err) {
      console.error('❌ Error triggering reassignment:', err);
      setMessage('❌ Failed to trigger reassignment');
    } finally {
      setLoading(false);
    }
  };

  const deactivateUser = async () => {
    if (!email.trim()) {
      setMessage('⚠️ Please enter a user email.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage('❌ Invalid email format.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const res = await axios.post(`${API_BASE}/admin/deactivate-user`, { email }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(res.data.message || '✅ User deactivated');
      setEmail('');
    } catch (err) {
      console.error('❌ Error deactivating user:', err);
      setMessage('❌ Failed to deactivate user');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLogLoading(true);
    setMessage('');
    try {
      const res = await axios.get(`${API_BASE}/admin/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error('❌ Error fetching logs:', err);
      setMessage('❌ Failed to fetch logs');
    } finally {
      setLogLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Admin Tools</h1>

        {/* Reassign Approvals */}
        <div className="mb-6">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            onClick={triggerReassignment}
            disabled={loading}
          >
            {loading ? 'Reassigning...' : 'Reassign Pending Approvals'}
          </button>
        </div>

        {/* Deactivate User */}
        <div className="mb-6">
          <label className="block font-semibold mb-1">Deactivate User by Email</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="p-2 border rounded flex-1"
              placeholder="Enter user email"
            />
            <button
              onClick={deactivateUser}
              disabled={loading}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              {loading ? 'Processing...' : 'Deactivate'}
            </button>
          </div>
        </div>

        {/* View Logs */}
        <div className="mb-6">
          <button
            onClick={fetchLogs}
            className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900"
          >
            {logLoading ? 'Loading Logs...' : 'View System Logs'}
          </button>

          {logs.length > 0 && (
            <div className="mt-4 border rounded p-3 bg-gray-50 max-h-64 overflow-y-auto text-sm">
              <ul className="space-y-1">
                {logs.map((log, index) => (
                  <li key={index} className="text-gray-700">
                    🔹 {typeof log === 'string' ? log : JSON.stringify(log)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Message */}
        {message && <p className="mt-4 text-blue-700 font-medium">{message}</p>}
      </div>
    </>
  );
};

export default AdminTools;
