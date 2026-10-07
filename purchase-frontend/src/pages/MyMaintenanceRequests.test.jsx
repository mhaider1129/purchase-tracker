import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
