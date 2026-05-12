export const featureRegistry = {
  openRequests: { path: '/open-requests', nav: { group: 'requests', labelKey: 'navbar.openRequests', color: 'text-green-600' } },
  approvals: { path: '/approvals', nav: { group: 'requests', label: 'Approvals', color: 'text-sky-700' } },
  approvalHistory: { path: '/approval-history', nav: { group: 'requests', label: 'Approval History', color: 'text-sky-600' } },
  allRequests: { path: '/all-requests', resourceKey: 'feature.allRequests', requiredPermissions: ['requests.view-all'], nav: { group: 'requests', labelKey: 'navbar.allRequests', color: 'text-indigo-600' } },
  historicalRequests: { path: '/requests/historical', resourceKey: 'feature.historicalRequests', requiredPermissions: ['requests.manage'], allowedRoles: ['admin', 'scm'], nav: { group: 'requests', labelKey: 'navbar.historicalRequests', color: 'text-blue-700' } },
  procurementPlans: { path: '/procurement-plans', resourceKey: 'feature.procurementPlans', requiredPermissions: ['procurement.update-status', 'procurement.update-cost'], nav: { group: 'requests', labelKey: 'navbar.procurementPlans', color: 'text-teal-600' } },
  assignedRequests: { path: '/assigned-requests', resourceKey: 'feature.procurementQueues', requiredPermissions: ['procurement.update-status'], nav: { group: 'requests', labelKey: 'navbar.myAssigned', color: 'text-purple-600' } },
  completedAssigned: { path: '/completed-assigned', resourceKey: 'feature.procurementQueues', requiredPermissions: ['procurement.update-status'], nav: { group: 'requests', labelKey: 'navbar.completedRequests', color: 'text-gray-700' } },
  procureToPay: { path: '/procure-to-pay', requiredPermissions: ['procure-to-pay.lifecycle.view'], allowedRoles: ['scm','admin','finance','financeapprover','warehousekeeper','warehousemanager','procurementspecialist'], nav: { group: 'procureToPay', label: 'Procure-to-Pay Dashboard', color: 'text-violet-800' } },
  procureToPayLifecycle: { path: '/procure-to-pay/lifecycle', requiredPermissions: ['procure-to-pay.lifecycle.view'], allowedRoles: ['scm','admin','finance','financeapprover','warehousekeeper','warehousemanager','procurementspecialist'], nav: { group: 'procureToPay', label: 'Procure-to-Pay Lifecycle', color: 'text-violet-700' } },
  procureToPayReceipts: { path: '/procure-to-pay/receipts', resourceKey: 'feature.procureToPayReceipts', requiredPermissions: ['procure-to-pay.receipts.manage'], allowedRoles: ['scm','admin','warehousekeeper','warehousemanager'], nav: { group: 'procureToPay', labelKey: 'navbar.procureToPayReceipts', color: 'text-blue-700' } },
  dashboard: { path: '/dashboard', resourceKey: 'feature.dashboard', requiredPermissions: ['dashboard.view'], nav: { group: 'insights', labelKey: 'navbar.dashboard', color: 'text-cyan-600' } },
};

export const featureByPath = Object.values(featureRegistry).reduce((acc, feature) => {
  acc[feature.path] = feature;
  return acc;
}, {});