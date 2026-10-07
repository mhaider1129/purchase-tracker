import i18next from 'i18next';
import en from '../locales/en.json';
import ar from '../locales/ar.json';
import { getMaintenanceApprovalStepLabel } from './maintenanceApprovalStatus';

const translator = (language) => {
  const i18n = i18next.createInstance();
  i18n.init({ lng: language, resources: { en: { translation: en }, ar: { translation: ar } }, initImmediate: false });
  return (key, options) => i18n.t(`myMaintenanceRequestsPage.${key}`, options);
};

test.each(['en', 'ar'])('handles completed lifecycle aliases and whitespace in %s', (language) => {
  const tr = translator(language);
  for (const status of ['Completed', ' Received ', 'Available in Stock', ' Approved ']) {
    expect(getMaintenanceApprovalStepLabel({ status }, tr)).toBe(tr('export.currentStepCompleted'));
  }
});

test('Arabic pending approval retains recorded level and approver', () => {
  const tr = translator('ar');
  expect(getMaintenanceApprovalStepLabel({ status: 'Submitted', current_approval_step: 4, current_pending_approver_name: 'أحمد', current_pending_approver_role: 'SCM' }, tr)).toBe('المستوى 4 – بانتظار أحمد (SCM)');
  expect(getMaintenanceApprovalStepLabel({ status: 'Submitted', current_approval_step: 4 }, tr)).toContain('لم يُسجل اسم المعتمد');
});

test('does not invent approval evidence for other statuses or missing data', () => {
  const tr = translator('ar');
  expect(getMaintenanceApprovalStepLabel({ status: 'Assigned' }, tr)).toBe('حالة الطلب: تم الإسناد');
  expect(getMaintenanceApprovalStepLabel({ status: 'Rejected' }, tr)).toBe(tr('export.currentStepRejected'));
  expect(getMaintenanceApprovalStepLabel({}, tr)).toBe(tr('export.currentStepUnknown'));
  expect(getMaintenanceApprovalStepLabel({ status: 'Received', final_approver_name: 'أحمد', final_approval_date: '2026-10-01' }, tr)).toContain('أحمد');
});
