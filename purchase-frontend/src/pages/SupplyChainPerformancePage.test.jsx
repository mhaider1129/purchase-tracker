import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SupplyChainPerformancePage from './SupplyChainPerformancePage';
import { getPerformanceDashboard } from '../api/procurementPerformance';
jest.mock('../api/procurementPerformance');

test('renders analytical sections, values, missing coverage and sends filters',async()=>{
 getPerformanceDashboard.mockResolvedValue({data:{metrics:{demand:{requested_items:{value:null,coverage:'LEGACY_INCOMPLETE',status:'not_available',reason:'Legacy evidence incomplete'}},complexity:{class_mix:[{class:'D',count:2}]}},buyers:[{buyer_id:1,buyer_name:'Buyer A',workload_units:7}],pending:[{root_cause:'CUSTOMS_REGULATORY',count:1}],highlights:[{case_id:4,summary:'OEM sourced'}]}});
 render(<SupplyChainPerformancePage/>);
 expect(screen.getByRole('heading',{name:'Supply Chain Performance & Workload'})).toBeInTheDocument();
 await screen.findByText('OEM sourced'); expect(screen.getByText('Not available')).toBeInTheDocument(); expect(screen.getByText(/Class D: 2/)).toBeInTheDocument(); expect(screen.getByText(/Buyer A: 7 PWU/)).toBeInTheDocument(); expect(screen.getByText(/CUSTOMS_REGULATORY: 1/)).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Date from'),{target:{value:'2026-08-01'}}); await waitFor(()=>expect(getPerformanceDashboard).toHaveBeenLastCalledWith({date_from:'2026-08-01'}));
});