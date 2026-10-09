import i18n from '../i18n';
import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import RequestDetailWorkspace from './RequestDetailWorkspace';
import api from '../api/axios';
import {getItemMasterReferences,searchGenericItems} from '../api/itemMaster';
jest.mock('../api/axios',()=>({get:jest.fn(),post:jest.fn()}));
jest.mock('../api/itemMaster',()=>({getItemMasterReferences:jest.fn(),searchGenericItems:jest.fn()}));
jest.mock('../components/ai/AiAssistantDrawer',()=>()=>null);
jest.mock('../components/ai/RequestAiButton',()=>()=>null);
test('approved request exposes the missing resolution workflow from its workspace',async()=>{
  const workspace={request:{id:78,status:'Approved',request_type:'Non-Stock'},items:[{id:12,item_id:12,item_name:'Original wording',requested_quantity:1,purchased_quantity:0,remaining_quantity:1,unit_of_measure:'Piece',request_mode:'free_text',catalog_status:'pending_mapping'}],available_actions:['resolve_item_identity']};
  api.get.mockImplementation(async url=>({data:url.includes('full-details')?workspace:[]}));
  api.post.mockResolvedValue({data:{}});
  getItemMasterReferences.mockResolvedValue({categories:[]});
  searchGenericItems.mockResolvedValue({data:[{id:5,item_code:'GEN-5',generic_name:'Infusion stand',inventory_uom:'EA'}]});
  render(<MemoryRouter initialEntries={['/requests/78']}><Routes><Route path="/requests/:requestId" element={<RequestDetailWorkspace />} /></Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button',{name:'Review item identities'}));
  fireEvent.click(screen.getByRole('button',{name:'Resolve identity'}));
  const dialog=screen.getByRole('dialog',{name:'Resolve requested item identity'});
  expect(within(dialog).getByText('Original wording')).toBeInTheDocument();
  fireEvent.click(await within(dialog).findByRole('button',{name:/GEN-5 Infusion stand/}));
  fireEvent.change(within(dialog).getByLabelText('Resolution / referral reason'),{target:{value:'Steward confirmed'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'Save identity resolution'}));
  await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/requests/78/items/12/resolve-identity',{generic_item_id:5,reason:'Steward confirmed'}));
});

test('server-provided request action context remains visible when switching detail tabs', async () => {
  api.post.mockClear();
  const workspace = {
    request: { request_id: 79, request_status: 'Approved', next_required_action: 'Review quote', assigned_to_name: 'Ahmed', current_bottleneck: 'Supplier response' },
    items: [], available_actions: [],
  };
  api.get.mockImplementation(async () => ({ data: workspace }));
  render(<MemoryRouter initialEntries={['/requests/79']}><Routes><Route path="/requests/:requestId" element={<RequestDetailWorkspace />} /></Routes></MemoryRouter>);
  const context = within(await screen.findByRole('region', { name: /Current request context|operationalWorkspace.actionContext/ }));
  expect(context.getByText('Review quote')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: /^Timeline/ }));
  expect(context.getByText('Review quote')).toBeInTheDocument();
  expect(context.getByText('Ahmed')).toBeInTheDocument();
  expect(context.getByText('Supplier response')).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test('overview shortcuts switch tabs without requiring mutation permissions', async () => {
 await i18n.changeLanguage('en');
 api.post.mockClear();
 api.get.mockImplementation(async () => ({data:{request:{request_id:80,request_status:'Pending'},items:[],approvals:[],attachments:[],available_actions:[]}}));
 render(<MemoryRouter initialEntries={['/requests/80']}><Routes><Route path="/requests/:requestId" element={<RequestDetailWorkspace />} /></Routes></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:/Review approvals/}));
 expect(screen.getByRole('tab',{name:/^Approvals/})).toHaveAttribute('aria-selected','true');
 expect(screen.queryByRole('button',{name:'Mark Request as Completed'})).not.toBeInTheDocument();
 expect(api.post).not.toHaveBeenCalled();
});

test('item focus and clear filters work without enabling procurement mutations', async () => {
 await i18n.changeLanguage('en');
 api.post.mockClear();
 const items=[{item_id:1,item_name:'Pump',requested_quantity:3,purchased_quantity:1,remaining_quantity:2,generic_item_id:11,procurement_status:'pending'}, {item_id:2,item_name:'Rejected stand',requested_quantity:2,purchased_quantity:0,remaining_quantity:2,approval_status:'Rejected'}];
 api.get.mockImplementation(async () => ({data:{request:{request_id:81,request_status:'Pending'},items,available_actions:[]}}));
 render(<MemoryRouter initialEntries={['/requests/81']}><Routes><Route path="/requests/:requestId" element={<RequestDetailWorkspace />} /></Routes></MemoryRouter>);
 fireEvent.click(await screen.findByRole('tab',{name:/^Items/}));
 fireEvent.click(screen.getByRole('button',{name:'Remaining quantity 1'}));
 expect(screen.getByText('Pump')).toBeInTheDocument();
 expect(screen.queryByText('Rejected stand')).not.toBeInTheDocument();
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'missing'}});
 expect(screen.getByText('No items match the current filters.')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Clear item filters'}));
 expect(screen.getByText('Rejected stand')).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Register'})).not.toBeInTheDocument();
 expect(api.post).not.toHaveBeenCalled();
});
