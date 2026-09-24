import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProcureToPayDashboardPage from './ProcureToPayDashboardPage';
import { getProcureToPayDashboard } from '../api/procureToPay';

jest.mock('../api/procureToPay');

const dashboard = {
  approved_requests_awaiting_po: 12,
  pos_awaiting_receipt: 8,
  invoices_pending_match: 5,
  invoices_in_exception: 2,
  open_payables_due_today: 4,
  overdue_payables: 3,
  payments_posted_this_week: 12500,
};

const renderPage = () => render(<MemoryRouter><ProcureToPayDashboardPage /></MemoryRouter>);

test('presents workflow, attention, and payment metrics with links', async () => {
  getProcureToPayDashboard.mockResolvedValue({ data: dashboard });
  renderPage();

  expect(screen.getByRole('heading', { name: 'Procure-to-Pay' })).toBeInTheDocument();
  await screen.findByText('12,500');
  expect(screen.getByText('5 open')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /open document flow/i })).toHaveAttribute('href', '/procure-to-pay/document-flow');
  expect(screen.getByRole('link', { name: /source to order/i })).toHaveAttribute('href', '/procure-to-pay/purchase-orders');
});

test('shows a recoverable error and retries the dashboard request', async () => {
  getProcureToPayDashboard.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: dashboard });
  renderPage();

  expect(await screen.findByRole('alert')).toHaveTextContent('could not load');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(getProcureToPayDashboard).toHaveBeenCalledTimes(2));
  expect(await screen.findByText('12,500')).toBeInTheDocument();
});