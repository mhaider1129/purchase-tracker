import { useMemo, useState } from 'react';
import axios from '../api/axios';

const normalizeRole = (role) => (typeof role === 'string' ? role.trim().toUpperCase() : '');
const allowedRoles = new Set(['HOD', 'SCM', 'PROCUREMENTSPECIALIST', 'ADMIN']);

const useDirectPurchaseCommunications = (role) => {
  const [drafts, setDrafts] = useState({});
  const [urgencyNotes, setUrgencyNotes] = useState({});
  const [sending, setSending] = useState({});
  const [error, setError] = useState({});
  const [success, setSuccess] = useState({});
  const [entries, setEntries] = useState({});

  const normalizedRole = useMemo(() => normalizeRole(role), [role]);
  const canDocumentDirectPurchase = useMemo(
    () => allowedRoles.has(normalizedRole),
    [normalizedRole]
  );

  const handleSendDirectCommunication = async (requestId) => {
    if (!canDocumentDirectPurchase || !requestId) return;

    const message = (drafts[requestId] || '').trim();
    if (!message) {
      setError((prev) => ({
        ...prev,
        [requestId]: 'Add a note about the direct purchase before sending.',
      }));
      return;
    }

    const urgency_reason = (urgencyNotes[requestId] || '').trim();

    setSending((prev) => ({ ...prev, [requestId]: true }));
    setError((prev) => ({ ...prev, [requestId]: '' }));
    setSuccess((prev) => ({ ...prev, [requestId]: '' }));

    try {
      const res = await axios.post(`/api/requests/${requestId}/direct-purchase-communications`, {
        message,
        urgency_reason: urgency_reason || undefined,
      });

      const logEntry = res.data?.log;
      setEntries((prev) => ({
        ...prev,
        [requestId]: logEntry ? [logEntry, ...(prev[requestId] || [])] : prev[requestId] || [],
      }));
      setDrafts((prev) => ({ ...prev, [requestId]: '' }));
      setSuccess((prev) => ({
        ...prev,
        [requestId]:
          res.data?.message ||
          'Direct purchase note recorded and shared with the supply chain team.',
      }));
    } catch (err) {
      console.error('❌ Failed to send direct purchase communication', err);
      setError((prev) => ({
        ...prev,
        [requestId]:
          err?.response?.data?.message ||
          'Unable to record the direct purchase note. Please try again.',
      }));
    } finally {
      setSending((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  return {
    canDocumentDirectPurchase,
    drafts,
    urgencyNotes,
    sending,
    error,
    success,
    entries,
    setDrafts,
    setUrgencyNotes,
    handleSendDirectCommunication,
  };
};

export default useDirectPurchaseCommunications;