import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settings from './MaintenanceApprovalReportingSettings';
import api from '../api/axios';
jest.mock('../api/axios', () => ({ get: jest.fn(), put: jest.fn() }));
jest.mock('react-i18next', () => {
  const i18n = require('i18next').createInstance();
  i18n.init({ lng: 'en', resources: { en: { translation: require('../locales/en.json') } }, initImmediate: false });
  const t = i18n.t.bind(i18n); return { useTranslation: () => ({ t }) };
});
beforeEach(() => { jest.clearAllMocks(); api.get.mockResolvedValue({ data: { configured: true, overdue_target_days: 3 } }); });
test('saves target and required reason, clears target explicitly, and displays server failures', async () => {
  api.put.mockResolvedValue({ data: { configured: true, overdue_target_days: 2 } });
  render(<Settings />);
  const input = await screen.findByLabelText('Organization overdue target (days)');
  expect(input).toHaveValue(3);
  expect(screen.getByRole('button', { name: 'Save reporting target' })).toBeDisabled();
  fireEvent.change(input, { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Reason for change'), { target: { value: 'Reviewed workload' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save reporting target' }));
  await screen.findByRole('status');
  expect(api.put).toHaveBeenCalledWith('/maintenance-approval-reporting-policy', { overdue_target_days: 2, reason: 'Reviewed workload' });
  api.put.mockRejectedValueOnce({ response: { data: { message: 'Permission denied' } } });
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Reason for change'), { target: { value: 'Disable reporting' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save reporting target' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Permission denied'));
  expect(api.put).toHaveBeenLastCalledWith('/maintenance-approval-reporting-policy', { overdue_target_days: null, reason: 'Disable reporting' });
});
test('missing migration disables writes', async () => {
  api.get.mockResolvedValue({ data: { configured: false, overdue_target_days: null } });
  render(<Settings />);
  await screen.findByText('Apply 046_maintenance_approval_reporting_policy.sql before saving.');
  expect(screen.getByRole('button', { name: 'Save reporting target' })).toBeDisabled();
  expect(api.put).not.toHaveBeenCalled();
});

test('invalid whole-day target disables save', async () => {
  render(<Settings />);
  const input = await screen.findByLabelText('Organization overdue target (days)');
  fireEvent.change(screen.getByLabelText('Reason for change'), { target: { value: 'Reviewed workload' } });
  for (const value of ['0', '366', '1.5']) {
    fireEvent.change(input, { target: { value } });
    expect(screen.getByRole('button', { name: 'Save reporting target' })).toBeDisabled();
  }
});
