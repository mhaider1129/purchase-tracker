const { createOrganizationAuthorityService, isCurrentPosition } = require('../services/organizationAuthorityService');

beforeAll(() => jest.useFakeTimers().setSystemTime(new Date('2026-10-03T12:00:00Z')));
afterAll(() => jest.useRealTimers());

const units = [
  { id: 1, name: 'Institute', unit_type: 'INSTITUTE', parent_unit_id: null, institute_id: 7 },
  { id: 92, name: 'COO', unit_type: 'EXECUTIVE_OFFICE', parent_unit_id: 1, institute_id: 7 },
  { id: 93, name: 'CMO', unit_type: 'EXECUTIVE_OFFICE', parent_unit_id: 1, institute_id: 7 },
  { id: 96, name: 'CFO', unit_type: 'EXECUTIVE_OFFICE', parent_unit_id: 1, institute_id: 7 },
  { id: 21, name: 'Supply Chain', unit_type: 'DEPARTMENT', parent_unit_id: 92, institute_id: 7 },
  { id: 41, name: 'General Warehouse', code: 'GENERAL_WAREHOUSE', unit_type: 'UNIT', parent_unit_id: 21, institute_id: 7 },
  { id: 42, name: 'Medical Supplies Warehouse', code: 'MEDICAL_SUPPLIES_WAREHOUSE', unit_type: 'UNIT', parent_unit_id: 21, institute_id: 7 },
  { id: 43, name: 'Medication Warehouse', code: 'MEDICATION_WAREHOUSE', unit_type: 'UNIT', parent_unit_id: 21, institute_id: 7 },
  { id: 44, name: 'Laboratory Warehouse', code: 'LABORATORY_WAREHOUSE', unit_type: 'UNIT', parent_unit_id: 21, institute_id: 7 },
  { id: 30, name: 'Pharmacy', unit_type: 'DEPARTMENT', parent_unit_id: 93, institute_id: 7, classification: 'Operational' },
  { id: 31, name: 'Nursing', unit_type: 'DEPARTMENT', parent_unit_id: 92, institute_id: 7, classification: 'Medical' }
];
const basePositions = [
  { id: 192, organization_unit_id: 92, position_type: 'EXECUTIVE_HEAD', position_name: 'COO', user_id: 2, user_name: 'Omar Zeyad', user_is_active: true, is_unit_head: true, is_active: true, effective_from: '2026-04-28', effective_to: null },
  { id: 193, organization_unit_id: 93, position_type: 'EXECUTIVE_HEAD', position_name: 'CMO', user_id: 3, user_name: 'Hassanin Muiz Mohammed', user_is_active: true, is_unit_head: true, is_active: true, effective_from: '2026-04-28', effective_to: null },
  { id: 196, organization_unit_id: 96, position_type: 'EXECUTIVE_HEAD', position_name: 'CFO', user_id: 22, user_name: 'Muntadher Mudher', user_is_active: true, is_unit_head: true, is_active: true, effective_to: null },
  { id: 121, organization_unit_id: 21, position_type: 'DEPARTMENT_HEAD', position_name: 'Supply Chain Manager', user_id: 1, user_name: 'Mohammed Haider Kamal', user_is_active: true, is_unit_head: true, is_active: true, effective_to: null },
  { id: 141, organization_unit_id: 41, position_type: 'UNIT_HEAD', position_name: 'General Warehouse Manager', user_id: 10, user_name: 'Hussein Lafta', user_is_active: true, is_unit_head: true, is_active: true, effective_from: '2026-01-01', effective_to: null },
  { id: 142, organization_unit_id: 42, position_type: 'UNIT_HEAD', position_name: 'Medical Supplies Warehouse Manager', user_id: 11, user_name: 'Jawad Hani Mohammed', user_is_active: true, is_unit_head: true, is_active: true, effective_from: '2026-01-01', effective_to: null },
  { id: 143, organization_unit_id: 43, position_type: 'UNIT_HEAD', position_name: 'Medication Warehouse Manager', user_id: 12, user_name: 'Ameer Hussein Meshaal', user_is_active: true, is_unit_head: true, is_active: true, effective_from: '2026-01-01', effective_to: null },
  { id: 144, organization_unit_id: 44, position_type: 'UNIT_HEAD', position_name: 'Laboratory Warehouse Manager', user_id: 13, user_name: 'Rouqiah Kefah', user_is_active: true, is_unit_head: true, is_active: true, effective_from: '2026-01-01', effective_to: null }
];

function fixture(extraPositions = []) {
  const positions = [...basePositions, ...extraPositions];
  const get = async id => units.find(unit => String(unit.id) === String(id));
  const ancestors = async id => {
    const result=[]; let unit=await get(id);
    while(unit?.parent_unit_id){unit=await get(unit.parent_unit_id);result.unshift(unit);}
    return result;
  };
  const findByCode = async (code, instituteId) => units.filter(unit =>
    String(unit.institute_id) === String(instituteId) &&
    unit.code?.toLowerCase() === String(code).toLowerCase()
  );
  return createOrganizationAuthorityService({ get, findByCode, ancestors, positions: async id => positions.filter(position => String(position.organization_unit_id) === String(id)) });
}

test.each([[93,3],[92,2],[96,22],[21,1]])('unit %s resolves its flagged current head user %s',async(unitId,userId)=>{
  expect(await fixture().resolveUnitHead(unitId,7)).toMatchObject({status:'RESOLVED',organizationUnitId:unitId,userId});
});

