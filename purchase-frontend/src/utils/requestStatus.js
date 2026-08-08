const normalizeRequestStatus = (status) =>
  (status || '').toString().trim().toLowerCase();

const COMPLETED_REQUEST_STATUSES = new Set(['completed', 'received']);

export const isCompletedRequestStatus = (status) =>
  COMPLETED_REQUEST_STATUSES.has(normalizeRequestStatus(status));

export const requestMatchesStatusFilter = (status, filter) => {
  const normalizedFilter = normalizeRequestStatus(filter);

  if (!normalizedFilter || normalizedFilter === 'all') return true;
  if (normalizedFilter === 'completed') return isCompletedRequestStatus(status);

  return normalizeRequestStatus(status) === normalizedFilter;
};

export const summarizeRequestStatuses = (requests = []) =>
  requests.reduce(
    (summary, request) => {
      const status = normalizeRequestStatus(request?.status) || 'unknown';
      summary[status] = (summary[status] || 0) + 1;

      if (status === 'received') {
        summary.completed += 1;
      }

      return summary;
    },
    { total: requests.length, completed: 0 },
  );