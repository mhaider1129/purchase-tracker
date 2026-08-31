import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StockItemMappingWorkspace, { isBulkApprovalSafe } from './StockItemMappingWorkspace';
import { searchGenericItems } from '../api/itemMaster';
import { listMappings, mappingCoverage, proposeMapping } from '../api/stockItemMappings';

jest.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { permissions: ['item-master.stock-map'] } }) }));
jest.mock('../api/itemMaster', () => ({ searchGenericItems: jest.fn() }));
jest.mock('../api/stockItemMappings', () => ({
  listMappings: jest.fn(),
  mappingCoverage: jest.fn(),
  mappingAction: jest.fn(),
  proposeMapping: jest.fn(),
}));

const row = {
  stock_item_id: 7,
  stock_item_name: 'Atorvastatin 20 mg Tab',
  mapping_status: 'unmapped',
  source_attributes: { category: 'Medication', uom: 'Tab' },
};

describe('StockItemMappingWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listMappings.mockResolvedValue({ data: [row] });
    mappingCoverage.mockResolvedValue({ total: 1, mapped: 0, unmapped: 1 });
    searchGenericItems.mockResolvedValue({ data: [{ id: 42, item_code: 'GEN-42', generic_name: 'Atorvastatin tablet', canonical_description: 'Atorvastatin oral tablet', category: 'Medication', inventory_uom: 'Tab' }] });
    proposeMapping.mockResolvedValue({ id: 99 });
  });

  it('lets a steward select a Generic Item and create a mapping proposal', async () => {
    render(<StockItemMappingWorkspace />);

    fireEvent.click(await screen.findByRole('button', { name: 'Map item' }));
    expect(screen.getByRole('dialog', { name: 'Map stock item' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /GEN-42 Atorvastatin tablet/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create mapping proposal' }));

    await waitFor(() => expect(proposeMapping).toHaveBeenCalledWith({
      stock_item_id: 7,
      generic_item_id: 42,
      reason: 'Manual mapping by steward',
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

test('bulk approval requires homogeneous conflict-free fresh targets and permission', () => {
  const user = { permissions: ['item-master.stock-map.bulk'] };
  const safe = id => ({ id, generic_item_id: 1, approved_product_id: 2, parser_version: 'v1', hard_exclusions: [], stale: false });
  expect(isBulkApprovalSafe([safe(1), safe(2)], user)).toBe(true);
  expect(isBulkApprovalSafe([safe(1), { ...safe(2), generic_item_id: 9 }], user)).toBe(false);
  expect(isBulkApprovalSafe([{ ...safe(1), hard_exclusions: ['route_conflict'] }], user)).toBe(false);
  expect(isBulkApprovalSafe([safe(1)], { permissions: [] })).toBe(false);
});