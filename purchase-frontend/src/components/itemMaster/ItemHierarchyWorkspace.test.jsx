import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ItemHierarchyWorkspace from './ItemHierarchyWorkspace';
import * as api from '../../api/itemMaster';

jest.mock('../../api/itemMaster');

test('moves between real pages and resets reference pagination when the reference type changes', async () => {
  // Exercise the real 350ms debounce deterministically; CPU load must not race
  // Testing Library's default wait against a pagination request.
  jest.useFakeTimers();
  const user=userEvent.setup({advanceTimers:jest.advanceTimersByTime});
  const search=async()=>act(async()=>{jest.advanceTimersByTime(350);});
  let view;
  try {
    api.searchGenericItems.mockImplementation(async ({ page }) => ({ total: 26, data: [{ id: page, generic_name: `Item page ${page}` }] }));
    api.searchItemMasterReferences.mockImplementation(async (_type, { page }) => ({ total: 26, data: [{ id: page, uom_name: `Unit page ${page}`, is_active: true }] }));
    view=render(<ItemHierarchyWorkspace />);
    await search();expect(screen.getByText('Item page 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next' }));await search();
    expect(screen.getByText('Item page 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Previous' }));await search();
    expect(screen.getByText('Item page 1')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Reference data/ }));await search();
    expect(screen.getByText('Unit page 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));await search();
    expect(screen.getByText('Unit page 2')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Reference type'), 'categories');await search();
    expect(api.searchItemMasterReferences).toHaveBeenLastCalledWith('categories', { q: '', page: 1, page_size: 25 });
  } finally {view?.unmount();jest.useRealTimers();}
});

test('explains disabled pagination for an empty list', async () => {
  api.searchGenericItems.mockResolvedValue({ total: 0, data: [] });
  render(<ItemHierarchyWorkspace />);
  await screen.findByText(/No records to page through/);
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
});

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
