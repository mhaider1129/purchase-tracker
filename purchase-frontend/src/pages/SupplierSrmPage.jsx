import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, FileText, Gavel, PackageCheck, Plus, Receipt, Shield, UsersRound, X } from "lucide-react";
import {
  createSupplierPrincipal,
  deactivateSupplierPrincipal,
  getSuppliersDashboard,
  listSupplierPrincipals,
  listSuppliers,
  suspendSupplierPrincipal,
  updateSupplierClassification,
  updateSupplierPrincipal,
  verifySupplierPrincipal,
} from "../api/suppliers";
import { listItemMaster } from "../api/itemMaster";
import {
  createComplianceArtifact,
  createSupplierIssue,
  createSupplierScorecard,
  getSupplierSrmStatus,
  listComplianceArtifacts,
  listSupplierIssues,
  listSupplierScorecards,
  updateSupplierIssue,
} from "../api/supplierSrm";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const SUPPLIER_CATEGORY_OPTIONS = [
  "Medical Equipment",
  "Medical Consumables",
  "Pharmaceuticals",
  "Laboratory Supplies",
  "Maintenance & Spare Parts",
  "IT & Software",
  "Facilities & Construction",
  "Professional Services",
  "Logistics & Transport",
  "Office & General Supplies",
];

const PRINCIPAL_COUNTRY_OPTIONS = [
  "Iraq",
  "United Arab Emirates",
  "Saudi Arabia",
  "Jordan",
  "Turkey",
  "Germany",
  "United States",
  "United Kingdom",
  "China",
  "India",
  "Japan",
  "South Korea",
  "France",
  "Italy",
  "Netherlands",
  "Switzerland",
];

const FALLBACK_AUTHORIZATION_CATEGORIES = [
  "Medical Equipment",
  "Medical Consumables",
  "Pharmaceuticals",
  "Laboratory Supplies",
  "Maintenance Spare Parts",
  "IT Equipment",
  "Stationery",
  "General Items",
  "Services",
];

const FALLBACK_AUTHORIZATION_BRANDS = [
  "Generic / No brand-specific authorization",
  "Multi-brand authorization",
  "Principal brand only",
];

