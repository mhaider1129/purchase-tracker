import React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import BudgetControlPage from './BudgetControlPage';
import {fetchBudgetControlData} from '../api/budgetControl';
jest.mock('../api/budgetControl',()=>({fetchBudgetControlData:jest.fn(),saveDepartmentBudget:jest.fn()}));
beforeEach(()=>{jest.clearAllMocks();fetchBudgetControlData.mockResolvedValue({data:[],departments:[{id:10,name:'Own institute ward'}],can_manage_budget:false});});
test('a financial viewer can read budgets but cannot open configuration',async()=>{
  render(<BudgetControlPage/>);await waitFor(()=>expect(fetchBudgetControlData).toHaveBeenCalled());
  expect(screen.getByRole('button',{name:'Set Budget'})).toBeDisabled();
  expect(screen.queryByLabelText('Department')).not.toBeInTheDocument();
});
test('only server-authorized budget manager receives configuration controls and scoped departments',async()=>{
  fetchBudgetControlData.mockResolvedValue({data:[],departments:[{id:10,name:'Own institute ward'}],can_manage_budget:true});
  render(<BudgetControlPage/>);const button=screen.getByRole('button',{name:'Set Budget'});
  await waitFor(()=>expect(button).toBeEnabled());fireEvent.click(button);
  expect(screen.getByRole('option',{name:'Own institute ward'})).toBeInTheDocument();
  expect(screen.queryByRole('option',{name:'Foreign ward'})).not.toBeInTheDocument();
});
test('permission reload failure removes previously available management controls',async()=>{
  fetchBudgetControlData.mockResolvedValueOnce({data:[],departments:[],can_manage_budget:true}).mockRejectedValue({response:{data:{message:'Permission revoked'}}});
  render(<BudgetControlPage/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Set Budget'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'Refresh data'}));
  await screen.findByText('Permission revoked');expect(screen.getByRole('button',{name:'Set Budget'})).toBeDisabled();
});
