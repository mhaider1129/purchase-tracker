import { featureByPath, featureRegistry } from './featureRegistry';

describe('Supply Chain Performance navigation feature', () => {
  test('uses the protected route and permission in the Insights group', () => {
    expect(featureRegistry.supplyChainPerformance).toMatchObject({
      path: '/supply-chain-performance',
      requiredPermissions: ['procurement-performance.view'],
      nav: { group: 'insights', labelKey: 'navbar.supplyChainPerformance' },
    });
    expect(featureByPath['/supply-chain-performance']).toBe(featureRegistry.supplyChainPerformance);
  });
});

describe('Approval Engine navigation feature', () => {
  test('exposes the policy administration page only to policy viewers', () => {
    expect(featureRegistry.approvalPolicies).toMatchObject({
      path: '/admin/approval-policies',
      requiredPermissions: ['approval-policy.view'],
      nav: { group: 'insights', labelKey: 'navbar.approvalEngine' },
    });
    expect(featureByPath['/admin/approval-policies']).toBe(
      featureRegistry.approvalPolicies,
    );
  });
});