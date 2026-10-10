const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createApprovalReminderService } = require('../services/approvalReminderService');
module.exports = async (client) => {
  const patch = fs.readFileSync(path.join(__dirname, '../sql/manual/047_manual_approval_reminders.sql'), 'utf8');
  await client.query(patch);
  const user = (await client.query('SELECT id FROM users ORDER BY id LIMIT 1')).rows[0];
  const request = (await client.query("INSERT INTO requests(request_type,status) VALUES('Stock','Submitted') RETURNING id")).rows[0];
  await client.query("UPDATE users SET email='nobody@example.invalid' WHERE id=$1", [user.id]);
  const approval = (await client.query("INSERT INTO approvals(request_id,approver_id,approval_level,status,is_active) VALUES($1,$2,1,'Pending',TRUE) RETURNING id", [request.id, user.id])).rows[0];
  const database = { connect: async () => ({ query: client.query.bind(client), release: () => {} }), query: client.query.bind(client) };
  let sent = 0;
  const service = createApprovalReminderService(database, async () => { sent++; return { accepted: ['nobody@example.invalid'] }; });
  const actor = { id: user.id, permissions: ['approvals.remind'] };
  await service.send({ requestId: request.id, approvalId: approval.id, actor });
  const history = await service.history(request.id, actor);
  assert.equal(history[0].status, 'sent'); assert.equal(history[0].actor_user_id, user.id);
  await assert.rejects(service.send({ requestId: request.id, approvalId: approval.id, actor }), { statusCode: 429 });
  assert.equal(sent, 1);
  await client.query('UPDATE maintenance_approval_reporting_policy SET reminder_cooldown_hours=48 WHERE id=1');
  await client.query(patch);
  assert.equal((await client.query('SELECT reminder_cooldown_hours FROM maintenance_approval_reporting_policy')).rows[0].reminder_cooldown_hours, 48);
  assert.equal((await service.history(request.id, actor)).length, 1);
  // Use additional connections only to this runner-created loopback fixture.
  assert.equal(client.connectionParameters.host, '127.0.0.1');
  assert.equal(client.connectionParameters.user, 'p2p_test');
  const fixture = client.connectionParameters;
  const concurrentPool = new (require('pg').Pool)({ host: fixture.host, port: fixture.port, user: fixture.user, password: fixture.password, database: fixture.database, max: 2 });
  try {
    const parallel = (await client.query("INSERT INTO approvals(request_id,approver_id,approval_level,status,is_active) VALUES($1,$2,2,'Pending',TRUE) RETURNING id", [request.id, user.id])).rows[0];
    let deliveries = 0;
    const concurrentService = createApprovalReminderService(concurrentPool, async () => { deliveries++; return { accepted: ['nobody@example.invalid'] }; });
    const results = await Promise.allSettled([
      concurrentService.send({ requestId: request.id, approvalId: parallel.id, actor }),
      concurrentService.send({ requestId: request.id, approvalId: parallel.id, source: 'automatic' }),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.find((r) => r.status === 'rejected').reason.statusCode, 429);
    assert.equal(deliveries, 1);
  } finally { await concurrentPool.end(); }
  await client.query("UPDATE requests SET status='Closed' WHERE id=$1", [request.id]);
  await assert.rejects(service.send({ requestId: request.id, approvalId: approval.id, actor }), { statusCode: 409 });
  await client.query("UPDATE requests SET status='Submitted' WHERE id=$1", [request.id]);
  await client.query('UPDATE approvals SET is_active=FALSE WHERE id=$1', [approval.id]);
  await assert.rejects(service.send({ requestId: request.id, approvalId: approval.id, actor }), { statusCode: 409 });
  console.log('SQL 047 reminders: reservation/delivery/history, concurrent sends, cooldown, terminal/inactive guards and repeat preservation PASS (SMTP mocked)');
};