const uniqueSorted = (values = []) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
const csvToArray = (value) => (typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : Array.isArray(value) ? value : []);

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const SupplierSrmPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [dashboardData, setDashboardData] = useState({});

  const [overview, setOverview] = useState(null);
  const [scorecards, setScorecards] = useState([]);
  const [issues, setIssues] = useState([]);
  const [compliance, setCompliance] = useState([]);
  const [principals, setPrincipals] = useState([]);
  const [itemReferenceOptions, setItemReferenceOptions] = useState({ categories: [], brands: [] });
  const [classificationForm, setClassificationForm] = useState({
    supplier_type: "Local Trader",
    is_manufacturer: false,
    is_authorized_agent: false,
    is_authorized_distributor: false,
    is_sub_distributor: false,
    is_service_provider: false,
    is_contractor: false,
    regulatory_risk_level: "medium",
    supplier_category: "",
    notes: "",
  });
  const [principalForm, setPrincipalForm] = useState({
    id: null,
    principal_name: "",
    principal_country: "",
    relationship_type: "Authorized Distributor",
    authorization_status: "Pending Verification",
    authorization_start_date: "",
    authorization_expiry_date: "",
    authorized_categories: "",
    authorized_brands: "",
    authorization_document_url: "",
    verification_notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [scorecardForm, setScorecardForm] = useState({
    otif_score: "",
    quality_defects: "",
    lead_time_variance: "",
    period_start: "",
    period_end: "",
    notes: "",
  });

  const [issueForm, setIssueForm] = useState({
    description: "",
    severity: "medium",
    status: "open",
    due_date: "",
    capa_required: false,
    capa_plan: "",
  });

  const [complianceForm, setComplianceForm] = useState({
    artifact_type: "Certification",
    name: "",
    document_url: "",
    expiry_date: "",
    status: "active",
    blocked: false,
  });

  const loadSuppliers = useCallback(async () => {
    try {
      const [data, dashboard] = await Promise.all([listSuppliers(), getSuppliersDashboard()]);
      setSuppliers(Array.isArray(data) ? data : []);
      setDashboardData(dashboard || {});
      if (!selectedSupplierId && Array.isArray(data) && data.length > 0) {
        setSelectedSupplierId(String(data[0].id));
      }
    } catch (err) {
      console.error("❌ Failed to load suppliers", err);
      setError("Failed to load suppliers");
    }
  }, [selectedSupplierId]);

  const loadItemReferenceOptions = useCallback(async () => {
    try {
      const data = await listItemMaster({ status: "approved" });
      const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.rows) ? data.rows : [];
      setItemReferenceOptions({
        categories: uniqueSorted(items.map((item) => item.category)),
        brands: uniqueSorted(items.map((item) => item.brand_name || item.brand)),
      });
    } catch (err) {
      console.warn("⚠️ Failed to load item master reference options for supplier principals", err);
      setItemReferenceOptions({ categories: [], brands: [] });
    }
  }, []);

  const loadSrmData = useCallback(async () => {
    if (!selectedSupplierId) return;
    setLoading(true);
    setError("");
    try {
      const supplierId = Number(selectedSupplierId);
      const [status, scorecardList, issueList, complianceList, principalList] = await Promise.all([
        getSupplierSrmStatus(supplierId),
        listSupplierScorecards(supplierId),
        listSupplierIssues(supplierId),
        listComplianceArtifacts(supplierId),
        listSupplierPrincipals(supplierId),
      ]);

      setOverview(status);
      setScorecards(scorecardList);
      setIssues(issueList);
      setCompliance(complianceList);
      setPrincipals(principalList);
    } catch (err) {
      console.error("❌ Failed to load SRM data", err);
      setError("Failed to load supplier SRM data");
      setOverview(null);
      setScorecards([]);
      setIssues([]);
      setCompliance([]);
      setPrincipals([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSupplierId]);

  useEffect(() => {
    loadSuppliers();
    loadItemReferenceOptions();
  }, [loadItemReferenceOptions, loadSuppliers]);

  useEffect(() => {
    loadSrmData();
  }, [loadSrmData]);

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => String(supplier.id) === String(selectedSupplierId)),
    [selectedSupplierId, suppliers],
  );

  useEffect(() => {
    if (!selectedSupplier) return;
    setClassificationForm({
      supplier_type: selectedSupplier.supplier_type || "Local Trader",
      is_manufacturer: Boolean(selectedSupplier.is_manufacturer),
      is_authorized_agent: Boolean(selectedSupplier.is_authorized_agent),
      is_authorized_distributor: Boolean(selectedSupplier.is_authorized_distributor),
      is_sub_distributor: Boolean(selectedSupplier.is_sub_distributor),
      is_service_provider: Boolean(selectedSupplier.is_service_provider),
      is_contractor: Boolean(selectedSupplier.is_contractor),
      regulatory_risk_level: selectedSupplier.regulatory_risk_level || "medium",
      supplier_category: selectedSupplier.supplier_category || "",
      notes: selectedSupplier.notes || "",
    });
  }, [selectedSupplier]);

  const authorizationCategoryOptions = useMemo(
    () => uniqueSorted([
      ...FALLBACK_AUTHORIZATION_CATEGORIES,
      ...SUPPLIER_CATEGORY_OPTIONS,
      ...itemReferenceOptions.categories,
      ...principals.flatMap((principal) => principal.authorized_categories || []),
    ]),
    [itemReferenceOptions.categories, principals],
  );

  const authorizationBrandOptions = useMemo(
    () => uniqueSorted([
      ...FALLBACK_AUTHORIZATION_BRANDS,
      ...itemReferenceOptions.brands,
      ...principals.flatMap((principal) => principal.authorized_brands || []),
    ]),
    [itemReferenceOptions.brands, principals],
  );

  const handleOpenEvaluations = () => {
    if (!selectedSupplier) return;

    const supplierName = selectedSupplier?.name?.trim();
    if (!supplierName) return;

    navigate(`/supplier-evaluations?supplier=${encodeURIComponent(supplierName)}`);
  };

  const handleScorecardSubmit = async (event) => {
    event.preventDefault();
    if (!selectedSupplierId) return;
    try {
      await createSupplierScorecard(Number(selectedSupplierId), {
        ...scorecardForm,
        quality_defects: scorecardForm.quality_defects
          ? Number(scorecardForm.quality_defects)
          : 0,
        lead_time_variance: scorecardForm.lead_time_variance
          ? Number(scorecardForm.lead_time_variance)
          : 0,
        otif_score: scorecardForm.otif_score ? Number(scorecardForm.otif_score) : 0,
      });
      setScorecardForm({
        otif_score: "",
        quality_defects: "",
        lead_time_variance: "",
        period_start: "",
        period_end: "",
        notes: "",
      });
      await loadSrmData();
    } catch (err) {
      console.error("❌ Failed to create scorecard", err);
      setError(err?.response?.data?.message || "Failed to create scorecard");
    }
  };

  const handleIssueSubmit = async (event) => {
    event.preventDefault();
    if (!selectedSupplierId) return;
    try {
      await createSupplierIssue(Number(selectedSupplierId), issueForm);
      setIssueForm({
        description: "",
        severity: "medium",
        status: "open",
        due_date: "",
        capa_required: false,
        capa_plan: "",
      });
      await loadSrmData();
    } catch (err) {
      console.error("❌ Failed to create issue", err);
      setError(err?.response?.data?.message || "Failed to create issue");
    }
  };

  const handleClassificationSubmit = async (event) => {
    event.preventDefault();
    if (!selectedSupplierId) return;
    try {
      await updateSupplierClassification(Number(selectedSupplierId), classificationForm);
      await loadSuppliers();
      await loadSrmData();
    } catch (err) {
      console.error("❌ Failed to update supplier classification", err);
      setError(err?.response?.data?.message || "Failed to update supplier classification");
    }
  };

  const resetPrincipalForm = () => setPrincipalForm({
    id: null,
    principal_name: "",
    principal_country: "",
    relationship_type: "Authorized Distributor",
    authorization_status: "Pending Verification",
    authorization_start_date: "",
    authorization_expiry_date: "",
    authorized_categories: "",
    authorized_brands: "",
    authorization_document_url: "",
    verification_notes: "",
  });

  const handlePrincipalSubmit = async (event) => {
    event.preventDefault();
    if (!selectedSupplierId) return;
    const payload = {
      ...principalForm,
      authorized_categories: csvToArray(principalForm.authorized_categories),
      authorized_brands: csvToArray(principalForm.authorized_brands),
    };
    try {
      if (principalForm.id) {
        await updateSupplierPrincipal(Number(selectedSupplierId), principalForm.id, payload);
      } else {
        await createSupplierPrincipal(Number(selectedSupplierId), payload);
      }
      resetPrincipalForm();
      await loadSrmData();
    } catch (err) {
      console.error("❌ Failed to save supplier principal", err);
      setError(err?.response?.data?.message || "Failed to save supplier principal");
    }
  };

  const handleEditPrincipal = (principal) => {
    setPrincipalForm({
      id: principal.id,
      principal_name: principal.principal_name || "",
      principal_country: principal.principal_country || "",
      relationship_type: principal.relationship_type || "Authorized Distributor",
      authorization_status: principal.authorization_status || "Pending Verification",
      authorization_start_date: principal.authorization_start_date?.slice?.(0, 10) || "",
      authorization_expiry_date: principal.authorization_expiry_date?.slice?.(0, 10) || "",
      authorized_categories: (principal.authorized_categories || []).join(", "),
      authorized_brands: (principal.authorized_brands || []).join(", "),
      authorization_document_url: principal.authorization_document_url || "",
      verification_notes: principal.verification_notes || "",
    });
  };

  const handleVerifyPrincipal = async (principalId) => {
    if (!selectedSupplierId) return;
    await verifySupplierPrincipal(Number(selectedSupplierId), principalId);
    await loadSrmData();
  };

  const handleSuspendPrincipal = async (principalId) => {
    if (!selectedSupplierId) return;
    const reason = window.prompt("Reason for suspension?");
    if (!reason) return;
    await suspendSupplierPrincipal(Number(selectedSupplierId), principalId, { reason });
    await loadSrmData();
  };

  const handleDeactivatePrincipal = async (principalId) => {
    if (!selectedSupplierId) return;
    await deactivateSupplierPrincipal(Number(selectedSupplierId), principalId);
    await loadSrmData();
  };

  const handleComplianceSubmit = async (event) => {
    event.preventDefault();
    if (!selectedSupplierId) return;
    try {
      await createComplianceArtifact(Number(selectedSupplierId), complianceForm);
      setComplianceForm({
        artifact_type: "Certification",
        name: "",
        document_url: "",
        expiry_date: "",
        status: "active",
        blocked: false,
      });
      await loadSrmData();
    } catch (err) {
      console.error("❌ Failed to create compliance artifact", err);
      setError(err?.response?.data?.message || "Failed to create compliance artifact");
    }
  };

  const handleIssueClose = async (issueId) => {
    try {
      await updateSupplierIssue(issueId, { status: "closed" });
      await loadSrmData();
    } catch (err) {
      console.error("❌ Failed to close issue", err);
      setError(err?.response?.data?.message || "Failed to close issue");
    }
  };

  const complianceBlocked = overview?.compliance?.blocked;
  const complianceExpiry = overview?.compliance?.next_expiry;
  const openIssues = overview?.open_issues ?? 0;
  const latestScorecard = overview?.latest_scorecard;
  const capaRequiredCount = issues.filter((item) => item.capa_required).length;

  const dashboardWidgets = [
    {
      title: "Suppliers by type",
      value: dashboardData.widgets?.suppliers_by_type?.length || 0,
      description: (dashboardData.widgets?.suppliers_by_type || []).map((item) => `${item.supplier_type}: ${item.supplier_count}`).join(" • ") || "No supplier types recorded",
      icon: UsersRound,
    },
    {
      title: "Expiring authorization letters",
      value: dashboardData.widgets?.expiring_authorizations_30_days?.length || 0,
      description: "Within 30 days",
      icon: AlertTriangle,
    },
    {
      title: "Unverified principals",
      value: dashboardData.widgets?.unverified_supplier_principals || 0,
      description: "Pending verification",
      icon: Shield,
    },
    {
      title: "High-risk suppliers",
      value: dashboardData.widgets?.high_risk_suppliers?.length || 0,
      description: "Risk level high or critical",
      icon: Gavel,
    },
    {
      title: "Expired authorizations",
      value: dashboardData.widgets?.expired_authorizations?.length || 0,
      description: "Represented companies requiring renewal",
      icon: X,
    },
  ];

  const workspaceTiles = [
    {
      title: "Active contracts",
      value: "Connect",
      description: "Attach contract governance records for this supplier.",
      icon: FileText,
    },
    {
      title: "POs",
      value: "Connect",
      description: "Link open and recently closed purchase orders.",
      icon: PackageCheck,
    },
    {
      title: "Delivery KPIs",
      value: latestScorecard?.otif_score ? `${latestScorecard.otif_score}% OTIF` : "No KPI yet",
      description: latestScorecard
        ? `Lead variance ${latestScorecard.lead_time_variance ?? "-"} days`
        : "Capture scorecards to unlock trend cards.",
      icon: ClipboardList,
    },
    {
      title: "Compliance docs",
      value: `${compliance.length}`,
      description: complianceBlocked ? "At least one artifact is blocked/expired." : "Compliance documents look healthy.",
      icon: Shield,
    },
    {
      title: "Invoices",
      value: "Connect",
      description: "Surface invoice status and aging for this supplier.",
      icon: Receipt,
    },
    {
      title: "Disputes",
      value: `${openIssues}`,
      description: openIssues > 0 ? "Open disputes require action." : "No open disputes.",
      icon: Gavel,
    },
    {
      title: "CAPA history",
      value: `${capaRequiredCount}`,
      description: capaRequiredCount > 0 ? "CAPA-linked issues tracked in SRM." : "No CAPA-linked issues yet.",
      icon: AlertTriangle,
    },
    {
      title: "Risk score",
      value: complianceBlocked || openIssues > 0 ? "Elevated" : "Low",
      description: "Calculated from compliance blocks and active supplier issues.",
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 transition-colors dark:bg-gray-950 dark:text-gray-100">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Supplier SRM</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Track performance scorecards, issues/CAPA, and compliance health for suppliers.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700 dark:text-gray-300" htmlFor="supplier-select">
                Supplier
              </label>
              <select
                id="supplier-select"
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
                value={selectedSupplierId}
                onChange={(event) => setSelectedSupplierId(event.target.value)}
              >
                <option value="" disabled>
                  Select supplier
                </option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleOpenEvaluations}
              disabled={!selectedSupplier}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-700/60 dark:bg-gray-900 dark:text-emerald-200 dark:hover:bg-gray-800"
            >
              <ClipboardList className="h-4 w-4" />
              Open evaluations
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-100">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {dashboardWidgets.map((widget) => (
            <OverviewCard
              key={widget.title}
              title={widget.title}
              value={widget.value}
              description={widget.description}
              icon={widget.icon}
              status={widget.value > 0 ? "warning" : "neutral"}
            />
          ))}
        </div>

        {!selectedSupplier && !loading && (
          <div className="mt-6 rounded-md border border-gray-200 bg-white px-4 py-6 text-center text-gray-700 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            {t("suppliersPage.empty")}
          </div>
        )}

        {selectedSupplier && (
          <Panel title={`Open Supplier Workspace • ${selectedSupplier?.name || "Supplier"}`} icon={ClipboardList}>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              Contextual workspace view for supplier operations: contracts, POs, delivery KPIs, compliance, invoices, disputes, CAPA history, and risk.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {workspaceTiles.map((tile) => {
                const Icon = tile.icon;
                return (
                  <article
                    key={tile.title}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3 shadow-sm dark:border-gray-800 dark:bg-gray-950"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tile.title}</h3>
                      <Icon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    </div>
                    <p className="text-base font-bold text-gray-900 dark:text-gray-100">{tile.value}</p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{tile.description}</p>
                  </article>
                );
              })}
            </div>
          </Panel>
        )}

        {selectedSupplier && (
          <div className="mt-6 rounded-lg border border-blue-100 bg-white p-4 shadow-sm dark:border-blue-900/60 dark:bg-gray-900">
            <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
              {["Overview", "Classification", "Principals / Represented Companies", "Compliance Documents", "Contracts", "Evaluations", "Risk & Scorecard", "Audit History"].map((tab) => (
                <span key={tab} className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100">{tab}</span>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Classification" icon={Shield}>
                <form className="space-y-3" onSubmit={handleClassificationSubmit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SelectField label="Supplier type" value={classificationForm.supplier_type} onChange={(event) => setClassificationForm((prev) => ({ ...prev, supplier_type: event.target.value }))} options={["Manufacturer", "Authorized Agent", "Authorized Distributor", "Sub-distributor", "Local Trader", "Service Provider", "Contractor"]} />
                    <SelectField label="Regulatory risk" value={classificationForm.regulatory_risk_level} onChange={(event) => setClassificationForm((prev) => ({ ...prev, regulatory_risk_level: event.target.value }))} options={["low", "medium", "high", "critical"]} />
                    <SelectField label="Supplier category" value={classificationForm.supplier_category} onChange={(event) => setClassificationForm((prev) => ({ ...prev, supplier_category: event.target.value }))} options={SUPPLIER_CATEGORY_OPTIONS} placeholder="Select category" />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["is_manufacturer", "Manufacturer"],
                      ["is_authorized_agent", "Authorized Agent"],
                      ["is_authorized_distributor", "Authorized Distributor"],
                      ["is_sub_distributor", "Sub-distributor"],
                      ["is_service_provider", "Service Provider"],
                      ["is_contractor", "Contractor"],
                    ].map(([field, label]) => (
                      <label key={field} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                        <input type="checkbox" checked={classificationForm[field]} onChange={(event) => setClassificationForm((prev) => ({ ...prev, [field]: event.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Notes</label>
                    <textarea className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" rows={3} value={classificationForm.notes} onChange={(event) => setClassificationForm((prev) => ({ ...prev, notes: event.target.value }))} />
                  </div>
                  <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Save classification</button>
                </form>
              </Panel>

              <Panel title="Add / Edit Principal" icon={Plus}>
                <form className="space-y-3" onSubmit={handlePrincipalSubmit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InputField label="Principal / Company Name" value={principalForm.principal_name} onChange={(event) => setPrincipalForm((prev) => ({ ...prev, principal_name: event.target.value }))} required />
                    <SelectField label="Country" value={principalForm.principal_country} onChange={(event) => setPrincipalForm((prev) => ({ ...prev, principal_country: event.target.value }))} options={PRINCIPAL_COUNTRY_OPTIONS} placeholder="Select country" />
                    <SelectField label="Relationship type" value={principalForm.relationship_type} onChange={(event) => setPrincipalForm((prev) => ({ ...prev, relationship_type: event.target.value }))} options={["Manufacturer", "Exclusive Agent", "Non-Exclusive Agent", "Authorized Distributor", "Sub-distributor", "Service Partner", "Maintenance Partner"]} />
                    <SelectField label="Authorization status" value={principalForm.authorization_status} onChange={(event) => setPrincipalForm((prev) => ({ ...prev, authorization_status: event.target.value }))} options={["Pending Verification", "Verified", "Expired", "Rejected", "Suspended"]} />
                    <InputField label="Start date" type="date" value={principalForm.authorization_start_date} onChange={(event) => setPrincipalForm((prev) => ({ ...prev, authorization_start_date: event.target.value }))} />
                    <InputField label="Expiry date" type="date" value={principalForm.authorization_expiry_date} onChange={(event) => setPrincipalForm((prev) => ({ ...prev, authorization_expiry_date: event.target.value }))} />
                    <MultiSelectField label="Authorized categories" value={csvToArray(principalForm.authorized_categories)} options={authorizationCategoryOptions} onChange={(values) => setPrincipalForm((prev) => ({ ...prev, authorized_categories: values.join(", ") }))} />
                    <MultiSelectField label="Authorized brands" value={csvToArray(principalForm.authorized_brands)} options={authorizationBrandOptions} onChange={(values) => setPrincipalForm((prev) => ({ ...prev, authorized_brands: values.join(", ") }))} />
                    <InputField label="Authorization document URL" value={principalForm.authorization_document_url} onChange={(event) => setPrincipalForm((prev) => ({ ...prev, authorization_document_url: event.target.value }))} />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{principalForm.id ? "Update principal" : "Add principal"}</button>
                    {principalForm.id && <button type="button" onClick={resetPrincipalForm} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Cancel edit</button>}
                  </div>
                </form>
              </Panel>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600 dark:bg-gray-950 dark:text-gray-300">
                  <tr>{["Principal / Company Name", "Country", "Relationship Type", "Authorized Categories", "Authorized Brands", "Authorization Status", "Start Date", "Expiry Date", "Expiry Status", "Verified By", "Verified At", "Actions"].map((head) => <th key={head} className="px-3 py-2">{head}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {principals.length === 0 && <tr><td className="px-3 py-4 text-gray-600 dark:text-gray-300" colSpan={12}>No represented principals recorded yet.</td></tr>}
                  {principals.map((principal) => (
                    <tr key={principal.id} className="align-top text-gray-800 dark:text-gray-200">
                      <td className="px-3 py-2 font-medium">{principal.principal_name}</td>
                      <td className="px-3 py-2">{principal.principal_country || "-"}</td>
                      <td className="px-3 py-2">{principal.relationship_type}</td>
                      <td className="px-3 py-2">{(principal.authorized_categories || []).join(", ") || "-"}</td>
                      <td className="px-3 py-2">{(principal.authorized_brands || []).join(", ") || "-"}</td>
                      <td className="px-3 py-2"><StatusBadge value={principal.authorization_status} /></td>
                      <td className="px-3 py-2">{formatDate(principal.authorization_start_date)}</td>
                      <td className="px-3 py-2">{formatDate(principal.authorization_expiry_date)}</td>
                      <td className="px-3 py-2"><ExpiryBadge value={principal.expiry_status} /></td>
                      <td className="px-3 py-2">{principal.verified_by_name || principal.verified_by || "-"}</td>
                      <td className="px-3 py-2">{formatDate(principal.verified_at)}</td>
                      <td className="space-x-2 px-3 py-2">
                        <button type="button" onClick={() => handleEditPrincipal(principal)} className="text-blue-600 hover:underline">Edit</button>
                        <button type="button" onClick={() => handleVerifyPrincipal(principal.id)} className="text-emerald-600 hover:underline">Verify</button>
                        <button type="button" onClick={() => handleSuspendPrincipal(principal.id)} className="text-red-600 hover:underline">Suspend</button>
                        <button type="button" onClick={() => handleDeactivatePrincipal(principal.id)} className="text-gray-600 hover:underline">Deactivate</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedSupplier && (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <OverviewCard
              title="Compliance"
              value={complianceBlocked ? "Blocked" : "Good to go"}
              icon={Shield}
              status={complianceBlocked ? "error" : "success"}
              description={
                complianceBlocked
                  ? "Requests and contracts are blocked until compliance is restored"
                  : complianceExpiry
                    ? `Next expiry ${formatDate(complianceExpiry)}`
                    : "No expiries on file"
              }
            />
            <OverviewCard
              title="Open issues"
              value={openIssues}
              icon={AlertTriangle}
              status={openIssues > 0 ? "warning" : "success"}
              description={openIssues > 0 ? "Issues need attention" : "No open issues"}
            />
            <OverviewCard
              title="Latest OTIF"
              value={latestScorecard?.otif_score ?? "-"}
              icon={ClipboardList}
              status={
                latestScorecard?.otif_score
                  ? latestScorecard.otif_score >= 95
                    ? "success"
                    : "warning"
                  : "neutral"
              }
              description={
                latestScorecard
                  ? `Quality defects ${latestScorecard.quality_defects ?? 0}`
                  : "No scorecards captured"
              }
            />
            <OverviewCard
              title="Lead time variance"
              value={latestScorecard?.lead_time_variance ?? "-"}
              icon={CheckCircle2}
              status="neutral"
              description={
                latestScorecard
                  ? `Period ending ${formatDate(latestScorecard.period_end || latestScorecard.created_at)}`
                  : "Awaiting first scorecard"
              }
            />
          </div>
        )}

        {selectedSupplier && (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Panel title="Performance scorecards" icon={ClipboardList}>
              <form className="space-y-3" onSubmit={handleScorecardSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InputField
                    label="OTIF %"
                    type="number"
                    value={scorecardForm.otif_score}
                    onChange={(event) =>
                      setScorecardForm((prev) => ({ ...prev, otif_score: event.target.value }))
                    }
                    required
                    min="0"
                    max="100"
                    step="0.01"
                  />
                  <InputField
                    label="Quality defects"
                    type="number"
                    value={scorecardForm.quality_defects}
                    onChange={(event) =>
                      setScorecardForm((prev) => ({ ...prev, quality_defects: event.target.value }))
                    }
                    min="0"
                    step="1"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InputField
                    label="Lead time variance (days)"
                    type="number"
                    value={scorecardForm.lead_time_variance}
                    onChange={(event) =>
                      setScorecardForm((prev) => ({ ...prev, lead_time_variance: event.target.value }))
                    }
                    step="0.01"
                  />
                  <InputField
                    label="Period start"
                    type="date"
                    value={scorecardForm.period_start}
                    onChange={(event) =>
                      setScorecardForm((prev) => ({ ...prev, period_start: event.target.value }))
                    }
                  />
                  <InputField
                    label="Period end"
                    type="date"
                    value={scorecardForm.period_end}
                    onChange={(event) =>
                      setScorecardForm((prev) => ({ ...prev, period_end: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Notes</label>
                  <textarea
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
                    rows={3}
                    value={scorecardForm.notes}
                    onChange={(event) =>
                      setScorecardForm((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    placeholder="Notes about performance, context, or highlights"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  <Plus className="h-4 w-4" />
                  Add scorecard
                </button>
              </form>

              <div className="mt-4 divide-y divide-gray-200 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
                {scorecards.length === 0 && (
                  <div className="p-4 text-sm text-gray-600 dark:text-gray-300">No scorecards yet.</div>
                )}
                {scorecards.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 px-4 py-3 text-sm text-gray-800 dark:text-gray-200 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold">{item.otif_score}% OTIF</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Quality defects {item.quality_defects ?? 0} • Lead time variance {item.lead_time_variance ?? "-"}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Period {formatDate(item.period_start)} – {formatDate(item.period_end)}
                      </p>
                    </div>
                    {item.notes && (
                      <p className="text-xs text-gray-600 dark:text-gray-400">{item.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Issues & CAPA" icon={AlertTriangle}>
              <form className="space-y-3" onSubmit={handleIssueSubmit}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Description</label>
                  <textarea
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
                    rows={3}
                    value={issueForm.description}
                    onChange={(event) =>
                      setIssueForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    required
                    placeholder="Quality incident, delivery miss, or risk"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Severity</label>
                    <select
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
                      value={issueForm.severity}
                      onChange={(event) =>
                        setIssueForm((prev) => ({ ...prev, severity: event.target.value }))
                      }
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <InputField
                    label="Due date"
                    type="date"
                    value={issueForm.due_date}
                    onChange={(event) =>
                      setIssueForm((prev) => ({ ...prev, due_date: event.target.value }))
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="capa-required"
                    type="checkbox"
                    checked={issueForm.capa_required}
                    onChange={(event) =>
                      setIssueForm((prev) => ({ ...prev, capa_required: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="text-sm text-gray-700 dark:text-gray-200" htmlFor="capa-required">
                    CAPA required
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">CAPA plan</label>
                  <textarea
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
                    rows={2}
                    value={issueForm.capa_plan}
                    onChange={(event) =>
                      setIssueForm((prev) => ({ ...prev, capa_plan: event.target.value }))
                    }
                    placeholder="Outline corrective / preventive actions"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                >
                  <Plus className="h-4 w-4" />
                  Log issue
                </button>
              </form>

              <div className="mt-4 divide-y divide-gray-200 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
                {issues.length === 0 && (
                  <div className="p-4 text-sm text-gray-600 dark:text-gray-300">No issues recorded.</div>
                )}
                {issues.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 px-4 py-3 text-sm text-gray-800 dark:text-gray-200"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold capitalize">{item.severity} severity</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{item.description}</p>
                      </div>
                      {item.status !== "closed" && (
                        <button
                          type="button"
                          onClick={() => handleIssueClose(item.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-800 transition hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                        >
                          <CheckCircle2 className="h-4 w-4" /> Close
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Status {item.status} • Due {formatDate(item.due_date)}
                    </p>
                    {item.capa_required && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">CAPA: {item.capa_plan || "Plan pending"}</p>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {selectedSupplier && (
          <div className="mt-8">
            <Panel title="Compliance artifacts" icon={Shield}>
              <form className="space-y-3" onSubmit={handleComplianceSubmit}>
                <div className="grid gap-3 md:grid-cols-3">
                  <InputField
                    label="Type"
                    value={complianceForm.artifact_type}
                    onChange={(event) =>
                      setComplianceForm((prev) => ({ ...prev, artifact_type: event.target.value }))
                    }
                    required
                  />
                  <InputField
                    label="Name"
                    value={complianceForm.name}
                    onChange={(event) =>
                      setComplianceForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    required
                  />
                  <InputField
                    label="Document URL"
                    value={complianceForm.document_url}
                    onChange={(event) =>
                      setComplianceForm((prev) => ({ ...prev, document_url: event.target.value }))
                    }
                    placeholder="https://..."
                  />
                  <InputField
                    label="Expiry date"
                    type="date"
                    value={complianceForm.expiry_date}
                    onChange={(event) =>
                      setComplianceForm((prev) => ({ ...prev, expiry_date: event.target.value }))
                    }
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Status</label>
                    <select
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
                      value={complianceForm.status}
                      onChange={(event) =>
                        setComplianceForm((prev) => ({ ...prev, status: event.target.value }))
                      }
                    >
                      <option value="active">Active</option>
                      <option value="expired">Expired</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="compliance-blocked"
                      type="checkbox"
                      checked={complianceForm.blocked}
                      onChange={(event) =>
                        setComplianceForm((prev) => ({ ...prev, blocked: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="compliance-blocked" className="text-sm text-gray-700 dark:text-gray-200">
                      Mark as blocked
                    </label>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                >
                  <Plus className="h-4 w-4" />
                  Add artifact
                </button>
              </form>

              <div className="mt-4 divide-y divide-gray-200 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
                {compliance.length === 0 && (
                  <div className="p-4 text-sm text-gray-600 dark:text-gray-300">No compliance artifacts yet.</div>
                )}
                {compliance.map((artifact) => (
                  <div
                    key={artifact.id}
                    className="flex flex-col gap-2 px-4 py-3 text-sm text-gray-800 dark:text-gray-200 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-semibold">{artifact.name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {artifact.artifact_type} • Expires {formatDate(artifact.expiry_date)}
                      </p>
                      {artifact.document_url && (
                        <a
                          href={artifact.document_url}
                          className="text-xs text-blue-600 underline hover:text-blue-700"
                          target="_blank"
                          rel="noreferrer"
                        >
                          View document
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {artifact.blocked || artifact.is_expired ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/50 dark:text-red-200">
                          <X className="h-4 w-4" /> Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100">
                          <CheckCircle2 className="h-4 w-4" /> Active
                        </span>
                      )}
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                        {artifact.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}
      </main>
    </div>
  );
};

const Panel = ({ title, icon: Icon, children }) => (
  <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
    <div className="mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
      <Icon className="h-5 w-5" />
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
    {children}
  </section>
);

const OverviewCard = ({ title, value, description, icon: Icon, status = "neutral" }) => {
  const colorClasses = {
    success: "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100",
    warning: "bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100",
    error: "bg-red-50 text-red-800 dark:bg-red-900/40 dark:text-red-100",
    neutral: "bg-gray-50 text-gray-800 dark:bg-gray-900/40 dark:text-gray-100",
  };

  return (
    <div className={`rounded-lg border border-gray-200 p-4 shadow-sm dark:border-gray-800 ${colorClasses[status]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-gray-700 dark:text-gray-200">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-gray-700/80 dark:text-gray-200/80">{description}</p>
        </div>
        <Icon className="h-8 w-8" />
      </div>
    </div>
  );
};

const InputField = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">{label}</label>
    <input
      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
      {...props}
    />
  </div>
);


const SelectField = ({ label, options, placeholder = "Select", value = "", ...props }) => {
  const normalizedOptions = uniqueSorted([...(value && !options.includes(value) ? [value] : []), ...options]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">{label}</label>
      <select
        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
        value={value}
        {...props}
      >
        <option value="">{placeholder}</option>
        {normalizedOptions.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
};

const MultiSelectField = ({ label, options, value = [], onChange }) => {
  const selected = Array.isArray(value) ? value : [];
  const normalizedOptions = uniqueSorted([...selected, ...options]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">{label}</label>
      <select
        multiple
        className="mt-1 min-h-28 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-offset-gray-950"
        value={selected}
        onChange={(event) => onChange(Array.from(event.target.selectedOptions).map((option) => option.value))}
      >
        {normalizedOptions.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Hold Ctrl/Cmd to select multiple values.</p>
    </div>
  );
};

const StatusBadge = ({ value }) => {
  const classes = {
    Verified: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100",
    "Pending Verification": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-100",
    Expired: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-100",
    Rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-100",
    Suspended: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
  };

  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${classes[value] || classes["Pending Verification"]}`}>{value || "Pending Verification"}</span>;
};

const ExpiryBadge = ({ value }) => {
  const classes = {
    Active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100",
    "Expiring Soon": "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-100",
    Expired: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-100",
  };

  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${classes[value] || classes.Active}`}>{value || "Active"}</span>;
};

export default SupplierSrmPage;