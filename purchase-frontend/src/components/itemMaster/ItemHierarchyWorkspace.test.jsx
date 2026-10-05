import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ItemHierarchyWorkspace from './ItemHierarchyWorkspace';
import * as api from '../../api/itemMaster';

jest.mock('../../api/itemMaster');

test('searches each hierarchy independently and displays distinguishing data', async () => {
  api.searchGenericItems.mockResolvedValue({ total: 1, data: [{ id: 1, item_code: 'MED-1', generic_name: 'Sodium Chloride', canonical_description: 'IV solution 0.9%, 500 mL', category: 'Medication', item_type: 'medication', inventory_uom: 'BAG', lifecycle_status: 'active', interchangeability_policy: 'fully_interchangeable' }] });
  api.searchApprovedProducts.mockResolvedValue({ total: 0, data: [] });
  api.searchSupplierCatalog.mockResolvedValue({ total: 0, data: [] });
  render(<ItemHierarchyWorkspace />);
  expect(await screen.findByText('Sodium Chloride')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: /Approved Products/ }));
  await waitFor(() => expect(api.searchApprovedProducts).toHaveBeenCalled());
  expect(screen.getByPlaceholderText(/Product, manufacturer/)).toBeInTheDocument();
});
test('shows only authorized lifecycle actions and follows each governed activation step',async()=>{
  const row={id:9,item_code:'GEN-9',generic_name:'Infusion stand',lifecycle_status:'draft'};
  api.searchGenericItems.mockImplementation(async()=>({total:1,data:[{...row}]}));
  api.transitionGenericItem.mockImplementation(async(_id,status)=>{row.lifecycle_status=status;return {...row};});
  render(<ItemHierarchyWorkspace user={{permissions:['item-master.create','item-master.edit','item-master.validate','item-master.approve']}} />);
  expect(screen.getByRole('button',{name:'Create Generic Item'})).toBeInTheDocument();
  for(const status of ['review','validation','approval','active']) {
    await userEvent.click(await screen.findByRole('button',{name:`Move to ${status}`}));
    await waitFor(()=>expect(api.transitionGenericItem).toHaveBeenCalledWith(9,status));
  }
  expect(await screen.findByText('active')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Move to retired'})).not.toBeInTheDocument();
});
