import api from './axios';

export const createCustodyRecord = async (payload) => {
  const { data } = await api.post('/api/custody', payload);
  return data;
};

export const searchCustodyRecipients = async (query) => {
  const { data } = await api.get('/api/custody/recipients/search', {
    params: { query },
  });
  return data;
};

export const getPendingCustodyApprovals = async () => {
  const { data } = await api.get('/api/custody/pending');
  return data;
};

export const submitCustodyDecision = async (id, decision) => {
  const { data } = await api.patch(`/api/custody/${id}/decision`, { decision });
  return data;
};

export const getIssuedCustodies = async () => {
  const { data } = await api.get('/api/custody/issued');
  return data;
};