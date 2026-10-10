jest.mock('../config/db', () => ({ connect: jest.fn(), query: jest.fn() }));
jest.mock('../utils/emailService', () => ({ sendEmail: jest.fn() }));
const { createApprovalReminderService } = require('../services/approvalReminderService');
const actor = { id: 1, name: 'SCM', permissions: ['approvals.remind'] };
function setup(options = {}) {
  const client = { release: jest.fn(), query: jest.fn(async (sql) => {
    if (sql.includes('to_regclass')) return { rows: [{ available: options.available !== false }] };
    if (sql.startsWith('SELECT a.id AS')) return { rows: options.noApproval ? [] : [{ approval_id: 5, request_id: 1, approver_id: 2, email: options.noEmail ? null : 'test@example.invalid', request_type: 'Stock' }] };
    if (sql.startsWith('SELECT reminder_cooldown')) return { rows: [{ reminder_cooldown_hours: 24 }] };
    if (sql.startsWith('SELECT EXISTS')) return { rows: [{ blocked: Boolean(options.blocked) }] };
    if (sql.startsWith('INSERT INTO public.approval_reminder_history')) return { rows: [{ id: 9 }] };
    if (sql.startsWith('SELECT a.id FROM')) return { rows: options.changed ? [] : [{ id: 5 }] };
    if (options.auditFailure && sql.includes('INSERT INTO audit_logs') && client.query.mock.calls.length > 10) throw new Error('Audit failed');
    return { rows: [], rowCount: 1 };
  }) };
  const database = { connect: jest.fn(async () => client), query: client.query };
  const deliver = jest.fn(options.deliver || (async () => ({ accepted: ['test@example.invalid'] })));
  return { client, database, deliver, service: createApprovalReminderService(database, deliver) };
}
test('denies unauthorized role or invalid IDs before connecting', async () => {
  const { service, database, deliver } = setup();
  await expect(service.send({ requestId: 1, actor: { id: 1, role: 'SCM' } })).rejects.toMatchObject({ statusCode: 403 });
  await expect(service.send({ requestId: 'invalid', actor })).rejects.toMatchObject({ statusCode: 400 });
  expect(database.connect).not.toHaveBeenCalled(); expect(deliver).not.toHaveBeenCalled();
});
test.each([{ available: false, code: 503 }, { blocked: true, code: 429 }, { noApproval: true, code: 409 }, { noEmail: true, code: 400 }])('preflight prevents SMTP for %j', async (options) => {
  const { service, deliver, client } = setup(options);
  await expect(service.send({ requestId: 1, approvalId: 5, actor })).rejects.toMatchObject({ statusCode: options.code });
  expect(deliver).not.toHaveBeenCalled(); expect(client.query).toHaveBeenCalledWith('ROLLBACK'); expect(client.release).toHaveBeenCalled();
});
test('durably reserves before SMTP, locks current ownership, records sender/history and leaves activation clock unchanged', async () => {
  const { service, deliver, client } = setup();
  await expect(service.send({ requestId: 1, approvalId: 5, actor })).resolves.toMatchObject({ approval_id: 5, reminder_id: 9 });
  const calls = client.query.mock.calls.map(([sql]) => sql);
  expect(calls.filter((sql) => sql === 'COMMIT')).toHaveLength(2);
  expect(calls.some((sql) => sql.includes('FOR UPDATE OF a'))).toBe(true);
  expect(calls.some((sql) => sql.includes('UPDATE approvals SET reminder_sent_at=NOW()'))).toBe(true);
  expect(calls.some((sql) => /SET.*activated_at|SET.*updated_at/.test(sql))).toBe(false);
  expect(deliver).toHaveBeenCalledTimes(1);
  expect(deliver.mock.calls[0][3]).toEqual({ throwOnError: true, retry: false });
});
test('changed approval cancels before delivery', async () => {
  const { service, deliver, client } = setup({ changed: true });
  await expect(service.send({ requestId: 1, actor })).rejects.toMatchObject({ statusCode: 409 });
  expect(deliver).not.toHaveBeenCalled(); expect(client.query.mock.calls.some(([sql]) => sql.includes("status='cancelled'"))).toBe(true);
});
test.each([null, { dryRun: true }, { accepted: [] }])('non-delivery result %j records failed attempt instead of success', async (result) => {
  const { service, client } = setup({ deliver: async () => result });
  await expect(service.send({ requestId: 1, actor })).rejects.toMatchObject({ statusCode: 503 });
  expect(client.query).toHaveBeenCalledWith(expect.stringContaining('SET status=$1'), ['failed', 'Email was not accepted', 9]);
});
test('SMTP uncertainty and post-send audit failure retain blocked unknown outcome', async () => {
  for (const options of [{ deliver: async () => { throw new Error('Timeout'); } }, { deliver: async () => { throw Object.assign(new Error('SMTP unavailable'), { statusCode: 503 }); } }, { auditFailure: true }]) {
    const { service, client } = setup(options);
    await expect(service.send({ requestId: 1, actor })).rejects.toThrow();
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('SET status=$1'), ['unknown', 'Delivery outcome needs review; do not resend', 9]);
  }
});
test('history enforces permission before database and scopes its query to one request', async () => {
  const { service, database, client } = setup();
  await expect(service.history(1, { id: 1 })).rejects.toMatchObject({ statusCode: 403 });
  expect(database.query).not.toHaveBeenCalled();
  await service.history(1, actor);
  expect(client.query).toHaveBeenCalledWith(expect.stringContaining('WHERE h.request_id=$1'), [1]);
});
