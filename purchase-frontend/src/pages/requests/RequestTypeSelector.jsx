// src/pages/requests/RequestTypeSelector.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  FileBox,
  FileCog,
  History,
  Laptop,
  LifeBuoy,
  Package,
  Pill,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import axios from '../../api/axios';
import { HelpTooltip } from '../../components/ui/HelpTooltip';

const BASE_BUTTON_STYLE =
  'block w-full py-2 px-4 rounded text-white font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm';

const ACTION_GROUPS = [
  {
    titleKey: 'requestTypeSelector.groups.warehouse.title',
    descriptionKey: 'requestTypeSelector.groups.warehouse.description',
    actions: [
      {
        labelKey: 'requestTypeSelector.actions.stockRequest.label',
        ariaLabelKey: 'requestTypeSelector.actions.stockRequest.aria',
        descriptionKey: 'requestTypeSelector.actions.stockRequest.description',
        path: '/requests/stock',
        roles: ['warehousemanager', 'warehouse_manager', 'warehouse_keeper'],
        buttonClassName: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400',
        icon: Package,
        featured: true,
      },
      {
        labelKey: 'requestTypeSelector.actions.newStockItem.label',
        ariaLabelKey: 'requestTypeSelector.actions.newStockItem.aria',
        descriptionKey: 'requestTypeSelector.actions.newStockItem.description',
        path: '/requests/stock-item',
        roles: ['warehousemanager', 'warehouse_manager'],
        buttonClassName: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400',
        icon: ClipboardPlus,
      },
      {
        labelKey: 'requestTypeSelector.actions.warehouseTemplates.label',
        ariaLabelKey: 'requestTypeSelector.actions.warehouseTemplates.aria',
        descriptionKey: 'requestTypeSelector.actions.warehouseTemplates.description',
        path: '/warehouse-supply-templates',
        roles: ['warehousemanager', 'warehouse_manager', 'warehouse_keeper'],
        buttonClassName: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400',
        icon: FileCog,
      },
      {
        labelKey: 'requestTypeSelector.actions.issueCustody.label',
        ariaLabelKey: 'requestTypeSelector.actions.issueCustody.aria',
        descriptionKey: 'requestTypeSelector.actions.issueCustody.description',
        path: '/custody/issue',
        roles: [
          'warehousemanager',
          'warehouse_manager',
          'warehousekeeper',
          'warehouse_keeper',
          'scm',
          'admin',
        ],
        buttonClassName: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-400',
        icon: ShieldCheck,
      },
      {
        labelKey: 'requestTypeSelector.actions.issuedCustodies.label',
        ariaLabelKey: 'requestTypeSelector.actions.issuedCustodies.aria',
        descriptionKey: 'requestTypeSelector.actions.issuedCustodies.description',
        path: '/custody/issued',
        roles: [
          'warehousemanager',
          'warehouse_manager',
          'warehousekeeper',
          'warehouse_keeper',
          'scm',
          'admin',
        ],
        buttonClassName: 'bg-indigo-500 hover:bg-indigo-600 focus:ring-indigo-300',
        icon: ClipboardCheck,
      },
      {
        labelKey: 'requestTypeSelector.actions.submittedSupply.label',
        ariaLabelKey: 'requestTypeSelector.actions.submittedSupply.aria',
        descriptionKey: 'requestTypeSelector.actions.submittedSupply.description',
        path: '/warehouse-supply-requests',
        roles: ['warehousemanager', 'warehouse_manager', 'warehouse_keeper'],
        buttonClassName: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300',
        icon: ClipboardList,
      },
      {
        labelKey: 'requestTypeSelector.actions.itemRecalls.label',
        ariaLabelKey: 'requestTypeSelector.actions.itemRecalls.aria',
        descriptionKey: 'requestTypeSelector.actions.itemRecalls.description',
        path: '/item-recalls',
        buttonClassName: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-400',
        icon: LifeBuoy,
      },
    ],
  },
  {
    titleKey: 'requestTypeSelector.groups.create.title',
    descriptionKey: 'requestTypeSelector.groups.create.description',
    actions: [
      {
        labelKey: 'requestTypeSelector.actions.warehouseSupply.label',
        ariaLabelKey: 'requestTypeSelector.actions.warehouseSupply.aria',
        descriptionKey: 'requestTypeSelector.actions.warehouseSupply.description',
        path: '/requests/warehouse-supply',
        buttonClassName: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300',
        icon: Boxes,
        featured: true,
      },
      {
        labelKey: 'requestTypeSelector.actions.nonStock.label',
        ariaLabelKey: 'requestTypeSelector.actions.nonStock.aria',
        descriptionKey: 'requestTypeSelector.actions.nonStock.description',
        path: '/requests/non-stock',
        buttonClassName: 'bg-green-600 hover:bg-green-700 focus:ring-green-400',
        icon: FileBox,
        featured: true,
      },
      {
        labelKey: 'requestTypeSelector.actions.medicalDevice.label',
        ariaLabelKey: 'requestTypeSelector.actions.medicalDevice.aria',
        descriptionKey: 'requestTypeSelector.actions.medicalDevice.description',
        path: '/requests/medical-device',
        buttonClassName: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-400',
        icon: Stethoscope,
      },
      {
        labelKey: 'requestTypeSelector.actions.medication.label',
        ariaLabelKey: 'requestTypeSelector.actions.medication.aria',
        descriptionKey: 'requestTypeSelector.actions.medication.description',
        path: '/requests/medication',
        buttonClassName: 'bg-pink-600 hover:bg-pink-700 focus:ring-pink-400',
        predicate: ({ can_request_medication, role }) =>
          Boolean(can_request_medication) || role === 'scm',
        icon: Pill,
      },
      {
        labelKey: 'requestTypeSelector.actions.itRequest.label',
        ariaLabelKey: 'requestTypeSelector.actions.itRequest.aria',
        descriptionKey: 'requestTypeSelector.actions.itRequest.description',
        path: '/requests/it-items',
        buttonClassName: 'bg-teal-600 hover:bg-teal-700 focus:ring-teal-400',
        icon: Laptop,
      },
    ],
  },
  {
    titleKey: 'requestTypeSelector.groups.maintenance.title',
    descriptionKey: 'requestTypeSelector.groups.maintenance.description',
    actions: [
      {
        labelKey: 'requestTypeSelector.actions.maintenanceRequest.label',
        ariaLabelKey: 'requestTypeSelector.actions.maintenanceRequest.aria',
        descriptionKey: 'requestTypeSelector.actions.maintenanceRequest.description',
        path: '/requests/maintenance',
        roles: ['technician'],
        buttonClassName: 'bg-red-600 hover:bg-red-700 focus:ring-red-400',
        icon: Wrench,
      },
      {
        labelKey: 'requestTypeSelector.actions.maintenanceSupply.label',
        ariaLabelKey: 'requestTypeSelector.actions.maintenanceSupply.aria',
        descriptionKey: 'requestTypeSelector.actions.maintenanceSupply.description',
        path: '/requests/maintenance-warehouse-supply',
        roles: ['technician'],
        buttonClassName: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300',
        icon: Truck,
      },
      {
        labelKey: 'requestTypeSelector.actions.maintenanceApprovals.label',
        ariaLabelKey: 'requestTypeSelector.actions.maintenanceApprovals.aria',
        descriptionKey: 'requestTypeSelector.actions.maintenanceApprovals.description',
        path: '/approvals',
        roles: ['hod', 'requester', 'warehouse_keeper', 'warehousemanager', 'cmo', 'coo', 'scm'],
        buttonClassName: 'bg-orange-700 hover:bg-orange-800 focus:ring-orange-400',
        icon: ShieldCheck,
      },
    ],
  },
  {
    titleKey: 'requestTypeSelector.groups.approvals.title',
    descriptionKey: 'requestTypeSelector.groups.approvals.description',
    actions: [
      {
        labelKey: 'requestTypeSelector.actions.approvalsPanel.label',
        ariaLabelKey: 'requestTypeSelector.actions.approvalsPanel.aria',
        descriptionKey: 'requestTypeSelector.actions.approvalsPanel.description',
        path: '/approvals',
        roles: ['hod', 'cmo', 'coo', 'cfo', 'scm', 'medicaldevices', 'warehousemanager', 'warehouse_manager'],
        buttonClassName: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-400',
        icon: ClipboardCheck,
        featured: true,
      },
      {
        labelKey: 'requestTypeSelector.actions.custodyApprovals.label',
        ariaLabelKey: 'requestTypeSelector.actions.custodyApprovals.aria',
        descriptionKey: 'requestTypeSelector.actions.custodyApprovals.description',
        path: '/custody/approvals',
        buttonClassName: 'bg-indigo-500 hover:bg-indigo-600 focus:ring-indigo-300',
        icon: ShieldCheck,
      },
      {
        labelKey: 'requestTypeSelector.actions.approvalHistory.label',
        ariaLabelKey: 'requestTypeSelector.actions.approvalHistory.aria',
        descriptionKey: 'requestTypeSelector.actions.approvalHistory.description',
        path: '/approval-history',
        roles: ['hod', 'cmo', 'coo', 'cfo', 'scm', 'medicaldevices', 'admin', 'warehousemanager', 'warehouse_manager'],
        buttonClassName: 'bg-gray-700 hover:bg-gray-800 focus:ring-gray-400',
        icon: History,
      },
    ],
  },
  {
    titleKey: 'requestTypeSelector.groups.admin.title',
    descriptionKey: 'requestTypeSelector.groups.admin.description',
    actions: [
      {
        labelKey: 'requestTypeSelector.actions.registerUser.label',
        ariaLabelKey: 'requestTypeSelector.actions.registerUser.aria',
        descriptionKey: 'requestTypeSelector.actions.registerUser.description',
        path: '/register',
        roles: ['admin', 'scm'],
        buttonClassName: 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-300 text-gray-900',
        icon: Users,
      },
    ],
  },
];

