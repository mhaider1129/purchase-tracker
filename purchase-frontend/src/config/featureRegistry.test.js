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