import React from 'react';
import { render, screen } from '@testing-library/react';
import PolicyDiagnostics, { SemanticPurpose } from './PolicyDiagnostics';

test('presents unknown legacy purpose neutrally with an explanation', () => {
  render(<SemanticPurpose value="LEGACY_SEMANTIC_UNKNOWN" />);
  expect(screen.getByText('Legacy approval — purpose unavailable')).toHaveAttribute('title', expect.stringContaining('did not store Approval Engine 2.0'));
  expect(screen.queryByText('LEGACY_SEMANTIC_UNKNOWN')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
test('shows exact condition operands, all three outcomes and selected version identity', () => {
  render(<PolicyDiagnostics policy={{ name: 'Non-Stock', versionNumber: 1, versionId: 12, status: 'SHADOW', activeRuleCount: 1, ruleCount: 1 }} diagnostics={[{ code: 'NONSTOCK_MED_HIGH', priority: 1, result: 'UNKNOWN', selected: false, conditions: [
    { type: 'REQUEST_TYPE_EQUALS', expected: 'Non-Stock', actual: 'Non-Stock', configuredValue: 'Non-Stock', result: 'PASS' },
    { type: 'AMOUNT_GTE', expected: '5000001', actual: '5000000', configuredValue: '5000001', result: 'FAIL' },
    { type: 'WAREHOUSE_REQUIRED', expected: true, actual: null, configuredValue: 'true', result: 'UNKNOWN' },
  ] }]} />);
  expect(screen.getByText(/Version 1 \(ID 12\)/)).toBeInTheDocument();
  for (const result of ['PASS', 'FAIL', 'UNKNOWN']) expect(screen.getByText(result)).toBeInTheDocument();
  expect(screen.getByText('Unavailable')).toBeInTheDocument();
});
test('distinguishes old runs without recorded diagnostics from versions with zero active rules', () => {
  const { rerender } = render(<PolicyDiagnostics />);
  expect(screen.getByText(/not recorded for this historical run/)).toBeInTheDocument();
  rerender(<PolicyDiagnostics diagnostics={[]} />);
  expect(screen.getByText(/no active rules/)).toBeInTheDocument();
});
