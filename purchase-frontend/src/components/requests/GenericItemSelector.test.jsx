import { render,screen,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GenericItemSelector from './GenericItemSelector';
import { getItemMasterReferences, searchGenericItems } from '../../api/itemMaster';
jest.mock('../../api/itemMaster');

beforeEach(()=>{
  getItemMasterReferences.mockResolvedValue({categories:[{id:2,name:'Medical Supplies'}]});
});

test('selects only searched active Generic Item identity',async()=>{
  searchGenericItems.mockResolvedValue({data:[{id:7,item_code:'GEN-7',generic_name:'Sterile Gauze',canonical_description:'Gauze swab 10 x 10 cm',inventory_uom:'EA',category:'Supplies',interchangeability_policy:'fully_interchangeable'}]});
  const onChange=jest.fn();render(<GenericItemSelector value={{request_mode:'generic_item'}} onChange={onChange}/>);
  expect(await screen.findByText('Sterile Gauze')).toBeInTheDocument();
  await userEvent.click(screen.getByText('Sterile Gauze'));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({generic_item_id:7,item_name:'Sterile Gauze'}));
  await waitFor(()=>expect(searchGenericItems).toHaveBeenCalledWith(expect.objectContaining({status:'active'})));
});

test('cannot-find action creates structured pending mode without master data',async()=>{
  searchGenericItems.mockResolvedValue({data:[]});const onChange=jest.fn();render(<GenericItemSelector value={{request_mode:'generic_item'}} onChange={onChange}/>);
  await userEvent.click(screen.getByRole('button',{name:'Cannot find the item'}));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({request_mode:'pending_item_creation',generic_item_id:null}));
});

test('uses controlled item type and category lists for a pending item',async()=>{
  searchGenericItems.mockResolvedValue({data:[]});
  const onChange=jest.fn();
  const {rerender}=render(<GenericItemSelector value={{request_mode:'generic_item'}} onChange={onChange}/>);
  await userEvent.click(screen.getByRole('button',{name:'Cannot find the item'}));
  rerender(<GenericItemSelector value={{request_mode:'pending_item_creation',pending_item:{}}} onChange={onChange}/>);
  expect(await screen.findByRole('option',{name:'Medical supply'})).toBeInTheDocument();
  expect(await screen.findByRole('option',{name:'Medical Supplies'})).toBeInTheDocument();
  expect(screen.getByLabelText('Pending item type').tagName).toBe('SELECT');
  expect(screen.getByLabelText('Pending category').tagName).toBe('SELECT');
});