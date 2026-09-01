import React from 'react';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import SparePartsRegisterPage from './SparePartsRegisterPage';
import * as spareApi from '../api/spareParts';
import {useAuth} from '../hooks/useAuth';

jest.mock('../api/spareParts');
jest.mock('../hooks/useAuth',()=>({useAuth:jest.fn()}));
jest.mock('react-i18next',()=>({useTranslation:()=>({t:key=>key})}));
const part={id:1,spare_part_code:'SP-001',name:'Pump seal',manufacturer_name:'Acme',oem_part_number:'OEM-7',criticality:'CRITICAL',technical_approval_status:'APPROVED',recommended_stocking_policy:'SAFETY_STOCK',compatible_equipment_count:2,lifecycle_status:'ACTIVE',updated_at:'2026-01-01T00:00:00Z'};
const response=(data=[part],total=data.length)=>({data,pagination:{page:1,limit:25,total}});
const renderPage=()=>render(<MemoryRouter><SparePartsRegisterPage/></MemoryRouter>);

beforeEach(()=>{jest.clearAllMocks();useAuth.mockReturnValue({user:{permissions:[]}});spareApi.listEquipment.mockResolvedValue({data:[{id:9,equipment_code:'EQ-9',name:'Pump'}]});spareApi.listSpareParts.mockResolvedValue(response());});

test('renders loading, successful register data, and permission-controlled create action',async()=>{
 let resolve;spareApi.listSpareParts.mockReturnValue(new Promise(r=>{resolve=r}));useAuth.mockReturnValue({user:{permissions:['spare-parts.create']}});renderPage();expect(screen.getByText('common.loading')).toBeInTheDocument();await act(async()=>resolve(response()));expect(await screen.findByText('SP-001')).toBeInTheDocument();expect(screen.getByText('Pump seal')).toBeInTheDocument();expect(screen.getByRole('link',{name:'spareParts.create'})).toHaveAttribute('href','/spare-parts/new');
});

test('renders empty and API failure states without source inspection',async()=>{
 spareApi.listSpareParts.mockResolvedValueOnce(response([]));const view=renderPage();expect(await screen.findByText('spareParts.empty')).toBeInTheDocument();view.unmount();spareApi.listSpareParts.mockRejectedValueOnce(new Error('offline'));renderPage();expect(await screen.findByRole('alert')).toHaveTextContent('spareParts.error');expect(screen.queryByRole('link',{name:'spareParts.create'})).not.toBeInTheDocument();
});

test('search and every implemented filter call the API with controlled values',async()=>{
 renderPage();await screen.findByText('SP-001');
 const cases=[['spareParts.search','search','seal'],['spareParts.manufacturer','manufacturer','Acme'],['spareParts.equipmentFilter','equipment_id','9'],['spareParts.criticality','criticality','HIGH'],['spareParts.technical_approval_status','technical_approval_status','UNDER_REVIEW'],['spareParts.lifecycle_status','lifecycle_status','INACTIVE'],['spareParts.stocking_policy','stocking_policy','NORMAL_STOCK']];
 for(const[label,key,value]of cases){fireEvent.change(screen.getByLabelText(label),{target:{value}});await waitFor(()=>expect(spareApi.listSpareParts).toHaveBeenLastCalledWith(expect.objectContaining({[key]:value,page:1})));}
});

test('pagination next and previous preserve behavioral query state',async()=>{
 spareApi.listSpareParts.mockResolvedValue(response([part],60));renderPage();await screen.findByText('SP-001');fireEvent.click(screen.getByRole('button',{name:'common.next'}));await waitFor(()=>expect(spareApi.listSpareParts).toHaveBeenLastCalledWith(expect.objectContaining({page:2})));expect(screen.getByText('2 / 3')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'common.previous'}));await waitFor(()=>expect(spareApi.listSpareParts).toHaveBeenLastCalledWith(expect.objectContaining({page:1})));
});