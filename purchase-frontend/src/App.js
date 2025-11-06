// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';
import Register from './pages/Register';
import RequestAccount from './pages/RequestAccount';
import RequestTypeSelector from './pages/requests/RequestTypeSelector';
import StockRequestForm from './pages/requests/StockRequestForm';
import NonStockRequestForm from './pages/requests/NonStockRequestForm';
import StockItemRequestForm from './pages/requests/StockItemRequestForm';
import MedicalDeviceRequestForm from './pages/requests/MedicalDeviceRequestForm';
import ITRequestForm from './pages/requests/ITRequestForm';
import MaintenanceRequestForm from './pages/requests/MaintenanceRequestForm';
import WarehouseSupplyRequestForm from './pages/requests/WarehouseSupplyRequestForm';
import MaintenanceWarehouseSupplyRequestForm from './pages/requests/MaintenanceWarehouseSupplyRequestForm';
import MedicationRequestForm from './pages/requests/MedicationRequestForm';
import SupplyItemsPage from './pages/requests/SupplyItemsPage';
import WarehouseSupplyRequestsPage from './pages/WarehouseSupplyRequestsPage';
import CustodyIssueForm from './pages/custody/CustodyIssueForm';
import CustodyApprovals from './pages/custody/CustodyApprovals';
import CustodyIssuedList from './pages/custody/CustodyIssuedList';
import ItemRecallsPage from './pages/ItemRecallsPage';

import ApprovalsPanel from './pages/ApprovalsPanel';
import OpenRequestsPage from './pages/OpenRequestsPage';
import MyMaintenanceRequests from './pages/MyMaintenanceRequests';
import MaintenanceHODApprovals from './pages/MaintenanceHODApprovals';
import ApprovalHistory from './pages/ApprovalHistory';

import AllRequestsPage from './pages/AllRequestsPage';
import AssignedRequestsPage from './pages/AssignedRequestsPage';
import AdminTools from './pages/AdminTools';
import Management from './pages/Management';
import ChangePassword from './pages/ChangePassword';
import IncompleteRequestsPage from './pages/IncompleteRequestsPage';
import IncompleteMedicalRequestsPage from './pages/IncompleteMedicalRequestsPage';
import IncompleteOperationalRequestsPage from './pages/IncompleteOperationalRequestsPage';
import Dashboard from './pages/Dashboard';
import CompletedAssignedRequestsPage from './pages/CompletedAssignedRequestsPage';
import ClosedRequestsPage from './pages/ClosedRequestsPage';
import MaintenanceStockPage from './pages/MaintenanceStockPage';
import ProcurementPlansPage from './pages/ProcurementPlansPage';
import RequestSubmittedPage from './pages/requests/RequestSubmittedPage';
import WarehouseSupplyTemplatesPage from './pages/WarehouseSupplyTemplatesPage';
import AuditRequestsPage from './pages/AuditRequestsPage';
import LifecycleAnalytics from './pages/LifecycleAnalytics';
import ContractsPage from './pages/ContractsPage';
import SupplierEvaluationsPage from './pages/SupplierEvaluationsPage';
import MyEvaluationsPage from './pages/MyEvaluationsPage';
import EvaluationDetailsPage from './pages/EvaluationDetailsPage';


// 🔒 Reusable Protected Route with Role Filtering
const ProtectedRoute = ({ element, allowedRoles = [] }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;

  try {
    const decoded = JSON.parse(atob(token.split('.')[1]));
    const userRole = decoded.role;

    if (allowedRoles.length && !allowedRoles.includes(userRole)) {
      return <Navigate to="/" replace />;
    }

    return element;
  } catch (err) {
    console.error('❌ Invalid token:', err);
    localStorage.removeItem('token');
    return <Navigate to="/login" replace />;
  }
};

