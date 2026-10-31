import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PlanningWorkbench from './PlanningWorkbench';
import useCurrentUser from '../hooks/useCurrentUser';
import { savePlanningDefaults, runReplenishmentPlanner } from '../api/planning';
jest.mock('../hooks/useCurrentUser');
jest.mock('../api/planning');
jest.mock('../components/planning/ForecastingDemandModuleCard',()=>()=>null);
beforeEach(()=>jest.clearAllMocks());
function mount(permissions){useCurrentUser.mockReturnValue({user:{id:1,permissions}});render(<PlanningWorkbench/>);}
test('viewer can calculate but cannot save configuration or generate demand',()=>{
 mount(['planning.view']);
 expect(screen.getByRole('button',{name:'Save policy'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Run replenishment'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Save current as defaults'})).toBeDisabled();
 expect(savePlanningDefaults).not.toHaveBeenCalled();expect(runReplenishmentPlanner).not.toHaveBeenCalled();
});
test('scoped manager must select a warehouse before saving defaults',()=>{
 mount(['planning.manage']);const button=screen.getByRole('button',{name:'Save current as defaults'});
 expect(button).toBeDisabled();fireEvent.change(screen.getByLabelText('Warehouse override (optional)'),{target:{value:'10'}});
 expect(button).toBeEnabled();expect(screen.getByRole('button',{name:'Save policy'})).toBeDisabled();
});
test('SCM with explicit capabilities retains institute-default and replenishment controls',()=>{
 mount(['planning.view','planning.manage','replenishment.manage','planning.cross-department','planning.cross-warehouse']);
 expect(screen.getByRole('button',{name:'Save current as defaults'})).toBeEnabled();
 expect(screen.getByRole('button',{name:'Save policy'})).toBeEnabled();
 fireEvent.change(screen.getByLabelText('Warehouse ID'),{target:{value:'10'}});
 expect(screen.getByRole('button',{name:'Run replenishment'})).toBeEnabled();
});
