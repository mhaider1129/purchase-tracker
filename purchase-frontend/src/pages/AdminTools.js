// src/pages/AdminTools.jsx
import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const AdminTools = () => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [deactivateEmail, setDeactivateEmail] = useState('');
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [filterKeyword, setFilterKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 10;
  const navigate = useNavigate();

  // 👤 Check Access
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('🔒 You must be logged in to access admin tools.');
      navigate('/login');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const role = payload?.role?.toLowerCase() || '';
      if (!['admin', 'scm'].includes(role)) {
        alert('🚫 Access denied: Only SCM or Admin can access this page.');
        navigate('/');
      }
    } catch (error) {
      console.error('❌ Token decode failed:', error);
      navigate('/login');
    }
  }, [navigate]);

  // 🔁 Reassign Approvals
  const triggerReassignment = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await api.post('/admin-tools/reassign-approvals');
      setMessage(res.data.message || '✅ Reassignment completed.');
    } catch (err) {
      setMessage(err.response?.data?.error || '❌ Failed to reassign approvals.');
    } finally {
      setLoading(false);
    }
  };

  // 🚫 Deactivate User
  const deactivateUser = async () => {
    if (!deactivateEmail.trim()) {
      setMessage('⚠️ Enter user email to deactivate.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(deactivateEmail.trim())) {
      setMessage('❌ Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const res = await api.post('/admin-tools/deactivate-user', {
        email: deactivateEmail,
      });
      setMessage(res.data.message || '✅ User deactivated.');
      setDeactivateEmail('');
    } catch (err) {
      setMessage(err.response?.data?.error || '❌ Failed to deactivate user.');
    } finally {
      setLoading(false);
    }
  };

  // 📜 Fetch Logs
  const fetchLogs = async () => {
    setLogLoading(true);
    try {
      const res = await api.get('/admin-tools/logs');
      const logs = res.data.logs || [];
      setLogs(logs);
      setFilteredLogs(logs);
      setCurrentPage(1);
    } catch (err) {
      setMessage('❌ Failed to fetch logs.');
    } finally {
      setLogLoading(false);
    }
  };

  // 🔎 Filter Logs
  useEffect(() => {
    if (filterKeyword.trim() === '') {
      setFilteredLogs(logs);
    } else {
      const filtered = logs.filter((log) =>
        JSON.stringify(log).toLowerCase().includes(filterKeyword.toLowerCase())
      );
      setFilteredLogs(filtered);
      setCurrentPage(1);
    }
  }, [filterKeyword, logs]);

  // 📄 Export to CSV
  const exportToCSV = () => {
    const rows = filteredLogs.map((log) => [typeof log === 'string' ? log : JSON.stringify(log)]);
    const csvContent = [
      ['Log Entry'],
      ...rows
    ]
      .map((e) => e.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'system_logs.csv');
  };

  // 📄 Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('System Logs', 14, 14);
    const rows = filteredLogs.map((log) => [typeof log === 'string' ? log : JSON.stringify(log)]);
    doc.autoTable({
      head: [['Log Entry']],
      body: rows,
      startY: 20,
    });
    doc.save('system_logs.pdf');
  };

  // 📄 Pagination Logic
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6">Admin Tools</h2>

        {/* 🔁 Reassign Approvals */}
        <div className="mb-8">
          <button
            onClick={triggerReassignment}
            disabled={loading}
            className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? 'Reassigning...' : 'Reassign Pending Approvals'}
          </button>
        </div>

        {/* 🚫 Deactivate User */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Deactivate User</h3>
          <div className="flex gap-2">
            <input
              type="email"
              value={deactivateEmail}
              onChange={(e) => setDeactivateEmail(e.target.value)}
              placeholder="User email"
              className="flex-1 p-2 border rounded"
            />
            <button
              onClick={deactivateUser}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              disabled={loading}
            >
              Deactivate
            </button>
          </div>
        </div>

        {/* 📜 View Logs */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">View System Logs</h3>
          <div className="flex gap-2 mb-4">
            <button
              onClick={fetchLogs}
              className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900"
              disabled={logLoading}
            >
              {logLoading ? 'Loading Logs...' : 'Fetch Logs'}
            </button>
            <button onClick={exportToCSV} className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700">
              Export CSV
            </button>
            <button onClick={exportToPDF} className="bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-700">
              Export PDF
            </button>
          </div>

          <input
            type="text"
            placeholder="Search logs..."
            className="w-full p-2 border rounded mb-4"
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
          />

          {currentLogs.length > 0 && (
            <>
              <div className="max-h-64 overflow-y-auto border p-2 bg-gray-50 rounded text-sm">
                <ul className="space-y-1">
                  {currentLogs.map((log, index) => (
                    <li key={index} className="text-gray-700">
                      🔹 {typeof log === 'string' ? log : JSON.stringify(log)}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pagination Controls */}
              <div className="mt-4 flex justify-between items-center">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
                >
                  ⬅️ Prev
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Next ➡️
                </button>
              </div>
            </>
          )}
        </div>

        {/* 📢 Feedback */}
        {message && <p className="mt-4 text-blue-700 font-medium">{message}</p>}
      </div>
    </>
  );
};

export default AdminTools;
