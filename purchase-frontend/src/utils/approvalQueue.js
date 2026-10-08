export const getApprovalQueueStatus = (request) =>
  String(request?.approval_status || "Pending")
    .trim()
    .toLowerCase();

const dateValue = (request, order) => {
  const values =
    order === "oldest"
      ? [
          request?.submitted_at,
          request?.created_at,
          request?.requested_at,
          request?.request_date,
        ]
      : [
          request?.updated_at,
          request?.submitted_at,
          request?.created_at,
          request?.requested_at,
          request?.request_date,
        ];
  for (const value of values) {
    if (!value) continue;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export const compareApprovalDates = (a, b, order) => {
  const first = dateValue(a, order),
    second = dateValue(b, order);
  if (first === null && second === null) return 0;
  if (first === null) return 1;
  if (second === null) return -1;
  return order === "oldest" ? first - second : second - first;
};
