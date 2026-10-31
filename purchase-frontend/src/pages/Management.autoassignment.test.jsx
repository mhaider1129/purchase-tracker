import React from 'react';
import { render,screen } from '@testing-library/react';
import i18n from '../i18n';
import Management from './Management';
import api from '../api/axios';
let mockUser;
jest.mock('../hooks/useAuth',()=>({useAuth:()=>({user:mockUser})}));
jest.mock('../hooks/useAccessControl',()=>({useAccessControl:()=>({resources:[],loading:false,refresh:jest.fn()})}));
jest.mock('../hooks/useWarehouses',()=>()=>({warehouses:[{id:9,name:'Foreign warehouse'}],warehouseMap:{9:{name:'Foreign warehouse'}},loading:false,refresh:jest.fn()}));
jest.mock('../api/axios',()=>({get:jest.fn(),post:jest.fn(),put:jest.fn(),delete:jest.fn()}));
beforeEach(async()=>{
 await i18n.changeLanguage('en');jest.clearAllMocks();
 api.get.mockImplementation(async path=>({data:path==='/request-auto-assignment-rules'?{request_types:['Non-stock','Stock'],rules:[],assignees:[{id:10,name:'Own buyer',role:'ProcurementSpecialist'}],warehouses:[{id:8,name:'Own warehouse'}]}:path==='/users'?[{id:12,name:'Foreign buyer',role:'ProcurementSpecialist',is_active:true}]:[]}));
});
test('a role name and user-management grant do not expose autoassignment controls',async()=>{
 mockUser={id:7,role:'SCM',permissions:['users.manage']};render(<Management/>);
 await screen.findByRole('heading',{name:'Users'});
 expect(screen.queryByRole('button',{name:'Auto assignments'})).not.toBeInTheDocument();
 expect(api.get.mock.calls.some(([path])=>path==='/request-auto-assignment-rules')).toBe(false);
});
test('assignment managers receive only server-scoped assignee and warehouse choices',async()=>{
 mockUser={id:7,role:'Assignment manager',permissions:['requests.manage']};render(<Management/>);
 await screen.findByRole('option',{name:'Own buyer (ProcurementSpecialist)'});
 expect(screen.getByRole('option',{name:'Own warehouse'})).toBeInTheDocument();
 expect(screen.queryByRole('option',{name:/Foreign buyer|Foreign warehouse/})).not.toBeInTheDocument();
});
