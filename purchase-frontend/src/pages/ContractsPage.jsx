import React, { useCallback, useEffect, useMemo, useState } from 'react';
import saveAs from 'file-saver';
import { useLocation, useNavigate } from 'react-router-dom';
import ContractForm from '../components/ContractForm';
import ContractEvaluationForm from '../components/ContractEvaluationForm';
import api from '../api/axios';
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
  { value: 'active', label: 'Active' },
  { value: 'on-hold', label: 'On hold' },
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
  'on-hold': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
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
  status: 'active',
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

  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState('');
  const [deletingAttachmentId, setDeletingAttachmentId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

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
      const { data } = await api.get('/api/contracts', { params });
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
        const { data } = await api.get('/api/departments');
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
        const { data } = await api.get('/api/users');
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
        const { data } = await api.get('/api/suppliers');
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
      const { data } = await api.get('/api/suppliers');
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

  const fetchAttachments = useCallback(async (contractId) => {
    if (!contractId) {
      setAttachments([]);
      return;
    }
    setAttachmentsLoading(true);
    setAttachmentsError('');
    try {
      const { data } = await api.get(`/api/contracts/${contractId}/attachments`);
      setAttachments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load attachments', err);
      setAttachmentsError('Unable to load attachments.');
    } finally {
      setAttachmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    const contractId = editingId || viewingContract?.id;
    if (contractId) {
      fetchAttachments(contractId);
    } else {
      setAttachments([]);
    }
  }, [editingId, viewingContract, fetchAttachments]);

  const fetchEvaluations = useCallback(async (contractId) => {
    if (!contractId) {
      setEvaluations([]);
      return;
    }
    setEvaluationsLoading(true);
    setEvaluationsError('');
    try {
      const { data } = await api.get('/api/contract-evaluations', {
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
      await api.delete(`/api/contract-evaluations/${evaluationId}`);
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

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile || !editingId) return;
    setUploading(true);
    setAttachmentsError('');
    const formData = new FormData();
    formData.append('file', selectedFile);
    try {
      await api.post(`/api/contracts/${editingId}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setSelectedFile(null);
      await fetchAttachments(editingId);
    } catch (err) {
      console.error('Failed to upload attachment', err);
      setAttachmentsError(err?.response?.data?.message || 'Failed to upload attachment.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!viewingContract && !editingId) return;

    const activeContractId = editingId || viewingContract?.id;
    if (!activeContractId) return;

    if (!window.confirm('Remove this attachment from the contract?')) {
      return;
    }

    setDeletingAttachmentId(attachmentId);
    setAttachmentsError('');

    try {
      await api.delete(`/api/contracts/${activeContractId}/attachments/${attachmentId}`);
      await fetchAttachments(activeContractId);
    } catch (err) {
      console.error('Failed to delete attachment', err);
      setAttachmentsError(err?.response?.data?.message || 'Failed to delete attachment.');
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const handleDownload = async (attachment) => {
    try {
      const response = await api.get(attachment.url, {
        responseType: 'blob',
      });
      saveAs(response.data, attachment.fileName);
    } catch (err) {
      console.error('Failed to download attachment', err);
    }
  };

  const handleInputChange = (event) => {
    const { name, value, selectedOptions } = event.target;

    if (name === 'technical_department_ids' || name === 'delivery_packaging_requirements' || name === 'delivery_transportation_requirements' || name === 'payment_methods') {
      const selected = Array.from(selectedOptions || [], (option) => option.value);
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
      commercial_terms: formState.commercial_terms.trim() || null,
      compliance_legal_terms: formState.compliance_legal_terms.trim() || null,
      financial_payment_control: formState.financial_payment_control.trim() || null,
      risk_dispute_management: formState.risk_dispute_management.trim() || null,
      digital_attachments_tracking: formState.digital_attachments_tracking.trim() || null,
      institute: formState.institute.trim() || null,
      contract_category: formState.contract_category.trim() || null,
      renewal_type: formState.renewal_type.trim() || null,
      contract_owner: formState.contract_owner.trim() || null,
      currency: formState.currency.trim() || null,
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
    payload.estimated_contract_value =
      formState.estimated_contract_value === '' ? null : Number(formState.estimated_contract_value);
    payload.actual_consumed_value =
      formState.actual_consumed_value === '' ? null : Number(formState.actual_consumed_value);

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
      if (Number.isNaN(numericValue)) {
        setFormError('Contract value must be a valid number.');
        return;
      }
      payload.contract_value = numericValue;
    } else {
      payload.contract_value = null;
    }

    if (formState.amount_paid !== '') {
      const numericPaid = Number(formState.amount_paid);
      if (Number.isNaN(numericPaid)) {
        setFormError('Amount paid must be a valid number.');
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
        await api.patch(`/api/contracts/${editingId}`, payload);
        setSuccessMessage('Contract updated successfully.');
      } else {
        const { data: newContract } = await api.post('/api/contracts', payload);
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
      await api.patch(`/api/contracts/${contractId}/archive`);
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
      await api.patch(`/api/contracts/${contractId}/unarchive`);
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
      await api.post(`/api/contracts/${contract.id}/renew`, {
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
      await api.delete(`/api/contracts/${contractId}`);
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

  const isExpiringSoon = (contract) => {
    if (!contract || contract.is_expired) {
      return false;
    }

    const daysUntilExpiry = contract.days_until_expiry;
    return typeof daysUntilExpiry === 'number' && daysUntilExpiry >= 0 && daysUntilExpiry <= EXPIRING_SOON_THRESHOLD_DAYS;
  };

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

      const numericValue = Number(contract.contract_value);
      const numericPaid = Number(contract.amount_paid);
      if (Number.isFinite(numericValue)) {
        stats.totalValue += numericValue;
      }
      if (Number.isFinite(numericPaid)) {
        stats.totalPaid += numericPaid;
      }

      if (contract.is_expired) {
        stats.expired += 1;
        return;
      }

      if (isExpiringSoon(contract)) {
        stats.expiringSoon += 1;
      }

      const daysUntilExpiry = contract.days_until_expiry;
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
  }, [contracts]);

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
  }, [contracts, renewalFilter]);

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
            <td>${formatCurrency(contract.contract_value) ?? ''}</td>
            <td>${formatCurrency(contract.amount_paid) ?? ''}</td>
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
  }, [sortedContracts]);

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

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;

    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numeric);
  };

  const getPaidSummary = (contract) => {
    const paidValue = Number(contract?.amount_paid);
    const totalValue = Number(contract?.contract_value);
    const hasPaid = Number.isFinite(paidValue);
    const hasTotal = Number.isFinite(totalValue) && totalValue > 0;

    const percent = hasTotal && hasPaid ? Math.min((paidValue / totalValue) * 100, 9999) : null;

    return {
      formattedPaid: hasPaid ? formatCurrency(paidValue) : null,
      formattedTotal: hasTotal ? formatCurrency(totalValue) : null,
      percent: percent !== null ? Number(percent.toFixed(1)) : null,
    };
  };

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
            value={formatCurrency(totalPaid) ?? '—'}
            description={
              totalValue
                ? `of ${formatCurrency(totalValue)}${paidCoverage !== null ? ` • ${paidCoverage}% paid` : ''}`
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
                    const contractValue = formatCurrency(contract.contract_value);
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
                        <td colSpan={9} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-300">
                          Loading contracts...
                        </td>
                      </tr>
                    ) : sortedContracts.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-300">
                          No contracts match your current filters.
                        </td>
                      </tr>
                    ) : (
                      sortedContracts.map((contract, index) => {
                        const isSelected = viewingContract?.id === contract.id;
                        const contractValue = formatCurrency(contract.contract_value);
                        const estimatedValue = formatCurrency(contract.estimated_contract_value);
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
                        {formatCurrency(viewingContract.contract_value) ?? '—'}
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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Attachments</h3>
                <div className="mt-4 space-y-4">
                  {attachmentsLoading ? (
                    <p className="text-sm text-gray-500">Loading attachments...</p>
                  ) : attachmentsError ? (
                    <p className="text-sm text-red-600">{attachmentsError}</p>
                  ) : attachments.length === 0 ? (
                    <p className="text-sm text-gray-500">No attachments for this contract.</p>
                  ) : (
                    <ul className="space-y-2">
                      {attachments.map((att) => (
                        <li key={att.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-3">
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {att.fileName}
                            </a>
                            <button
                              onClick={() => handleDownload(att)}
                              className="rounded-md bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-300"
                            >
                              Download
                            </button>
                          </div>
                          <button
                            onClick={() => handleDeleteAttachment(att.id)}
                            disabled={deletingAttachmentId === att.id}
                            className="rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200 disabled:opacity-60"
                          >
                            {deletingAttachmentId === att.id ? 'Removing...' : 'Delete'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {editingId && (
                    <div className="flex items-center space-x-2">
                      <input type="file" onChange={handleFileChange} className="text-sm" />
                      <button
                        onClick={handleUpload}
                        disabled={!selectedFile || uploading}
                        className="rounded-md bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {uploading ? 'Uploading...' : 'Upload'}
                      </button>
                    </div>
                  )}
                </div>
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