import api from './axios';

export const getLifecycleDetail = async (requestId) => (await api.get(`/api/procure-to-pay/requests/${requestId}/lifecycle`)).data;

export const createPurchaseOrder = async (requestId, payload) => (await api.post(`/api/procure-to-pay/requests/${requestId}/purchase-orders`, payload)).data;
export const listPurchaseOrders = async (requestId = null) => {
  const query = requestId ? `?request_id=${requestId}` : '';
  return (await api.get(`/api/procure-to-pay/purchase-orders${query}`)).data;
};
export const getPurchaseOrderDetail = async (poId) => (await api.get(`/api/procure-to-pay/purchase-orders/${poId}`)).data;

export const createGoodsReceipt = async (requestId, payload) => (await api.post(`/api/procure-to-pay/requests/${requestId}/receipts`, payload)).data;
export const listReceiptsByRequest = async (requestId) => (await api.get(`/api/procure-to-pay/requests/${requestId}/receipts`)).data;

export const submitInvoice = async (requestId, payload) => (await api.post(`/api/procure-to-pay/requests/${requestId}/invoices`, payload)).data;
export const runInvoiceMatch = async (requestId, invoiceId, payload) => (await api.post(`/api/procure-to-pay/requests/${requestId}/invoices/${invoiceId}/match`, payload)).data;
export const approveOverride = async (requestId, matchResultId, payload) => (await api.post(`/api/procure-to-pay/requests/${requestId}/match-results/${matchResultId}/override`, payload)).data;

export const postPayableFromInvoice = async (invoiceId) => (await api.post(`/api/procure-to-pay/ap-invoices/${invoiceId}/post-payable`, {})).data;
export const listAccountsPayable = async () => (await api.get('/api/procure-to-pay/accounts-payable')).data;
export const recordPayablePayment = async (payableId, payload) => (await api.post(`/api/procure-to-pay/accounts-payable/${payableId}/payments`, payload)).data;

export const getDocumentFlow = async (requestId) => (await api.get(`/api/procure-to-pay/document-flow/request/${requestId}`)).data;

export const createApVoucher = async (requestId, payload) => (await api.post(`/api/procure-to-pay/requests/${requestId}/vouchers`, payload)).data;
export const verifyFinanceRecord = async (requestId, payload = {}) => (await api.post(`/api/procure-to-pay/requests/${requestId}/verify`, payload)).data;
export const postToInternalLedger = async (requestId, payload) => (await api.post(`/api/procure-to-pay/requests/${requestId}/post-ledger`, payload)).data;
export const markPaymentPending = async (requestId, payload) => (await api.post(`/api/procure-to-pay/requests/${requestId}/payment-pending`, payload)).data;
export const markPaid = async (requestId, paymentId, payload) => (await api.post(`/api/procure-to-pay/requests/${requestId}/payments/${paymentId}/paid`, payload)).data;