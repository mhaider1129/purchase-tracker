import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import RfxPortalPage from './RfxPortalPage';
import {listRfxEvents,listRfxResponses} from '../api/rfxPortal';
let mockUser;
jest.mock('../hooks/useAuth',()=>({useAuth:()=>({user:mockUser,isAuthenticated:!!mockUser})}));
jest.mock('react-i18next',()=>({useTranslation:()=>({t:key=>key})}));
jest.mock('../api/rfxPortal',()=>({listRfxEvents:jest.fn(),listRfxResponses:jest.fn(),createRfxEvent:jest.fn(),analyzeRfxQuotations:jest.fn(),submitRfxResponse:jest.fn(),updateRfxStatus:jest.fn(),awardRfxResponse:jest.fn(),listValidRfxOfferings:jest.fn()}));
beforeEach(()=>{jest.clearAllMocks();mockUser=null;listRfxEvents.mockResolvedValue([{id:1,title:'Owned RFx',request_id:9,rfx_type:'RFQ',status:'open',details:{items:[]}}]);listRfxResponses.mockResolvedValue([]);});
const show=()=>render(<MemoryRouter><RfxPortalPage/></MemoryRouter>);
test.each([null,{id:3,role:'Supplier',permissions:['rfx.respond']},{id:4,role:'SCM',permissions:[]}])('anonymous or role/respond-only accounts have no quotation entry or competitor response controls: %s',async user=>{
  mockUser=user;show();fireEvent.click(await screen.findByText('Owned RFx'));
  expect(screen.queryByLabelText('rfxPortal.fields.supplierName')).not.toBeInTheDocument();expect(listRfxResponses).not.toHaveBeenCalled();
});
test('explicit sourcing manager retains supplier quotation entry and must link a request',async()=>{
  mockUser={id:1,permissions:['rfx.manage']};show();fireEvent.click(await screen.findByText('Owned RFx'));
  await waitFor(()=>expect(listRfxResponses).toHaveBeenCalledWith(1));
  expect(screen.getByLabelText('rfxPortal.fields.supplierName',{selector:'input[name="supplier_name"]'})).toBeInTheDocument();expect(screen.getByLabelText('rfxPortal.fields.requestIdOptional')).toBeRequired();
});
