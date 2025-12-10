import { useEffect, useMemo, useState } from 'react';
import axios from '../api/axios';

const normalizeRole = (role) => (typeof role === 'string' ? role.trim().toUpperCase() : '');

const useStatusCommunications = (role) => {
  const [communicationList, setCommunicationList] = useState({});
  const [communicationDrafts, setCommunicationDrafts] = useState({});
  const [communicationLoading, setCommunicationLoading] = useState({});
  const [communicationError, setCommunicationError] = useState({});
  const [communicationSuccess, setCommunicationSuccess] = useState({});
  const [communicationSending, setCommunicationSending] = useState({});

  const normalizedRole = useMemo(() => normalizeRole(role), [role]);
  const canSendCommunication = useMemo(
    () => ['HOD', 'CMO', 'COO'].includes(normalizedRole),
    [normalizedRole]
  );
  const canViewCommunication = useMemo(
    () => canSendCommunication || normalizedRole === 'SCM',
    [canSendCommunication, normalizedRole]
  );

  const refreshCommunications = async (requestId) => {
    if (!requestId || !canViewCommunication) return;

    setCommunicationLoading((prev) => ({ ...prev, [requestId]: true }));
    setCommunicationError((prev) => ({ ...prev, [requestId]: '' }));

    try {
      const res = await axios.get(`/api/requests/${requestId}/status-communications`);
      setCommunicationList((prev) => ({ ...prev, [requestId]: res.data || [] }));
    } catch (err) {
      console.error('❌ Failed to load communications', err);
      setCommunicationError((prev) => ({
        ...prev,
        [requestId]: 'Failed to load communications. Please try again.',
      }));
    } finally {
      setCommunicationLoading((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const handleSendCommunication = async (requestId, statusLabel) => {
    if (!canSendCommunication) return;

    const draft = (communicationDrafts[requestId] || '').trim();
    if (!draft) {
      setCommunicationError((prev) => ({
        ...prev,
        [requestId]: 'Enter a message before sending.',
      }));
      return;
    }

    setCommunicationSending((prev) => ({ ...prev, [requestId]: true }));
    setCommunicationError((prev) => ({ ...prev, [requestId]: '' }));
    setCommunicationSuccess((prev) => ({ ...prev, [requestId]: '' }));

    try {
      const res = await axios.post(`/api/requests/${requestId}/status-communications`, {
        message: draft,
        status: statusLabel,
      });

      setCommunicationDrafts((prev) => ({ ...prev, [requestId]: '' }));
      setCommunicationSuccess((prev) => ({
        ...prev,
        [requestId]: res.data?.message || 'Message sent.',
      }));

      const newEntry = res.data?.communication;
      if (newEntry) {
        setCommunicationList((prev) => ({
          ...prev,
          [requestId]: [newEntry, ...(prev[requestId] || [])],
        }));
      } else {
        await refreshCommunications(requestId);
      }
    } catch (err) {
      console.error('❌ Failed to send communication', err);
      setCommunicationError((prev) => ({
        ...prev,
        [requestId]:
          err?.response?.data?.message || 'Failed to send message. Please try again.',
      }));
    } finally {
      setCommunicationSending((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  useEffect(() => {
    // Clear communication data when role changes to avoid stale permissions
    setCommunicationList({});
    setCommunicationDrafts({});
    setCommunicationError({});
    setCommunicationSuccess({});
    setCommunicationSending({});
    setCommunicationLoading({});
  }, [normalizedRole]);

  return {
    canSendCommunication,
    canViewCommunication,
    communicationDrafts,
    communicationError,
    communicationList,
    communicationLoading,
    communicationSending,
    communicationSuccess,
    handleSendCommunication,
    refreshCommunications,
    setCommunicationDrafts,
  };
};

export default useStatusCommunications;