// src/App.js
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import RequestAccount from "./pages/RequestAccount";
import RequestTypeSelector from "./pages/requests/RequestTypeSelector";
import StockRequestForm from "./pages/requests/StockRequestForm";
import NonStockRequestForm from "./pages/requests/NonStockRequestForm";
import StockItemRequestForm from "./pages/requests/StockItemRequestForm";
import MedicalDeviceRequestForm from "./pages/requests/MedicalDeviceRequestForm";
import ITRequestForm from "./pages/requests/ITRequestForm";
import MaintenanceRequestForm from "./pages/requests/MaintenanceRequestForm";
import WarehouseSupplyRequestForm from "./pages/requests/WarehouseSupplyRequestForm";
import MaintenanceWarehouseSupplyRequestForm from "./pages/requests/MaintenanceWarehouseSupplyRequestForm";
import MedicationRequestForm from "./pages/requests/MedicationRequestForm";
import SupplyItemsPage from "./pages/requests/SupplyItemsPage";
import WarehouseSupplyRequestsPage from "./pages/WarehouseSupplyRequestsPage";
import CustodyIssueForm from "./pages/custody/CustodyIssueForm";
import CustodyApprovals from "./pages/custody/CustodyApprovals";
import CustodyIssuedList from "./pages/custody/CustodyIssuedList";
import ItemRecallsPage from "./pages/ItemRecallsPage";

import ApprovalsPanel from "./pages/ApprovalsPanel";
import OpenRequestsPage from "./pages/OpenRequestsPage";
import MyMaintenanceRequests from "./pages/MyMaintenanceRequests";
import ApprovalHistory from "./pages/ApprovalHistory";

import AllRequestsPage from "./pages/AllRequestsPage";
import AssignedRequestsPage from "./pages/AssignedRequestsPage";
import AdminTools from "./pages/AdminTools";
import Management from "./pages/Management";
import ChangePassword from "./pages/ChangePassword";
import IncompleteRequestsPage from "./pages/IncompleteRequestsPage";
import IncompleteMedicalRequestsPage from "./pages/IncompleteMedicalRequestsPage";
import IncompleteOperationalRequestsPage from "./pages/IncompleteOperationalRequestsPage";
import Dashboard from "./pages/Dashboard";
import CompletedAssignedRequestsPage from "./pages/CompletedAssignedRequestsPage";
import ClosedRequestsPage from "./pages/ClosedRequestsPage";
import MaintenanceStockPage from "./pages/MaintenanceStockPage";
import ProcurementPlansPage from "./pages/ProcurementPlansPage";
import RequestSubmittedPage from "./pages/requests/RequestSubmittedPage";
import WarehouseSupplyTemplatesPage from "./pages/WarehouseSupplyTemplatesPage";
import AuditRequestsPage from "./pages/AuditRequestsPage";
import LifecycleAnalytics from "./pages/LifecycleAnalytics";
import MonthlyDispensing from "./pages/MonthlyDispensing";
import ContractsPage from "./pages/ContractsPage";
import SupplierEvaluationsPage from "./pages/SupplierEvaluationsPage";
import MyEvaluationsPage from "./pages/MyEvaluationsPage";
import EvaluationDetailsPage from "./pages/EvaluationDetailsPage";
import StockItemApprovals from "./pages/StockItemApprovals";
import WarehouseInventoryPage from "./pages/WarehouseInventoryPage";
import TechnicalInspectionsPage from "./pages/TechnicalInspectionsPage";
import SuppliersPage from "./pages/SuppliersPage";
import SupplierSrmPage from "./pages/SupplierSrmPage";
import SupplierEvaluationDashboard from "./pages/SupplierEvaluationDashboard";
import PlanningWorkbench from "./pages/PlanningWorkbench";
import HistoricalRequestsImportPage from "./pages/HistoricalRequestsImportPage";
import RfxPortalPage from "./pages/RfxPortalPage";
import RiskManagementPage from "./pages/RiskManagementPage";

