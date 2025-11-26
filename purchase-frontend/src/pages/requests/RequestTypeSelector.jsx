// src/pages/requests/RequestTypeSelector.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
        path: '/requests/stock',
        roles: ['warehousemanager', 'warehouse_manager', 'warehouse_keeper'],
        buttonClassName: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400',
      },
      {
        labelKey: 'requestTypeSelector.actions.newStockItem.label',
        ariaLabelKey: 'requestTypeSelector.actions.newStockItem.aria',
        path: '/requests/stock-item',
        roles: ['warehousemanager', 'warehouse_manager'],
        buttonClassName: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400',
      },
      {
        labelKey: 'requestTypeSelector.actions.warehouseTemplates.label',
        ariaLabelKey: 'requestTypeSelector.actions.warehouseTemplates.aria',
        path: '/warehouse-supply-templates',
        roles: ['warehousemanager', 'warehouse_manager', 'warehouse_keeper'],
        buttonClassName: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400',
      },
      {
        labelKey: 'requestTypeSelector.actions.issueCustody.label',
        ariaLabelKey: 'requestTypeSelector.actions.issueCustody.aria',
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
      },
      {
        labelKey: 'requestTypeSelector.actions.issuedCustodies.label',
        ariaLabelKey: 'requestTypeSelector.actions.issuedCustodies.aria',
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
      },
      {
        labelKey: 'requestTypeSelector.actions.submittedSupply.label',
        ariaLabelKey: 'requestTypeSelector.actions.submittedSupply.aria',
        path: '/warehouse-supply-requests',
        roles: ['warehousemanager', 'warehouse_manager', 'warehouse_keeper'],
        buttonClassName: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300',
      },
      {
        labelKey: 'requestTypeSelector.actions.itemRecalls.label',
        ariaLabelKey: 'requestTypeSelector.actions.itemRecalls.aria',
        path: '/item-recalls',
        buttonClassName: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-400',
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
        path: '/requests/warehouse-supply',
        buttonClassName: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300',
      },
      {
        labelKey: 'requestTypeSelector.actions.nonStock.label',
        ariaLabelKey: 'requestTypeSelector.actions.nonStock.aria',
        path: '/requests/non-stock',
        buttonClassName: 'bg-green-600 hover:bg-green-700 focus:ring-green-400',
      },
      {
        labelKey: 'requestTypeSelector.actions.medicalDevice.label',
        ariaLabelKey: 'requestTypeSelector.actions.medicalDevice.aria',
        path: '/requests/medical-device',
        buttonClassName: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-400',
      },
      {
        labelKey: 'requestTypeSelector.actions.medication.label',
        ariaLabelKey: 'requestTypeSelector.actions.medication.aria',
        path: '/requests/medication',
        buttonClassName: 'bg-pink-600 hover:bg-pink-700 focus:ring-pink-400',
        predicate: ({ can_request_medication, role }) =>
          Boolean(can_request_medication) || role === 'scm',
      },
      {
        labelKey: 'requestTypeSelector.actions.itRequest.label',
        ariaLabelKey: 'requestTypeSelector.actions.itRequest.aria',
        path: '/requests/it-items',
        buttonClassName: 'bg-teal-600 hover:bg-teal-700 focus:ring-teal-400',
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
        path: '/requests/maintenance',
        roles: ['technician'],
        buttonClassName: 'bg-red-600 hover:bg-red-700 focus:ring-red-400',
      },
      {
        labelKey: 'requestTypeSelector.actions.maintenanceSupply.label',
        ariaLabelKey: 'requestTypeSelector.actions.maintenanceSupply.aria',
        path: '/requests/maintenance-warehouse-supply',
        roles: ['technician'],
        buttonClassName: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300',
      },
      {
        labelKey: 'requestTypeSelector.actions.maintenanceApprovals.label',
        ariaLabelKey: 'requestTypeSelector.actions.maintenanceApprovals.aria',
        path: '/approvals',
        roles: ['hod', 'requester', 'warehouse_keeper', 'warehousemanager', 'cmo', 'coo', 'scm'],
        buttonClassName: 'bg-orange-700 hover:bg-orange-800 focus:ring-orange-400',
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
        path: '/approvals',
        roles: ['hod', 'cmo', 'coo', 'cfo', 'scm', 'medicaldevices', 'warehousemanager', 'warehouse_manager'],
        buttonClassName: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-400',
      },
      {
        labelKey: 'requestTypeSelector.actions.custodyApprovals.label',
        ariaLabelKey: 'requestTypeSelector.actions.custodyApprovals.aria',
        path: '/custody/approvals',
        buttonClassName: 'bg-indigo-500 hover:bg-indigo-600 focus:ring-indigo-300',
      },
      {
        labelKey: 'requestTypeSelector.actions.approvalHistory.label',
        ariaLabelKey: 'requestTypeSelector.actions.approvalHistory.aria',
        path: '/approval-history',
        roles: ['hod', 'cmo', 'coo', 'cfo', 'scm', 'medicaldevices', 'admin', 'warehousemanager', 'warehouse_manager'],
        buttonClassName: 'bg-gray-700 hover:bg-gray-800 focus:ring-gray-400',
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
        path: '/register',
        roles: ['admin', 'scm'],
        buttonClassName: 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-300 text-gray-900',
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

  const handleNavigate = (path) => {
    navigate(path);
  };

  return (
    <>
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">
        <header className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">
            {t('pageTitles.requestTypeSelector')}
            <HelpTooltip text={tr('tooltips.stepOne')} />
          </h1>
          <p className="mt-2 text-sm text-gray-600">{tr('intro')}</p>
        </header>

        {isLoading && (
          <div className="text-center text-gray-500" role="status" aria-live="polite">
            {tr('loading')}
          </div>
        )}

        {!isLoading && error && (
          <div
            className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            role="alert"
          >
            <p className="font-semibold">{tr('errors.heading')}</p>
            <p className="mt-1">{error}</p>
            <button
              type="button"
              onClick={fetchUserInfo}
              className="mt-3 inline-flex items-center rounded bg-red-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
            >
              {tr('actions.retry')}
            </button>
          </div>
        )}

        {!isLoading && !error && visibleGroups.length === 0 && (
          <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            {tr('emptyState')}
          </div>
        )}

        <div className="space-y-8">
          {visibleGroups.map((group) => (
            <section key={group.titleKey} aria-labelledby={`${group.titleKey.replace(/\./g, '-')}-heading`}>
              <div className="mb-3 text-left">
                <h2
                  id={`${group.titleKey.replace(/\./g, '-')}-heading`}
                  className="text-lg font-semibold text-gray-800"
                >
                  {t(group.titleKey)}
                </h2>
                <p className="text-sm text-gray-600">{t(group.descriptionKey)}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {group.actions.map((action) => (
                  <button
                    key={action.path}
                    type="button"
                    onClick={() => handleNavigate(action.path)}
                    className={`${BASE_BUTTON_STYLE} ${action.buttonClassName}`}
                    aria-label={t(action.ariaLabelKey)}
                  >
                    {t(action.labelKey)}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
};

export default RequestTypeSelector;