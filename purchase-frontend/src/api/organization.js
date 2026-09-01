import api from './axios';
export const getOrganizationTree=()=>api.get('/organization/tree').then(r=>r.data);
export const getOrganizationUnits=params=>api.get('/organization/units',{params}).then(r=>r.data);
export const createOrganizationUnit=data=>api.post('/organization/units',data).then(r=>r.data);
export const updateOrganizationUnit=(id,data)=>api.patch(`/organization/units/${id}`,data).then(r=>r.data);
export const moveOrganizationUnit=(id,parentUnitId)=>api.post(`/organization/units/${id}/move`,{parentUnitId}).then(r=>r.data);