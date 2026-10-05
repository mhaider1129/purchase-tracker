jest.mock('../config/db', () => ({}));
jest.mock('../utils/emailService', () => ({ sendEmail: jest.fn() }));
jest.mock('../utils/notificationService', () => ({ createNotifications: jest.fn() }));
jest.mock('../utils/ensureWarehouseAssignments', () => jest.fn());
jest.mock('../utils/ensureWarehouseInventoryTables', () => jest.fn());
jest.mock('../utils/ensureProjectsTable', () => jest.fn());
jest.mock('../utils/ensureRequestSchedulingColumns', () => jest.fn());
jest.mock('../utils/ensureRequestClientSubmissionKey', () => jest.fn());
jest.mock('../utils/ensureMaintenanceRequestSchema', () => jest.fn());
jest.mock('../utils/ensureFinanceCoreTables', () => ({ ensureFinanceCoreTables: jest.fn() }));
jest.mock('../services/financeCoreService', () => ({
  evaluateBudgetCoverage: jest.fn(),
  recordCommitment: jest.fn(),
}));
jest.mock('../controllers/utils/approvalRoutes', () => ({ fetchApprovalRoutes: jest.fn() }));
jest.mock('../controllers/requests/saveRequestAttachments', () => ({
  persistRequestAttachments: jest.fn(),
}));
const mockResolveUnitHeadByCode = jest.fn();
jest.mock('../services/organizationAuthorityService', () => ({
  createOrganizationAuthorityService: () => ({
    resolveUnitHeadByCode: mockResolveUnitHeadByCode,
  }),
}));

const { assignApprover } = require('../controllers/requests/createRequestController');

describe('assignApprover', () => {
  beforeEach(() => mockResolveUnitHeadByCode.mockReset());

  it('assigns Medical Devices approvers globally instead of limiting them to requester department', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 46, email: 'medical.devices@example.com' }] })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({});

    await assignApprover(
      client,
      'Medical Devices',
      12,
      311,
      'Medical Device',
      3,
      'medical',
    );

    expect(client.query).toHaveBeenNthCalledWith(
      1,
      'SELECT id, email FROM users WHERE role = $1 AND is_active = true LIMIT 1',
      ['Medical Devices'],
    );
    expect(client.query).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO approvals'),
      [311, 46, 3, false, 'Pending', null],
    );
  });

  it('skips later approval levels when the same approver already approved the request', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 12, email: 'hod@example.com' }] })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await assignApprover(
      client,
      'HOD',
      5,
      340,
      'Maintenance',
      2,
      'operational',
    );

    expect(result).toEqual({ skipped: true, reason: 'duplicate_approver' });
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO approvals'),
      expect.any(Array),
    );
  });

  it('resolves ordinary warehouse validation through the General Warehouse current head', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [{ institute_id: 7 }] })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({});
    mockResolveUnitHeadByCode.mockResolvedValue({
      status: 'RESOLVED', userId: 10, userName: 'Hussein Lafta', userEmail: 'hussein@example.com',
    });

    await assignApprover(client, 'WarehouseManager', 21, 400, 'Non-Stock', 2, 'operational', 42);

    expect(mockResolveUnitHeadByCode).toHaveBeenCalledWith('GENERAL_WAREHOUSE', 7, client);
    expect(client.query).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO approvals'),
      [400, 10, 2, false, 'Pending', null],
    );
  });

  it('fails closed when General Warehouse has multiple current heads', async () => {
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [{ institute_id: 7 }] }) };
    mockResolveUnitHeadByCode.mockResolvedValue({ status: 'AMBIGUOUS', positionIds: [141, 142] });

    await expect(assignApprover(client, 'WarehouseManager', 21, 401, 'Maintenance', 4, 'operational'))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('AMBIGUOUS') });
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it('maps an explicit Warehouse Supply destination to its distinct structural authority', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [{ institute_id: 7 }] })
      .mockResolvedValueOnce({ rows: [{ name: 'Medical Supplies Warehouse' }] })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({});
    mockResolveUnitHeadByCode.mockResolvedValue({ status: 'RESOLVED', userId: 11 });

    await assignApprover(client, 'WarehouseManager', 21, 403, 'Warehouse Supply', 2, 'medical', 42);

    expect(mockResolveUnitHeadByCode).toHaveBeenCalledWith('MEDICAL_SUPPLIES_WAREHOUSE', 7, client);
    expect(client.query).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO approvals'),
      [403, 11, 2, false, 'Pending', null],
    );
  });

  it('fails closed when a Warehouse Supply destination has no canonical authority mapping', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [{ institute_id: 7 }] })
      .mockResolvedValueOnce({ rows: [{ name: 'Temporary Overflow Store' }] });

    await expect(assignApprover(client, 'WarehouseManager', 21, 404, 'Warehouse Supply', 2, 'operational', 99))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('UNASSIGNED') });
    expect(mockResolveUnitHeadByCode).not.toHaveBeenCalled();
  });

  it('creates a new approval without rewriting historical approvals', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [{ institute_id: 7 }] })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({});
    mockResolveUnitHeadByCode.mockResolvedValue({ status: 'RESOLVED', userId: 10 });

    await assignApprover(client, 'WarehouseManager', 21, 402, 'Printing Logbook', 2, 'operational');

    const sql = client.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('INSERT INTO approvals');
    expect(sql).not.toMatch(/UPDATE\s+approvals/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+approvals/i);
  });
});
