export const buildRequestSubmissionState = (
  requestType,
  responseData = {},
  overrides = {},
) => {
  const safeData = responseData && typeof responseData === 'object' ? responseData : {};
  const merged = { ...safeData, ...overrides };

  const normalizeNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const nextApproval = merged.next_approval || merged.nextApproval || null;
  const normalizedNextApproval = nextApproval
    ? {
        level:
          nextApproval.level ??
          nextApproval.approval_level ??
          nextApproval.approvalLevel ??
          null,
        approverName:
          nextApproval.approver_name ??
          nextApproval.approverName ??
          null,
        approverRole:
          nextApproval.approver_role ??
          nextApproval.approverRole ??
          null,
      }
    : null;

  return {
    requestType,
    summary: {
      requestId:
        merged.request_id ?? merged.requestId ?? merged.id ?? null,
      estimatedCost:
        normalizeNumber(merged.estimated_cost ?? merged.estimatedCost),
      attachmentsUploaded: normalizeNumber(
        merged.attachments_uploaded ?? merged.attachmentsUploaded ?? 0,
      ) ?? 0,
      nextApproval: normalizedNextApproval,
      duplicateDetected: Boolean(
        merged.duplicate_detected ?? merged.duplicateDetected,
      ),
      message: merged.message ?? merged.description ?? '',
    },
  };
};