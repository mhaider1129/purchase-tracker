import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProcureToPayLifecyclePage from './ProcureToPayLifecyclePage';
import { getLifecycleDetail } from '../api/procureToPay';

jest.mock('../api/procureToPay');
jest.mock('../api/axios', () => ({ get: jest.fn().mockResolvedValue({ data: [] }) }));
jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { permissions: ['procure-to-pay.lifecycle.view'] } }),
}));
jest.mock('../hooks/useSuppliers', () => ({
  useSuppliers: () => ({ suppliers: [], suppliersError: '' }),
}));

const lifecycle = {
  request: { created_at: '2026-09-20T08:00:00Z', supply_warehouse_name: 'Central Warehouse' },
  lifecycle: { procurement_state: 'GOODS_RECEIVED', finance_state: 'INVOICE_PENDING' },
  request_items: [],
  purchase_orders: [{ id: 10 }],
  receipts: [{ id: 20, receipt_number: 'GRPO-20', received_at: '2026-09-21T09:00:00Z' }],
  invoices: [{ id: 30, invoice_number: 'INV-30', total_amount: 1250 }],
  match_results: [],
  payments: [],
};

const renderPage = () => render(
  <MemoryRouter initialEntries={['/requests/42/procure-to-pay']}>
    <Routes>
      <Route path="/requests/:requestId/procure-to-pay" element={<ProcureToPayLifecyclePage />} />
    </Routes>
  </MemoryRouter>,
);

test('summarizes lifecycle progress and highlights the next stage', async () => {
  getLifecycleDetail.mockResolvedValue(lifecycle);
  renderPage();

  expect(await screen.findByRole('heading', { name: 'Procurement lifecycle' })).toBeInTheDocument();
  expect(screen.getByText('67%')).toBeInTheDocument();
  expect(screen.getByText('4 of 6 stages')).toBeInTheDocument();
  expect(screen.getByText('Central Warehouse')).toBeInTheDocument();
  expect(screen.getByText('3-way match')).toBeInTheDocument();
  expect(screen.getByText('Current stage')).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Lifecycle workspaces' })).toBeInTheDocument();
  await waitFor(() => expect(getLifecycleDetail).toHaveBeenCalledWith('42'));
});