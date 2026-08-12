import api from './axios';
import { createPurchaseOrder } from './procureToPay';

jest.mock('./axios', () => ({ post: jest.fn() }));

describe('award-based purchase order API', () => {
  beforeEach(() => api.post.mockReset());

  test('sends only award selections and permitted delivery metadata', async () => {
    api.post.mockResolvedValue({ data: { purchase_order: { id: 1 } } });
    await createPurchaseOrder(7, {
      awards: [{ award_id: 11, quantity: '4' }],
      expected_delivery_date: '2026-09-01',
      supplier_id: 999,
      supplier_name: 'Caller supplied',
      items: [{ unit_price: '0.01' }],
    });
    expect(api.post).toHaveBeenCalledWith('/procure-to-pay/requests/7/purchase-orders', {
      awards: [{ award_id: 11, quantity: '4' }],
      expected_delivery_date: '2026-09-01',
      delivery_location: null,
      budget_cost_center: null,
    });
  });

  test('fails closed before HTTP for legacy arbitrary PO payloads', async () => {
    await expect(createPurchaseOrder(7, { supplier_name: 'Legacy', items: [{ unit_price: 2 }] }))
      .rejects.toThrow('legacy manual PO creation is disabled');
    expect(api.post).not.toHaveBeenCalled();
  });
});