export const getRequesterDisplay = (request) => {
  if (!request) return '—';
  const normalizedRequesterName = [
    request.requester_name,
    request.requesterName,
    request.requester_user_name,
    request.requester?.name,
    request.temporary_requester_name,
  ].find((value) => typeof value === 'string' && value.trim());

  const isMaintenanceRequest = request.request_type === 'Maintenance';
  const maintenanceAssignedToRequester =
    isMaintenanceRequest &&
    request.initiated_by_technician_id &&
    request.requester_id &&
    request.requester_id !== request.initiated_by_technician_id;

  const maintenanceRequesterName = maintenanceAssignedToRequester
    ? normalizedRequesterName
    : request.temporary_requester_name || normalizedRequesterName;

  const requesterName = isMaintenanceRequest
    ? maintenanceRequesterName
    : normalizedRequesterName;

  const requesterRole = maintenanceAssignedToRequester
    ? request.requester_role
    : isMaintenanceRequest && request.temporary_requester_name
      ? 'Temporary Requester'
      : request.requester_role;

  if (!requesterName) return '—';

  return requesterRole ? `${requesterName} (${requesterRole})` : requesterName;
};