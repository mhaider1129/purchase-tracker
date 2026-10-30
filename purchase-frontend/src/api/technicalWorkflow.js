import api from './axios';
const base='/technical-inspections/workflow';
const data=p=>p.then(r=>r.data);
export const technicalProfiles=()=>data(api.get(`${base}/profiles`));
export const saveTechnicalProfile=input=>data(api.put(`${base}/profiles`,input));
export const receiptInspectionOptions=()=>data(api.get(`${base}/receipt-options`));
export const generateRequiredReview=request_id=>data(api.post(`${base}/generate`,{request_id}));
export const deliveryTask=id=>data(api.get(`${base}/delivery/${id}`));
export const deliveryAction=(id,action,input)=>data(api.post(`${base}/delivery/${id}/${action}`,input));
