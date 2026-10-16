import React from 'react';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import Page from './ProcurementPriorityManagementPage';
import { getPriorityManagementQueue,reorderInstitutionalPriorities,getPriorityProfile,getPriorityHistory } from '../api/procurementPriority';
jest.mock('../api/procurementPriority', () => ({ getPriorityManagementQueue:jest.fn(),reorderInstitutionalPriorities:jest.fn(),getPriorityProfile:jest.fn(),getPriorityHistory:jest.fn() }));
jest.mock('../hooks/useAuth', () => ({ useAuth:() => ({ user:{ permissions:['procurement-priority.override'] } }) }));
const rows = [
  { procurement_case_id:11,request_id:208,public_title:'Hook',institutional_rank:1,system_suggested_rank:1,snapshot:{rank_version:'1',cases:{11:'3',13:'4'}},item_count:2,members:[{procurement_case_id:11,public_title:'Hook'},{procurement_case_id:13,public_title:'Cable'}] },
  { procurement_case_id:12,request_id:209,public_title:'Chair',institutional_rank:2,system_suggested_rank:2,snapshot:{rank_version:'1',cases:{12:'8'}},item_count:1,members:[{procurement_case_id:12,public_title:'Chair'}] },
];
beforeEach(() => { jest.clearAllMocks(); getPriorityManagementQueue.mockResolvedValue({ data:rows }); });
test('SCM saves the displayed organizational order with reason and each original version', async () => {
  reorderInstitutionalPriorities.mockResolvedValue({});
  render(<Page />);
  fireEvent.click(await screen.findByRole('button',{ name:'Move Chair up' }));
  expect(screen.getByRole('button',{ name:'Save institutional order' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Institutional order override reason'),{ target:{ value:'Service continuity' } });
  fireEvent.click(screen.getByRole('button',{ name:'Save institutional order' }));
  await waitFor(() => expect(reorderInstitutionalPriorities).toHaveBeenCalledWith([209,208],{208:rows[0].snapshot,209:rows[1].snapshot},'Service continuity'));
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

test('a request has one position while its item assessments remain individually accessible', async () => {
  getPriorityProfile.mockImplementation(id => Promise.resolve({data:{procurement_case_id:id,public_title:id===11?'Hook':'Cable'}}));
  getPriorityHistory.mockResolvedValue({data:[]});
  render(<Page />);
  fireEvent.click(await screen.findByRole('row',{name:/2 active items · Hook/}));
  const select=await screen.findByLabelText('Item assessment');
  expect(select.options).toHaveLength(2);
  fireEvent.change(select,{target:{value:'13'}});
  await waitFor(()=>expect(getPriorityProfile).toHaveBeenCalledWith(13));
  expect(screen.getAllByRole('button',{name:'Move Hook down'})).toHaveLength(1);
});
