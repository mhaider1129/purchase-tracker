import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Panel from './ApprovalReminderPanel';
import api from '../api/axios';
jest.mock('../api/axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('react-i18next', () => {
  const i18n = require('i18next').createInstance();
  i18n.init({ lng: 'en', resources: { en: { translation: require('../locales/en.json') } }, initImmediate: false });
  const t = i18n.t.bind(i18n); return { useTranslation: () => ({ t }) };
});
const approvals = [{ approval_id: 5, approver_name: 'Clinical owner', approver_role: 'CMO', approval_level: 5 }, { approval_id: 6, approver_name: 'Operations owner', approver_role: 'COO', approval_level: 8 }];
beforeEach(() => { jest.clearAllMocks(); jest.spyOn(window, 'confirm').mockReturnValue(true); });
afterEach(() => jest.restoreAllMocks());
test('permission controls visibility; current parallel approval can be selected and sent', async () => {
  const { rerender } = render(<Panel requestId={1} approvals={approvals} allowed={false} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  rerender(<Panel requestId={1} approvals={approvals} allowed />);
  api.post.mockResolvedValue({ data: {} });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '6' } });
  fireEvent.click(screen.getByRole('button', { name: 'Remind approver' }));
  await screen.findByRole('status');
  expect(api.post).toHaveBeenCalledWith('/approvals/request/1/remind-current', { approval_id: 6 });
});
test('cancel confirmation prevents send; cooldown and history outcomes are visible', async () => {
  render(<Panel requestId={1} approvals={approvals} allowed />);
  window.confirm.mockReturnValueOnce(false);
  fireEvent.click(screen.getByRole('button', { name: 'Remind approver' }));
  expect(api.post).not.toHaveBeenCalled();
  api.post.mockRejectedValue({ response: { data: { message: 'Cooldown active' } } });
  fireEvent.click(screen.getByRole('button', { name: 'Remind approver' }));
  await screen.findByText('Cooldown active');
  api.get.mockResolvedValue({ data: [{ id: 7, recipient_name: 'Clinical owner', actor_name: 'SCM User', attempted_at: '2026-10-11T08:00:00Z', status: 'unknown' }] });
  fireEvent.click(screen.getByRole('button', { name: 'Reminder history' }));
  expect(await screen.findByText(/SCM User.*Delivery uncertain/)).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/approvals/request/1/reminder-history');
});
test('no active approvals disables send while keeping history available', () => {
  render(<Panel requestId={1} approvals={[]} allowed pending={false} />);
  expect(screen.getByRole('button', { name: 'Remind approver' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Reminder history' })).toBeEnabled();
});
test('changing the filtered active approvals clears a stale recipient selection', async () => {
  const { rerender } = render(<Panel requestId={1} approvals={approvals} allowed />);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '6' } });
  rerender(<Panel requestId={1} approvals={[approvals[0]]} allowed />);
  api.post.mockResolvedValue({ data: {} });
  fireEvent.click(screen.getByRole('button', { name: 'Remind approver' }));
  await screen.findByRole('status');
  expect(api.post).toHaveBeenCalledWith('/approvals/request/1/remind-current', { approval_id: 5 });
});
