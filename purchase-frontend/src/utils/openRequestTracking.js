export const matchesSubmissionDates = (request, fromDate, toDate) => {
  if (!fromDate && !toDate) return true;
  const submitted = request.created_at ? Date.parse(request.created_at) : NaN;
  if (!Number.isFinite(submitted)) return false;
  const from = fromDate
    ? new Date(`${fromDate}T00:00:00`).getTime()
    : -Infinity;
  const to = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : Infinity;
  return submitted >= from && submitted <= to;
};

export const sortTrackedRequests = (requests, order) =>
  [...requests].sort((a, b) => {
    const first = Date.parse(a.updated_at || a.created_at || "");
    const second = Date.parse(b.updated_at || b.created_at || "");
    if (!Number.isFinite(first) && !Number.isFinite(second)) return 0;
    if (!Number.isFinite(first)) return 1;
    if (!Number.isFinite(second)) return -1;
    return order === "oldest" ? first - second : second - first;
  });
