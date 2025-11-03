// src/pages/AdminTools.jsx
import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useTranslation } from 'react-i18next';
import usePageTranslation from '../utils/usePageTranslation';

const AdminTools = () => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [deactivateEmail, setDeactivateEmail] = useState('');
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [hasFetchedLogs, setHasFetchedLogs] = useState(false);
  const [filterKeyword, setFilterKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [reassignStats, setReassignStats] = useState(null);
  const { t, i18n } = useTranslation();
  const tr = usePageTranslation('adminTools');
  const logsPerPage = 10;
  const navigate = useNavigate();

  const localeForExport = i18n.language?.startsWith('ar') ? 'ar-SA' : 'en-US';

  const exportHeaders = [
    { key: 'id', label: tr('export.headers.id', 'Log ID') },
    { key: 'requestId', label: tr('export.headers.requestId', 'Request ID') },
    { key: 'approvalId', label: tr('export.headers.approvalId', 'Approval ID') },
    { key: 'actor', label: tr('export.headers.actor', 'Actor') },
    { key: 'actorId', label: tr('export.headers.actorId', 'Actor ID') },
    { key: 'action', label: tr('export.headers.action', 'Action') },
    { key: 'comments', label: tr('export.headers.comments', 'Comments') },
    { key: 'type', label: tr('export.headers.type', 'Type') },
    { key: 'justification', label: tr('export.headers.justification', 'Request Justification') },
    { key: 'createdAt', label: tr('export.headers.createdAt', 'Created At') },
    { key: 'raw', label: tr('export.headers.raw', 'Raw Entry') },
  ];

  const sanitizeValue = (value) => {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    return String(value);
  };

  const formatDateTime = (value) => {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString(localeForExport, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (error) {
      console.warn('Failed to format date for export:', error);
      return sanitizeValue(value);
    }
  };

  const normalizeLogForExport = (entry) => {
    if (!entry || typeof entry !== 'object') {
      return {
        id: '',
        requestId: '',
        approvalId: '',
        actor: '',
        actorId: '',
        action: '',
        comments: '',
        type: '',
        justification: '',
        createdAt: '',
        raw: sanitizeValue(entry),
      };
    }

    return {
      id: sanitizeValue(entry.id),
      requestId: sanitizeValue(entry.request_id),
      approvalId: sanitizeValue(entry.approval_id),
      actor: sanitizeValue(entry.actor_name),
      actorId: sanitizeValue(entry.actor_id),
      action: sanitizeValue(entry.action),
      comments: sanitizeValue(entry.comments || entry.description),
      type: sanitizeValue(entry.log_type),
      justification: sanitizeValue(entry.justification),
      createdAt: formatDateTime(entry.created_at || entry.timestamp),
      raw: '',
    };
  };

  const buildExportRows = () => filteredLogs.map(normalizeLogForExport);

  const escapeCsvValue = (value) => {
    const stringValue = sanitizeValue(value);
    if (stringValue === '') return '';
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const getExportFileName = (extension) => {
    const base = tr('systemLogsFile', 'system_logs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${base}_${timestamp}.${extension}`;
  };

  // 👤 Check Access
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage(tr('loginRequired', 'You must be logged in to access admin tools.'));
      navigate('/login');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const role = payload?.role?.toLowerCase() || '';
      if (!['admin', 'scm'].includes(role)) {
        alert(
          tr('accessDenied', '🚫 Access denied: Only SCM or Admin can access this page.')
        );
        navigate('/');
      }
    } catch (error) {
      console.error('❌ Token decode failed:', error);
      navigate('/login');
    }
  }, [navigate, t]);

  // 🔁 Reassign Approvals
  const triggerReassignment = async () => {
    if (!window.confirm(tr('confirmReassign', 'Reassign all pending approvals?'))) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await api.post('/api/admin-tools/reassign-approvals');
      setMessage(res.data?.message || tr('reassignmentSuccess', 'Reassignment completed.'));
      setReassignStats(res.data?.data || null);
    } catch (err) {
      setMessage(
        err.response?.data?.error ||
          err.response?.data?.message ||
          tr('failedReassign', 'Failed to trigger reassignment.')
      );
      setReassignStats(null);
    } finally {
      setLoading(false);
    }
  };

  // 🚫 Deactivate User
  const deactivateUser = async () => {
    if (!deactivateEmail.trim()) {
      setMessage(tr('enterEmail', 'Enter user email to deactivate.'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(deactivateEmail.trim())) {
      setMessage(tr('failedDeactivate', 'Failed to deactivate user.'));
      return;
    }
    if (!window.confirm(tr('confirmDeactivate', 'Deactivate this user?'))) return;

    setLoading(true);
    setMessage('');
    try {
      const res = await api.post('/api/admin-tools/deactivate-user', {
        email: deactivateEmail,
      });
      setMessage(res.data?.message || tr('deactivateUserSuccess', 'User deactivated.'));
      setDeactivateEmail('');
    } catch (err) {
      setMessage(
        err.response?.data?.error ||
          err.response?.data?.message ||
          tr('failedDeactivate', 'Failed to deactivate user.')
      );
    } finally {
      setLoading(false);
    }
  };

  // 📜 Fetch Logs
  const fetchLogs = async () => {
    setLogLoading(true);
    setHasFetchedLogs(false);
    try {
      const res = await api.get('/api/admin-tools/logs');
      const logs = res.data.logs || [];
      setLogs(logs);
      setFilteredLogs(logs);
      setCurrentPage(1);
      setHasFetchedLogs(true);
    } catch (err) {
      setMessage(tr('failedFetchLogs', 'Failed to fetch logs.'));
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
    if (filteredLogs.length === 0) {
      setMessage(tr('export.noLogs', 'No logs available to export.'));
      return;
    }

    const exportRows = buildExportRows();
    const headerRow = exportHeaders.map(({ label }) => escapeCsvValue(label));
    const bodyRows = exportRows.map((row) =>
      exportHeaders.map(({ key }) => escapeCsvValue(row[key]))
    );

    const csvContent = [headerRow, ...bodyRows]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, getExportFileName('csv'));
  };

  // 📄 Export to PDF
  const exportToPDF = () => {
    if (filteredLogs.length === 0) {
      setMessage(tr('export.noLogs', 'No logs available to export.'));
      return;
    }

    const doc = new jsPDF();
    const exportRows = buildExportRows();
    const headers = exportHeaders.map(({ label }) => label);
    const bodyRows = exportRows.map((row) =>
      exportHeaders.map(({ key }) => sanitizeValue(row[key]))
    );

    doc.text(tr('systemLogsTitle', 'System Logs'), 14, 14);
    doc.setFontSize(10);
    doc.text(
      tr('export.generatedAt', 'Generated at: {{timestamp}}', {
        timestamp: new Date().toLocaleString(localeForExport),
      }),
      14,
      22
    );

    doc.autoTable({
      head: [headers],
      body: bodyRows,
      startY: 28,
      styles: {
        fontSize: 8,
        cellWidth: 'wrap',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [22, 101, 216],
        textColor: 255,
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 22 },
        2: { cellWidth: 22 },
        3: { cellWidth: 28 },
        4: { cellWidth: 22 },
        5: { cellWidth: 28 },
        6: { cellWidth: 35 },
        7: { cellWidth: 20 },
        8: { cellWidth: 45 },
        9: { cellWidth: 35 },
        10: { cellWidth: 60 },
      },
    });

    doc.save(getExportFileName('pdf'));
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
        <h2 className="text-2xl font-bold mb-6">{tr('title', 'Admin Tools')}</h2>

        {/* 🔁 Reassign Approvals */}
        <div className="mb-8">
          <button
            onClick={triggerReassignment}
            disabled={loading}
            className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? tr('reassigning', 'Reassigning...') : tr('reassign', 'Reassign Approvals')}
          </button>
          {reassignStats && (
            <div className="mt-3 p-3 border border-blue-200 bg-blue-50 rounded text-sm text-blue-900">
              {tr('reassignmentSummary', 'Reassigned: {{reassigned}}, Auto-approved: {{autoApproved}}, Failed: {{failed}}.', {
                reassigned: reassignStats.reassigned ?? 0,
                autoApproved: reassignStats.autoApproved ?? 0,
                failed: reassignStats.failed ?? 0,
              })}
            </div>
          )}
        </div>

        {/* 🚫 Deactivate User */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">{tr('deactivateUser', 'Deactivate User')}</h3>
          <div className="flex gap-2">
            <input
              type="email"
              value={deactivateEmail}
              onChange={(e) => setDeactivateEmail(e.target.value)}
              placeholder={tr('userEmail', 'User email')}
              className="flex-1 p-2 border rounded"
            />
            <button
              onClick={deactivateUser}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              disabled={loading}
            >
              {tr('deactivate', 'Deactivate')}
            </button>
          </div>
        </div>

        {/* 📜 View Logs */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">{tr('viewLogs', 'View System Logs')}</h3>
          <div className="flex gap-2 mb-4">
            <button
              onClick={fetchLogs}
              className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900"
              disabled={logLoading}
            >
              {logLoading ? tr('loadingLogs', 'Loading Logs...') : tr('fetchLogs', 'Fetch Logs')}
            </button>
            <button onClick={exportToCSV} className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700">
              {tr('exportCSV', 'Export CSV')}
            </button>
            <button onClick={exportToPDF} className="bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-700">
              {tr('exportPDF', 'Export PDF')}
            </button>
          </div>

          <input
            type="text"
            placeholder={tr('searchLogs', 'Search logs...')}
            className="w-full p-2 border rounded mb-4"
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
          />

          {logLoading && (
            <p className="text-sm text-gray-600">{tr('loadingLogs', 'Loading Logs...')}</p>
          )}

          {!logLoading && currentLogs.length > 0 && (
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
                  {t('common.prev')}
                </button>
                <span>
                  {t('common.pageOf', { current: currentPage, total: totalPages })}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
                >
                  {t('common.next')}
                </button>
              </div>
            </>
          )}

          {!logLoading && hasFetchedLogs && filteredLogs.length === 0 && (
            <p className="text-sm text-gray-600 italic">{tr('noLogsFound', 'No logs found for the selected filters.')}</p>
          )}
        </div>

        {/* 📢 Feedback */}
        {message && <p className="mt-4 text-blue-700 font-medium">{message}</p>}
      </div>
    </>
  );
};

export default AdminTools;