import api from './axios';

export const getProcureToPayDashboard = async () => (await api.get('/procure-to-pay/dashboard')).data;

export const getLifecycleDetail = async (requestId) => (await api.get(`/procure-to-pay/requests/${requestId}/lifecycle`)).data;

export const createPurchaseOrder = async (requestId, payload) => {
  if (!Array.isArray(payload?.awards) || payload.awards.length === 0
      || payload.awards.some(({ award_id: awardId, quantity }) => !awardId || quantity == null)) {
    throw new Error('Purchase order creation requires award selections; legacy manual PO creation is disabled.');
  }
  const canonicalPayload = {
    awards: payload.awards.map(({ award_id: awardId, quantity }) => ({ award_id: awardId, quantity })),
    expected_delivery_date: payload.expected_delivery_date || null,
    delivery_location: payload.delivery_location || null,
    budget_cost_center: payload.budget_cost_center || null,
  };
  return (await api.post(requestId
    ? `/procure-to-pay/requests/${requestId}/purchase-orders`
    : '/procure-to-pay/purchase-orders', canonicalPayload)).data;
};
export const listPurchaseOrders = async (params = {}) => (await api.get('/procure-to-pay/purchase-orders', { params })).data;
export const listPoSourceRequests = async (params = {}) => (await api.get('/procure-to-pay/po-source-requests', { params })).data;
export const getPurchaseOrderDetail = async (poId) => (await api.get(`/procure-to-pay/purchase-orders/${poId}`)).data;

export const submitPurchaseOrderForApproval = async (poId, payload = {}) => (await api.post(`/procure-to-pay/purchase-orders/${poId}/submit-approval`, payload)).data;
export const approvePurchaseOrder = async (poId, payload = {}) => (await api.post(`/procure-to-pay/purchase-orders/${poId}/approve`, payload)).data;
export const issuePurchaseOrder = async (poId, payload = {}) => (await api.post(`/procure-to-pay/purchase-orders/${poId}/issue`, payload)).data;
export const cancelPurchaseOrder = async (poId, payload) => (await api.post(`/procure-to-pay/purchase-orders/${poId}/cancel`, payload)).data;
export const closePurchaseOrder = async (poId, payload = {}) => (await api.post(`/procure-to-pay/purchase-orders/${poId}/close`, payload)).data;

export const createGoodsReceipt = async (requestId, payload) => {
  if (!payload?.idempotency_key) throw new Error('Goods receipt idempotency_key is required.');
  return (await api.post(`/procure-to-pay/requests/${requestId}/receipts`, payload, {
    headers: { 'Idempotency-Key': payload.idempotency_key },
  })).data;
};
export const listReceiptsByRequest = async (requestId) => (await api.get(`/procure-to-pay/requests/${requestId}/receipts`)).data;
export const listGoodsReceipts = async (params = {}) => (await api.get('/procure-to-pay/goods-receipts', { params })).data;
export const listOpenPosForReceipt = async () => (await api.get('/procure-to-pay/open-pos-for-receipt')).data;

export const submitInvoice = async (requestId, payload) => (await api.post(`/procure-to-pay/requests/${requestId}/invoices`, payload)).data;
export const listApInvoices = async (params = {}) => (await api.get('/procure-to-pay/ap-invoices', { params })).data;
export const runInvoiceMatch = async (requestId, invoiceId, payload) => (await api.post(`/procure-to-pay/requests/${requestId}/invoices/${invoiceId}/match`, payload)).data;
export const listInvoiceMatchingQueue = async () => (await api.get('/procure-to-pay/invoice-matching-queue')).data;
export const approveOverride = async (requestId, matchResultId, payload) => (await api.post(`/procure-to-pay/requests/${requestId}/match-results/${matchResultId}/override`, payload)).data;

export const postPayableFromInvoice = async (invoiceId) => (await api.post(`/procure-to-pay/ap-invoices/${invoiceId}/post-payable`, {})).data;
export const listAccountsPayable = async (params = {}) => (await api.get('/procure-to-pay/accounts-payable', { params })).data;
export const listPayments = async (params = {}) => (await api.get('/procure-to-pay/payments', { params })).data;
export const recordPayablePayment = async (payableId, payload) => (await api.post(`/procure-to-pay/accounts-payable/${payableId}/payments`, payload)).data;

export const listDocumentFlow = async (params = {}) => (await api.get('/procure-to-pay/document-flow', { params })).data;
export const getDocumentFlow = async (requestId) => (await api.get(`/procure-to-pay/document-flow/request/${requestId}`)).data;

export const createApVoucher = async (requestId, payload) => (await api.post(`/procure-to-pay/requests/${requestId}/vouchers`, payload)).data;
export const verifyFinanceRecord = async (requestId, payload = {}) => (await api.post(`/procure-to-pay/requests/${requestId}/verify`, payload)).data;
export const postToInternalLedger = async (requestId, payload) => (await api.post(`/procure-to-pay/requests/${requestId}/post-ledger`, payload)).data;
export const markPaymentPending = async (requestId, payload) => (await api.post(`/procure-to-pay/requests/${requestId}/payment-pending`, payload)).data;
export const markPaid = async (requestId, paymentId, payload) => (await api.post(`/procure-to-pay/requests/${requestId}/payments/${paymentId}/paid`, payload)).data;