function App() {
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <Router>
      <Routes>
        {/* ✅ Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/request-account" element={<RequestAccount />} />
        <Route path="/register" element={<Register />} />

        {/* ✅ General Protected Routes */}
        <Route path="/" element={<ProtectedRoute element={<RequestTypeSelector />} />} />
        <Route path="/requests/stock" element={<ProtectedRoute element={<StockRequestForm />} />} />
        <Route
          path="/requests/stock-item"
          element={
            <ProtectedRoute
              element={<StockItemRequestForm />}
              allowedRoles={['WarehouseManager', 'warehouse_manager']}
            />
          }
        />
        <Route path="/requests/warehouse-supply" element={<ProtectedRoute element={<WarehouseSupplyRequestForm />} />} />
        <Route path="/item-recalls" element={<ProtectedRoute element={<ItemRecallsPage />} />} />
        <Route
          path="/requests/maintenance-warehouse-supply"
          element={<ProtectedRoute element={<MaintenanceWarehouseSupplyRequestForm />} allowedRoles={['technician', 'SCM', 'admin']} />}
        />
        <Route
          path="/custody/issue"
          element={
            <ProtectedRoute
              element={<CustodyIssueForm />}
              allowedRoles={[
                'warehouse_keeper',
                'WarehouseKeeper',
                'warehousekeeper',
                'warehousemanager',
                'WarehouseManager',
                'SCM',
                'admin',
              ]}
            />
          }
        />
        <Route
          path="/custody/issued"
          element={
            <ProtectedRoute
              element={<CustodyIssuedList />}
              allowedRoles={[
                'warehouse_keeper',
                'WarehouseKeeper',
                'warehousekeeper',
                'warehousemanager',
                'WarehouseManager',
                'SCM',
                'admin',
              ]}
            />
          }
        />
        <Route path="/custody/approvals" element={<ProtectedRoute element={<CustodyApprovals />} />} />
        <Route path="/requests/non-stock" element={<ProtectedRoute element={<NonStockRequestForm />} />} />
        <Route path="/requests/it-items" element={<ProtectedRoute element={<ITRequestForm />} />} />
        <Route path="/requests/medical-device" element={<ProtectedRoute element={<MedicalDeviceRequestForm />} />} />
        <Route
          path="/requests/medication"
          element={
            <ProtectedRoute
              element={<MedicationRequestForm />}
              allowedRoles={['requester', 'Requester', 'HOD', 'CMO', 'SCM']}
            />
          }
        />
        <Route path="/approvals" element={<ProtectedRoute element={<ApprovalsPanel />} />} />
        <Route path="/open-requests" element={<ProtectedRoute element={<OpenRequestsPage />} />} />
        <Route path="/request-submitted" element={<ProtectedRoute element={<RequestSubmittedPage />} />} />
        <Route path="/approval-history" element={<ProtectedRoute element={<ApprovalHistory />} />} />

        {/* ✅ Maintenance Routes */}
        <Route path="/requests/maintenance" element={<ProtectedRoute element={<MaintenanceRequestForm />} allowedRoles={['technician', 'SCM', 'admin']} />} />
        <Route path="/my-maintenance-requests" element={<ProtectedRoute element={<MyMaintenanceRequests />} allowedRoles={['technician', 'SCM', 'admin']} />} />
        <Route
          path="/approvals/maintenance"
          element={
            <ProtectedRoute
              element={<MaintenanceHODApprovals />}
              allowedRoles={['HOD', 'requester', 'Requester', 'CMO', 'COO', 'SCM']}
            />
          }
        />
        <Route
          path="/maintenance-stock"
          element={<ProtectedRoute element={<MaintenanceStockPage />} allowedRoles={['WarehouseManager', 'warehouse_manager', 'technician']} />}
        />
        <Route
          path="/warehouse-supply-templates"
          element={<ProtectedRoute element={<WarehouseSupplyTemplatesPage />} allowedRoles={['WarehouseManager', 'warehouse_manager', 'warehouse_keeper']} />}
        />
        <Route path="/warehouse-supply-requests" element={<ProtectedRoute element={<WarehouseSupplyRequestsPage />} allowedRoles={['WarehouseManager', 'warehouse_manager', 'warehouse_keeper']} />} />

        {/* ✅ Admin / SCM Routes */}
        <Route path="/admin-tools" element={<ProtectedRoute element={<AdminTools />} allowedRoles={['SCM', 'admin']} />} />
        <Route path="/management" element={<ProtectedRoute element={<Management />} allowedRoles={['SCM', 'admin']} />} />
        <Route path="/all-requests" element={<ProtectedRoute element={<AllRequestsPage />} allowedRoles={['SCM', 'admin']} />} />
        <Route path="/incomplete" element={<ProtectedRoute element={<IncompleteRequestsPage />} allowedRoles={['SCM', 'admin']} />} />
        <Route path="/procurement-plans" element={<ProtectedRoute element={<ProcurementPlansPage />} allowedRoles={['SCM', 'admin']} />} />
        <Route
          path="/contracts"
          element={<ProtectedRoute element={<ContractsPage />} allowedRoles={['SCM', 'admin', 'COO', 'Medical Devices', 'ProcurementSpecialist']} />}
        />
        <Route
          path="/supplier-evaluations"
          element={
            <ProtectedRoute
              element={<SupplierEvaluationsPage />}
              allowedRoles={['admin', 'SCM', 'ProcurementSpecialist', 'ProcurementManager']}
            />
          }
        />

        {/* ✅ Procurement-Specific Routes */}
        <Route path="/assigned-requests" element={<ProtectedRoute element={<AssignedRequestsPage />} allowedRoles={['ProcurementSpecialist', 'SCM']} />} />

        {/* ✅ Approver Views */}
        <Route path="/incomplete/medical" element={<ProtectedRoute element={<IncompleteMedicalRequestsPage />} allowedRoles={['CMO', 'SCM']} />} />
        <Route path="/incomplete/operational" element={<ProtectedRoute element={<IncompleteOperationalRequestsPage />} allowedRoles={['COO', 'SCM']} />} />

<Route
  path="/completed-assigned"
      element={<ProtectedRoute element={<CompletedAssignedRequestsPage />} allowedRoles={['ProcurementSpecialist', 'SCM']} />}
/>
        <Route path="/closed-requests" element={<ProtectedRoute element={<ClosedRequestsPage />} />} />
        <Route path="/audit-requests" element={<ProtectedRoute element={<AuditRequestsPage />} allowedRoles={['audit']} />} />
        <Route path="/warehouse-supply/:id" element={<ProtectedRoute element={<SupplyItemsPage />} allowedRoles={['warehouse_keeper']} />} />
        <Route path="/dashboard" element={<ProtectedRoute element={<Dashboard />} allowedRoles={['SCM', 'admin']} />} />
        <Route path="/analytics" element={<ProtectedRoute element={<LifecycleAnalytics />} allowedRoles={['SCM', 'admin']} />} />
        <Route path="/change-password" element={<ProtectedRoute element={<ChangePassword />} />} />
        <Route path="/my-evaluations" element={<ProtectedRoute element={<MyEvaluationsPage />} />} />
        <Route path="/evaluations/:id" element={<ProtectedRoute element={<EvaluationDetailsPage />} />} />
        {/* 🚨 Catch-All Fallback */}
        <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />

      </Routes>
    </Router>
  );
}

export default App;