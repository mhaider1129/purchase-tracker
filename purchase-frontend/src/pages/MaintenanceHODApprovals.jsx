// src/pages/MaintenanceHODApprovals.jsx
import React from 'react';
import ApprovalsWorkspace from '../components/approvals/ApprovalsWorkspace';

const MaintenanceApprovalsPage = () => {
  return <ApprovalsWorkspace requestType="maintenance" />;
};

export default MaintenanceApprovalsPage;