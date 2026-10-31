import React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import SupplyItemsPage from './SupplyItemsPage';
import api from '../../api/axios';
import useWarehouseStockItems from '../../hooks/useWarehouseStockItems';
jest.mock('../../api/axios',()=>({get:jest.fn(),post:jest.fn()}));
jest.mock('../../hooks/useWarehouses',()=>()=>({warehouses:[{id:3,name:'Central'}],loading:false}));
jest.mock('../../hooks/useWarehouseStockItems',()=>jest.fn());
const refresh=jest.fn();
let supplied;
const stock=[
  {warehouse_stock_level_id:80,stock_item_id:11,item_name:'Gauze',batch_id:500,batch_number:'BATCH-A',lot_number:'LOT-A',stock_status:'AVAILABLE',quantity:10,available_quantity:5},
  {warehouse_stock_level_id:81,stock_item_id:11,item_name:'Gauze',batch_id:501,batch_number:'BATCH-B',lot_number:'LOT-B',stock_status:'AVAILABLE',quantity:7,available_quantity:7},
  {warehouse_stock_level_id:82,stock_item_id:11,item_name:'Gauze',batch_id:502,lot_number:'QUARANTINE',stock_status:'QUARANTINE',quantity:99,available_quantity:99},
];
function mount(){return render(<MemoryRouter initialEntries={['/warehouse-supply/1343']}><Routes><Route path="/warehouse-supply/:id" element={<SupplyItemsPage/>}/></Routes></MemoryRouter>);}
beforeEach(()=>{
  jest.clearAllMocks();supplied=0;
  jest.spyOn(window,'confirm').mockReturnValue(true);jest.spyOn(window,'alert').mockImplementation(()=>{});jest.spyOn(console,'error').mockImplementation(()=>{});
  useWarehouseStockItems.mockReturnValue({items:stock,loading:false,refresh});
  api.get.mockImplementation(async()=>({data:[{id:1343,status:'Approved',supply_warehouse_id:3,items:[{id:44,item_name:'Gauze',quantity:8,supplied_quantity:supplied}]}]}));
  api.post.mockResolvedValue({data:{status:'Approved'}});
});
afterEach(()=>jest.restoreAllMocks());
test('sends the exact selected balance and supplied-total snapshot',async()=>{
  mount();await screen.findByLabelText('Supply now');
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'1'}});
  fireEvent.change(screen.getByLabelText('Supply now'),{target:{value:'3'}});
  fireEvent.click(screen.getByRole('button',{name:'Save supplied quantities'}));
  await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/warehouse-supply/1343/items',{items:[{
    item_id:44,supplied_quantity:3,expected_supplied_quantity:0,warehouse_stock_level_id:81,stock_item_id:11,batch_id:501,lot_number:'LOT-B',expiry_date:null,
  }]}));
});
test('displays total unreserved available stock across lots and excludes quarantine',async()=>{
  mount();expect(await screen.findByText('Available in warehouse: 12')).toBeInTheDocument();
  expect(screen.queryByRole('option',{name:/QUARANTINE/})).not.toBeInTheDocument();
  expect(screen.getAllByRole('option')).toHaveLength(3);
});
test('successful save refreshes supplied totals, outstanding quantity and stock before another save',async()=>{
  api.post.mockImplementation(async()=>{supplied+=3;return {data:{}};});
  mount();const input=await screen.findByLabelText('Supply now');fireEvent.change(input,{target:{value:'3'}});
  fireEvent.click(screen.getByRole('button',{name:'Save supplied quantities'}));
  await screen.findByText('Supplied so far: 3');expect(screen.getByLabelText('Supply now')).toHaveValue(5);expect(refresh).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Supply now'),{target:{value:'3'}});fireEvent.click(screen.getByRole('button',{name:'Save supplied quantities'}));
  await waitFor(()=>expect(api.post).toHaveBeenLastCalledWith('/warehouse-supply/1343/items',{items:[{item_id:44,supplied_quantity:3,expected_supplied_quantity:3}]}));
});
test('shows actual inventory conflict inline and allows explicit refresh without retrying issuance',async()=>{
  api.post.mockRejectedValue({response:{status:409,data:{code:'INSUFFICIENT_STOCK',message:'Available stock 0 is less than requested quantity 3'}}});
  mount();await screen.findByLabelText('Supply now');fireEvent.click(screen.getByRole('button',{name:'Save supplied quantities'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Available stock 0 is less than requested quantity 3');
  expect(screen.getByLabelText('Supply now')).toBeInTheDocument();supplied=3;
  fireEvent.click(screen.getByRole('button',{name:'Reload quantities and stock'}));await screen.findByText('Supplied so far: 3');expect(api.post).toHaveBeenCalledTimes(1);
});
