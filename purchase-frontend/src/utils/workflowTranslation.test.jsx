import React from 'react';
import { act, render, screen } from '@testing-library/react';
import i18n from '../i18n';
import useUiTranslation from './useUiTranslation';
import { translateWorkflowAction, workflowLabel } from './workflowTranslation';
import RequestActionContext from '../components/workspaces/RequestActionContext';
import interfaceEn from '../locales/interface.en.json';
import interfaceAr from '../locales/interface.ar.json';

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(async () => { await i18n.changeLanguage('en'); });
const Probe = () => {
  const text = useUiTranslation();
  return <div>{text('Maintenance ref.')} | {text('Showing {{shown}} of {{total}} requests', { shown: 10, total: 1151 })}</div>;
};
test('Arabic messages, punctuation and interpolated counts update when language changes', async () => {
  render(<Probe />);
  expect(screen.getByText(/Showing 10 of 1151 requests/)).toBeInTheDocument();
  await act(async () => { await i18n.changeLanguage('ar'); });
  expect(screen.getByText(/مرجع الصيانة.*عرض 10 من 1151 طلب/)).toBeInTheDocument();
  await act(async () => { await i18n.changeLanguage('en'); });
  expect(screen.getByText(/Maintenance ref./)).toBeInTheDocument();
});
test('approval guidance translates templates while preserving approver and assignee names', async () => {
  await i18n.changeLanguage('ar');
  render(<RequestActionContext request={{ next_required_action: 'Awaiting Hassanin Muiz Mohammed approval', current_bottleneck: 'Approval level 3', assigned_to_name: 'Ahmed' }} />);
  expect(screen.getByText('بانتظار موافقة Hassanin Muiz Mohammed')).toBeInTheDocument();
  expect(screen.getByText('مستوى الموافقة 3')).toBeInTheDocument();
  expect(screen.getByText('Ahmed')).toBeInTheDocument();
});
test('only known workflow messages are interpreted and codes remain unchanged', () => {
  const unknown = 'Custom clinical instruction: awaiting lab approval';
  const translate = jest.fn();
  expect(translateWorkflowAction(unknown, translate)).toBe(unknown);
  expect(translate).not.toHaveBeenCalled();
  const item = { status: 'partially_procured' };
  expect(workflowLabel(item.status)).toBe('Partially Procured');
  expect(item.status).toBe('partially_procured');
  expect(workflowLabel('Custom product name')).toBe('Custom product name');
});
test('both UI catalogues have identical keys and interpolation variables', () => {
  expect(Object.keys(interfaceAr).sort()).toEqual(Object.keys(interfaceEn).sort());
  const variables = value => [...value.matchAll(/\{\{([^}]+)\}\}/g)].map(x => x[1]).sort();
  for (const key of Object.keys(interfaceEn)) {
    expect(interfaceAr[key].trim()).not.toBe('');
    expect(variables(interfaceAr[key])).toEqual(variables(interfaceEn[key]));
  }
});
