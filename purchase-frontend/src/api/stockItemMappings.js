import api from './axios';
export const listMappings=(params)=>api.get('/stock-items/mappings',{params}).then(r=>r.data);
export const mappingCoverage=()=>api.get('/stock-items/mapping-coverage').then(r=>r.data);
export const mappingHistory=(stockItemId)=>api.get(`/stock-items/${stockItemId}/mappings`).then(r=>r.data);
export const mappingAction=(mappingId,action,payload)=>api.post(`/stock-items/mappings/${mappingId}/${action}`,payload).then(r=>r.data);
export const proposeMapping=(payload)=>api.post('/stock-items/mappings/propose',payload).then(r=>r.data);
export const supersedeMapping=(stockItemId,mappingId,payload)=>api.post(`/stock-items/${stockItemId}/mappings/${mappingId}/supersede`,payload).then(r=>r.data);
export const rollbackMapping=(stockItemId,mappingId,payload)=>api.post(`/stock-items/${stockItemId}/mappings/${mappingId}/rollback`,payload).then(r=>r.data);