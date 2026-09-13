import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EquipmentManagementPage from './EquipmentManagementPage';
import { createEquipment, listAvailableAssets, listEquipment } from '../api/equipment';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: key => ({
  'spareParts.equipment.asset': 'Asset Register record',
  'spareParts.equipment.equipment_code': 'Equipment code',
  'common.add': 'Add',
}[key] || key) }) }));

jest.mock('../api/equipment', () => ({
  createEquipment: jest.fn(),
  listAvailableAssets: jest.fn(),
  listEquipment: jest.fn(),
  updateEquipment: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  listEquipment.mockResolvedValue({ data: [] });
  listAvailableAssets.mockResolvedValue([{ id: 8, asset_number: 'WICI-A-000008', description: 'TrueBeam LINAC' }]);
  createEquipment.mockResolvedValue({ id: 2 });
});

test('new equipment must be created from an available Asset Register record', async () => {
  render(<EquipmentManagementPage />);
  const asset = await screen.findByRole('option', { name: /WICI-A-000008.*TrueBeam LINAC/ });
  await userEvent.selectOptions(screen.getByRole('combobox', { name: /Asset Register record/ }), asset);
  await userEvent.type(screen.getByLabelText('Equipment code'), 'EQ-RT-001');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(createEquipment).toHaveBeenCalledWith(expect.objectContaining({ asset_id: '8', equipment_code: 'EQ-RT-001' })));
});

test('register shows Asset number and current canonical identity', async () => {
  listEquipment.mockResolvedValue({ data: [{ id: 2, equipment_code: 'EQ-RT-001', asset_id: 8, asset_number: 'WICI-A-000008', name: 'TrueBeam LINAC', manufacturer: 'Varian', model: 'TrueBeam', active_contract_count: 2, lifecycle_status: 'ACTIVE' }] });
  render(<EquipmentManagementPage />);
  expect(await screen.findByText('WICI-A-000008')).toBeInTheDocument();
  expect(screen.getByText('TrueBeam LINAC')).toBeInTheDocument();
  expect(screen.getByText('Varian')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
});