test('executive owner follows ancestry, not department classification',async()=>{
  expect(await fixture().resolveExecutiveOwner(30,7)).toMatchObject({status:'RESOLVED',organizationUnitId:93,userId:3});
  expect(await fixture().resolveExecutiveOwner(21,7)).toMatchObject({status:'RESOLVED',organizationUnitId:92,userId:2});
  expect(await fixture().resolveExecutiveOwner(31,7)).toMatchObject({status:'RESOLVED',organizationUnitId:92,userId:2});
});

test('current-position boundaries include an open end and exclude expired, future, and inactive rows',()=>{
  expect(isCurrentPosition({is_active:true,effective_from:'2026-01-01',effective_to:null},'2026-10-03')).toBe(true);
  expect(isCurrentPosition({is_active:true,effective_to:'2026-10-02'},'2026-10-03')).toBe(false);
  expect(isCurrentPosition({is_active:true,effective_from:'2026-10-04'},'2026-10-03')).toBe(false);
  expect(isCurrentPosition({is_active:false,effective_to:null},'2026-10-03')).toBe(false);
});

test('duplicate current flagged heads are explicit and fail closed',async()=>{
  const result=await fixture([{...basePositions[1],id:999,user_id:4,user_name:'Duplicate'}]).resolveUnitHead(93,7);
  expect(result).toMatchObject({status:'AMBIGUOUS',positionIds:[193,999]});
  expect(result.userId).toBeUndefined();
});

test('cross-institute unit references do not resolve',async()=>{
  expect(await fixture().resolveUnitHead(93,8)).toEqual({status:'UNASSIGNED',organizationUnitId:93});
});

test('General Warehouse code resolves Hussein and excludes other Supply Chain warehouse heads',async()=>{
  const result=await fixture().resolveUnitHeadByCode('GENERAL_WAREHOUSE',7);
  expect(result).toMatchObject({status:'RESOLVED',organizationUnitId:41,userId:10,userName:'Hussein Lafta'});
});

test.each([
  ['Medical Supplies Warehouse',11],
  ['Medication Warehouse',12],
  ['Laboratory Warehouse',13],
])('%s head does not satisfy General Warehouse validation',async(_warehouse,userId)=>{
  const result=await fixture().resolveUnitHeadByCode('GENERAL_WAREHOUSE',7);
  expect(result).toMatchObject({status:'RESOLVED',userId:10});
  expect(result.userId).not.toBe(userId);
});

test('multiple Supply Chain warehouse personnel do not affect General Warehouse resolution',async()=>{
  expect(await fixture().resolveUnitHeadByCode('GENERAL_WAREHOUSE',7)).toMatchObject({status:'RESOLVED',userId:10});
});

test('multiple current General Warehouse heads are AMBIGUOUS',async()=>{
  const duplicate={...basePositions.find(position=>position.id===141),id:999,user_id:11,user_name:'Jawad Hani Mohammed'};
  expect(await fixture([duplicate]).resolveUnitHeadByCode('GENERAL_WAREHOUSE',7)).toMatchObject({status:'AMBIGUOUS',positionIds:[141,999]});
});

test.each([
  ['inactive',{is_active:false}],
  ['expired',{effective_to:'2026-10-02'}],
  ['future',{effective_from:'2026-10-04'}],
])('%s General Warehouse head is ignored',async(_label,change)=>{
  const replacement={...basePositions.find(position=>position.id===141),...change};
  const get=async id=>units.find(unit=>String(unit.id)===String(id));
  const repo={get,findByCode:async()=>[units.find(unit=>unit.id===41)],positions:async()=>[replacement]};
  expect(await createOrganizationAuthorityService(repo).resolveUnitHeadByCode('GENERAL_WAREHOUSE',7)).toMatchObject({status:'UNASSIGNED'});
});

test('changing the General Warehouse position holder changes authority without policy changes',async()=>{
  const current={...basePositions.find(position=>position.id===141)};
  const get=async id=>units.find(unit=>String(unit.id)===String(id));
  const repo={get,findByCode:async()=>[units.find(unit=>unit.id===41)],positions:async()=>[current]};
  const service=createOrganizationAuthorityService(repo);
  expect((await service.resolveUnitHeadByCode('GENERAL_WAREHOUSE',7)).userId).toBe(10);
  current.user_id=15;current.user_name='Replacement Manager';
  expect((await service.resolveUnitHeadByCode('GENERAL_WAREHOUSE',7)).userId).toBe(15);
});

test('cross-institute warehouse code fails closed',async()=>{
  expect(await fixture().resolveUnitHeadByCode('GENERAL_WAREHOUSE',8)).toEqual({status:'UNASSIGNED',organizationUnitCode:'GENERAL_WAREHOUSE'});
});

test('inactive organization units and foreign or missing position holders fail closed',async()=>{
  const inactiveUnit={...units.find(unit=>unit.id===41),is_active:false};
  const activePosition={...basePositions.find(position=>position.id===141)};
  const inactiveUnitRepo={
    get:async()=>inactiveUnit,
    findByCode:async()=>[inactiveUnit],
    positions:async()=>[activePosition],
  };
  expect(await createOrganizationAuthorityService(inactiveUnitRepo).resolveUnitHeadByCode('GENERAL_WAREHOUSE',7))
    .toMatchObject({status:'UNASSIGNED'});

  const unscopedHolderRepo={
    get:async()=>units.find(unit=>unit.id===41),
    findByCode:async()=>[units.find(unit=>unit.id===41)],
    positions:async()=>[{...activePosition,user_is_active:null}],
  };
  expect(await createOrganizationAuthorityService(unscopedHolderRepo).resolveUnitHeadByCode('GENERAL_WAREHOUSE',7))
    .toMatchObject({status:'UNASSIGNED',positionId:141});
});
