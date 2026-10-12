import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import InstitutionalPrioritiesPage from './InstitutionalPrioritiesPage';
import { getPublicPriorityQueue } from '../api/procurementPriority';
jest.mock('../api/procurementPriority', () => ({ getPublicPriorityQueue: jest.fn() }));

test('returning to the priority view removes a completed requirement returned by the refreshed API', async () => {
  getPublicPriorityQueue.mockResolvedValueOnce({ data: [{ public_title: 'Hook', institutional_rank: 1, tier: 'P3', case_status: 'READY_FOR_SOURCING' }] });
  render(<InstitutionalPrioritiesPage />);
  expect(await screen.findByText('Hook')).toBeInTheDocument();
  getPublicPriorityQueue.mockResolvedValue({ data: [] });
  fireEvent(window, new Event('focus'));
  expect(await screen.findByText('No active procurement priorities.')).toBeInTheDocument();
  expect(screen.queryByText('Hook')).not.toBeInTheDocument();
});
