// Display-only vocabulary: persisted workflow codes and action/permission keys
// must never be translated or sent back to APIs as translated values.
const labels = [
  'Unknown', 'Submitted', 'Pending', 'Approved', 'Rejected', 'Completed',
  'Canceled', 'Cancelled', 'On Hold', 'Partially Procured', 'Received',
  'Available in Stock', 'Purchased', 'Assigned', 'Not Procured', 'Urgent',
  'Routine', 'Emergency', 'Normal', 'High', 'Low', 'Piece', 'Box', 'Pack', 'Pair', 'Set',
  'Internal note', 'Department follow up', 'Supplier follow up', 'Clarification',
  'Finance note', 'Warehouse note', 'Manufacturer', 'Model', 'Serial number',
  'Location', 'Planned start', 'Planned end', 'Received at', 'Started at',
  'Completed at', 'Returned at', 'Findings', 'Safety findings', 'Open',
  'Revision required', 'COO review', 'Registered', 'Scheduled', 'In progress',
  'Evaluating', 'Withdrawn', 'Returned', 'Suitable', 'Not suitable', 'Document', 'Candidate',
  'Transition', 'Observation', 'Return', 'Opinion', 'Recommend', 'Decision',
  'Pending mapping', 'Approved exception', 'Resolved',
];
const normalize = value => String(value ?? '').trim().replaceAll('_', ' ').toLowerCase();
const vocabulary = new Map(labels.map(label => [normalize(label), label]));
export const workflowLabel = value => vocabulary.get(normalize(value)) || value;

const actions = new Set([
  'Request review', 'Review request status', 'Request rejected',
  'Request stopped; review the rejection reason in history',
  'No procurement required; review fulfillment history', 'Procurement assignment',
  'Assign request to procurement', 'Procurement execution',
  'Register procurement progress', 'Completion',
  'Mark request completed/received if required', 'Completed',
]);
export function translateWorkflowAction(value, translate) {
  if (typeof value !== 'string') return value;
  const level = /^Approval level (\d+)$/.exec(value);
  if (level) return translate('Approval level {{level}}', { level: level[1] });
  const awaiting = /^Awaiting (.+) approval$/.exec(value);
  if (awaiting) return translate('Awaiting {{name}} approval', {
    name: awaiting[1] === 'approver' ? translate('approver') : awaiting[1],
  });
  return actions.has(value) ? translate(value) : value;
}
