export const getRequesterDisplay = (request) => {
  if (!request) return '—';

  const isMaintenanceRequest = request.request_type === 'Maintenance';
  const maintenanceAssignedToRequester =
    isMaintenanceRequest &&
    request.initiated_by_technician_id &&
    request.requester_id &&
    request.requester_id !== request.initiated_by_technician_id;

  const maintenanceRequesterName = maintenanceAssignedToRequester
    ? request.requester_name
    : request.temporary_requester_name || request.requester_name;

  const requesterName = isMaintenanceRequest
    ? maintenanceRequesterName
    : request.requester_name || request.temporary_requester_name;

  const requesterRole = maintenanceAssignedToRequester
    ? request.requester_role
    : isMaintenanceRequest && request.temporary_requester_name
      ? 'Temporary Requester'
      : request.requester_role;

  if (!requesterName) return '—';

  return requesterRole ? `${requesterName} (${requesterRole})` : requesterName;
};