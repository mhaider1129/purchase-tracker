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