import { AuthProvider, useAuth } from "./hooks/useAuth";
import {
  AccessControlProvider,
  useAccessControl,
} from "./hooks/useAccessControl";
import { NotificationProvider } from "./components/ui/NotificationProvider";
import { hasAnyPermission, hasAllPermissions } from "./utils/permissions";

const ProtectedRoute = ({
  element,
  allowedRoles = [],
  requiredPermissions = [],
  requireAllPermissions = false,
  resourceKey,
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { resolvePermissions } = useAccessControl();
  const location = useLocation();

  if (isLoading) {
    return <div className="p-6 text-center text-gray-600">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const { permissions: effectivePermissions, requireAll } = resourceKey
    ? resolvePermissions(
        resourceKey,
        requiredPermissions,
        requireAllPermissions,
      )
    : {
        permissions: requiredPermissions,
        requireAll: requireAllPermissions,
      };

  let hasPermissionAccess = true;
  if (effectivePermissions && effectivePermissions.length > 0) {
    hasPermissionAccess = requireAll
      ? hasAllPermissions(user, effectivePermissions)
      : hasAnyPermission(user, effectivePermissions);
  }

  let hasRoleAccess = true;
  if (allowedRoles.length > 0) {
    const normalizedRole = user?.role?.toLowerCase?.() ?? "";
    hasRoleAccess = allowedRoles.some(
      (role) => String(role).toLowerCase() === normalizedRole,
    );
  }

  if (!hasPermissionAccess && !hasRoleAccess) {
    return <Navigate to="/" replace />;
  }

  return element;
};

const FallbackRedirect = () => {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? "/" : "/login"} replace />;
};

const AppRoutes = () => (
  <Routes>
    {/* ✅ Public Routes */}
    <Route path="/login" element={<Login />} />
    <Route path="/request-account" element={<RequestAccount />} />
    <Route path="/register" element={<Register />} />

    {/* ✅ General Protected Routes */}
    <Route
      path="/"
      element={<ProtectedRoute element={<RequestTypeSelector />} />}
    />
    <Route
      path="/requests/stock"
      element={<ProtectedRoute element={<StockRequestForm />} />}
    />
    <Route
      path="/requests/stock-item"
      element={
        <ProtectedRoute
          element={<StockItemRequestForm />}
          resourceKey="feature.stockItemRequests"
        />
      }
    />
    <Route
      path="/requests/warehouse-supply"
      element={<ProtectedRoute element={<WarehouseSupplyRequestForm />} />}
    />
    <Route
      path="/requests/historical"
      element={
        <ProtectedRoute
          element={<HistoricalRequestsImportPage />}
          resourceKey="feature.historicalRequests"
          requiredPermissions={["requests.manage"]}
          allowedRoles={["admin", "scm"]}
        />
      }
    />
    <Route
      path="/item-recalls"
      element={
        <ProtectedRoute
          element={<ItemRecallsPage />}
          resourceKey="feature.itemRecalls"
        />
      }
    />
    <Route
      path="/requests/maintenance-warehouse-supply"
      element={
        <ProtectedRoute
          element={<MaintenanceWarehouseSupplyRequestForm />}
          resourceKey="feature.maintenanceWarehouseSupply"
        />
      }
    />
    <Route
      path="/custody/issue"
      element={
        <ProtectedRoute
          element={<CustodyIssueForm />}
          resourceKey="feature.custody"
        />
      }
    />
    <Route
      path="/warehouse-inventory"
      element={
        <ProtectedRoute
          element={<WarehouseInventoryPage />}
          resourceKey="feature.warehouseInventory"
        />
      }
    />
    <Route
      path="/technical-inspections"
      element={
        <ProtectedRoute
          element={<TechnicalInspectionsPage />}
          resourceKey="feature.technicalInspections"
        />
      }
    />
    <Route
      path="/custody/issued"
      element={
        <ProtectedRoute
          element={<CustodyIssuedList />}
          resourceKey="feature.custody"
        />
      }
    />
    <Route
      path="/custody/approvals"
      element={<ProtectedRoute element={<CustodyApprovals />} />}
    />
    <Route
      path="/requests/non-stock"
      element={<ProtectedRoute element={<NonStockRequestForm />} />}
    />
    <Route
      path="/requests/it-items"
      element={<ProtectedRoute element={<ITRequestForm />} />}
    />
    <Route
      path="/requests/medical-device"
      element={<ProtectedRoute element={<MedicalDeviceRequestForm />} />}
    />
    <Route
      path="/requests/medication"
      element={
        <ProtectedRoute
          element={<MedicationRequestForm />}
          allowedRoles={["requester", "Requester", "HOD", "CMO", "SCM"]}
        />
      }
    />
    <Route
      path="/approvals"
      element={<ProtectedRoute element={<ApprovalsPanel />} />}
    />
    <Route
      path="/open-requests"
      element={<ProtectedRoute element={<OpenRequestsPage />} />}
    />
    <Route
      path="/request-submitted"
      element={<ProtectedRoute element={<RequestSubmittedPage />} />}
    />
    <Route
      path="/approval-history"
      element={<ProtectedRoute element={<ApprovalHistory />} />}
    />

    {/* ✅ Maintenance Routes */}
    <Route
      path="/requests/maintenance"
      element={
        <ProtectedRoute
          element={<MaintenanceRequestForm />}
          allowedRoles={["technician", "SCM", "admin"]}
        />
      }
    />
    <Route
      path="/my-maintenance-requests"
      element={
        <ProtectedRoute
          element={<MyMaintenanceRequests />}
          allowedRoles={["technician", "SCM", "admin"]}
        />
      }
    />
    <Route
      path="/approvals/maintenance"
      element={
        <ProtectedRoute element={<Navigate to="/approvals" replace />} />
      }
    />

    <Route
      path="/maintenance-stock"
      element={
        <ProtectedRoute
          element={<MaintenanceStockPage />}
          resourceKey="feature.maintenanceStock"
        />
      }
    />
    <Route
      path="/warehouse-supply-templates"
      element={
        <ProtectedRoute
          element={<WarehouseSupplyTemplatesPage />}
          resourceKey="feature.warehouseTemplates"
        />
      }
    />
    <Route
      path="/warehouse-supply-requests"
      element={
        <ProtectedRoute
          element={<WarehouseSupplyRequestsPage />}
          resourceKey="feature.warehouseRequests"
        />
      }
    />

    {/* ✅ Admin / SCM Routes */}
    <Route
      path="/admin-tools"
      element={
        <ProtectedRoute
          element={<AdminTools />}
          resourceKey="feature.adminTools"
        />
      }
    />
    <Route
      path="/management"
      element={
        <ProtectedRoute
          element={<Management />}
          resourceKey="feature.management"
        />
      }
    />
    <Route
      path="/all-requests"
      element={
        <ProtectedRoute
          element={<AllRequestsPage />}
          resourceKey="feature.allRequests"
        />
      }
    />
    <Route
      path="/incomplete"
      element={
        <ProtectedRoute
          element={<IncompleteRequestsPage />}
          resourceKey="feature.incompleteRequests"
        />
      }
    />
    <Route
      path="/procurement-plans"
      element={
        <ProtectedRoute
          element={<ProcurementPlansPage />}
          resourceKey="feature.procurementPlans"
        />
      }
    />
    <Route
      path="/stock-item-approvals"
      element={
        <ProtectedRoute
          element={<StockItemApprovals />}
          resourceKey="feature.stockItemApprovals"
        />
      }
    />
    <Route
      path="/contracts"
      element={
        <ProtectedRoute
          element={<ContractsPage />}
          resourceKey="feature.contracts"
        />
      }
    />
    <Route
      path="/suppliers"
      element={
        <ProtectedRoute
          element={<SuppliersPage />}
          resourceKey="feature.suppliers"
        />
      }
    />
    <Route
      path="/supplier-srm"
      element={
        <ProtectedRoute
          element={<SupplierSrmPage />}
          allowedRoles={[
            "SCM",
            "admin",
            "COO",
            "Medical Devices",
            "Contract_Manager",
            "ProcurementSpecialist",
            "ProcurementManager",
          ]}
          requiredPermissions={["contracts.manage"]}
          resourceKey="feature.suppliers"
        />
      }
    />
    <Route path="/rfx-portal" element={<RfxPortalPage />} />
    <Route
      path="/supplier-evaluations"
      element={
        <ProtectedRoute
          element={<SupplierEvaluationsPage />}
          allowedRoles={[
            "admin",
            "SCM",
            "Contract_Manager",
            "ProcurementSpecialist",
            "ProcurementManager",
          ]}
          requiredPermissions={["evaluations.manage"]}
          resourceKey="feature.supplierEvaluations"
        />
      }
    />
    <Route
      path="/supplier-dashboard"
      element={
        <ProtectedRoute
          element={<SupplierEvaluationDashboard />}
          allowedRoles={[
            "admin",
            "SCM",
            "Contract_Manager",
            "ProcurementSpecialist",
            "ProcurementManager",
          ]}
          requiredPermissions={["evaluations.manage"]}
          resourceKey="feature.supplierEvaluations"
        />
      }
    />
    <Route
      path="/risk-management"
      element={
        <ProtectedRoute
          element={<RiskManagementPage />}
          requiredPermissions={["risks.view", "risks.manage"]}
          resourceKey="feature.riskManagement"
        />
      }
    />

    {/* ✅ Procurement-Specific Routes */}
    <Route
      path="/assigned-requests"
      element={
        <ProtectedRoute
          element={<AssignedRequestsPage />}
          resourceKey="feature.procurementQueues"
        />
      }
    />

    {/* ✅ Approver Views */}
    <Route
      path="/incomplete/medical"
      element={
        <ProtectedRoute
          element={<IncompleteMedicalRequestsPage />}
          resourceKey="feature.incompleteMedical"
        />
      }
    />
    <Route
      path="/incomplete/operational"
      element={
        <ProtectedRoute
          element={<IncompleteOperationalRequestsPage />}
          resourceKey="feature.incompleteOperational"
        />
      }
    />

    <Route
      path="/completed-assigned"
      element={
        <ProtectedRoute
          element={<CompletedAssignedRequestsPage />}
          resourceKey="feature.procurementQueues"
        />
      }
    />
    <Route
      path="/closed-requests"
      element={<ProtectedRoute element={<ClosedRequestsPage />} />}
    />
    <Route
      path="/audit-requests"
      element={
        <ProtectedRoute
          element={<AuditRequestsPage />}
          resourceKey="feature.auditRequests"
        />
      }
    />
    <Route
      path="/warehouse-supply/:id"
      element={
        <ProtectedRoute
          element={<SupplyItemsPage />}
          resourceKey="feature.warehouseDetail"
        />
      }
    />
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute
          element={<Dashboard />}
          resourceKey="feature.dashboard"
        />
      }
    />
    <Route
      path="/analytics"
      element={
        <ProtectedRoute
          element={<LifecycleAnalytics />}
          resourceKey="feature.analytics"
        />
      }
    />
    <Route
      path="/dispensing"
      element={
        <ProtectedRoute
          element={<MonthlyDispensing />}
          resourceKey="feature.dispensing"
        />
      }
    />
    <Route
      path="/planning"
      element={
        <ProtectedRoute
          element={<PlanningWorkbench />}
          allowedRoles={["SCM", "admin"]}
          resourceKey="feature.demandPlanning"
        />
      }
    />
    <Route
      path="/change-password"
      element={<ProtectedRoute element={<ChangePassword />} />}
    />
    <Route
      path="/my-evaluations"
      element={<ProtectedRoute element={<MyEvaluationsPage />} />}
    />
    <Route
      path="/evaluations/:id"
      element={<ProtectedRoute element={<EvaluationDetailsPage />} />}
    />

    {/* 🚨 Catch-All Fallback */}
    <Route path="*" element={<FallbackRedirect />} />
  </Routes>
);

function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <AccessControlProvider>
            <AppRoutes />
          </AccessControlProvider>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
