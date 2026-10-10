jest.mock('../controllers/approvalReminderController', () => ({ send: jest.fn() }));
jest.mock('../config/db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../utils/emailService', () => ({ sendEmail: jest.fn() }));
const { notifyCurrentApprovalByEmail } = require('../controllers/approvalsController');
test('legacy controller export delegates to controlled reminders', () => {
  expect(notifyCurrentApprovalByEmail).toBe(require('../controllers/approvalReminderController').send);
});
