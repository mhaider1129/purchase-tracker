import React from "react";
import { Building2, Check, CircleDollarSign, FileText, Landmark, Users } from "lucide-react";
import AmountInput from "./ui/AmountInput";

const ContractForm = ({
  formState,
  handleInputChange,
  handleSubmit,
  saving,
  editingId,
  handleArchive,
  archivingId,
  formError,
  successMessage,
  statusOptions,
  departments,
  departmentsLoading,
  departmentsError,
  users,
  usersLoading,
  usersError,
  suppliers,
  suppliersLoading,
  suppliersError,
}) => {
  const [activeStructuredSection, setActiveStructuredSection] = React.useState("scope_summary");
  const [activeStep, setActiveStep] = React.useState("overview");

  const steps = [
    { key: "overview", label: "Overview", description: "Identity and ownership", icon: FileText },
    { key: "parties", label: "Parties", description: "Supplier and contacts", icon: Users },
    { key: "terms", label: "Terms", description: "Scope and obligations", icon: Building2 },
    { key: "governance", label: "Governance", description: "Reviews and approvals", icon: Landmark },
    { key: "payment", label: "Payment", description: "Commercial controls", icon: CircleDollarSign },
  ];

  const stepFields = {
    overview: ["title", "reference_number", "contract_category", "contract_type", "start_date", "end_date", "signing_date", "currency", "contract_value"],
    parties: ["institute", "vendor", "supplier_id", "first_party", "second_party", "authorized_signatory", "vendor_contact_person", "vendor_contact_email", "vendor_contact_phone", "vendor_tax_id", "vendor_address"],
    terms: ["scope_summary", "deliverables", "technical_specifications", "exclusions", "sla_requirements", "warranty_terms", "delivery_terms", "financial_payment_control", "penalties_incentives", "termination_exit_terms", "risk_dispute_management", "compliance_legal_terms", "change_management_terms"],
    governance: ["renewal_type", "renewal_notice_days", "end_user_department_id", "contract_manager_id", "main_technical_department_id"],
    payment: ["payment_period", "payment_advance_percentage", "payment_retention", "payment_milestone_details", "payment_invoice_requirements"],
  };

  const fieldHasValue = (field) => {
    const value = formState[field];
    return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && String(value).trim() !== "";
  };

  const stepProgress = (step) => {
    const fields = stepFields[step] || [];
    if (!fields.length) return 0;
    return Math.round((fields.filter(fieldHasValue).length / fields.length) * 100);
  };

  const completedFields = [...new Set(Object.values(stepFields).flat())].filter(fieldHasValue).length;
  const totalFields = [...new Set(Object.values(stepFields).flat())].length;
  const completion = totalFields ? Math.round((completedFields / totalFields) * 100) : 0;

  const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";

  const structuredSections = [
    { key: "scope_summary", label: "Scope", placeholder: "Define the contract scope and boundaries." },
    { key: "deliverables", label: "Deliverables", placeholder: "List expected deliverables and acceptance criteria." },
    { key: "technical_specifications", label: "Technical Specifications", placeholder: "Provide technical standards and specifications." },
    { key: "exclusions", label: "Exclusions", placeholder: "State what is explicitly excluded from the contract." },
    { key: "sla_requirements", label: "SLA", placeholder: "Define SLA metrics, response times, and service targets." },
    { key: "warranty_terms", label: "Warranty", placeholder: "Outline warranty coverage, duration, and procedures." },
    { key: "delivery_terms", label: "Delivery Terms", placeholder: "Specify delivery terms, timelines, and responsibilities." },
    { key: "financial_payment_control", label: "Payment Terms", placeholder: "Define payment schedule, controls, and conditions." },
    { key: "penalties_incentives", label: "Penalties", placeholder: "Define penalties, incentives, and remedies." },
    { key: "termination_exit_terms", label: "Termination", placeholder: "Specify termination rights and exit obligations." },
    { key: "risk_dispute_management", label: "Dispute Resolution", placeholder: "Define dispute escalation and resolution process." },
    { key: "compliance_legal_terms", label: "Confidentiality", placeholder: "Capture confidentiality and legal compliance clauses." },
    { key: "change_management_terms", label: "Change Control", placeholder: "Define amendment and change-control governance." },
  ];

  const stepTargets = {
    overview: "overview-start",
    parties: "institute",
    terms: "structured-contract-sections",
    governance: "renewal_type",
    payment: "payment-controls",
  };

  const goToStep = (step) => {
    setActiveStep(step);
    document.getElementById(stepTargets[step])?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/70 px-5 py-4 dark:border-slate-800 dark:from-slate-900 dark:to-blue-950/30 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Contract setup</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Move through each section to build a complete, review-ready agreement.</p>
          </div>
          <div className="flex min-w-[190px] items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden="true">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500" style={{ width: `${completion}%` }} />
            </div>
            <span className="text-sm font-bold tabular-nums text-blue-700 dark:text-blue-300">{completion}%</span>
          </div>
        </div>
        <nav className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-5 dark:bg-slate-800" aria-label="Contract form sections">
          {steps.map((step) => {
            const Icon = step.icon;
            const progress = stepProgress(step.key);
            const active = activeStep === step.key;
            return (
              <button key={step.key} type="button" onClick={() => goToStep(step.key)} aria-current={active ? "step" : undefined} className={`group flex min-w-0 items-center gap-3 bg-white px-4 py-3 text-left transition hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-blue-950/30 ${active ? "shadow-[inset_0_-3px_0_#2563eb]" : ""}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${progress === 100 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : active ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
                  {progress === 100 ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className={`block truncate text-xs font-bold ${active ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-200"}`}>{step.label}</span>
                  <span className="block truncate text-[11px] text-slate-400">{progress}% complete</span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div id="overview-start" className="scroll-mt-24 sm:col-span-2">
          <h3 className="flex items-center gap-2 border-b border-slate-200 pb-3 text-base font-bold text-slate-900 dark:border-slate-700 dark:text-white"><FileText className="h-4 w-4 text-blue-600" /> Core Contract Header</h3>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="institute">Institute</label>
          <input id="institute" name="institute" type="text" value={formState.institute} onChange={handleInputChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="contract_category">Contract Category</label>
          <input id="contract_category" name="contract_category" type="text" value={formState.contract_category} onChange={handleInputChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="renewal_type">Renewal Type</label>
          <input id="renewal_type" name="renewal_type" type="text" value={formState.renewal_type} onChange={handleInputChange} placeholder="Auto / Manual" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="renewal_notice_days">Renewal Notice Days</label>
          <input id="renewal_notice_days" name="renewal_notice_days" type="number" min="0" value={formState.renewal_notice_days} onChange={handleInputChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="currency">Currency</label>
          <select id="currency" name="currency" value={formState.currency} onChange={handleInputChange} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            <option value="IQD">IQD</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <h3 className="mt-3 flex items-center gap-2 border-b border-slate-200 pb-3 text-base font-bold text-slate-900 dark:border-slate-700 dark:text-white"><Users className="h-4 w-4 text-blue-600" /> Parties Information</h3>
        </div>
        <div><input name="first_party" value={formState.first_party} onChange={handleInputChange} placeholder="First party" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></div>
        <div><input name="second_party" value={formState.second_party} onChange={handleInputChange} placeholder="Second party" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></div>
        <div><input name="authorized_signatory" value={formState.authorized_signatory} onChange={handleInputChange} placeholder="Authorized signatory" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></div>
        <div><input name="vendor_contact_person" value={formState.vendor_contact_person} onChange={handleInputChange} placeholder="Vendor contact person" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></div>
        <div><input name="vendor_contact_email" value={formState.vendor_contact_email} onChange={handleInputChange} placeholder="Vendor email" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></div>
        <div><input name="vendor_contact_phone" value={formState.vendor_contact_phone} onChange={handleInputChange} placeholder="Vendor phone" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></div>
        <div><input name="vendor_tax_id" value={formState.vendor_tax_id} onChange={handleInputChange} placeholder="Tax ID / registration" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></div>
        <div><input name="vendor_address" value={formState.vendor_address} onChange={handleInputChange} placeholder="Legal address" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" /></div>
        <div id="structured-contract-sections" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:col-span-2 dark:border-slate-700 dark:bg-slate-800/40">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"><Building2 className="h-4 w-4 text-blue-600" /> Structured Contract Sections</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Document the operational clauses reviewers need. Your entries are preserved while switching tabs.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {structuredSections.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveStructuredSection(section.key)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  activeStructuredSection === section.key
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
          {structuredSections.map((section) =>
            activeStructuredSection === section.key ? (
              <div key={section.key} className="mt-3">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  {section.label}
                </label>
                <textarea
                  name={section.key}
                  rows={4}
                  value={formState[section.key] || ""}
                  onChange={handleInputChange}
                  placeholder={section.placeholder}
                  className={inputClass}
                />
              </div>
            ) : null
          )}
          <textarea name="service_coverage" rows={2} value={formState.service_coverage} onChange={handleInputChange} placeholder="Service coverage" className={`${inputClass} mt-2`} />
        </div>
        <div className="sm:col-span-2">
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="title"
          >
            Contract title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            value={formState.title}
            onChange={handleInputChange}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="vendor"
          >
            Vendor
          </label>
          <input
            id="vendor"
            name="vendor"
            type="text"
            value={formState.vendor}
            onChange={handleInputChange}
            required
            list="supplier-suggestions"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Start typing to reuse an existing supplier or enter a new vendor name.
          </p>
          <datalist id="supplier-suggestions">
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.name}>
                {supplier.name}
              </option>
            ))}
          </datalist>
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="supplier_id"
          >
            Supplier record (optional)
          </label>
          <select
            id="supplier_id"
            name="supplier_id"
            value={formState.supplier_id}
            onChange={handleInputChange}
            disabled={suppliersLoading}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-900 dark:disabled:text-gray-500"
          >
            <option value="">No linked supplier selected</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={String(supplier.id)}>
                {supplier.name}
              </option>
            ))}
          </select>
          {suppliersLoading && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Loading suppliers…</p>
          )}
          {suppliersError && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{suppliersError}</p>
          )}
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="reference_number"
          >
            Reference number
          </label>
          <input
            id="reference_number"
            name="reference_number"
            type="text"
            value={formState.reference_number}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="source_request_id"
          >
            Source request ID
          </label>
          <input
            id="source_request_id"
            name="source_request_id"
            type="number"
            min="1"
            value={formState.source_request_id}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Link the originating request"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Linking a contract to its originating request keeps the lifecycle connected and auditable.
          </p>
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="contract_type"
          >
            Contract type
          </label>
          <select
            id="contract_type"
            name="contract_type"
            value={formState.contract_type}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="purchasing">Purchasing</option>
            <option value="leasing">Leasing</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="start_date"
          >
            Start date
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            value={formState.start_date}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="signing_date"
          >
            Signing date
          </label>
          <input
            id="signing_date"
            name="signing_date"
            type="date"
            value={formState.signing_date}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="end_date"
          >
            End date
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            value={formState.end_date}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="contract_value"
          >
            Contract value
          </label>
          <AmountInput
            id="contract_value"
            name="contract_value"
            value={formState.contract_value}
            onChange={handleInputChange}
            placeholder="e.g. 250,000"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="status"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            value={formState.status}
            onChange={handleInputChange}
            disabled={!formState.is_historical_contract && !editingId}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            {statusOptions
              .filter((option) => option.value !== "all")
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
          {!editingId && (
            <label className="mt-2 flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={Boolean(formState.is_historical_contract)} onChange={(event) => handleInputChange({ target: { name: 'is_historical_contract', value: event.target.checked } })} />
              Historical migration (allows an existing contract to be entered outside draft status)
            </label>
          )}
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="end_user_department_id"
          >
            End user department
          </label>
          <select
            id="end_user_department_id"
            name="end_user_department_id"
            value={formState.end_user_department_id}
            onChange={handleInputChange}
            disabled={departmentsLoading}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-900 dark:disabled:text-gray-500"
          >
            <option value="">
              {departmentsLoading
                ? "Loading departments..."
                : "No department (send to CMO/COO)"}
            </option>
            {departments.map((department) => (
              <option key={department.id} value={String(department.id)}>
                {department.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            If no department is selected, stakeholder and risk evaluations will
            be routed to the CMO/COO.
          </p>
          {departmentsError && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {departmentsError}
            </p>
          )}
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="contract_manager_id"
          >
            Contract manager
          </label>
          {users.length > 0 ? (
            <select
              id="contract_manager_id"
              name="contract_manager_id"
              value={formState.contract_manager_id}
              onChange={handleInputChange}
              disabled={usersLoading}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-900 dark:disabled:text-gray-500"
            >
              <option value="">No contract manager assigned</option>
              {users.map((user) => (
                <option key={user.id} value={String(user.id)}>
                  {user.name || user.email || `User #${user.id}`} (
                  {(user.role || "").toUpperCase() || "Unknown"})
                </option>
              ))}
            </select>
          ) : (
            <input
              id="contract_manager_id"
              name="contract_manager_id"
              type="number"
              min="1"
              value={formState.contract_manager_id}
              onChange={handleInputChange}
              placeholder="Enter user ID"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          )}
          {usersLoading && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Loading users…
            </p>
          )}
          {usersError && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {usersError}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="main_technical_department_id">
            Main technical department <span className="text-red-600">*</span>
          </label>
          <select id="main_technical_department_id" name="main_technical_department_id" value={formState.main_technical_department_id || ''} onChange={handleInputChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            <option value="">Choose the department whose HOD approves first</option>
            {departments.map((department) => <option key={department.id} value={String(department.id)}>{department.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-500">After this HOD approves, Legal and Finance review in parallel.</p>
        </div>
        <div className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Secondary technical departments and assigned sections</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {departments.map((department) => {
              if (String(department.id) === String(formState.main_technical_department_id)) return null;
              const review = (formState.secondary_technical_reviews || []).find((item) => String(item.department_id) === String(department.id));
              return (
                <div key={department.id} className="rounded border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={Boolean(review)} onChange={() => {
                      const current = formState.secondary_technical_reviews || [];
                      const next = review ? current.filter((item) => String(item.department_id) !== String(department.id)) : [...current, { department_id: String(department.id), sections: [] }];
                      handleInputChange({ target: { name: 'secondary_technical_reviews', value: next } });
                    }} />
                    {department.name}
                  </label>
                  {review && <input className="mt-2 w-full rounded border px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900" placeholder="Sections, comma separated (e.g. Function, Safety)" value={(review.sections || []).join(', ')} onChange={(event) => {
                    const sections = event.target.value.split(',').map((part) => part.trim()).filter(Boolean);
                    const next = (formState.secondary_technical_reviews || []).map((item) => String(item.department_id) === String(department.id) ? { ...item, sections } : item);
                    handleInputChange({ target: { name: 'secondary_technical_reviews', value: next } });
                  }} />}
                </div>
              );
            })}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="description"
          >
            Notes
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            value={formState.description}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Important clauses, renewal reminders, or performance notes"
          />
        </div>
        <div className="sm:col-span-2">
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="performance_management"
          >
            Performance Management
          </label>
          <textarea
            id="performance_management"
            name="performance_management"
            rows={4}
            value={formState.performance_management}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Define KPIs, performance metrics, and review processes."
          />
        </div>
        <div className="sm:col-span-2">
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
            htmlFor="digital_attachments_tracking"
          >
            Digital Attachments &amp; Tracking
          </label>
          <textarea
            id="digital_attachments_tracking"
            name="digital_attachments_tracking"
            rows={4}
            value={formState.digital_attachments_tracking}
            onChange={handleInputChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Required attachments, amendment history, approval workflow log, alerts, and monitoring notes."
          />
        </div>
        <div id="payment-controls" className="scroll-mt-24 sm:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <select name="payment_methods" multiple value={formState.payment_methods} onChange={handleInputChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"><option>Cash</option><option>Transfer</option><option>LC</option></select>
            <input name="payment_period" value={formState.payment_period} onChange={handleInputChange} placeholder="Payment Period" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            <input name="payment_advance_percentage" value={formState.payment_advance_percentage} onChange={handleInputChange} placeholder="Advance Payment %" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            <select name="payment_retention" value={formState.payment_retention} onChange={handleInputChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"><option value="">Retention</option><option>Yes</option><option>No</option></select>
            <textarea name="payment_milestone_details" rows={2} value={formState.payment_milestone_details} onChange={handleInputChange} placeholder="Milestone Payments" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            <textarea name="payment_invoice_requirements" rows={2} value={formState.payment_invoice_requirements} onChange={handleInputChange} placeholder="Invoice Requirements" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          </div>
          <textarea name="alert_rules" rows={3} value={formState.alert_rules} onChange={handleInputChange} placeholder="Alerts & automation notes (expiry windows, SLA breach alerts)." className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
        </div>
      </div>

      {formError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          {formError}
        </div>
      )}
      {successMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
          {successMessage}
        </div>
      )}

      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl shadow-slate-900/10 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex dark:text-slate-400">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">{completion}%</span>
          {completion === 100 ? "Ready for review" : "You can save now and complete the remaining details later."}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="ml-auto inline-flex items-center justify-center rounded-xl border border-transparent bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
        >
          {saving
            ? "Saving..."
            : editingId
              ? "Update contract"
              : "Create contract"}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={() => handleArchive(editingId)}
            disabled={archivingId === editingId}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-60 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
          >
            {archivingId === editingId ? "Archiving..." : "Archive contract"}
          </button>
        )}
      </div>
    </form>
  );
};

export default ContractForm;
