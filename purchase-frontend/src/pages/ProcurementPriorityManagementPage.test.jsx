import React from 'react';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import Page from './ProcurementPriorityManagementPage';
import { getPriorityManagementQueue,reorderInstitutionalPriorities } from '../api/procurementPriority';
jest.mock('../api/procurementPriority', () => ({ getPriorityManagementQueue:jest.fn(),reorderInstitutionalPriorities:jest.fn() }));
jest.mock('../hooks/useAuth', () => ({ useAuth:() => ({ user:{ permissions:['procurement-priority.override'] } }) }));
const rows = [
  { procurement_case_id:11,request_id:208,public_title:'Hook',institutional_rank:1,system_suggested_rank:1,row_version:3 },
  { procurement_case_id:12,request_id:209,public_title:'Chair',institutional_rank:2,system_suggested_rank:2,row_version:8 },
];
beforeEach(() => { jest.clearAllMocks(); getPriorityManagementQueue.mockResolvedValue({ data:rows }); });
test('SCM saves the displayed organizational order with reason and each original version', async () => {
  reorderInstitutionalPriorities.mockResolvedValue({});
  render(<Page />);
  fireEvent.click(await screen.findByRole('button',{ name:'Move Chair up' }));
  expect(screen.getByRole('button',{ name:'Save institutional order' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Institutional order override reason'),{ target:{ value:'Service continuity' } });
  fireEvent.click(screen.getByRole('button',{ name:'Save institutional order' }));
  await waitFor(() => expect(reorderInstitutionalPriorities).toHaveBeenCalledWith([
    { procurement_case_id:12,institutional_rank:1,row_version:8 },
    { procurement_case_id:11,institutional_rank:2,row_version:3 },
  ],'Service continuity'));
  expect(await screen.findByText('Organizational priority order saved.')).toBeInTheDocument();
});
test('stale organizational order displays a recoverable conflict', async () => {
  reorderInstitutionalPriorities.mockRejectedValue({ response:{ status:409 } });
  render(<Page />);
  fireEvent.click(await screen.findByRole('button',{ name:'Move Chair up' }));
  fireEvent.change(screen.getByLabelText('Institutional order override reason'),{ target:{ value:'Service continuity' } });
  fireEvent.click(screen.getByRole('button',{ name:'Save institutional order' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Reload the latest queue');
  expect(screen.getByRole('button',{ name:'Reload latest queue' })).toBeEnabled();
});
