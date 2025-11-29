import api from "./axios";

export const getSupplierSrmStatus = async (supplierId, options = {}) => {
  const response = await api.get(`/api/supplier-srm/${supplierId}/status`, options);
  return response.data;
};

export const listSupplierScorecards = async (supplierId, options = {}) => {
  const response = await api.get(`/api/supplier-srm/${supplierId}/scorecards`, options);
  return Array.isArray(response.data) ? response.data : [];
};

export const createSupplierScorecard = async (supplierId, payload, options = {}) => {
  const response = await api.post(
    `/api/supplier-srm/${supplierId}/scorecards`,
    payload,
    options,
  );
  return response.data;
};

export const listSupplierIssues = async (supplierId, options = {}) => {
  const response = await api.get(`/api/supplier-srm/${supplierId}/issues`, options);
  return Array.isArray(response.data) ? response.data : [];
};

export const createSupplierIssue = async (supplierId, payload, options = {}) => {
  const response = await api.post(
    `/api/supplier-srm/${supplierId}/issues`,
    payload,
    options,
  );
  return response.data;
};

export const updateSupplierIssue = async (issueId, payload, options = {}) => {
  const response = await api.patch(`/api/supplier-srm/issues/${issueId}`, payload, options);
  return response.data;
};

export const listComplianceArtifacts = async (supplierId, options = {}) => {
  const response = await api.get(`/api/supplier-srm/${supplierId}/compliance`, options);
  return Array.isArray(response.data) ? response.data : [];
};

export const createComplianceArtifact = async (supplierId, payload, options = {}) => {
  const response = await api.post(
    `/api/supplier-srm/${supplierId}/compliance`,
    payload,
    options,
  );
  return response.data;
};

export default {
  getSupplierSrmStatus,
  listSupplierScorecards,
  createSupplierScorecard,
  listSupplierIssues,
  createSupplierIssue,
  updateSupplierIssue,
  listComplianceArtifacts,
  createComplianceArtifact,
};