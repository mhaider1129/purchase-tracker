import React, { useCallback, useEffect, useMemo, useState } from 'react';
import saveAs from 'file-saver';
import { useLocation, useNavigate } from 'react-router-dom';
import ContractForm from '../components/ContractForm';
import ContractEvaluationForm from '../components/ContractEvaluationForm';
import api from '../api/axios';
import { listContractDocuments } from '../api/contracts';
import { useAuth } from '../hooks/useAuth';

const parseJson = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (err) {
      return null;
    }
  }

  if (typeof value === 'object') {
    return value;
  }

  return null;
};

const normalizeComponents = (components) => {
  if (!Array.isArray(components)) {
    return [];
  }

  return components
    .map((component) => {
      if (typeof component === 'string') {
        const name = component.trim();
        return name ? { name, score: null } : null;
      }

      if (component && typeof component === 'object') {
        const name = (component.name || component.component || component.label || '').trim();
        const rawScore = component.score ?? component.value ?? null;
        const numericScore = Number(rawScore);
        return name ? { name, score: Number.isFinite(numericScore) ? numericScore : null } : null;
      }

      return null;
    })
    .filter(Boolean);
};

const calculateOverallScore = (components) => {
  const numericScores = components
    .map((component) => (Number.isFinite(component.score) ? component.score : null))
    .filter((score) => score !== null);

  if (numericScores.length === 0) {
    return null;
  }

  const total = numericScores.reduce((sum, value) => sum + value, 0);
  return Number((total / numericScores.length).toFixed(2));
};

const normalizeEvaluation = (evaluation) => {
  const parsedCriteria = parseJson(evaluation.evaluation_criteria);
  const base = typeof parsedCriteria === 'object' && parsedCriteria !== null ? parsedCriteria : {};
  const components = normalizeComponents(base.components || base.criteria || base.items || []);
  const overallScore =
    base.overallScore !== undefined && base.overallScore !== null
      ? Number(base.overallScore)
      : calculateOverallScore(components);

  return {
    ...evaluation,
    evaluation_criteria: {
      ...base,
      criterionId: base.criterionId || evaluation.criterion_id || null,
      criterionName: base.criterionName || base.name || evaluation.criterion_name || null,
      criterionRole: base.criterionRole || base.role || evaluation.criterion_role || null,
      components,
      overallScore: Number.isFinite(overallScore) ? Number(overallScore.toFixed(2)) : null,
    },
  };
};

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'legal_review', label: 'Legal Review' },
  { value: 'finance_review', label: 'Finance Review' },
  { value: 'technical_review', label: 'Technical Review' },
  { value: 'executive_approval', label: 'Executive Approval' },
  { value: 'sent_for_signature', label: 'Sent for Signature' },
  { value: 'active', label: 'Active' },
  { value: 'expiring_soon', label: 'Expiring Soon' },
  { value: 'renewed', label: 'Renewed' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'archived', label: 'Archived' },
];

const renewalOptions = [
  { value: 'all', label: 'All renewals' },
  { value: 'expiring', label: 'Expiring soon' },
  { value: 'expired', label: 'Expired' },
];

const EXPIRING_SOON_THRESHOLD_DAYS = 30;

const CURRENCY_OPTIONS = ['IQD', 'USD'];
const USD_TO_IQD_RATE = Number(process.env.REACT_APP_USD_TO_IQD_RATE || 1600);

const normalizeCurrency = (currency) => {
  const normalized = String(currency || 'IQD').trim().toUpperCase();
  return CURRENCY_OPTIONS.includes(normalized) ? normalized : 'IQD';
};

const toIqd = (amount, currency) => {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return null;
  return normalizeCurrency(currency) === 'USD' ? numeric * USD_TO_IQD_RATE : numeric;
};

const statStyles = {
  active: {
    gradient: 'from-emerald-500/90 to-emerald-600',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.07 7.1a1 1 0 0 1-1.42.006L3.29 9.89a1 1 0 0 1 1.42-1.408l3.093 3.117 6.362-6.387a1 1 0 0 1 1.54.079Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  expiring: {
    gradient: 'from-amber-400/90 to-amber-500',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10 2a1 1 0 0 1 .894.553l7 14A1 1 0 0 1 17 18H3a1 1 0 0 1-.894-1.447l7-14A1 1 0 0 1 10 2Zm0 4a1 1 0 0 0-1 1v3.382l-1.447 1.447a1 1 0 1 0 1.414 1.414l2-2A1 1 0 0 0 11 10V7a1 1 0 0 0-1-1Zm0 9a1.25 1.25 0 1 0 0-2.5A1.25 1.25 0 0 0 10 15Z" />
      </svg>
    ),
  },
  expired: {
    gradient: 'from-rose-500/90 to-rose-600',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  renewal: {
    gradient: 'from-blue-500/90 to-indigo-600',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M6 2a1 1 0 1 0 0 2h8a2 2 0 0 1 2 2v1.09A6.5 6.5 0 1 0 9.25 16H6a1 1 0 1 0 0 2h8a4 4 0 0 0 4-4V6a4 4 0 0 0-4-4H6Zm9.5 10.5a4.5 4.5 0 1 1-8.17-2.46l1.6 1.6a1 1 0 0 0 1.41-1.42L8.74 8.12A4.5 4.5 0 0 1 15.5 12.5Z" />
      </svg>
    ),
  },
  paid: {
    gradient: 'from-cyan-500/90 to-sky-600',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M4.5 4A1.5 1.5 0 0 1 6 2.5h8A1.5 1.5 0 0 1 15.5 4v1.25A3.75 3.75 0 0 1 12 9h-1v2h1a1 1 0 0 1 0 2h-1v1a1 1 0 1 1-2 0v-1H8a1 1 0 1 1 0-2h1V9H8A3.75 3.75 0 0 1 4.5 5.25V4Z" />
      </svg>
    ),
  },
};

const statusStyles = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
  under_review: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  legal_review: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  technical_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  finance_review: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  executive_approval: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  sent_for_signature: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  expiring_soon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  renewed: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  terminated: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  archived: 'bg-gray-200 text-gray-700 dark:bg-gray-800/70 dark:text-gray-300',
};

const initialFormState = {
  title: '',
  vendor: '',
  reference_number: '',
  signing_date: '',
  start_date: '',
  end_date: '',
  contract_type: 'purchasing',
  status: 'draft',
  contract_value: '',
  amount_paid: '',
  description: '',
  delivery_terms: '',
  warranty_terms: '',
  performance_management: '',
  commercial_terms: '',
  compliance_legal_terms: '',
  financial_payment_control: '',
  risk_dispute_management: '',
  digital_attachments_tracking: '',
  institute: 'Warith International Cancer Institute',
  contract_category: '',
  renewal_type: '',
  renewal_notice_days: '',
  contract_owner: '',
  currency: 'IQD',
  estimated_contract_value: '',
  actual_consumed_value: '',
  first_party: 'Warith International Cancer Institute',
  second_party: '',
  authorized_signatory: '',
  vendor_contact_person: '',
  vendor_contact_email: '',
  vendor_contact_phone: '',
  vendor_tax_id: '',
  vendor_address: '',
  scope_summary: '',
  deliverables: '',
  technical_specifications: '',
  service_coverage: '',
  exclusions: '',
  sla_requirements: '',
  payment_terms_details: '',
  delivery_logistics_details: '',
  sla_details: '',
  penalties_incentives: '',
  change_management_terms: '',
  termination_exit_terms: '',
  alert_rules: '',

  commercial_contract_value: '',
  commercial_unit_pricing: '',
  commercial_price_validity: '',
  commercial_discount_structure: '',
  commercial_vat_tax: '',
  commercial_currency_exchange_clause: '',
  commercial_escalation_clause: '',
  commercial_minimum_order_quantity: '',
  commercial_delivery_charges: '',
  delivery_location_department_id: '',
  delivery_incoterms: '',
  delivery_lead_time_days: '',
  delivery_emergency_terms: '',
  delivery_shipping_responsibility: '',
  delivery_customs_clearance_responsibility: '',
  delivery_packaging_requirements: [],
  delivery_transportation_requirements: [],
  delivery_partial_allowed: '',
  sla_response_time: '',
  sla_resolution_time: '',
  sla_uptime_requirement: '',
  sla_preventive_maintenance_frequency: '',
  sla_emergency_support_availability: '',
  sla_spare_parts_availability: '',
  sla_escalation_path_user: '',
  payment_methods: [],
  payment_period: '',
  payment_advance_percentage: '',
  payment_retention: '',
  payment_milestone_details: '',
  payment_invoice_requirements: '',
  payment_partial_allowed: '',
  payment_penalty_rate_percent: '',
  payment_penalty_timeline: 'day',
  payment_penalty_max_percent: '',
  end_user_department_id: '',
  contract_manager_id: '',
  technical_department_ids: [],
  supplier_id: '',
  source_request_id: '',
};

const ContractsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isCreatePage = location.pathname === '/contracts/new';
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState('all');
  const [renewalFilter, setRenewalFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [formState, setFormState] = useState(initialFormState);
  const [editingId, setEditingId] = useState(null);
  const [viewingContract, setViewingContract] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [archivingId, setArchivingId] = useState(null);
  const [unarchivingId, setUnarchivingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [renewingId, setRenewingId] = useState(null);

  const [checklistSavingId, setChecklistSavingId] = useState(null);
  const [detailTab, setDetailTab] = useState('documents');
  const [contractItems, setContractItems] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [stockItemsError, setStockItemsError] = useState('');
  const [contractItemForm, setContractItemForm] = useState({
    item_id: '',
    item_name: '',
    unit: '',
    contracted_price: '',
    currency: '',
    minimum_order_quantity: '',
    lead_time_days: '',
    warranty_terms: '',
    price_valid_from: '',
    price_valid_to: '',
    requested_quantity: '',
    delivered_quantity: '',
    notes: '',
    is_active: true,
  });
  const [contractItemError, setContractItemError] = useState('');
  const [savingContractItem, setSavingContractItem] = useState(false);
  const [approvals, setApprovals] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [, setContractDocuments] = useState([]);
  const [consumption, setConsumption] = useState(null);
  const [risk, setRisk] = useState(null);
  const [riskHistory, setRiskHistory] = useState([]);
  const [riskDashboard, setRiskDashboard] = useState(null);
  const [aiExtractions, setAiExtractions] = useState([]);
  const [aiMessage, setAiMessage] = useState('');
  const [obligations, setObligations] = useState([]);
  const [renewalEvents, setRenewalEvents] = useState([]);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [consumptionEntries, setConsumptionEntries] = useState([]);
  const [contractPayments, setContractPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState('');
  const [addingPayment, setAddingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_date: '', notes: '' });

  const [departments, setDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [departmentsError, setDepartmentsError] = useState('');

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');

  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [suppliersError, setSuppliersError] = useState('');

  const [evaluations, setEvaluations] = useState([]);
  const [evaluationsLoading, setEvaluationsLoading] = useState(false);
  const [evaluationsError, setEvaluationsError] = useState('');
  const [deletingEvaluationId, setDeletingEvaluationId] = useState(null);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);

  const { user } = useAuth();
  const normalizedUserRole = (user?.role || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const canInitiateEvaluations = ['SCM', 'COO', 'ADMIN', 'CONTRACTMANAGER'].includes(normalizedUserRole);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 300);

    return () => clearTimeout(handler);
  }, [searchInput]);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setError('');

    const params = {};
    if (statusFilter !== 'all') {
      params.status = statusFilter;
    }
    if (searchTerm) {
      params.search = searchTerm;
    }

    try {
      const { data } = await api.get('/contracts', { params });
      setContracts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load contracts', err);
      setError(err?.response?.data?.message || 'Unable to load contracts. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  useEffect(() => {
    let isMounted = true;

    const loadDepartments = async () => {
      setDepartmentsLoading(true);
      setDepartmentsError('');
      try {
        const { data } = await api.get('/departments');
        if (!isMounted) return;
        setDepartments(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load departments', err);
        if (!isMounted) return;
        setDepartments([]);
        setDepartmentsError(
          err?.response?.data?.message || 'Failed to load departments. Please try again later.'
        );
      } finally {
        if (isMounted) {
          setDepartmentsLoading(false);
        }
      }
    };

    loadDepartments();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      setUsersLoading(true);
      setUsersError('');
      try {
        const { data } = await api.get('/users');
        if (!isMounted) return;
        const activeUsers = Array.isArray(data)
          ? data.filter((userRecord) => userRecord?.is_active)
          : [];
        setUsers(activeUsers);
      } catch (err) {
        console.error('Failed to load users', err);
        if (!isMounted) return;
        setUsers([]);
        if (err?.response?.status === 403) {
          setUsersError(
            'You do not have permission to view the users list. Enter a contract manager ID manually if needed.'
          );
        } else {
          setUsersError('Failed to load users. Please try again later.');
        }
      } finally {
        if (isMounted) {
          setUsersLoading(false);
        }
      }
    };

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSuppliers = async () => {
      setSuppliersLoading(true);
      setSuppliersError('');
      try {
        const { data } = await api.get('/suppliers');
        if (!isMounted) return;
        setSuppliers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load suppliers', err);
        if (!isMounted) return;
        setSuppliers([]);
        setSuppliersError(
          err?.response?.data?.message || 'Failed to load suppliers. Please try again later.'
        );
      } finally {
        if (isMounted) {
          setSuppliersLoading(false);
        }
      }
    };

    loadSuppliers();

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshSuppliers = useCallback(async () => {
    try {
      const { data } = await api.get('/suppliers');
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to refresh suppliers', err);
    }
  }, []);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    const contractId = editingId || viewingContract?.id;
    if (!contractId) return;
    api.get(`/contracts/${contractId}/items`).then(r => setContractItems(r.data || [])).catch(() => setContractItems([]));
    setContractItemError('');
    api.get(`/contracts/${contractId}/approvals`).then(r => setApprovals(r.data || [])).catch(() => setApprovals([]));
    api.get(`/contracts/${contractId}/document-checklist`).then(r => setChecklist(r.data || [])).catch(() => setChecklist([]));
    api.get(`/contracts/${contractId}/obligations`).then(r=>setObligations(r.data||[])).catch(()=>setObligations([]));
    api.get(`/contracts/${contractId}/renewal-events`).then(r=>setRenewalEvents(r.data||[])).catch(()=>setRenewalEvents([]));
    api.get(`/contracts/${contractId}/financial-summary`).then(r=>setFinancialSummary(r.data||null)).catch(()=>setFinancialSummary(null));
    api.get(`/contracts/${contractId}/invoices`).then(r=>setInvoices(r.data||[])).catch(()=>setInvoices([]));
    api.get(`/contracts/${contractId}/payments`).then(r=>setPayments(r.data||[])).catch(()=>setPayments([]));
    api.get(`/contracts/${contractId}/consumption-entries`).then(r=>setConsumptionEntries(r.data||[])).catch(()=>setConsumptionEntries([]));
    api.get(`/contracts/${contractId}/risk`).then(r=>setRisk(r.data||null)).catch(()=>setRisk(null));
    api.get(`/contracts/${contractId}/risk/history`).then(r=>setRiskHistory(r.data||[])).catch(()=>setRiskHistory([]));
    api.get('/contracts/dashboard/risk').then(r=>setRiskDashboard(r.data||null)).catch(()=>setRiskDashboard(null));
    api.get(`/contracts/${contractId}/ai-extractions`).then(r=>setAiExtractions(r.data||[])).catch(()=>setAiExtractions([]));
    listContractDocuments(contractId).then(setContractDocuments).catch(() => setContractDocuments([]));
    api.get(`/contracts/${contractId}/consumption`).then(r => setConsumption(r.data || null)).catch(() => setConsumption(null));
    api.get(`/contracts/${contractId}/risk`).then(r => setRisk(r.data || null)).catch(() => setRisk(null));
  }, [editingId, viewingContract]);


  const refreshContractItems = useCallback(async (contractId) => {
    if (!contractId) {
      setContractItems([]);
      return;
    }
    const { data } = await api.get(`/contracts/${contractId}/items`);
    setContractItems(Array.isArray(data) ? data : []);
  }, []);

  const resetContractItemForm = () => {
    setContractItemForm({
      item_id: '',
      item_name: '',
      unit: '',
      contracted_price: '',
      currency: viewingContract?.currency || formState.currency || '',
      minimum_order_quantity: '',
      lead_time_days: '',
      warranty_terms: '',
      price_valid_from: '',
      price_valid_to: '',
      requested_quantity: '',
      delivered_quantity: '',
      notes: '',
      is_active: true,
    });
  };


  useEffect(() => {
    const fetchStockItems = async () => {
      setStockItemsError('');
      try {
        const { data } = await api.get('/stock-items');
        setStockItems(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load stock items for contracts', err);
        setStockItems([]);
        setStockItemsError('Stock item catalog is unavailable. You can still define a contracted item by name.');
      }
    };

    fetchStockItems();
  }, []);

  const handleContractStockItemSelection = (event) => {
    const stockItemId = event.target.value;
    setContractItemForm((current) => {
      if (!stockItemId) {
        return { ...current, item_id: '' };
      }

      const selectedStockItem = stockItems.find((item) => String(item.id) === String(stockItemId));
      return {
        ...current,
        item_id: stockItemId,
        item_name: selectedStockItem?.name || current.item_name,
        unit: selectedStockItem?.unit || current.unit,
      };
    });
  };

  const handleContractItemInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setContractItemForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleCreateContractItem = async (event) => {
    event.preventDefault();
    const contractId = editingId || viewingContract?.id;
    if (!contractId) return;
    if (!contractItemForm.item_name.trim()) {
      setContractItemError('Item name is required.');
      return;
    }
    setSavingContractItem(true);
    setContractItemError('');
    try {
      await api.post(`/contracts/${contractId}/items`, {
        ...contractItemForm,
        item_id: contractItemForm.item_id || null,
        item_name: contractItemForm.item_name.trim(),
        currency: contractItemForm.currency || viewingContract?.currency || formState.currency || 'IQD',
      });
      resetContractItemForm();
      await Promise.all([refreshContractItems(contractId), fetchContracts()]);
      setSuccessMessage('Contracted item added. Requesters can select it when linking purchases to this contract.');
    } catch (err) {
      console.error('Failed to add contracted item', err);
      setContractItemError(err?.response?.data?.message || 'Failed to add contracted item.');
    } finally {
      setSavingContractItem(false);
    }
  };

  const fetchEvaluations = useCallback(async (contractId) => {
    if (!contractId) {
      setEvaluations([]);
      return;
    }
    setEvaluationsLoading(true);
    setEvaluationsError('');
    try {
      const { data } = await api.get('/contract-evaluations', {
        params: { contract_id: contractId },
      });
      const normalized = Array.isArray(data) ? data.map(normalizeEvaluation) : [];
      setEvaluations(normalized);
    } catch (err) {
      console.error('Failed to load evaluations', err);
      setEvaluationsError('Unable to load evaluations.');
    } finally {
      setEvaluationsLoading(false);
    }
  }, []);

  const handleViewEvaluation = (evaluationId) => {
    if (!evaluationId) return;
    navigate(`/evaluation-details/${evaluationId}`);
  };

  const handleDeleteEvaluation = async (evaluationId) => {
    if (!evaluationId || !(editingId || viewingContract?.id)) return;

    if (!window.confirm('Delete this evaluation from the contract?')) {
      return;
    }

    setDeletingEvaluationId(evaluationId);
    setEvaluationsError('');

    try {
      await api.delete(`/contract-evaluations/${evaluationId}`);
      const activeContractId = editingId || viewingContract?.id;
      if (activeContractId) {
        await fetchEvaluations(activeContractId);
      }
    } catch (err) {
      console.error('Failed to delete evaluation', err);
      setEvaluationsError(err?.response?.data?.message || 'Unable to delete evaluation.');
    } finally {
      setDeletingEvaluationId(null);
    }
  };

  useEffect(() => {
    const contractId = editingId || viewingContract?.id;
    if (contractId) {
      fetchEvaluations(contractId);
    } else {
      setEvaluations([]);
    }
  }, [editingId, viewingContract, fetchEvaluations]);

  const resetForm = () => {
    setFormState(initialFormState);
    setEditingId(null);
    setViewingContract(null);
    setFormError('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setFormState(initialFormState);
    setFormError('');
  };

  const handleViewContract = (contract) => {
    setViewingContract(contract);
    setEditingId(null);
    setFormState(initialFormState);
  };

  const fetchContractPayments = useCallback(async (contractId) => {
    if (!contractId) {
      setContractPayments([]);
      return;
    }
    setPaymentsLoading(true);
    setPaymentsError('');
    try {
      const { data } = await api.get(`/contracts/${contractId}/payments`);
      setContractPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load contract payments', err);
      setContractPayments([]);
      setPaymentsError(err?.response?.data?.message || 'Failed to load contract payments.');
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  const handleCreatePayment = async (event) => {
    event.preventDefault();
    if (!viewingContract?.id) return;
    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentsError('Payment amount must be a positive number.');
      return;
    }
    setAddingPayment(true);
    setPaymentsError('');
    try {
      await api.post(`/contracts/${viewingContract.id}/payments`, {
        amount,
        payment_date: paymentForm.payment_date || undefined,
        notes: paymentForm.notes.trim() || undefined,
        currency: viewingContract.currency || undefined,
      });
      setPaymentForm({ amount: '', payment_date: '', notes: '' });
      await Promise.all([fetchContractPayments(viewingContract.id), fetchContracts()]);
      const { data: refreshedContract } = await api.get(`/contracts/${viewingContract.id}`);
      setViewingContract(refreshedContract);
    } catch (err) {
      console.error('Failed to register payment', err);
      setPaymentsError(err?.response?.data?.message || 'Failed to register payment.');
    } finally {
      setAddingPayment(false);
    }
  };

  useEffect(() => {
    if (!viewingContract?.id) {
      setContractPayments([]);
      setPaymentForm({ amount: '', payment_date: '', notes: '' });
      setPaymentsError('');
      return;
    }
    fetchContractPayments(viewingContract.id);
  }, [fetchContractPayments, viewingContract?.id]);

  const handleSelectContract = (contract) => {
    setEditingId(contract.id);
    setViewingContract(contract);
    setFormState({
      title: contract.title || '',
      vendor: contract.vendor || '',
      supplier_id: contract.supplier_id ? String(contract.supplier_id) : '',
      source_request_id: contract.source_request_id ? String(contract.source_request_id) : '',
      reference_number: contract.reference_number || '',
      signing_date: contract.signing_date || '',
      start_date: contract.start_date || '',
      end_date: contract.end_date || '',
      status: contract.status || 'active',
      contract_value:
        contract.contract_value === null || contract.contract_value === undefined
          ? ''
          : String(contract.contract_value),
      amount_paid:
        contract.amount_paid === null || contract.amount_paid === undefined ? '' : String(contract.amount_paid),
      description: contract.description || '',
      delivery_terms: contract.delivery_terms || '',
      warranty_terms: contract.warranty_terms || '',
      performance_management: contract.performance_management || '',
      commercial_terms: contract.commercial_terms || '',
      compliance_legal_terms: contract.compliance_legal_terms || '',
      financial_payment_control: contract.financial_payment_control || '',
      risk_dispute_management: contract.risk_dispute_management || '',
      digital_attachments_tracking: contract.digital_attachments_tracking || '',
      institute: contract.institute || '',
      contract_category: contract.contract_category || '',
      renewal_type: contract.renewal_type || '',
      renewal_notice_days:
        contract.renewal_notice_days === null || contract.renewal_notice_days === undefined
          ? ''
          : String(contract.renewal_notice_days),
      contract_owner: contract.contract_owner || '',
      currency: contract.currency || 'IQD',
      estimated_contract_value:
        contract.estimated_contract_value === null || contract.estimated_contract_value === undefined
          ? ''
          : String(contract.estimated_contract_value),
      actual_consumed_value:
        contract.actual_consumed_value === null || contract.actual_consumed_value === undefined
          ? ''
          : String(contract.actual_consumed_value),
      first_party: contract.first_party || '',
      second_party: contract.second_party || '',
      authorized_signatory: contract.authorized_signatory || '',
      vendor_contact_person: contract.vendor_contact_person || '',
      vendor_contact_email: contract.vendor_contact_email || '',
      vendor_contact_phone: contract.vendor_contact_phone || '',
      vendor_tax_id: contract.vendor_tax_id || '',
      vendor_address: contract.vendor_address || '',
      scope_summary: contract.scope_summary || '',
      deliverables: contract.deliverables || '',
      technical_specifications: contract.technical_specifications || '',
      service_coverage: contract.service_coverage || '',
      exclusions: contract.exclusions || '',
      sla_requirements: contract.sla_requirements || '',
      payment_terms_details: contract.payment_terms_details || '',
      delivery_logistics_details: contract.delivery_logistics_details || '',
      sla_details: contract.sla_details || '',
      penalties_incentives: contract.penalties_incentives || '',
      change_management_terms: contract.change_management_terms || '',
      termination_exit_terms: contract.termination_exit_terms || '',
      alert_rules: contract.alert_rules || '',
      commercial_contract_value: contract.commercial_contract_value || '',
      commercial_unit_pricing: contract.commercial_unit_pricing || '',
      commercial_price_validity: contract.commercial_price_validity || '',
      commercial_discount_structure: contract.commercial_discount_structure || '',
      commercial_vat_tax: contract.commercial_vat_tax || '',
      commercial_currency_exchange_clause: contract.commercial_currency_exchange_clause || '',
      commercial_escalation_clause: contract.commercial_escalation_clause || '',
      commercial_minimum_order_quantity: contract.commercial_minimum_order_quantity || '',
      commercial_delivery_charges: contract.commercial_delivery_charges || '',
      delivery_location_department_id: contract.delivery_location_department_id ? String(contract.delivery_location_department_id) : '',
      delivery_incoterms: contract.delivery_incoterms || '',
      delivery_lead_time_days: contract.delivery_lead_time_days || '',
      delivery_emergency_terms: contract.delivery_emergency_terms || '',
      delivery_shipping_responsibility: contract.delivery_shipping_responsibility || '',
      delivery_customs_clearance_responsibility: contract.delivery_customs_clearance_responsibility || '',
      delivery_packaging_requirements: contract.delivery_packaging_requirements ? contract.delivery_packaging_requirements.split(',').map((item) => item.trim()).filter(Boolean) : [],
      delivery_transportation_requirements: contract.delivery_transportation_requirements ? contract.delivery_transportation_requirements.split(',').map((item) => item.trim()).filter(Boolean) : [],
      delivery_partial_allowed: contract.delivery_partial_allowed || '',
      sla_response_time: contract.sla_response_time || '',
      sla_resolution_time: contract.sla_resolution_time || '',
      sla_uptime_requirement: contract.sla_uptime_requirement || '',
      sla_preventive_maintenance_frequency: contract.sla_preventive_maintenance_frequency || '',
      sla_emergency_support_availability: contract.sla_emergency_support_availability || '',
      sla_spare_parts_availability: contract.sla_spare_parts_availability || '',
      sla_escalation_path_user: contract.sla_escalation_path_user || '',
      payment_methods: contract.payment_methods ? contract.payment_methods.split(',').map((item) => item.trim()).filter(Boolean) : [],
      payment_period: contract.payment_period || '',
      payment_advance_percentage: contract.payment_advance_percentage || '',
      payment_retention: contract.payment_retention || '',
      payment_milestone_details: contract.payment_milestone_details || '',
      payment_invoice_requirements: contract.payment_invoice_requirements || '',
      payment_partial_allowed: contract.payment_partial_allowed || '',
      payment_penalty_rate_percent: contract.payment_penalty_rate_percent || '',
      payment_penalty_timeline: contract.payment_penalty_timeline || 'day',
      payment_penalty_max_percent: contract.payment_penalty_max_percent || '',
      contract_type: contract.contract_type || 'purchasing',
      end_user_department_id: contract.end_user_department_id
        ? String(contract.end_user_department_id)
        : '',
      contract_manager_id: contract.contract_manager_id
        ? String(contract.contract_manager_id)
        : '',
      technical_department_ids: Array.isArray(contract.technical_department_ids)
        ? contract.technical_department_ids.map((id) => String(id))
        : [],
    });
    setFormError('');
    setSuccessMessage('');
  };

  const handleChecklistToggle = async (documentId, checked) => {
    const activeContractId = editingId || viewingContract?.id;
    if (!activeContractId || !documentId) return;
    setChecklistSavingId(documentId);
    try {
      const { data } = await api.patch(`/contracts/${activeContractId}/document-checklist/${documentId}`, {
        is_uploaded: checked,
      });
      setChecklist((prev) => prev.map((item) => (item.id === documentId ? data : item)));
    } catch (err) {
      console.error('Failed to update checklist item', err);
    } finally {
      setChecklistSavingId(null);
    }
  };

  const handleInputChange = (event) => {
    const { name, value, selectedOptions } = event.target;

    if (name === 'technical_department_ids' || name === 'delivery_packaging_requirements' || name === 'delivery_transportation_requirements' || name === 'payment_methods') {
      const selected = Array.isArray(value) ? value : Array.from(selectedOptions || [], (option) => option.value);
      setFormState((prev) => ({ ...prev, [name]: selected }));
      return;
    }

    if (name === 'end_user_department_id' || name === 'contract_manager_id') {
      setFormState((prev) => ({ ...prev, [name]: value }));
      return;
    }

    if (name === 'supplier_id') {
      setFormState((prev) => {
        const matchedSupplier = suppliers.find((supplier) => String(supplier.id) === value);
        return {
          ...prev,
          supplier_id: value,
          vendor: matchedSupplier?.name || prev.vendor,
        };
      });
      return;
    }

    if (name === 'source_request_id') {
      setFormState((prev) => ({ ...prev, source_request_id: value }));
      return;
    }

    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const parseOptionalNumericField = (value) => {
      if (value === null || value === undefined) {
        return null;
      }
      const normalized = String(value).trim();
      if (!normalized) {
        return null;
      }
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    };

    const payload = {
      title: formState.title.trim(),
      vendor: formState.vendor.trim(),
      contract_type: formState.contract_type,
      reference_number: formState.reference_number.trim() || null,
      signing_date: formState.signing_date || null,
      start_date: formState.start_date || null,
      end_date: formState.end_date || null,
      status: formState.status,
      description: formState.description.trim() || null,
      delivery_terms: formState.delivery_terms.trim() || null,
      warranty_terms: formState.warranty_terms.trim() || null,
      performance_management: formState.performance_management.trim() || null,
      compliance_legal_terms: formState.compliance_legal_terms.trim() || null,
      financial_payment_control: formState.financial_payment_control.trim() || null,
      risk_dispute_management: formState.risk_dispute_management.trim() || null,
      digital_attachments_tracking: formState.digital_attachments_tracking.trim() || null,
      institute: formState.institute.trim() || null,
      contract_category: formState.contract_category.trim() || null,
      renewal_type: formState.renewal_type.trim() || null,
      currency: normalizeCurrency(formState.currency),
      first_party: formState.first_party.trim() || null,
      second_party: formState.second_party.trim() || null,
      authorized_signatory: formState.authorized_signatory.trim() || null,
      vendor_contact_person: formState.vendor_contact_person.trim() || null,
      vendor_contact_email: formState.vendor_contact_email.trim() || null,
      vendor_contact_phone: formState.vendor_contact_phone.trim() || null,
      vendor_tax_id: formState.vendor_tax_id.trim() || null,
      vendor_address: formState.vendor_address.trim() || null,
      scope_summary: formState.scope_summary.trim() || null,
      deliverables: formState.deliverables.trim() || null,
      technical_specifications: formState.technical_specifications.trim() || null,
      service_coverage: formState.service_coverage.trim() || null,
      exclusions: formState.exclusions.trim() || null,
      sla_requirements: formState.sla_requirements.trim() || null,
      payment_terms_details: formState.payment_terms_details.trim() || null,
      delivery_logistics_details: formState.delivery_logistics_details.trim() || null,
      sla_details: formState.sla_details.trim() || null,
      penalties_incentives: formState.penalties_incentives.trim() || null,
      change_management_terms: formState.change_management_terms.trim() || null,
      termination_exit_terms: formState.termination_exit_terms.trim() || null,
      alert_rules: formState.alert_rules.trim() || null,
      commercial_contract_value: formState.commercial_contract_value.trim() || null,
      commercial_unit_pricing: formState.commercial_unit_pricing.trim() || null,
      commercial_price_validity: formState.commercial_price_validity.trim() || null,
      commercial_discount_structure: formState.commercial_discount_structure.trim() || null,
      commercial_vat_tax: formState.commercial_vat_tax.trim() || null,
      commercial_currency_exchange_clause: formState.commercial_currency_exchange_clause.trim() || null,
      commercial_escalation_clause: formState.commercial_escalation_clause.trim() || null,
      commercial_minimum_order_quantity: formState.commercial_minimum_order_quantity.trim() || null,
      commercial_delivery_charges: formState.commercial_delivery_charges.trim() || null,
      delivery_location_department_id: formState.delivery_location_department_id || null,
      delivery_incoterms: formState.delivery_incoterms || null,
      delivery_lead_time_days: formState.delivery_lead_time_days.trim() || null,
      delivery_emergency_terms: formState.delivery_emergency_terms.trim() || null,
      delivery_shipping_responsibility: formState.delivery_shipping_responsibility || null,
      delivery_customs_clearance_responsibility: formState.delivery_customs_clearance_responsibility || null,
      delivery_packaging_requirements: formState.delivery_packaging_requirements.join(', ') || null,
      delivery_transportation_requirements: formState.delivery_transportation_requirements.join(', ') || null,
      delivery_partial_allowed: formState.delivery_partial_allowed || null,
      sla_response_time: formState.sla_response_time.trim() || null,
      sla_resolution_time: formState.sla_resolution_time.trim() || null,
      sla_uptime_requirement: formState.sla_uptime_requirement.trim() || null,
      sla_preventive_maintenance_frequency: formState.sla_preventive_maintenance_frequency.trim() || null,
      sla_emergency_support_availability: formState.sla_emergency_support_availability.trim() || null,
      sla_spare_parts_availability: formState.sla_spare_parts_availability.trim() || null,
      sla_escalation_path_user: formState.sla_escalation_path_user.trim() || null,
      payment_methods: formState.payment_methods.join(', ') || null,
      payment_period: formState.payment_period.trim() || null,
      payment_advance_percentage: formState.payment_advance_percentage.trim() || null,
      payment_retention: formState.payment_retention || null,
      payment_milestone_details: formState.payment_milestone_details.trim() || null,
      payment_invoice_requirements: formState.payment_invoice_requirements.trim() || null,
      payment_partial_allowed: formState.payment_partial_allowed || null,
      payment_penalty_rate_percent: formState.payment_penalty_rate_percent.trim() || null,
      payment_penalty_timeline: formState.payment_penalty_timeline || null,
      payment_penalty_max_percent: formState.payment_penalty_max_percent.trim() || null,
    };

    payload.renewal_notice_days =
      formState.renewal_notice_days === '' ? null : Number(formState.renewal_notice_days);
    payload.estimated_contract_value = parseOptionalNumericField(formState.estimated_contract_value);
    payload.actual_consumed_value = parseOptionalNumericField(formState.actual_consumed_value);
    if (!payload.title) {
      setFormError('A contract title is required.');
      return;
    }

    if (!payload.vendor) {
      setFormError('A vendor name is required.');
      return;
    }

    const allowedContractTypes = ['purchasing', 'leasing', 'other'];
    if (!allowedContractTypes.includes(payload.contract_type)) {
      setFormError('Select a valid contract type.');
      return;
    }

    if (formState.contract_value !== '') {
      const numericValue = Number(formState.contract_value);
      if (!Number.isFinite(numericValue)) {
        setFormError('Contract value must be a valid number.');
        return;
      }
      if (Math.abs(numericValue) >= 1000000000000) {
        setFormError('Contract value is too large.');
        return;
      }
      payload.contract_value = numericValue;
    } else {
      payload.contract_value = null;
    }

    if (formState.amount_paid !== '') {
      const numericPaid = Number(formState.amount_paid);
      if (!Number.isFinite(numericPaid)) {
        setFormError('Amount paid must be a valid number.');
        return;
      }
      if (Math.abs(numericPaid) >= 1000000000000) {
        setFormError('Amount paid is too large.');
        return;
      }
      if (numericPaid < 0) {
        setFormError('Amount paid cannot be negative.');
        return;
      }
      if (payload.contract_value !== null && numericPaid > payload.contract_value) {
        setFormError('Amount paid cannot exceed the contract value.');
        return;
      }
      payload.amount_paid = numericPaid;
    } else {
      payload.amount_paid = null;
    }

    if (payload.renewal_notice_days !== null && !Number.isFinite(payload.renewal_notice_days)) {
      setFormError('Renewal notice period must be a valid number of days.');
      return;
    }
    if (
      payload.estimated_contract_value !== null &&
      !Number.isFinite(payload.estimated_contract_value)
    ) {
      setFormError('Estimated contract value must be a valid number.');
      return;
    }
    if (
      payload.actual_consumed_value !== null &&
      !Number.isFinite(payload.actual_consumed_value)
    ) {
      setFormError('Actual consumed value must be a valid number.');
      return;
    }

    const exceedsNumericColumnLimit = (value) => Math.abs(value) >= 1000000000000;
    if (
      payload.estimated_contract_value !== null &&
      exceedsNumericColumnLimit(payload.estimated_contract_value)
    ) {
      setFormError('Estimated contract value is too large.');
      return;
    }
    if (
      payload.actual_consumed_value !== null &&
      exceedsNumericColumnLimit(payload.actual_consumed_value)
    ) {
      setFormError('Actual consumed value is too large.');
      return;
    }

    if (formState.end_user_department_id) {
      const parsedDepartment = Number(formState.end_user_department_id);
      if (!Number.isInteger(parsedDepartment) || parsedDepartment <= 0) {
        setFormError('End user department must be selected from the list.');
        return;
      }
      payload.end_user_department_id = parsedDepartment;
    } else {
      payload.end_user_department_id = null;
    }

    if (formState.contract_manager_id) {
      const parsedManager = Number(formState.contract_manager_id);
      if (!Number.isInteger(parsedManager) || parsedManager <= 0) {
        setFormError('Contract manager must be a valid user.');
        return;
      }
      payload.contract_manager_id = parsedManager;
    } else {
      payload.contract_manager_id = null;
    }

    if (formState.supplier_id) {
      const parsedSupplier = Number(formState.supplier_id);
      if (!Number.isInteger(parsedSupplier) || parsedSupplier <= 0) {
        setFormError('Supplier must be selected from the list or left blank.');
        return;
      }
      payload.supplier_id = parsedSupplier;
    }

    if (formState.source_request_id) {
      const parsedRequest = Number(formState.source_request_id);
      if (!Number.isInteger(parsedRequest) || parsedRequest <= 0) {
        setFormError('Source request ID must be a positive number.');
        return;
      }
      payload.source_request_id = parsedRequest;
    }

    if (payload.signing_date && payload.start_date && payload.signing_date > payload.start_date) {
      setFormError('Signing date must be on or before the start date.');
      return;
    }

    if (payload.signing_date && payload.end_date && payload.signing_date > payload.end_date) {
      setFormError('Signing date must be on or before the end date.');
      return;
    }

    const technicalIds = Array.isArray(formState.technical_department_ids)
      ? formState.technical_department_ids
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      : [];
    payload.technical_department_ids = technicalIds;

    setSaving(true);

    try {
      if (editingId) {
        await api.patch(`/contracts/${editingId}`, payload);
        setSuccessMessage('Contract updated successfully.');
      } else {
        const { data: newContract } = await api.post('/contracts', payload);
        setSuccessMessage('Contract created successfully.');
        handleSelectContract(newContract);
      }
      resetForm();
      await fetchContracts();
      await refreshSuppliers();
    } catch (err) {
      console.error('Failed to save contract', err);
      setFormError(err?.response?.data?.message || 'Failed to save contract. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (contractId) => {
    if (!window.confirm('Archive this contract? Archived contracts remain read-only.')) {
      return;
    }

    setArchivingId(contractId);
    setFormError('');
    setSuccessMessage('');

    try {
      await api.patch(`/contracts/${contractId}/archive`);
      if (editingId === contractId) {
        resetForm();
      }
      setSuccessMessage('Contract archived successfully.');
      await fetchContracts();
    } catch (err) {
      console.error('Failed to archive contract', err);
      setFormError(err?.response?.data?.message || 'Unable to archive this contract.');
    } finally {
      setArchivingId(null);
    }
  };

  const handleUnarchive = async (contractId) => {
    setUnarchivingId(contractId);
    setFormError('');
    setSuccessMessage('');

    try {
      await api.patch(`/contracts/${contractId}/unarchive`);
      if (editingId === contractId) {
        resetForm();
      }
      setSuccessMessage('Contract unarchived successfully.');
      await fetchContracts();
    } catch (err) {
      console.error('Failed to unarchive contract', err);
      setFormError(err?.response?.data?.message || 'Unable to unarchive this contract.');
    } finally {
      setUnarchivingId(null);
    }
  };

  const handleRenew = async (contract) => {
    if (!contract) return;

    const proposedEnd = window.prompt(
      'Enter the new contract end date (YYYY-MM-DD)',
      contract.end_date || ''
    );

    if (!proposedEnd) {
      return;
    }

    const proposedStart = window.prompt(
      'Enter the new contract start date (leave blank to keep current)',
      contract.start_date || ''
    );

    setRenewingId(contract.id);
    setFormError('');
    setSuccessMessage('');

    try {
      await api.post(`/contracts/${contract.id}/renew`, {
        start_date: proposedStart || null,
        end_date: proposedEnd,
        contract_value: contract.contract_value,
        amount_paid: contract.amount_paid,
      });

      setSuccessMessage('Contract renewed successfully.');
      await fetchContracts();
    } catch (err) {
      console.error('Failed to renew contract', err);
      setFormError(err?.response?.data?.message || 'Unable to renew this contract.');
    } finally {
      setRenewingId(null);
    }
  };

  const handleDeleteContract = async (contractId) => {
    if (!window.confirm('Delete this contract and its related evaluations and attachments?')) {
      return;
    }

    setDeletingId(contractId);
    setFormError('');
    setSuccessMessage('');

    try {
      await api.delete(`/contracts/${contractId}`);
      if (editingId === contractId) {
        resetForm();
      }
      setSuccessMessage('Contract deleted successfully.');
      await fetchContracts();
    } catch (err) {
      console.error('Failed to delete contract', err);
      setFormError(err?.response?.data?.message || 'Unable to delete this contract.');
    } finally {
      setDeletingId(null);
    }
  };

  const isExpiringSoon = useCallback((contract) => {
    if (!contract || contract.is_expired) {
      return false;
    }

    const daysUntilExpiry = contract.days_until_expiry;
    return typeof daysUntilExpiry === 'number' && daysUntilExpiry >= 0 && daysUntilExpiry <= EXPIRING_SOON_THRESHOLD_DAYS;
  }, []);

  const contractStats = useMemo(() => {
    const stats = {
      active: 0,
      expiringSoon: 0,
      expired: 0,
      nextRenewal: null,
      totalValue: 0,
      totalPaid: 0,
    };

    contracts.forEach((contract) => {
      const normalizedStatus = (contract.status || '').toLowerCase();
      if (normalizedStatus === 'active') {
        stats.active += 1;
      }

      const iqdValue = toIqd(contract.contract_value, contract.currency);
      const iqdPaid = toIqd(contract.amount_paid, contract.currency);
      if (Number.isFinite(iqdValue)) {
        stats.totalValue += iqdValue;
      }
      if (Number.isFinite(iqdPaid)) {
        stats.totalPaid += iqdPaid;
      }

      if (contract.is_expired) {
        stats.expired += 1;
        return;
      }

      if (isExpiringSoon(contract)) {
        stats.expiringSoon += 1;
      }

      const daysUntilExpiry = contract.days_until_expiry;
      if (['terminated', 'archived', 'expired'].includes(normalizedStatus)) {
        return;
      }
      if (typeof daysUntilExpiry === 'number' && daysUntilExpiry >= 0) {
        if (!stats.nextRenewal || daysUntilExpiry < stats.nextRenewal.daysUntil) {
          stats.nextRenewal = {
            daysUntil: daysUntilExpiry,
            title: contract.title,
            endDate: contract.end_date,
          };
        }
      }
    });

    const paidCoverage =
      stats.totalValue > 0
        ? Number(Math.min((stats.totalPaid / stats.totalValue) * 100, 9999).toFixed(1))
        : null;

    return { ...stats, paidCoverage };
  }, [contracts, isExpiringSoon]);

  const {
    active: activeCount,
    expiringSoon: expiringSoonCount,
    expired: expiredCount,
    nextRenewal,
    totalValue,
    totalPaid,
    paidCoverage,
  } = contractStats;

  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => {
      if (renewalFilter === 'expiring') {
        return isExpiringSoon(contract);
      }

      if (renewalFilter === 'expired') {
        return Boolean(contract.is_expired);
      }

      return true;
    });
  }, [contracts, isExpiringSoon, renewalFilter]);

  const sortedContracts = useMemo(() => {
    return [...filteredContracts].sort((a, b) => {
      const statusA = (a.status || '').toLowerCase();
      const statusB = (b.status || '').toLowerCase();

      if (statusA === statusB) {
        return (b.updated_at || '').localeCompare(a.updated_at || '');
      }

      return statusA.localeCompare(statusB);
    });
  }, [filteredContracts]);

  const exportContractsToCsv = useCallback(() => {
    if (sortedContracts.length === 0) {
      setError('No contracts available to export with the current filters.');
      return;
    }

    const headers = [
      'Title',
      'Vendor',
      'Reference #',
      'Signing date',
      'Start date',
      'End date',
      'Status',
      'Contract value',
      'Amount paid',
    ];

    const escapeCsv = (value) => {
      if (value === null || value === undefined) {
        return '""';
      }
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    };

    const rows = sortedContracts.map((contract) => [
      contract.title || '',
      contract.vendor || '',
      contract.reference_number || '',
      contract.signing_date || '',
      contract.start_date || '',
      contract.end_date || '',
      contract.status || '',
      contract.contract_value ?? '',
      contract.amount_paid ?? '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'contracts-export.csv');
  }, [sortedContracts]);

  const formatCurrency = useCallback((value, currency = null) => {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;

    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numeric) + (currency ? ` ${normalizeCurrency(currency)}` : '');
  }, []);

  const handlePrintContracts = useCallback(() => {
    const printWindow = window.open('', '', 'width=1100,height=800');
    if (!printWindow) {
      return;
    }

    const rows = sortedContracts
      .map(
        (contract) => `
          <tr>
            <td>${contract.title || ''}</td>
            <td>${contract.vendor || ''}</td>
            <td>${contract.reference_number || ''}</td>
            <td>${contract.signing_date || ''}</td>
            <td>${contract.start_date || ''}</td>
            <td>${contract.end_date || ''}</td>
            <td>${(contract.status || '').toUpperCase()}</td>
            <td>${formatCurrency(contract.contract_value, contract.currency) ?? ''}</td>
            <td>${formatCurrency(contract.amount_paid, contract.currency) ?? ''}</td>
          </tr>
        `
      )
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Contracts snapshot</title>
          <style>
            body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; padding: 16px; color: #111827; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
            th { background: #f3f4f6; text-align: left; }
            caption { font-weight: 700; margin-bottom: 8px; }
          </style>
        </head>
        <body>
          <table>
            <caption>Contracts export (${new Date().toLocaleString()})</caption>
            <thead>
              <tr>
                <th>Title</th>
                <th>Vendor</th>
                <th>Reference #</th>
                <th>Signing date</th>
                <th>Start date</th>
                <th>End date</th>
                <th>Status</th>
                <th>Contract value</th>
                <th>Amount paid</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }, [formatCurrency, sortedContracts]);

  const renderStatusBadge = (status) => {
    const normalized = (status || '').toLowerCase();
    const classes = statusStyles[normalized] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    const label = normalized ? normalized.replace('-', ' ') : 'unknown';

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${classes}`}>
        {label}
      </span>
    );
  };

  const renderExpiry = (contract) => {
    const normalizedStatus = (contract?.status || '').toLowerCase();
    if (['terminated', 'archived'].includes(normalizedStatus)) {
      return renewalPill('inactive', normalizedStatus === 'terminated' ? 'Terminated' : 'Archived');
    }

    if (!contract.end_date) {
      return renewalPill('ok', 'No end date');
    }

    if (contract.is_expired) {
      const days = Math.abs(contract.days_until_expiry || 0);
      const label = days === 0 ? 'Expired today' : `Expired ${days} day${days === 1 ? '' : 's'} ago`;
      return renewalPill('expired', label);
    }

    if (typeof contract.days_until_expiry === 'number') {
      const label = `In ${contract.days_until_expiry} day${contract.days_until_expiry === 1 ? '' : 's'}`;
      const tone = isExpiringSoon(contract) ? 'expiring' : 'ok';
      return renewalPill(tone, label);
    }

    return renewalPill('ok', 'Date pending');
  };

  const formatDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toLocaleDateString();
  };

  const getPaidSummary = useCallback((contract) => {
    const registeredPaymentTotal = viewingContract?.id === contract?.id
      ? contractPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
      : null;
    const paidValue = registeredPaymentTotal !== null && registeredPaymentTotal > 0
      ? registeredPaymentTotal
      : Number(contract?.amount_paid);
    const totalValue = Number(contract?.contract_value);
    const hasPaid = Number.isFinite(paidValue);
    const hasTotal = Number.isFinite(totalValue) && totalValue > 0;

    const percent = hasTotal && hasPaid ? Math.min((paidValue / totalValue) * 100, 9999) : null;

    return {
      formattedPaid: hasPaid ? formatCurrency(paidValue, contract?.currency) : null,
      formattedTotal: hasTotal ? formatCurrency(totalValue, contract?.currency) : null,
      percent: percent !== null ? Number(percent.toFixed(1)) : null,
    };
  }, [contractPayments, formatCurrency, viewingContract?.id]);

  const selectedContractInsights = useMemo(() => {
    if (!viewingContract) {
      return null;
    }

    const now = new Date();
    const parseDate = (value) => {
      if (!value) return null;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const signingDate = parseDate(viewingContract.signing_date);
    const startDate = parseDate(viewingContract.start_date);
    const endDate = parseDate(viewingContract.end_date);
    const msPerDay = 1000 * 60 * 60 * 24;

    const daysUntil = (date) => (date ? Math.round((date.getTime() - now.getTime()) / msPerDay) : null);
    const describeRelative = (date) => {
      const delta = daysUntil(date);
      if (delta === null) return 'Date not set';
      if (delta === 0) return 'Today';
      return delta > 0 ? `${delta} day${delta === 1 ? '' : 's'} from now` : `${Math.abs(delta)} day${
        Math.abs(delta) === 1 ? '' : 's'
      } ago`;
    };

    const progressValue = startDate && endDate ? (now - startDate) / (endDate - startDate) : null;
    const coverage = getPaidSummary(viewingContract);

    return {
      timeline: [
        {
          label: 'Signed',
          date: signingDate,
          detail: describeRelative(signingDate),
        },
        {
          label: 'Start',
          date: startDate,
          detail: describeRelative(startDate),
        },
        {
          label: 'End',
          date: endDate,
          detail: describeRelative(endDate),
        },
      ],
      progress: Number.isFinite(progressValue) ? Math.min(Math.max(progressValue * 100, 0), 100) : null,
      expirySummary:
        daysUntil(endDate) !== null
          ? daysUntil(endDate) >= 0
            ? `Expires in ${daysUntil(endDate)} day${daysUntil(endDate) === 1 ? '' : 's'}`
            : `Expired ${Math.abs(daysUntil(endDate))} day${Math.abs(daysUntil(endDate)) === 1 ? '' : 's'} ago`
          : 'No end date on record',
      renewalHint: viewingContract.is_expired
        ? 'This contract is expired and ready for renewal or archiving.'
        : isExpiringSoon(viewingContract)
        ? 'Expiring soon—initiate renewal or confirm end-of-life.'
        : 'Healthy timeline—monitor renewal cadence.',
      paidCoverage: coverage.percent,
    };
  }, [getPaidSummary, isExpiringSoon, viewingContract]);

  const getRowHighlight = (contract) => {
    if (contract.is_expired) {
      return 'border-l-4 border-rose-400/80 bg-rose-50/60 dark:border-rose-400/60 dark:bg-rose-900/10';
    }

    if (isExpiringSoon(contract)) {
      return 'border-l-4 border-amber-400/80 bg-amber-50/60 dark:border-amber-400/60 dark:bg-amber-900/10';
    }

    return 'border-l-4 border-transparent';
  };

  const departmentLookup = useMemo(() => {
    const entries = new Map();
    departments.forEach((department) => {
      if (department?.id === undefined || department?.id === null) {
        return;
      }
      entries.set(Number(department.id), department);
    });
    return entries;
  }, [departments]);

  const userLookup = useMemo(() => {
    const entries = new Map();
    users.forEach((userRecord) => {
      if (userRecord?.id === undefined || userRecord?.id === null) {
        return;
      }
      entries.set(Number(userRecord.id), userRecord);
    });
    return entries;
  }, [users]);

  const getDepartmentName = (departmentId) => {
    if (!departmentId) {
      return null;
    }
    const numericId = Number(departmentId);
    const record = departmentLookup.get(numericId);
    return record?.name || null;
  };

  const getContractManagerLabel = (managerId) => {
    if (!managerId) {
      return null;
    }
    const numericId = Number(managerId);
    const record = userLookup.get(numericId);
    if (!record) {
      return null;
    }
    const roleLabel = (record.role || '').toUpperCase();
    const nameLabel = record.name || record.email || `User #${numericId}`;
    return roleLabel ? `${nameLabel} (${roleLabel})` : nameLabel;
  };

  const getTechnicalDepartmentLabels = (ids) => {
    if (!Array.isArray(ids)) {
      return [];
    }
    return ids
      .map((id) => {
        const label = getDepartmentName(id);
        if (label) {
          return label;
        }
        const numericId = Number(id);
        if (Number.isInteger(numericId) && numericId > 0) {
          return `Department #${numericId}`;
        }
        return null;
      })
      .filter(Boolean);
    };

  const StatCard = ({ tone, title, value, description }) => {
    const style = statStyles[tone] || statStyles.active;

    return (
      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-900">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.gradient}`} aria-hidden="true" />
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
          </div>
          <span
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${style.gradient} text-white shadow-sm`}
          >
            {style.icon}
          </span>
        </div>
      </div>
    );
  };

  const renewalPill = (tone, label) => {
    const colorMap = {
      expired: 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-900/30 dark:text-rose-200 dark:ring-rose-800/60',
      inactive: 'bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700',
      expiring: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800/60',
      ok: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800/60',
    };

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
          colorMap[tone] || colorMap.ok
        }`}
      >
        {tone === 'expired' && '⏳'}
        {tone === 'inactive' && '⏸️'}
        {tone === 'expiring' && '⚠️'}
        {tone === 'ok' && '✅'}
        {label}
      </span>
    );
  };

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Contract management</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Track active agreements, update contract details, and keep visibility on upcoming renewals.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
              <div className="font-semibold">{contracts.length} contracts</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{activeCount} active</div>
            </div>
          </div>
        </header>

        {!isCreatePage && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <StatCard
            tone="active"
            title="Active contracts"
            value={activeCount}
            description="Based on current status"
          />
          <StatCard
            tone="expiring"
            title="Expiring soon"
            value={expiringSoonCount}
            description={`Within the next ${EXPIRING_SOON_THRESHOLD_DAYS} days`}
          />
          <StatCard
            tone="expired"
            title="Expired"
            value={expiredCount}
            description="Requires close-out or archiving"
          />
          <StatCard
            tone="renewal"
            title="Next renewal"
            value={
              nextRenewal
                ? `${nextRenewal.daysUntil} day${nextRenewal.daysUntil === 1 ? '' : 's'}`
                : 'No upcoming renewals'
            }
            description={
              nextRenewal
                ? `${nextRenewal.title || 'Unnamed contract'}${
                    formatDate(nextRenewal.endDate) ? ` • ${formatDate(nextRenewal.endDate)}` : ''
                  }`
                : 'Awaiting schedule'
            }
          />
          <StatCard
            tone="paid"
            title="Paid to date"
            value={formatCurrency(totalPaid, 'IQD') ?? '—'}
            description={
              totalValue
                ? `of ${formatCurrency(totalValue, 'IQD')}${paidCoverage !== null ? ` • ${paidCoverage}% paid` : ''}`
                : 'Add contract values to track spend'
            }
          />
        </div>
        )}

        {!isCreatePage ? (
        <section
          className={`grid gap-6 ${
            editingId || viewingContract
              ? 'lg:grid-cols-[minmax(0,1.75fr)_minmax(420px,0.95fr)] xl:grid-cols-[minmax(0,2fr)_minmax(500px,1fr)]'
              : 'grid-cols-1'
          }`}
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 gap-3">
                  <div className="flex-1">
                    <label htmlFor="contracts-search" className="sr-only">
                      Search contracts
                    </label>
                    <input
                      id="contracts-search"
                      type="search"
                      placeholder="Search by title, vendor, or reference"
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div className="w-full sm:w-48">
                    <label htmlFor="status-filter" className="sr-only">
                      Filter by status
                    </label>
                    <select
                      id="status-filter"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="w-full sm:w-48">
                    <label htmlFor="renewal-filter" className="sr-only">
                      Filter by renewal window
                    </label>
                    <select
                      id="renewal-filter"
                      value={renewalFilter}
                      onChange={(event) => setRenewalFilter(event.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    >
                      {renewalOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={exportContractsToCsv}
                    className="inline-flex items-center justify-center rounded-md border border-transparent bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintContracts}
                    className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={fetchContracts}
                    className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/contracts/approvals')}
                    className="inline-flex items-center justify-center rounded-md border border-transparent bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
                  >
                    Contract approval panel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewingContract(null);
                      setEditingId(null);
                      setFormState(initialFormState);
                      navigate('/contracts/new');
                    }}
                    className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    Create new contract
                  </button>
                </div>
              </div>
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                  {error}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm ring-1 ring-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:ring-gray-800/60">
              <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-300">
                <span>{sortedContracts.length} contract{sortedContracts.length === 1 ? '' : 's'} in view</span>
                <span className="hidden sm:inline">Tip: Select a contract row to open full details.</span>
              </div>

              <div className="space-y-3 p-3 md:hidden">
                {loading ? (
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    Loading contracts...
                  </div>
                ) : sortedContracts.length === 0 ? (
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    No contracts match your current filters.
                  </div>
                ) : (
                  sortedContracts.map((contract) => {
                    const isSelected = viewingContract?.id === contract.id;
                    const paidSummary = getPaidSummary(contract);
                    const contractValue = formatCurrency(contract.contract_value, contract.currency);
                    return (
                      <button
                        key={contract.id}
                        type="button"
                        onClick={() => handleViewContract(contract)}
                        className={`w-full rounded-lg border p-3 text-left shadow-sm transition ${
                          isSelected
                            ? 'border-blue-300 bg-blue-50/70 dark:border-blue-700 dark:bg-blue-900/20'
                            : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/40 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{contract.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{contract.vendor}</p>
                          </div>
                          <div>{renderStatusBadge(contract.status)}</div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Value</p>
                            <p className="font-medium text-gray-800 dark:text-gray-100">{contractValue ?? '—'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Renewal</p>
                            <div className="font-medium text-gray-800 dark:text-gray-100">{renderExpiry(contract)}</div>
                          </div>
                          <div className="col-span-2">
                            <p className="text-gray-500 dark:text-gray-400">Paid progress</p>
                            <p className="font-medium text-gray-800 dark:text-gray-100">
                              {paidSummary.formattedPaid ?? '—'}
                              {paidSummary.formattedTotal ? ` of ${paidSummary.formattedTotal}` : ''}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="hidden max-h-[640px] overflow-auto md:block">
                <table className="min-w-[1120px] divide-y divide-gray-200 text-sm dark:divide-gray-700" aria-label="Contracts table">
                  <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur dark:bg-gray-800/90">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        Contract
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        First party
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        Vendor
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        Request
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        Value
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        Estimated value
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        Paid
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        Renewal
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white/60 dark:divide-gray-800 dark:bg-gray-900/70">
                    {loading ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-300">
                          Loading contracts...
                        </td>
                      </tr>
                    ) : sortedContracts.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-300">
                          No contracts match your current filters.
                        </td>
                      </tr>
                    ) : (
                      sortedContracts.map((contract, index) => {
                        const isSelected = viewingContract?.id === contract.id;
                        const contractValue = formatCurrency(contract.contract_value, contract.currency);
                        const estimatedValue = formatCurrency(contract.estimated_contract_value, contract.currency);
                        const paidSummary = getPaidSummary(contract);
                        const paidBarTone =
                          paidSummary.percent === null
                            ? 'bg-gray-300 dark:bg-gray-700'
                            : paidSummary.percent >= 90
                            ? 'bg-emerald-500'
                            : paidSummary.percent >= 50
                            ? 'bg-blue-500'
                            : 'bg-amber-500';

                        return (
                          <tr
                            key={contract.id}
                            className={`cursor-pointer transition hover:-translate-y-[1px] hover:shadow-sm hover:ring-1 hover:ring-blue-100 dark:hover:ring-blue-800 ${
                              isSelected ? 'bg-blue-50/70 dark:bg-blue-900/20' : ''
                            } ${index % 2 === 1 ? 'bg-gray-50/70 dark:bg-gray-800/60' : ''} ${getRowHighlight(contract)}`}
                            onClick={() => handleViewContract(contract)}
                          >
                            <td className="px-4 py-3 align-top">
                              <div className="font-semibold text-gray-900 dark:text-gray-100">{contract.title}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {contract.reference_number || 'No reference'}
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top text-gray-700 dark:text-gray-200">{contract.first_party || '—'}</td>
                            <td className="px-4 py-3 align-top text-gray-700 dark:text-gray-200">{contract.vendor}</td>
                            <td className="px-4 py-3 align-top text-gray-700 dark:text-gray-200">
                              {contract.source_request_id ? `#${contract.source_request_id}` : '—'}
                            </td>
                            <td className="px-4 py-3 align-top text-gray-700 dark:text-gray-200">{contractValue ?? '—'}</td>
                            <td className="px-4 py-3 align-top text-gray-700 dark:text-gray-200">{estimatedValue ?? '—'}</td>
                            <td className="px-4 py-3 align-top">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {paidSummary.formattedPaid ?? '—'}
                                  </span>
                                  <span className="text-gray-500 dark:text-gray-400">
                                    {paidSummary.formattedTotal ? `of ${paidSummary.formattedTotal}` : 'No total set'}
                                  </span>
                                </div>
                                {paidSummary.percent !== null ? (
                                  <div className="h-2.5 rounded-full bg-gray-200 dark:bg-gray-800">
                                    <div
                                      className={`h-2.5 rounded-full ${paidBarTone}`}
                                      style={{ width: `${Math.min(paidSummary.percent, 100)}%` }}
                                    />
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                    Track value to see coverage
                                  </div>
                                )}
                                {paidSummary.percent !== null && (
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                    {paidSummary.percent}% paid
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top">{renderStatusBadge(contract.status)}</td>
                            <td className="px-4 py-3 align-top text-gray-700 dark:text-gray-200">{renderExpiry(contract)}</td>
                            <td className="px-4 py-3 align-top">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleSelectContract(contract);
                                  }}
                                  className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleRenew(contract);
                                  }}
                                  disabled={renewingId === contract.id}
                                  className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                  {renewingId === contract.id ? 'Renewing...' : 'Renew'}
                                </button>
                                {contract.status !== 'archived' ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleArchive(contract.id);
                                    }}
                                    disabled={archivingId === contract.id}
                                    className="rounded-md border border-transparent bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                                  >
                                    {archivingId === contract.id ? 'Archiving...' : 'Archive'}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleUnarchive(contract.id);
                                    }}
                                    disabled={unarchivingId === contract.id}
                                    className="rounded-md border border-transparent bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
                                  >
                                    {unarchivingId === contract.id ? 'Restoring...' : 'Unarchive'}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDeleteContract(contract.id);
                                  }}
                                  disabled={deletingId === contract.id}
                                  className="rounded-md border border-transparent bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-60 dark:bg-rose-900/30 dark:text-rose-200 dark:hover:bg-rose-900/50"
                                >
                                  {deletingId === contract.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {(editingId || viewingContract) && (
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-b from-white via-white to-blue-50/60 p-6 shadow-lg ring-1 ring-blue-50 dark:border-blue-900/50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950/20 dark:ring-blue-900/40">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {isCreatePage
                      ? 'Create a new contract'
                      : editingId
                      ? 'Edit contract'
                      : viewingContract
                      ? 'Contract details'
                      : 'Create a new contract'}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {isCreatePage
                      ? 'Capture supplier agreements, contract periods, and renewal information.'
                      : editingId
                      ? 'Update the selected contract. All changes are tracked with timestamps.'
                      : viewingContract
                      ? 'Review the contract details below. Click Edit to make changes.'
                      : 'Capture supplier agreements, contract periods, and renewal information.'}
                  </p>
                </div>
                {(editingId || isCreatePage) && (
                  <button
                    type="button"
                    onClick={() => {
                      cancelEditing();
                      navigate('/contracts');
                    }}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700 focus:outline-none focus:underline"
                  >
                    Back to contracts
                  </button>
                )}
              </div>

              {editingId ? (
                <ContractForm
                  formState={formState}
                  handleInputChange={handleInputChange}
                  handleSubmit={handleSubmit}
                  saving={saving}
                  editingId={editingId}
                  handleArchive={handleArchive}
                  archivingId={archivingId}
                  formError={formError}
                  successMessage={successMessage}
                  statusOptions={statusOptions}
                  departments={departments}
                  departmentsLoading={departmentsLoading}
                  departmentsError={departmentsError}
                  users={users}
                  usersLoading={usersLoading}
                  usersError={usersError}
                  suppliers={suppliers}
                  suppliersLoading={suppliersLoading}
                  suppliersError={suppliersError}
                />
              ) : (
                <div className="mt-4 space-y-4">
                  {!viewingContract && (
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      Select a contract from the list to view details, or use <span className="font-semibold">Create new contract</span> to add one.
                    </div>
                  )}
                  {selectedContractInsights && (
                    <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/30">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-200">
                            Lifecycle snapshot
                          </p>
                          <p className="text-sm text-blue-900 dark:text-blue-100">{selectedContractInsights.renewalHint}</p>
                        </div>
                        {selectedContractInsights.paidCoverage !== null && (
                          <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm ring-1 ring-blue-100 dark:bg-blue-900 dark:text-blue-100 dark:ring-blue-800">
                            {selectedContractInsights.paidCoverage}% paid coverage
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        {selectedContractInsights.timeline.map((milestone) => (
                          <div
                            key={milestone.label}
                            className="rounded-md border border-blue-100 bg-white/70 px-3 py-2 shadow-sm dark:border-blue-900/50 dark:bg-blue-900/30"
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-200">
                              {milestone.label}
                            </p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {formatDate(milestone.date?.toISOString()) || 'Not set'}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-300">{milestone.detail}</p>
                          </div>
                        ))}
                      </div>

                      {selectedContractInsights.progress !== null && (
                        <div className="mt-4 space-y-1">
                          <div className="flex items-center justify-between text-xs text-gray-700 dark:text-gray-200">
                            <span className="font-semibold">Timeline progress</span>
                            <span>{selectedContractInsights.progress.toFixed(0)}%</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-blue-100 dark:bg-blue-900/40">
                            <div
                              className="h-2.5 rounded-full bg-blue-600 dark:bg-blue-400"
                              style={{ width: `${selectedContractInsights.progress}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-gray-600 dark:text-gray-300">
                            {selectedContractInsights.expirySummary}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {viewingContract && (
                    <>
                      <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Vendor</h3>
                      <p className="mt-1 text-gray-900 dark:text-gray-100">{viewingContract.vendor}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Contract type</h3>
                      <p className="mt-1 text-gray-900 dark:text-gray-100">
                        {(viewingContract.contract_type || 'purchasing')
                          .toString()
                          .replace(/^[a-z]/, (char) => char.toUpperCase())}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">First party</h3>
                      <p className="mt-1 text-gray-900 dark:text-gray-100">
                        {viewingContract.first_party || <span className="italic text-gray-500">Not specified</span>}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Second party</h3>
                      <p className="mt-1 text-gray-900 dark:text-gray-100">
                        {viewingContract.second_party || <span className="italic text-gray-500">Not specified</span>}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Currency</h3>
                      <p className="mt-1 text-gray-900 dark:text-gray-100">{normalizeCurrency(viewingContract.currency)}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Supplier record</h3>
                      <p className="mt-1 text-gray-900 dark:text-gray-100">
                        {viewingContract.supplier_id
                          ? `Supplier #${viewingContract.supplier_id}`
                          : 'Not linked to a supplier profile'}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Reference number</h3>
                      <p className="mt-1 text-gray-900 dark:text-gray-100">
                        {viewingContract.reference_number || <span className="italic text-gray-500">None</span>}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Source request</h3>
                      <p className="mt-1 text-gray-900 dark:text-gray-100">
                        {viewingContract.source_request_id
                          ? `Request #${viewingContract.source_request_id}`
                          : 'No originating request linked'}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Start date</h3>
                      <p className="mt-1 text-gray-900 dark:text-gray-100">
                        {viewingContract.start_date || <span className="italic text-gray-500">Not set</span>}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Signing date</h3>
                      <p className="mt-1 text-gray-900 dark:text-gray-100">
                        {viewingContract.signing_date || <span className="italic text-gray-500">Not set</span>}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">End date</h3>
                      <p className="mt-1 text-gray-900 dark:text-gray-100">
                        {viewingContract.end_date || <span className="italic text-gray-500">Not set</span>}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Contract value</h3>
                      <p className="mt-1 text-gray-900 dark:text-gray-100">
                        {formatCurrency(viewingContract.contract_value, viewingContract.currency) ?? '—'}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Paid to date</h3>
                      {(() => {
                        const paidSummary = getPaidSummary(viewingContract);
                        return (
                          <div className="mt-1 space-y-1">
                            <div className="text-gray-900 dark:text-gray-100">
                              {paidSummary.formattedPaid ?? '—'}
                              {paidSummary.formattedTotal ? ` of ${paidSummary.formattedTotal}` : ''}
                            </div>
                            {paidSummary.percent !== null ? (
                              <>
                                <div className="h-2.5 rounded-full bg-gray-200 dark:bg-gray-800">
                                  <div
                                    className="h-2.5 rounded-full bg-emerald-500"
                                    style={{ width: `${Math.min(paidSummary.percent, 100)}%` }}
                                  />
                                </div>
                                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                  {paidSummary.percent}% paid
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-gray-500 dark:text-gray-400">Add a contract value to track coverage.</p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</h3>
                      <div className="mt-1">{renderStatusBadge(viewingContract.status)}</div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">End user department</h3>
                      <p className="mt-1 text-gray-900 dark:text-gray-100">
                        {viewingContract.end_user_department_id
                          ? getDepartmentName(viewingContract.end_user_department_id) ||
                            `Department #${viewingContract.end_user_department_id}`
                          : 'None selected (evaluations route to CMO/COO)'}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Contract manager</h3>
                      <p className="mt-1 text-gray-900 dark:text-gray-100">
                        {viewingContract.contract_manager_id
                          ? getContractManagerLabel(viewingContract.contract_manager_id) ||
                            `User #${viewingContract.contract_manager_id}`
                          : 'Not assigned'}
                      </p>
                    </div>
                    <div className="sm:col-span-2 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment register</h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {contractPayments.length} payment{contractPayments.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <form onSubmit={handleCreatePayment} className="grid gap-2 sm:grid-cols-4">
                        <input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Amount" className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                        <input type="date" value={paymentForm.payment_date} onChange={(event) => setPaymentForm((current) => ({ ...current, payment_date: event.target.value }))} className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                        <input type="text" value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes (optional)" className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                        <button type="submit" disabled={addingPayment} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                          {addingPayment ? 'Saving...' : 'Register payment'}
                        </button>
                      </form>
                      {paymentsError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{paymentsError}</p>}
                      <div className="mt-3 max-h-48 overflow-auto">
                        {paymentsLoading ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">Loading payments…</p>
                        ) : contractPayments.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No payments registered yet.</p>
                        ) : (
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                                <th className="py-1">Date</th>
                                <th className="py-1">Amount</th>
                                <th className="py-1">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {contractPayments.map((payment) => (
                                <tr key={payment.id} className="border-t border-gray-200 dark:border-gray-700">
                                  <td className="py-1">{formatDate(payment.payment_date) || '—'}</td>
                                  <td className="py-1">{formatCurrency(payment.amount) ?? '—'}</td>
                                  <td className="py-1 text-gray-600 dark:text-gray-300">{payment.notes || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Technical departments</h3>
                      <p className="mt-1 text-gray-900 dark:text-gray-100">
                        {(() => {
                          const labels = getTechnicalDepartmentLabels(
                            viewingContract.technical_department_ids
                          );
                          if (!labels.length) {
                            return (
                              <span className="italic text-gray-500 dark:text-gray-400">
                                No technical departments assigned
                              </span>
                            );
                          }
                          return labels.join(', ');
                        })()}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes</h3>
                      <p className="mt-1 text-gray-800 dark:text-gray-200">
                        {viewingContract.description || <span className="italic text-gray-500">No notes</span>}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Delivery Terms</h3>
                      <p className="mt-1 text-gray-800 dark:text-gray-200">
                        {viewingContract.delivery_terms || <span className="italic text-gray-500">Not specified</span>}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Warranty Terms</h3>
                      <p className="mt-1 text-gray-800 dark:text-gray-200">
                        {viewingContract.warranty_terms || <span className="italic text-gray-500">Not specified</span>}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Performance Management</h3>
                      <p className="mt-1 text-gray-800 dark:text-gray-200">
                        {viewingContract.performance_management || <span className="italic text-gray-500">Not specified</span>}
                      </p>
                    </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleSelectContract(viewingContract)}
                          className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          Edit contract
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewingContract(null)}
                          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          Close
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            )}

            {(editingId || viewingContract) && (
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-4 flex flex-wrap gap-2">
                  {['documents', 'obligations', 'renewals', 'financials', 'items', 'approvals', 'consumption', 'risk', 'ai_summary'].map((tab) => (
                    <button key={tab} type="button" onClick={() => setDetailTab(tab)} className={`rounded px-3 py-1 text-sm ${detailTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                      {tab === 'documents' ? 'Documents' : tab === 'obligations' ? 'Obligations' : tab === 'renewals' ? 'Renewals' : tab === 'financials' ? 'Financials' : tab === 'items' ? 'Items / Price Catalog' : tab === 'approvals' ? 'Approvals' : tab === 'consumption' ? 'Consumption' : tab === 'ai_summary' ? 'AI Summary' : 'Risk & Compliance'}
                    </button>
                  ))}
                </div>
                {detailTab === 'documents' && <>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Required Documents Checklist</h3>
                <div className="mt-4 space-y-4">
                  <ul className="space-y-2 text-sm">
                    {checklist.map((document) => (
                      <li key={document.id} className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 dark:border-gray-700">
                        <label className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                          <input
                            type="checkbox"
                            checked={Boolean(document.is_uploaded)}
                            disabled={checklistSavingId === document.id}
                            onChange={(event) => handleChecklistToggle(document.id, event.target.checked)}
                          />
                          <span>{document.document_type}</span>
                        </label>
                        <span className={document.is_uploaded ? 'text-green-600' : 'text-rose-600'}>
                          {document.is_uploaded ? 'Checked' : 'Unchecked'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                </>}

                {detailTab === 'obligations' && <div className="space-y-2"><button type="button" className="rounded bg-blue-600 px-3 py-1 text-sm text-white" onClick={async()=>{const id=editingId||viewingContract?.id; await api.post(`/contracts/${id}/obligations`,{title:'New obligation',obligation_type:'general',priority:'medium',status:'open'}); const {data}=await api.get(`/contracts/${id}/obligations`); setObligations(data||[]);}}>Add Obligation</button>{obligations.map((o)=><div key={o.id} className="rounded border p-2 text-sm"><div className="font-medium">{o.title}</div><div>{o.obligation_type} · due {o.due_date || '—'} · {o.recurrence} · {o.priority} · {o.computed_status || o.status}</div><div className="mt-1 flex gap-2"><button className="rounded bg-emerald-600 px-2 py-1 text-xs text-white" onClick={async()=>{const id=editingId||viewingContract?.id; await api.patch(`/contracts/${id}/obligations/${o.id}/complete`,{completion_notes:'Completed from UI'}); const {data}=await api.get(`/contracts/${id}/obligations`); setObligations(data||[]);}}>Complete</button><button className="rounded bg-amber-600 px-2 py-1 text-xs text-white" onClick={async()=>{const id=editingId||viewingContract?.id; await api.patch(`/contracts/${id}/obligations/${o.id}/waive`,{notes:'Waived'}); const {data}=await api.get(`/contracts/${id}/obligations`); setObligations(data||[]);}}>Waive</button><button className="rounded bg-rose-600 px-2 py-1 text-xs text-white" onClick={async()=>{const id=editingId||viewingContract?.id; await api.patch(`/contracts/${id}/obligations/${o.id}/cancel`,{notes:'Cancelled'}); const {data}=await api.get(`/contracts/${id}/obligations`); setObligations(data||[]);}}>Cancel</button></div></div>)}</div>}
                {detailTab === 'renewals' && <div className="space-y-2"><button type="button" className="rounded bg-blue-600 px-3 py-1 text-sm text-white" onClick={async()=>{const id=editingId||viewingContract?.id; await api.post(`/contracts/${id}/renewal-events`,{renewal_type:'manual',renewal_date:new Date().toISOString().slice(0,10),notice_days:90}); const {data}=await api.get(`/contracts/${id}/renewal-events`); setRenewalEvents(data||[]);}}>Add Renewal Event</button>{renewalEvents.map((r)=><div key={r.id} className="rounded border p-2 text-sm">{r.renewal_date || '—'} · alert {r.alert_date || '—'} · {r.notice_days} days · {r.status} · {r.decision || '—'} <button className="ml-2 rounded bg-indigo-600 px-2 py-1 text-xs text-white" onClick={async()=>{const id=editingId||viewingContract?.id; await api.patch(`/contracts/${id}/renewal-events/${r.id}/decision`,{decision:'renew',decision_notes:'Approved'}); const {data}=await api.get(`/contracts/${id}/renewal-events`); setRenewalEvents(data||[]);}}>Decide Renew</button></div>)}</div>}

                {detailTab === 'financials' && <div className="space-y-2 text-sm"><div className="grid grid-cols-2 gap-2 md:grid-cols-3"><div className="rounded border p-2">Contract: {financialSummary?.contract_value ?? '—'}</div><div className="rounded border p-2">Invoiced: {financialSummary?.total_invoiced ?? '—'}</div><div className="rounded border p-2">Paid: {financialSummary?.total_paid ?? '—'}</div><div className="rounded border p-2">Consumed: {financialSummary?.total_consumed ?? '—'}</div><div className="rounded border p-2">Remaining: {financialSummary?.remaining_contract_value ?? '—'}</div><div className="rounded border p-2">Warn/Fail: {(financialSummary?.matching_warning_count||0)}/{(financialSummary?.matching_failed_count||0)}</div></div><div>Invoices: {invoices.length} | Payments: {payments.length} | Consumption: {consumptionEntries.length}</div></div>}
                {detailTab === 'items' && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Contracted items cycle</h3>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        Add every item covered by this agreement. Purchase requesters should select the matching contracted item so ordered quantities, delivery performance, and contract consumption stay connected to this contract.
                      </p>
                      {stockItemsError && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{stockItemsError}</p>}
                      <form onSubmit={handleCreateContractItem} className="mt-4 grid gap-3 md:grid-cols-4">
                        <select name="item_id" value={contractItemForm.item_id} onChange={handleContractStockItemSelection} className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                          <option value="">Define item manually</option>
                          {stockItems.map((stockItem) => (
                            <option key={stockItem.id} value={stockItem.id}>{stockItem.name}{stockItem.brand ? ` • ${stockItem.brand}` : ''}</option>
                          ))}
                        </select>
                        <input name="item_name" value={contractItemForm.item_name} onChange={handleContractItemInputChange} placeholder="Item name *" className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                        <input name="unit" value={contractItemForm.unit} onChange={handleContractItemInputChange} placeholder="Unit" className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                        <input name="contracted_price" value={contractItemForm.contracted_price} onChange={handleContractItemInputChange} placeholder="Contracted price" type="number" step="0.01" className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                        <input name="currency" value={contractItemForm.currency} onChange={handleContractItemInputChange} placeholder={viewingContract?.currency || formState.currency || 'IQD'} className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                        <input name="requested_quantity" value={contractItemForm.requested_quantity} onChange={handleContractItemInputChange} placeholder="Contract quantity" type="number" step="0.01" className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                        <input name="delivered_quantity" value={contractItemForm.delivered_quantity} onChange={handleContractItemInputChange} placeholder="Delivered quantity" type="number" step="0.01" className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                        <input name="lead_time_days" value={contractItemForm.lead_time_days} onChange={handleContractItemInputChange} placeholder="Lead time days" type="number" className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                        <input name="notes" value={contractItemForm.notes} onChange={handleContractItemInputChange} placeholder="Notes / requester guidance" className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                        <div className="md:col-span-4 flex items-center justify-between gap-3">
                          {contractItemError && <p className="text-sm text-red-600">{contractItemError}</p>}
                          <button type="submit" disabled={savingContractItem} className="ml-auto rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{savingContractItem ? 'Adding...' : 'Add contracted item'}</button>
                        </div>
                      </form>
                    </div>
                    {contractItems.length === 0 ? <p className="text-sm text-gray-500">No contracted items have been added yet.</p> : contractItems.map((it) => {
                      const requested = Number(it.requested_quantity || 0);
                      const delivered = Number(it.delivered_quantity || 0);
                      const deliveryPercent = requested > 0 ? Math.min(100, Math.round((delivered / requested) * 100)) : null;
                      return <div key={it.id} className="rounded border p-3 text-sm dark:border-gray-700"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-gray-900 dark:text-gray-100">{it.item_name}</p>{it.item_id && <p className="text-xs text-blue-600 dark:text-blue-300">Linked stock item #{it.item_id}</p>}<p className="text-gray-600 dark:text-gray-300">{it.unit || 'Unit —'} · {it.contracted_price || '—'} {it.currency || ''} · lead time {it.lead_time_days || '—'} days</p><p className="text-xs text-gray-500">{it.notes || 'No requester guidance.'}</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${it.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{it.is_active ? 'Selectable' : 'Inactive'}</span></div><div className="mt-3"><div className="flex justify-between text-xs text-gray-600 dark:text-gray-300"><span>Delivered {delivered || 0} of {requested || '—'}</span><span>{deliveryPercent === null ? 'No contract quantity' : `${deliveryPercent}% delivered`}</span></div>{deliveryPercent !== null && <div className="mt-1 h-2 rounded-full bg-gray-200 dark:bg-gray-800"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${deliveryPercent}%` }} /></div>}</div></div>;
                    })}
                  </div>
                )}
                {detailTab === 'approvals' && <div className="space-y-2"><button type="button" onClick={async()=>{const id=editingId||viewingContract?.id; await api.post(`/contracts/${id}/submit-review`); const {data}=await api.get(`/contracts/${id}/approvals`); setApprovals(data||[]);}} className="rounded bg-blue-600 px-3 py-1 text-sm text-white">Submit for Review</button>{approvals.map((a)=><div key={a.id} className="rounded border p-2 text-sm">L{a.approval_level} {a.stage} - {a.status} {a.is_active ? '(Active)' : ''}</div>)}</div>}
                {detailTab === 'consumption' && consumption && <div className="text-sm space-y-1"><p>Consumed: {consumption.actual_consumed_value}</p><p>Paid: {consumption.paid_amount}</p><p>Remaining: {consumption.remaining_balance}</p><p>Consumed %: {consumption.consumed_percentage}</p></div>}
                {detailTab === 'risk' && <div className="text-sm space-y-2"><div className="rounded border p-2"><p>Risk: <span className="font-semibold">{risk?.risk_level || '—'}</span> ({risk?.risk_score ?? '—'})</p><button type="button" className="mt-1 rounded bg-indigo-600 px-2 py-1 text-xs text-white" onClick={async()=>{const id=editingId||viewingContract?.id; const {data}=await api.post(`/contracts/${id}/risk/recalculate`,{}); setRisk(data||null); const h=await api.get(`/contracts/${id}/risk/history`); setRiskHistory(h.data||[]);}}>Recalculate risk</button></div><div className="rounded border p-2"><p className="font-medium">Factors</p><ul className="list-disc pl-5">{(risk?.risk_factors||[]).map((f,i)=><li key={i}><span className="font-medium">{f.label || f.code}</span> (+{f.points}) — {f.explanation}</li>)}</ul></div><div className="rounded border p-2"><p className="font-medium">History</p>{riskHistory.slice(0,5).map((h)=><div key={h.id} className="text-xs">{h.assessed_at}: {h.risk_level} ({h.risk_score})</div>)}</div><div className="rounded border p-2"><p className="font-medium">Dashboard snapshot</p><div className="grid grid-cols-2 gap-1 text-xs md:grid-cols-4"><div>Low: {riskDashboard?.low_count ?? 0}</div><div>Medium: {riskDashboard?.medium_count ?? 0}</div><div>High: {riskDashboard?.high_count ?? 0}</div><div>Critical: {riskDashboard?.critical_count ?? 0}</div><div>Avg: {riskDashboard?.average_risk_score ?? 0}</div></div></div></div>}
                {detailTab === 'ai_summary' && <div className="space-y-2 text-sm"><button type="button" className="rounded bg-indigo-600 px-3 py-1 text-white text-xs" onClick={async()=>{try{const id=editingId||viewingContract?.id; await api.post(`/contracts/${id}/ai-extract`,{}); setAiMessage('Extraction requested successfully.');}catch(err){if(err?.response?.status===501){setAiMessage('AI extraction is prepared but no provider is configured yet.');}else{setAiMessage('Extraction failed.');}} const id=editingId||viewingContract?.id; const {data}=await api.get(`/contracts/${id}/ai-extractions`); setAiExtractions(data||[]);}}>Run AI Extraction</button>{aiMessage && <p className="text-xs text-slate-600">{aiMessage}</p>}{aiExtractions[0] ? <div className="rounded border p-2"><p>Status: {aiExtractions[0].extraction_status}</p><p>Summary: {aiExtractions[0].summary || '—'}</p><p>Parties: {JSON.stringify(aiExtractions[0].extracted_parties || {})}</p><p>Dates: {JSON.stringify(aiExtractions[0].extracted_dates || {})}</p><p>Value: {JSON.stringify(aiExtractions[0].extracted_value || {})}</p><p>Payment Terms: {JSON.stringify(aiExtractions[0].extracted_payment_terms || {})}</p><p>Renewal: {JSON.stringify(aiExtractions[0].extracted_renewal_clause || {})}</p><p>Termination: {JSON.stringify(aiExtractions[0].extracted_termination_clause || {})}</p><p>Obligations: {JSON.stringify(aiExtractions[0].extracted_obligations || [])}</p><p>Risks: {JSON.stringify(aiExtractions[0].extracted_risks || [])}</p></div> : <p>No AI extraction yet.</p>}</div>}
              </div>
            )}

            {(editingId || viewingContract) && (
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Contract Evaluations</h3>
                <div className="mt-4 space-y-4">
                  {evaluationsLoading ? (
                    <p className="text-sm text-gray-500">Loading evaluations...</p>
                  ) : evaluationsError ? (
                    <p className="text-sm text-red-600">{evaluationsError}</p>
                  ) : evaluations.length === 0 ? (
                    <p className="text-sm text-gray-500">No evaluations for this contract.</p>
                  ) : (
                    <ul className="space-y-2">
                      {evaluations.map((evaluation) => (
                        <li
                          key={evaluation.id}
                          className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                        >
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">
                              {evaluation.evaluation_criteria?.criterionName || 'Evaluation'}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-300">
                              Evaluator: {evaluation.evaluator_name || '—'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold capitalize text-gray-900 dark:text-gray-100">
                              {evaluation.status}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-300">
                              Overall score: {evaluation.evaluation_criteria?.overallScore ?? '—'}
                            </p>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                onClick={() => handleViewEvaluation(evaluation.id)}
                                className="rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                              >
                                View / Edit
                              </button>
                              <button
                                onClick={() => handleDeleteEvaluation(evaluation.id)}
                                disabled={deletingEvaluationId === evaluation.id}
                                className="rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200 disabled:opacity-60"
                              >
                                {deletingEvaluationId === evaluation.id ? 'Removing...' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {canInitiateEvaluations && (
                  <button
                    onClick={() => setIsEvaluationModalOpen(true)}
                    className="rounded-md bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Send for Evaluation
                  </button>
                  )}
                </div>
              </div>
            )}

            {isEvaluationModalOpen && viewingContract && (
              <ContractEvaluationForm
                contractId={viewingContract.id}
                onClose={() => {
                  setIsEvaluationModalOpen(false);
                  fetchEvaluations(viewingContract.id);
                }}
              />
            )}

          </div>
        </section>
        ) : (
          <section className="mx-auto max-w-4xl">
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-b from-white via-white to-blue-50/60 p-6 shadow-lg ring-1 ring-blue-50 dark:border-blue-900/50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950/20 dark:ring-blue-900/40">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Create a new contract</h2>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Capture supplier agreements, contract periods, and renewal information.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    cancelEditing();
                    navigate('/contracts');
                  }}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 focus:outline-none focus:underline"
                >
                  Back to contracts
                </button>
              </div>
              <ContractForm
                formState={formState}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                saving={saving}
                editingId={editingId}
                handleArchive={handleArchive}
                archivingId={archivingId}
                formError={formError}
                successMessage={successMessage}
                statusOptions={statusOptions}
                departments={departments}
                departmentsLoading={departmentsLoading}
                departmentsError={departmentsError}
                users={users}
                usersLoading={usersLoading}
                usersError={usersError}
                suppliers={suppliers}
                suppliersLoading={suppliersLoading}
                suppliersError={suppliersError}
              />
              <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">Contract tips</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Keep the reference number consistent with the signed agreement.</li>
                  <li>Use the notes section to track renewal discussions and milestones.</li>
                  <li>Archive contracts that are no longer active to keep the dashboard tidy.</li>
                </ul>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
};

export default ContractsPage;