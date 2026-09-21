const getRequestTimestamp = (request = {}) => {
  const value =
    request.created_at || request.requested_at || request.updated_at;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const getRequestProgress = (request = {}) => {
  const summary = request.status_summary || {};
  const total = Math.max(Number(summary.total_items) || 0, 0);
  const finalized = Math.max(
    (Number(summary.purchased_count) || 0) +
      (Number(summary.not_procured_count) || 0),
    0,
  );

  if (total === 0) return 0;
  return Math.min(Math.round((finalized / total) * 100), 100);
};

export const sortAssignedRequests = (requests = [], sortBy = "priority") => {
  const sorted = [...requests];

  return sorted.sort((a, b) => {
    if (sortBy === "newest")
      return getRequestTimestamp(b) - getRequestTimestamp(a);
    if (sortBy === "oldest")
      return getRequestTimestamp(a) - getRequestTimestamp(b);
    if (sortBy === "progress")
      return getRequestProgress(b) - getRequestProgress(a);

    const urgencyDifference =
      Number(Boolean(b?.is_urgent)) - Number(Boolean(a?.is_urgent));
    return urgencyDifference || getRequestTimestamp(a) - getRequestTimestamp(b);
  });
};