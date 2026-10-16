import React from 'react';
import { render,screen,fireEvent,waitFor,act } from '@testing-library/react';
import Page from './DepartmentPrioritiesPage';
import { getDepartmentPriorityQueue,reorderDepartmentPriority } from '../api/procurementPriority';
jest.mock('../api/procurementPriority', () => ({ getDepartmentPriorityQueue:jest.fn(),reorderDepartmentPriority:jest.fn() }));
const rows = [
  { procurement_case_id:11,request_id:208,request_reference:'R208',public_title:'Hook',snapshot:{rank_version:'0',cases:{11:'3',13:'4'}},item_count:2,department_rank:1 },
  { procurement_case_id:12,request_id:209,request_reference:'R209',public_title:'Chair',snapshot:{rank_version:'0',cases:{12:'8'}},item_count:1,department_rank:2 },
];
beforeEach(() => { jest.clearAllMocks(); getDepartmentPriorityQueue.mockResolvedValue({ data:rows }); });
test('moves one whole request and saves its complete member snapshot', async () => {
  reorderDepartmentPriority.mockResolvedValue({ data:[{ ...rows[1],department_rank:1,row_version:9 },{ ...rows[0],department_rank:2,row_version:4 }] });
  render(<Page />);
  fireEvent.click(await screen.findByRole('button',{ name:'Move Chair up' }));
  fireEvent.click(screen.getByRole('button',{ name:'Save Changes' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Department priority order saved');
  expect(reorderDepartmentPriority).toHaveBeenCalledWith([209,208],{208:rows[0].snapshot,209:rows[1].snapshot});
  expect(screen.getByRole('link',{ name:'R208' })).toHaveAttribute('href','/requests/208');
});
test('a single unranked requirement can be saved without a pointless move', async () => {
  getDepartmentPriorityQueue.mockResolvedValue({ data:[{ ...rows[0],department_rank:null }] });
  reorderDepartmentPriority.mockResolvedValue({ data:[rows[0]] });
  render(<Page />);
  await screen.findByText('Hook');
  expect(screen.getByRole('button',{ name:'Save Changes' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{ name:'Save Changes' }));
  await screen.findByRole('status');
  expect(reorderDepartmentPriority).toHaveBeenCalledWith([208],{208:rows[0].snapshot});
});
test('a stale queue shows reload guidance and keeps unsaved order', async () => {
  reorderDepartmentPriority.mockRejectedValue({ response:{ status:409 } });
  render(<Page />);
  fireEvent.click(await screen.findByRole('button',{ name:'Move Chair up' }));
  fireEvent.click(screen.getByRole('button',{ name:'Save Changes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Reload the latest queue');
  await waitFor(() => expect(screen.getByRole('button',{ name:'Save Changes' })).toBeEnabled());
  expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
});
test('a background response cannot discard an order edited while it was loading', async () => {
  let finishRefresh;
  getDepartmentPriorityQueue.mockResolvedValueOnce({ data:rows }).mockImplementationOnce(() => new Promise(resolve => { finishRefresh=resolve; }));
  render(<Page />);
  await screen.findByText('Hook');
  fireEvent(window,new Event('focus'));
  fireEvent.click(screen.getByRole('button',{ name:'Move Chair up' }));
  await act(async () => finishRefresh({ data:[{ ...rows[0],row_version:99 },rows[1]] }));
  expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  reorderDepartmentPriority.mockResolvedValue({ data:rows });
  fireEvent.click(screen.getByRole('button',{ name:'Save Changes' }));
  await screen.findByRole('status');
  expect(reorderDepartmentPriority).toHaveBeenCalledWith([209,208],{208:rows[0].snapshot,209:rows[1].snapshot});
});
