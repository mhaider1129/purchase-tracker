import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CurrentProcurementPriorities, DepartmentPriorityQueue, FactorBreakdown, ScmPriorityManagement } from './ProcurementPriorityViews';

test('public widget displays only supplied safe group fields and tier badges', () => {
  render(<CurrentProcurementPriorities entries={[{ id: 1, institutionalRank: 1, publicTitle: 'LINAC Critical Spares', tier: 'P0' }]} />);
  expect(screen.getByText(/LINAC Critical Spares/)).toBeInTheDocument();
  expect(screen.getByText('P0')).toBeInTheDocument();
  expect(screen.queryByText(/supplier|price|quotation/i)).not.toBeInTheDocument();
});

test('HOD controls depend on ranking permission', () => {
  const entry = { id: 1, requestNumber: 'PR-1', safeTitle: 'ECG electrodes', stage: 'Sourcing', tier: 'P2' };
  const { rerender } = render(<DepartmentPriorityQueue entries={[entry]} canRank={false} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  rerender(<DepartmentPriorityQueue entries={[entry]} canRank onMove={() => {}} />);
  expect(screen.getAllByRole('button')).toHaveLength(2);
});

test('SCM override requires a reason and keeps explainability visible', () => {
  const onOverride = jest.fn();
  render(<ScmPriorityManagement canManage onOverride={onOverride} profile={{ systemSuggestedRank: 1, institutionalRank: 2, score: '82.00', tier: 'P1', breakdown: { Impact: '22 / 25' } }} />);
  expect(screen.getByLabelText('Priority factor breakdown')).toBeInTheDocument();
  expect(screen.getByRole('button')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Override reason'), { target: { value: 'Sequence dependency' } });
  fireEvent.click(screen.getByRole('button'));
  expect(onOverride).toHaveBeenCalledWith('Sequence dependency');
});

test('factor breakdown renders total and tier', () => {
  render(<FactorBreakdown breakdown={{ Aging: '6 / 10' }} score="62.00" tier="P2" />);
  expect(screen.getByText('Aging')).toBeInTheDocument(); expect(screen.getByText('P2')).toBeInTheDocument();
});

test('missing factor evidence is not fabricated as zero', () => {
  render(<FactorBreakdown breakdown={null} score={null} tier={null} />);
  expect(screen.getAllByText('Not assessed').length).toBeGreaterThan(1);
  expect(screen.queryByText('0 / 100')).not.toBeInTheDocument();
});