const RequestTypeSelector = () => {
  const { t } = useTranslation();
  const tr = useCallback(
    (key, options) => t(`requestTypeSelector.${key}`, options),
    [t]
  );
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState({
    role: '',
    department_id: null,
    department_name: '',
    section_id: null,
    can_request_medication: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchUserInfo = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const res = await axios.get('/api/users/me');
      setUserInfo({
        role: res.data.role?.toLowerCase() || '',
        department_id: res.data.department_id ?? null,
        department_name: res.data.department_name?.toLowerCase() || '',
        section_id: res.data.section_id ?? null,
        can_request_medication: Boolean(res.data.can_request_medication),
      });
    } catch (err) {
      console.error('❌ Failed to load user info:', err);
      setError(tr('errors.loadUser'));
    } finally {
      setIsLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    let isSubscribed = true;

    const loadUserInfo = async () => {
      try {
        await fetchUserInfo();
      } catch (err) {
        if (isSubscribed) {
          console.error('❌ Failed to fetch user info on mount:', err);
        }
      }
    };

    loadUserInfo();

    return () => {
      isSubscribed = false;
    };
  }, [fetchUserInfo]);

  const visibleGroups = useMemo(() => {
    return ACTION_GROUPS.map((group) => ({
      ...group,
      actions: group.actions.filter((action) => {
        const matchesRole = !action.roles || action.roles.includes(userInfo.role);
        const passesPredicate = action.predicate ? action.predicate(userInfo) : true;
        return matchesRole && passesPredicate;
      }),
    })).filter((group) => group.actions.length > 0);
  }, [userInfo]);

  const totalActionCount = useMemo(
    () =>
      visibleGroups.reduce((count, group) => {
        return count + group.actions.length;
      }, 0),
    [visibleGroups]
  );

  const handleNavigate = (path) => {
    navigate(path);
  };

  const recommendedActions = useMemo(() => {
    const flattened = visibleGroups.flatMap((group) =>
      group.actions.map((action) => ({
        ...action,
        groupTitleKey: group.titleKey,
      }))
    );

    const featured = flattened.filter((action) => action.featured);
    if (featured.length > 0) {
      return featured.slice(0, 3);
    }

    return flattened.slice(0, 3);
  }, [visibleGroups]);

  const renderActionCard = (action, isFeatured = false) => {
    const Icon = action.icon;
    const description = action.descriptionKey ? t(action.descriptionKey) : '';

    return (
      <button
        key={action.path}
        type="button"
        onClick={() => handleNavigate(action.path)}
        className={`${BASE_BUTTON_STYLE} ${action.buttonClassName} text-left transition-transform duration-150 hover:-translate-y-0.5`}
        aria-label={t(action.ariaLabelKey)}
      >
        <div className="flex items-start gap-3">
          {Icon && (
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white shadow-inner ${
                isFeatured ? 'ring-2 ring-white/40' : ''
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold leading-tight">{t(action.labelKey)}</span>
              {isFeatured && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                  {tr('recommended.badge')}
                </span>
              )}
            </div>
            {description && (
              <p className="mt-1 text-sm leading-snug text-white/90">{description}</p>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <>
      <Navbar />
      <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-white">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-10 top-8 h-32 w-32 rounded-full bg-indigo-200/40 blur-3xl" aria-hidden="true" />
          <div className="absolute right-10 bottom-20 h-40 w-40 rounded-full bg-blue-200/30 blur-3xl" aria-hidden="true" />
        </div>

        <div className="relative mx-auto max-w-6xl space-y-7 px-6 py-10">
          <header className="flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-indigo-50 via-white to-blue-50/60 p-6 shadow-md ring-1 ring-indigo-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {t('pageTitles.requestTypeSelector')}
                  <HelpTooltip text={tr('tooltips.stepOne')} />
                </h1>
                <p className="mt-1 text-sm text-gray-700">{tr('intro')}</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-700 shadow-sm">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {tr('summary.tagline')}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-sm text-indigo-900">
              {userInfo.role && (
                <span className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-indigo-100">
                  <ShieldCheck className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                  {tr('summary.role', { value: userInfo.role })}
                </span>
              )}
              {userInfo.department_name && (
                <span className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-indigo-100">
                  <Boxes className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                  {tr('summary.department', { value: userInfo.department_name })}
                </span>
              )}
              {userInfo.section_id && (
                <span className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-indigo-100">
                  <ClipboardList className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                  {tr('summary.section', { value: userInfo.section_id })}
                </span>
              )}
              <span className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-indigo-100">
                <Pill className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                {userInfo.can_request_medication
                  ? tr('summary.medicationAccessEnabled')
                  : tr('summary.medicationAccessDisabled')}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-indigo-100 backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-indigo-700">{tr('summary.accessTitle')}</p>
                <p className="mt-1 text-sm text-gray-700">
                  {tr('summary.accessDetails', {
                    count: totalActionCount,
                    groups: visibleGroups.length,
                  })}
                </p>
              </div>
              <div className="rounded-2xl bg-indigo-600 p-4 text-indigo-50 shadow-md ring-1 ring-indigo-200/40">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {tr('summary.quickTipTitle')}
                </div>
                <p className="mt-1 text-sm text-indigo-100">{tr('summary.quickTipCopy')}</p>
              </div>
              <div className="rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-indigo-100 backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
                  <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                  {tr('summary.recommendationTitle')}
                </div>
                <p className="mt-1 text-sm text-gray-700">{tr('summary.recommendationCopy')}</p>
              </div>
            </div>
          </header>

          {isLoading && (
            <div className="text-center text-gray-500" role="status" aria-live="polite">
              {tr('loading')}
            </div>
          )}

          {!isLoading && error && (
            <div
              className="mb-6 rounded-2xl border border-red-200/80 bg-red-50/90 p-5 text-sm text-red-700 shadow-sm backdrop-blur"
              role="alert"
            >
              <p className="font-semibold">{tr('errors.heading')}</p>
              <p className="mt-1">{error}</p>
              <button
                type="button"
                onClick={fetchUserInfo}
                className="mt-3 inline-flex items-center rounded-full bg-red-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
              >
                {tr('actions.retry')}
              </button>
            </div>
          )}

          {!isLoading && !error && visibleGroups.length === 0 && (
            <div className="rounded-2xl border border-yellow-200/80 bg-yellow-50/90 p-5 text-sm text-yellow-800 shadow-sm backdrop-blur">
              {tr('emptyState')}
            </div>
          )}

          {!isLoading && !error && recommendedActions.length > 0 && (
            <section className="relative overflow-hidden rounded-2xl border border-indigo-100/70 bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 p-5 shadow-xl shadow-indigo-100/50">
              <div className="pointer-events-none absolute -left-10 top-1/3 h-32 w-32 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
              <div className="pointer-events-none absolute -right-16 -bottom-10 h-40 w-40 rounded-full bg-blue-300/20 blur-3xl" aria-hidden="true" />
              <div className="relative flex items-center gap-2 text-indigo-50">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-indigo-100">
                    {tr('recommended.subtitle')}
                  </p>
                  <h2 className="text-lg font-semibold">{tr('recommended.title')}</h2>
                </div>
              </div>
              <div className="relative mt-4 grid gap-3 md:grid-cols-3">
                {recommendedActions.map((action) => renderActionCard(action, true))}
              </div>
            </section>
          )}

          <div className="space-y-6">
            {visibleGroups.map((group) => (
              <section
                key={group.titleKey}
                aria-labelledby={`${group.titleKey.replace(/\./g, '-')}-heading`}
                className="rounded-2xl bg-white/90 p-5 shadow-sm ring-1 ring-indigo-100 backdrop-blur"
              >
                <div className="mb-4 flex items-center justify-between text-left">
                  <div>
                    <h2
                      id={`${group.titleKey.replace(/\./g, '-')}-heading`}
                      className="text-lg font-semibold text-gray-800"
                    >
                      {t(group.titleKey)}
                    </h2>
                    <p className="text-sm text-gray-600">{t(group.descriptionKey)}</p>
                  </div>
                  <div className="hidden items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 md:inline-flex">
                    <span className="inline-block h-2 w-2 rounded-full bg-indigo-400" aria-hidden="true" />
                    {t('recommended.subtitle')}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {group.actions.map((action) => renderActionCard(action))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default RequestTypeSelector;