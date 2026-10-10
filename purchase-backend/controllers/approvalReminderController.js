const service = require('../services/approvalReminderService').createApprovalReminderService();
exports.send = async (req, res, next) => {
  try { res.json(await service.send({ requestId: req.params.request_id, approvalId: req.body?.approval_id, actor: req.user })); } catch (error) { next(error); }
};
exports.history = async (req, res, next) => {
  try { res.json(await service.history(req.params.request_id, req.user)); } catch (error) { next(error); }
};
