import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import MyMaintenanceRequests from './MyMaintenanceRequests';
import axios from '../api/axios';
import { saveAs } from 'file-saver';
import { buildExcelWorkbookBlob } from '../utils/excelWorkbookExport';

jest.mock('../api/axios', () => ({ get: jest.fn() }));
jest.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { permissions: ['maintenance-requests.view-all'] } }) }));
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('../utils/excelWorkbookExport', () => ({ buildExcelWorkbookBlob: jest.fn() }));
jest.mock('react-i18next', () => {
  const i18n = require('i18next').createInstance();
  i18n.init({ lng: 'en', resources: { en: { translation: require('../locales/en.json') } }, initImmediate: false });
  const t = i18n.t.bind(i18n);
  return { useTranslation: () => ({ t }) };
});

const requests = [
  { id: 1, status: 'Approved', created_at: '2026-09-30T12:00:00', justification: 'Older' },
  { id: 2, status: 'Submitted', created_at: '2026-10-01T00:00:00', justification: 'Start boundary' },
  { id: 3, status: 'Received', created_at: '2026-10-07T23:59:59', justification: 'End boundary' },
  { id: 4, status: 'Rejected', created_at: '2026-10-08T00:00:00', justification: 'Later' },
];

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockImplementation((url) => Promise.resolve({ data: url === '/requests/my-maintenance' ? requests : [] }));
  buildExcelWorkbookBlob.mockResolvedValue(new Blob(['workbook']));
});

