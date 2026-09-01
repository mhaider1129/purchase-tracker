import api from './axios';
export const listApprovalPolicies=()=>api.get('/approval-policies').then(r=>r.data);
export const createApprovalPolicy=body=>api.post('/approval-policies',body).then(r=>r.data);
export const getApprovalPolicy=id=>api.get(`/approval-policies/${id}`).then(r=>r.data);
export const getApprovalPolicyVersion=id=>api.get(`/approval-policy-versions/${id}`).then(r=>r.data);
export const saveApprovalPolicyVersion=(id,body)=>api.patch(`/approval-policy-versions/${id}`,body).then(r=>r.data);
export const validateApprovalPolicyVersion=id=>api.post(`/approval-policy-versions/${id}/validate`).then(r=>r.data);
export const enterApprovalPolicyShadow=id=>api.post(`/approval-policy-versions/${id}/enter-shadow`).then(r=>r.data);
export const getShadowRun=id=>api.get(`/approval-policy-shadow-runs/${id}`).then(r=>r.data);