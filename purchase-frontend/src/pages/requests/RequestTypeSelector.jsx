// src/pages/requests/RequestTypeSelector.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import axios from '../../api/axios';
import { HelpTooltip } from '../../components/ui/HelpTooltip';

const BASE_BUTTON_STYLE =
  'block w-full py-2 px-4 rounded text-white font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm';

const ACTION_GROUPS = [
  {
    title: 'Warehouse Operations',
    description: 'Stock control tasks available to warehouse staff.',
    actions: [
      {
        label: 'Stock Request',
        path: '/requests/stock',
        roles: ['warehousemanager', 'warehouse_manager', 'warehouse_keeper'],
        ariaLabel: 'Stock Request',
        buttonClassName: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400',
      },
      {
        label: 'New Stock Item',
        path: '/requests/stock-item',
        roles: ['warehousemanager', 'warehouse_manager'],
        ariaLabel: 'New Stock Item',
        buttonClassName: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400',
      },
      {
        label: 'Warehouse Supply Templates',
        path: '/warehouse-supply-templates',
        roles: ['warehousemanager', 'warehouse_manager', 'warehouse_keeper'],
        ariaLabel: 'Manage Warehouse Supply Templates',
        buttonClassName: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400',
      },
      {
        label: 'Submitted Warehouse Supply Requests',
        path: '/warehouse-supply-requests',
        roles: ['warehousemanager', 'warehouse_manager', 'warehouse_keeper'],
        ariaLabel: 'View Warehouse Supply Requests',
        buttonClassName: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300',
      },
    ],
  },
  {
    title: 'Create a Request',
    description: 'Start a new procurement request for your department.',
    actions: [
      {
        label: 'Warehouse Supply Request',
        path: '/requests/warehouse-supply',
        ariaLabel: 'Warehouse Supply Request',
        buttonClassName: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300',
      },
      {
        label: 'Non-Stock Request',
        path: '/requests/non-stock',
        ariaLabel: 'Non-Stock Request',
        buttonClassName: 'bg-green-600 hover:bg-green-700 focus:ring-green-400',
      },
      {
        label: 'Medical Device Request',
        path: '/requests/medical-device',
        ariaLabel: 'Medical Device Request',
        buttonClassName: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-400',
      },
      {
        label: 'Medication Request',
        path: '/requests/medication',
        ariaLabel: 'Medication Request',
        buttonClassName: 'bg-pink-600 hover:bg-pink-700 focus:ring-pink-400',
        predicate: ({ can_request_medication }) => Boolean(can_request_medication),
      },
      {
        label: 'IT Item Request',
        path: '/requests/it-items',
        ariaLabel: 'IT Item Request',
        buttonClassName: 'bg-teal-600 hover:bg-teal-700 focus:ring-teal-400',
      },
    ],
  },
  {
    title: 'Maintenance',
    description: 'Maintenance submissions and follow-up.',
    actions: [
      {
        label: 'Maintenance Request',
        path: '/requests/maintenance',
        roles: ['technician'],
        ariaLabel: 'Maintenance Request',
        buttonClassName: 'bg-red-600 hover:bg-red-700 focus:ring-red-400',
      },
      {
        label: 'Maintenance Warehouse Supply Request',
        path: '/requests/maintenance-warehouse-supply',
        roles: ['technician'],
        ariaLabel: 'Maintenance Warehouse Supply Request',
        buttonClassName: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300',
      },
      {
        label: 'Maintenance Approvals',
        path: '/approvals/maintenance',
        roles: ['hod', 'requester', 'cmo', 'coo', 'scm'],
        ariaLabel: 'Maintenance Approvals',
        buttonClassName: 'bg-orange-700 hover:bg-orange-800 focus:ring-orange-400',
      },
    ],
  },
  {
    title: 'Approvals & History',
    description: 'Review and approve pending requests or revisit historical submissions.',
    actions: [
      {
        label: 'Approvals Panel',
        path: '/approvals',
        roles: ['hod', 'cmo', 'coo', 'cfo', 'scm', 'medicaldevices', 'warehousemanager', 'warehouse_manager'],
        ariaLabel: 'Approvals Panel',
        buttonClassName: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-400',
      },
      {
        label: 'Approval History',
        path: '/approval-history',
        roles: ['hod', 'cmo', 'coo', 'cfo', 'scm', 'medicaldevices', 'admin', 'warehousemanager', 'warehouse_manager'],
        ariaLabel: 'Approval History',
        buttonClassName: 'bg-gray-700 hover:bg-gray-800 focus:ring-gray-400',
      },
    ],
  },
  {
    title: 'Administration',
    description: 'Tools reserved for administrators.',
    actions: [
      {
        label: 'Register New User',
        path: '/register',
        roles: ['admin', 'scm'],
        ariaLabel: 'Register New User',
        buttonClassName: 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-300 text-gray-900',
      },
    ],
  },
];

const RequestTypeSelector = () => {
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
      setError('We could not load your user details. Please retry.');
    } finally {
      setIsLoading(false);
    }
  }, []);

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
            Select Request Type
            <HelpTooltip text="Step 1: Choose the type of request you want to submit." />
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Explore the available actions below. Your access is based on your assigned role
            and permissions.
          </p>
        </header>

        {isLoading && (
          <div className="text-center text-gray-500" role="status" aria-live="polite">
            Loading your access options...
          </div>
        )}

        {!isLoading && error && (
          <div
            className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            role="alert"
          >
            <p className="font-semibold">Unable to load user information.</p>
            <p className="mt-1">{error}</p>
            <button
              type="button"
              onClick={fetchUserInfo}
              className="mt-3 inline-flex items-center rounded bg-red-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && visibleGroups.length === 0 && (
          <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            No available actions were found for your role. Please contact an administrator if you
            believe this is an error.
          </div>
        )}

        <div className="space-y-8">
          {visibleGroups.map((group) => (
            <section key={group.title} aria-labelledby={`${group.title.replace(/\s+/g, '-')}-heading`}>
              <div className="mb-3 text-left">
                <h2
                  id={`${group.title.replace(/\s+/g, '-')}-heading`}
                  className="text-lg font-semibold text-gray-800"
                >
                  {group.title}
                </h2>
                <p className="text-sm text-gray-600">{group.description}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {group.actions.map((action) => (
                  <button
                    key={action.path}
                    type="button"
                    onClick={() => handleNavigate(action.path)}
                    className={`${BASE_BUTTON_STYLE} ${action.buttonClassName}`}
                    aria-label={action.ariaLabel}
                  >
                    {action.label}
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