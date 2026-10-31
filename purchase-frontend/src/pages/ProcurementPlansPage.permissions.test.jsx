import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ProcurementPlansPage from './ProcurementPlansPage';
import useCurrentUser from '../hooks/useCurrentUser';
import api from '../api/axios';
jest.mock('../hooks/useCurrentUser');
jest.mock('../api/axios',()=>({get:jest.fn(),post:jest.fn()}));
jest.mock('../api/attachments',()=>({openProtectedFile:jest.fn()}));
beforeEach(()=>{
 jest.clearAllMocks();
 api.get.mockImplementation(async path=>({data:path.endsWith('integration-insights')?{items:[],data_limitations:['Unscoped dispensing excluded.']}:path==='/procurement-plans'?[{id:5,plan_year:2026,file_name:'Own plan'}]:[]}));
});
test('viewer can inspect scoped plans and data limitations but cannot prepare or upload',async()=>{
 useCurrentUser.mockReturnValue({user:{id:1,department_id:2,permissions:['planning.view']}});render(<ProcurementPlansPage/>);
 await waitFor(()=>expect(api.get).toHaveBeenCalledWith('/procurement-plans',expect.anything()));
 expect(screen.getByRole('group',{name:'Upload plan'})).toBeDisabled();
 expect(screen.getByRole('group',{name:'Prepare plan items'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Select plan'),{target:{value:'5'}});
 await screen.findByText('Unscoped dispensing excluded.');
 expect(api.post).not.toHaveBeenCalled();
});
test('authorized manager retains plan preparation controls',async()=>{
 useCurrentUser.mockReturnValue({user:{id:1,department_id:2,permissions:['planning.manage']}});render(<ProcurementPlansPage/>);
 await waitFor(()=>expect(api.get).toHaveBeenCalled());
 expect(screen.getByRole('group',{name:'Upload plan'})).not.toBeDisabled();
 expect(screen.getByRole('group',{name:'Prepare plan items'})).not.toBeDisabled();
});