test('saved target loads, approver and band filters count and export only matching approvals, reset restores queue', async () => {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-09T12:00:00Z'));
  axios.get.mockImplementation((url) => Promise.resolve({ data: url === '/maintenance-approval-reporting-policy' ? { configured: true, overdue_target_days: 3 } : url === '/requests/my-maintenance' ? [
    { ...requests[0], status: 'Submitted', current_pending_approvals: [{ approver_id: 1, approver_name: 'Clinical owner', approver_role: 'CMO', approval_level: 5, activated_at: '2026-10-01T12:00:00Z' }, { approver_id: 2, approver_name: 'Operations owner', approver_role: 'COO', approval_level: 8, activated_at: '2026-10-09T11:00:00Z' }] },
    { ...requests[1], current_pending_approvals: [{ approver_id: 1, approver_name: 'Clinical owner', approver_role: 'CMO', approval_level: 5, activated_at: null }] },
    { ...requests[2], current_pending_approvals: [] },
  ] : [] }));
  try {
    render(<MyMaintenanceRequests />); await screen.findByText('Start boundary');
    expect(screen.getByLabelText('Overdue target (days)')).toHaveValue(3);
    fireEvent.change(screen.getByLabelText('Pending with'), { target: { value: 'user:2' } });
    fireEvent.change(screen.getByLabelText('Waiting-time band'), { target: { value: 'under2' } });
    expect(screen.getByRole('button', { name: 'Total 1' })).toBeInTheDocument();
    expect(screen.queryByText('Start boundary')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));
    await waitFor(() => expect(saveAs).toHaveBeenCalled());
    expect(buildExcelWorkbookBlob.mock.calls[0][0][1].slice(-4)).toEqual(['Operations owner · COO', 'Approval required', '1 hours', '']);
    fireEvent.change(screen.getByLabelText('Waiting time filter'), { target: { value: 'overdue' } });
    expect(screen.getByRole('button', { name: 'Total 0' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Reset filters' })[0]);
    expect(screen.getByRole('button', { name: 'Total 3' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
    const table = screen.getAllByRole('table')[0];
    expect(within(table).queryByRole('link', { name: /#1/ })).not.toBeInTheDocument();
  } finally { clock.mockRestore(); }
});

test('a late saved target response does not overwrite a temporary target already entered', async () => {
  let finishPolicy;
  axios.get.mockImplementation((url) => url === '/maintenance-approval-reporting-policy' ? new Promise((resolve) => { finishPolicy = resolve; }) : Promise.resolve({ data: url === '/requests/my-maintenance' ? requests : [] }));
  render(<MyMaintenanceRequests />); await screen.findByText('Start boundary');
  fireEvent.change(screen.getByLabelText('Overdue target (days)'), { target: { value: '2' } });
  finishPolicy({ data: { configured: true, overdue_target_days: 7 } });
  await screen.findByText(/Saved organization target \(days\): 7/);
  expect(screen.getByLabelText('Overdue target (days)')).toHaveValue(2);
});

test('waiting-time controls filter unknown/overdue requests and export current owners with matching headers', async () => {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-08T12:00:00Z'));
  axios.get.mockImplementation((url) => Promise.resolve({ data: url === '/requests/my-maintenance' ? [
    { ...requests[0], current_pending_approvals: [{ approval_level: 5, approver_role: 'CMO', approver_name: 'Doctor', activated_at: '2026-10-01T12:00:00Z' }] },
    { ...requests[1], current_pending_approvals: [{ approval_level: 8, approver_role: 'COO', activated_at: null }] },
    { ...requests[2], current_pending_approvals: [{ approval_level: 6, approver_role: 'SCM', activated_at: '2026-10-08T11:00:00Z' }] },
  ] : [] }));
  try {
    render(<MyMaintenanceRequests />);
    await screen.findByText('Start boundary');
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'approval-oldest' } });
    const queueRows = within(screen.getAllByRole('table').at(-1)).getAllByRole('row').slice(1);
    expect(queueRows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Older'), expect.stringContaining('End boundary'), expect.stringContaining('Start boundary'),
    ]);
    fireEvent.change(screen.getByLabelText('Overdue target (days)'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Waiting time filter'), { target: { value: 'overdue' } });
    expect(screen.getByRole('button', { name: 'Total 1' })).toBeInTheDocument();
    expect(within(screen.getAllByRole('table').at(-1)).getByText('Doctor · CMO')).toBeInTheDocument();
    expect(screen.queryByText('Start boundary')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));
    await waitFor(() => expect(saveAs).toHaveBeenCalled());
    const exported = buildExcelWorkbookBlob.mock.calls[0][0];
    expect(exported[1]).toHaveLength(exported[0].length);
    expect(exported[1].slice(-4)).toEqual(['Doctor · CMO', 'Approval required', '168 hours', 'Overdue']);
    fireEvent.change(screen.getByLabelText('Waiting time filter'), { target: { value: 'unknown' } });
    expect(screen.getByText('Start boundary')).toBeInTheDocument();
    expect(screen.queryByText('Older')).not.toBeInTheDocument();
  } finally { clock.mockRestore(); }
});

test('date filters update scorecards, include both boundaries, retain facets and reset counts', async () => {
  render(<MyMaintenanceRequests />);
  await screen.findByText('Start boundary');
  expect(screen.getByRole('button', { name: 'Total 4' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-07' } });
  expect(screen.getByRole('button', { name: 'Total 2' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Completed 1' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Approved 0' })).toBeInTheDocument();
  expect(screen.getByText('End boundary')).toBeInTheDocument();
  expect(screen.queryByText('Older')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Completed 1' }));
  expect(screen.queryByText('Start boundary')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Total 2' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(screen.getByRole('button', { name: 'Total 4' })).toBeInTheDocument();
});

test('exports filtered requests as XLSX rather than HTML with an XLS extension', async () => {
  render(<MyMaintenanceRequests />);
  await screen.findByText('Start boundary');
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-07' } });
  fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));
  await waitFor(() => expect(saveAs).toHaveBeenCalled());
  expect(buildExcelWorkbookBlob.mock.calls[0][0].slice(1).map((row) => row[0])).toEqual([3, 2]);
  expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/\.xlsx$/));
});

test('an empty date range clears cards and export failures allow retry', async () => {
  const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  buildExcelWorkbookBlob.mockRejectedValueOnce(new Error('Write failed'));
  render(<MyMaintenanceRequests />);
  await screen.findByText('Start boundary');
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2027-01-01' } });
  expect(screen.getByRole('button', { name: 'Total 0' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Completed 0' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));
  await waitFor(() => expect(alert).toHaveBeenCalledWith('Unable to export. Please try again.'));
  expect(saveAs).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Export Excel' })).toBeEnabled();
  alert.mockRestore();
  log.mockRestore();
});

test('pending step cards follow dates, filter queue/export, retain zero counts and reset', async () => {
  axios.get.mockImplementation((url) => Promise.resolve({ data: url === '/requests/my-maintenance' ? [
    { ...requests[0], status: 'Submitted', current_pending_approvals: [{ approval_level: 1, approver_role: 'HOD' }] },
    { ...requests[1], current_pending_approvals: [{ approval_level: 5, approver_role: 'CMO' }, { approval_level: 5, approver_role: 'CMO' }, { approval_level: 8, approver_role: 'COO' }] },
    { ...requests[2], status: 'Submitted', current_pending_approvals: [{ approval_level: 6, approver_role: 'SCM' }] },
    { ...requests[3], current_pending_approvals: [] },
  ] : [] }));
  render(<MyMaintenanceRequests />);
  await screen.findByText('Start boundary');
  expect(screen.getByRole('button', { name: 'All pending approvals: 3' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-07' } });
  expect(screen.getByRole('button', { name: 'All pending approvals: 2' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Level 1 · HOD: 0' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Level 5 · CMO: 1' }));
  expect(screen.getByRole('button', { name: 'Total 1' })).toBeInTheDocument();
  expect(screen.queryByText('End boundary')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));
  await waitFor(() => expect(saveAs).toHaveBeenCalled());
  expect(buildExcelWorkbookBlob.mock.calls[0][0].slice(1).map((row) => row[0])).toEqual([2]);
  fireEvent.click(screen.getByRole('button', { name: 'Clear approval filter' }));
  expect(screen.getByText('End boundary')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'All pending approvals: 2' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(screen.getByRole('button', { name: 'Total 4' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'rejected' } });
  expect(screen.getByRole('button', { name: 'All pending approvals: 0' })).toBeInTheDocument();
});
