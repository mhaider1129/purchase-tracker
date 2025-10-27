export const buildRequestSubmissionState = (
  requestType,
  responseData = {},
  overrides = {},
) => {
  const safeData =
    responseData && typeof responseData === 'object' ? responseData : {};
  const merged = { ...safeData, ...overrides };

  const resolveCandidate = (candidate) => {
    if (typeof candidate === 'function') {
      return candidate();
    }

    if (Array.isArray(candidate)) {
      return candidate.reduce((acc, key) => {
        if (acc === null || acc === undefined) return undefined;
        if (typeof acc !== 'object') return undefined;
        return acc[key];
      }, merged);
    }

    if (typeof candidate === 'string') {
      return merged[candidate];
    }

    return undefined;
  };

  const pickValue = (candidates = [], { preserveEmptyString = false } = {}) => {
    for (const candidate of candidates) {
      const value = resolveCandidate(candidate);
      if (value === undefined || value === null) continue;
      if (
        !preserveEmptyString &&
        typeof value === 'string' &&
        value.trim() === ''
      ) {
        continue;
      }
      return value;
    }
    return null;
  };

  const normalizeNumber = (value) => {
    if (value === null || value === undefined) return null;

    if (typeof value === 'string') {
      if (value.trim() === '') return null;
      const parsedFromString = Number(value.trim());
      return Number.isNaN(parsedFromString) ? null : parsedFromString;
    }

    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const pickNumber = (...candidates) => {
    for (const candidate of candidates) {
      const value = resolveCandidate(candidate);
      const normalized = normalizeNumber(value);
      if (normalized !== null) {
        return normalized;
      }
    }
    return null;
  };

  const normalizeBoolean = (value, defaultValue = false) => {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const lowered = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(lowered)) return true;
      if (['false', '0', 'no', 'n'].includes(lowered)) return false;
    }
    return defaultValue;
  };

  const pickArray = (...candidates) => {
    for (const candidate of candidates) {
      const value = resolveCandidate(candidate);
      if (Array.isArray(value)) {
        return value;
      }
    }
    return null;
  };

  const computeEstimatedCostFromItems = () => {
    const items =
      pickArray('items', 'line_items', 'request_items', 'requestItems') || [];
    if (!items.length) return null;

    let hasValidEntry = false;
    const total = items.reduce((sum, item) => {
      if (!item || typeof item !== 'object') return sum;
      const quantity =
        pickNumber(
          () =>
            item.quantity ??
            item.qty ??
            item.requested_quantity ??
            item.requestedQuantity,
        ) ?? 1;
      const unitCost =
        pickNumber(
          () =>
            item.unit_cost ??
            item.unitCost ??
            item.cost ??
            item.price ??
            item.unit_price ??
            item.unitPrice,
        );

      if (unitCost === null) return sum;
      hasValidEntry = true;
      const normalizedQuantity =
        quantity === null || Number.isNaN(quantity) ? 1 : quantity;
      return sum + unitCost * normalizedQuantity;
    }, 0);

    return hasValidEntry && Number.isFinite(total) ? total : null;
  };

  const computeAttachmentsFromData = () => {
    const directAttachments = pickArray(
      'attachments',
      'files',
      'uploaded_files',
      'uploadedFiles',
    );
    if (directAttachments) {
      return directAttachments.length;
    }

    const items =
      pickArray('items', 'line_items', 'request_items', 'requestItems') || [];
    if (!items.length) return null;

    let attachmentsFound = false;
    const total = items.reduce((sum, item) => {
      if (!item || typeof item !== 'object') return sum;
      const itemAttachments = item.attachments || item.files || [];
      if (Array.isArray(itemAttachments) && itemAttachments.length >= 0) {
        attachmentsFound = true;
        return sum + itemAttachments.length;
      }
      return sum;
    }, 0);

    return attachmentsFound ? total : null;
  };

  const nextApproval =
    pickValue([
      'next_approval',
      'nextApproval',
      'next_step',
      'nextStep',
    ]) || null;

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
          nextApproval.name ??
          null,
        approverRole:
          nextApproval.approver_role ??
          nextApproval.approverRole ??
          nextApproval.role ??
          null,
      }
    : null;

  const estimatedCost =
    pickNumber(
      'estimated_cost',
      'estimatedCost',
      'total_estimated_cost',
      'totalEstimatedCost',
      computeEstimatedCostFromItems,
    );

  const attachmentsUploaded =
    pickNumber(
      'attachments_uploaded',
      'attachmentsUploaded',
      'attachments_count',
      'attachmentsCount',
      computeAttachmentsFromData,
    ) ?? 0;

  const items =
    pickArray('items', 'line_items', 'request_items', 'requestItems') || null;

  return {
    requestType:
      pickValue(['request_type', 'requestType', 'type']) ?? requestType,
    summary: {
      requestId:
        pickValue(
          [
            'request_id',
            'requestId',
            'id',
            'request_number',
            'requestNumber',
            ['request', 'id'],
          ],
          { preserveEmptyString: true },
        ) ?? null,
      requestNumber:
        pickValue(
          [
            'request_number',
            'requestNumber',
            'reference',
            'reference_number',
            'tracking_number',
            'trackingNumber',
          ],
          { preserveEmptyString: true },
        ) ?? null,
      estimatedCost,
      attachmentsUploaded,
      attachmentsCount: attachmentsUploaded,
      itemsCount: items ? items.length : null,
      nextApproval: normalizedNextApproval,
      duplicateDetected: normalizeBoolean(
        pickValue([
          'duplicate_detected',
          'duplicateDetected',
          'is_duplicate',
          'isDuplicate',
          'duplicate',
        ]),
      ),
      message:
        pickValue(
          [
            'message',
            'status_message',
            'statusMessage',
            'description',
            'detail',
            'details',
          ],
          { preserveEmptyString: true },
        ) ?? '',
      submittedAt:
        pickValue([
          'submitted_at',
          'submittedAt',
          'created_at',
          'createdAt',
          'timestamp',
        ]) ?? null,
      submittedBy:
        pickValue([
          'submitted_by',
          'submittedBy',
          'requester_name',
          'requesterName',
        ]) ?? null,
      projectName:
        pickValue([
          'project_name',
          'projectName',
          ['project', 'name'],
        ]) ?? null,
    },
  };
};