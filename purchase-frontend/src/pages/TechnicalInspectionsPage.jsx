import React, { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import {
  createTechnicalInspection,
  deleteTechnicalInspection,
  listTechnicalInspections,
  updateTechnicalInspection,
} from "../api/technicalInspections";

const CONDITION_OPTIONS = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
  { value: "not_sure", label: "Not sure" },
  { value: "not_applicable", label: "Not applicable" },
];

const GENERAL_CHECKLIST_ITEMS = [
  "General condition",
  "Packaging",
  "Labelling/Markings",
];

const CATEGORY_CHECKLIST_ITEMS = [
  "Compliance with specifications",
  "Quality",
  "Functionality",
  "Expiry date",
  "Storage requirements",
  "Calibrated",
  "Safety features",
  "Structural integrity",
  "Compatibility with existing system",
  "SDS available",
];

const CATEGORY_OPTIONS = [
  "Medical Consumable",
  "Medical Supply",
  "Device",
  "Medical Equipment",
  "Stationary",
  "Operational Item",
  "Maintenance Item",
  "Furniture",
  "IT Equipment",
  "Housekeeping",
];

const emptyInspector = () => ({
  name: "",
  title: "",
  contact_information: "",
  department: "",
});

const emptySignature = () => ({
  name: "",
  date: "",
  title: "",
});

const buildChecklistState = (items) =>
  items.map((item) => ({
    item,
    condition: "",
    comment: "",
    action_required: "",
  }));

const createInitialFormState = () => ({
  inspection_date: new Date().toISOString().slice(0, 10),
  location: "",
  item_name: "",
  item_category: "",
  model_number: "",
  serial_number: "",
  lot_number: "",
  manufacturer: "",
  supplier_name: "",
  general_checklist: buildChecklistState(GENERAL_CHECKLIST_ITEMS),
  category_checklist: buildChecklistState(CATEGORY_CHECKLIST_ITEMS),
  summary: {
    overall_condition: "",
    immediate_actions: "",
    recommended_actions: "",
    additional_comments: "",
  },
  inspectors: Array.from({ length: 3 }, () => emptyInspector()),
  approvals: {
    inspector_signatures: Array.from({ length: 3 }, () => emptySignature()),
    procurement_supervisor: emptySignature(),
  },
});

const normalizeChecklistForForm = (entries, template) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return buildChecklistState(template);
  }

  const byItem = new Map();
  entries.forEach((entry) => {
    const key = (entry?.item || "").toString().toLowerCase();
    if (key) {
      byItem.set(key, entry);
    }
  });

  return template.map((item, index) => {
    const match = byItem.get(item.toLowerCase()) ?? entries[index];
    return {
      item,
      condition: match?.condition || "",
      comment: match?.comment || "",
      action_required: match?.action_required || "",
    };
  });
};

const normalizeInspectorSet = (inspectors = []) => {
  const hydrated = Array.isArray(inspectors) ? inspectors.slice(0, 3) : [];
  while (hydrated.length < 3) hydrated.push(emptyInspector());
  return hydrated.map((inspector) => ({
    name: inspector?.name || "",
    title: inspector?.title || "",
    contact_information: inspector?.contact_information || "",
    department: inspector?.department || "",
  }));
};

const normalizeSignatures = (signatures = [], fallbackCount = 3) => {
  const hydrated = Array.isArray(signatures) ? signatures.slice(0, fallbackCount) : [];
  while (hydrated.length < fallbackCount) hydrated.push(emptySignature());
  return hydrated.map((signature) => ({
    name: signature?.name || "",
    date: signature?.date || "",
    title: signature?.title || "",
  }));
};

const TechnicalInspectionsPage = () => {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formState, setFormState] = useState(createInitialFormState);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    start_date: "",
    end_date: "",
    category: "",
  });
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(
      () => setDebouncedSearch(searchInput.trim()),
      300,
    );
    return () => clearTimeout(handler);
  }, [searchInput]);

  const activeFilters = useMemo(
    () => ({
      ...filters,
      search: debouncedSearch,
    }),
    [filters, debouncedSearch],
  );

  const fetchInspections = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await listTechnicalInspections(activeFilters);
      setInspections(data);
    } catch (err) {
      console.error("Failed to load inspections", err);
      setError("Unable to load inspections. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [activeFilters]);

  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);

  const resetForm = () => {
    setEditingId(null);
    setFormState(createInitialFormState());
  };

  const handleChecklistChange = (listKey, index, field, value) => {
    setFormState((prev) => {
      const updated = [...prev[listKey]];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return { ...prev, [listKey]: updated };
    });
  };

  const handleInspectorChange = (index, field, value) => {
    setFormState((prev) => {
      const inspectors = [...prev.inspectors];
      inspectors[index] = {
        ...inspectors[index],
        [field]: value,
      };
      return { ...prev, inspectors };
    });
  };

  const handleSignatureChange = (index, field, value) => {
    setFormState((prev) => {
      const inspector_signatures = [...prev.approvals.inspector_signatures];
      inspector_signatures[index] = {
        ...inspector_signatures[index],
        [field]: value,
      };
      return {
        ...prev,
        approvals: {
          ...prev.approvals,
          inspector_signatures,
        },
      };
    });
  };

  const handleSupervisorChange = (field, value) => {
    setFormState((prev) => ({
      ...prev,
      approvals: {
        ...prev.approvals,
        procurement_supervisor: {
          ...prev.approvals.procurement_supervisor,
          [field]: value,
        },
      },
    }));
  };

  const handleSummaryChange = (field, value) => {
    setFormState((prev) => ({
      ...prev,
      summary: {
        ...prev.summary,
        [field]: value,
      },
    }));
  };

  const handleFieldChange = (field, value) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (editingId) {
        await updateTechnicalInspection(editingId, formState);
        setSuccess("Inspection updated successfully.");
      } else {
        await createTechnicalInspection(formState);
        setSuccess("Inspection saved successfully.");
      }

      await fetchInspections();
      resetForm();
    } catch (err) {
      console.error("Failed to save inspection", err);
      setError(
        err?.response?.data?.message ||
          "Unable to save the inspection. Please check required fields.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (inspection) => {
    setEditingId(inspection.id);
    setSuccess("");
    setError("");

    setFormState({
      inspection_date: inspection.inspection_date || "",
      location: inspection.location || "",
      item_name: inspection.item_name || "",
      item_category: inspection.item_category || "",
      model_number: inspection.model_number || "",
      serial_number: inspection.serial_number || "",
      lot_number: inspection.lot_number || "",
      manufacturer: inspection.manufacturer || "",
      supplier_name: inspection.supplier_name || "",
      general_checklist: normalizeChecklistForForm(
        inspection.general_checklist,
        GENERAL_CHECKLIST_ITEMS,
      ),
      category_checklist: normalizeChecklistForForm(
        inspection.category_checklist,
        CATEGORY_CHECKLIST_ITEMS,
      ),
      summary: {
        overall_condition: inspection.summary?.overall_condition || "",
        immediate_actions: inspection.summary?.immediate_actions || "",
        recommended_actions: inspection.summary?.recommended_actions || "",
        additional_comments: inspection.summary?.additional_comments || "",
      },
      inspectors: normalizeInspectorSet(inspection.inspectors),
      approvals: {
        inspector_signatures: normalizeSignatures(
          inspection.approvals?.inspector_signatures,
        ),
        procurement_supervisor:
          inspection.approvals?.procurement_supervisor || emptySignature(),
      },
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this inspection record?",
    );
    if (!confirmed) return;

    try {
      setSubmitting(true);
      await deleteTechnicalInspection(id);
      setSuccess("Inspection removed.");
      await fetchInspections();
      if (editingId === id) {
        resetForm();
      }
    } catch (err) {
      console.error("Failed to delete inspection", err);
      setError("Could not delete the inspection entry.");
    } finally {
      setSubmitting(false);
    }
  };

  const inspectionCountByCondition = useMemo(() => {
    const tally = {};
    inspections.forEach((inspection) => {
      const condition = inspection?.summary?.overall_condition || "unknown";
      tally[condition] = (tally[condition] || 0) + 1;
    });
    return tally;
  }, [inspections]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          <header className="rounded-xl bg-white/70 p-6 shadow-sm backdrop-blur dark:bg-gray-800/70">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                  Supply Chain Quality
                </p>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                  Technical Inspections
                </h1>
                <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
                  Capture inspection details digitally, including item condition,
                  category-specific checks, and required follow-up actions.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                {Object.entries(inspectionCountByCondition).map(
                  ([condition, count]) => (
                    <span
                      key={condition}
                      className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700 shadow-sm dark:bg-indigo-900/40 dark:text-indigo-200"
                    >
                      <span className="h-2 w-2 rounded-full bg-indigo-500" aria-hidden />
                      {condition.replace("_", " ") || "Unspecified"}
                      <span className="text-xs text-gray-500 dark:text-gray-300">
                        ({count})
                      </span>
                    </span>
                  ),
                )}
              </div>
            </div>
            {(error || success) && (
              <div className="mt-4 space-y-2 text-sm">
                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-700/50 dark:bg-red-900/30 dark:text-red-200">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-green-700 dark:border-green-700/50 dark:bg-green-900/30 dark:text-green-200">
                    {success}
                  </div>
                )}
              </div>
            )}
          </header>

          <section className="rounded-xl bg-white/80 p-6 shadow-sm backdrop-blur dark:bg-gray-800/70">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Search
                  </label>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Item, supplier, or location"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={filters.start_date}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, start_date: e.target.value }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    End date
                  </label>
                  <input
                    type="date"
                    value={filters.end_date}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, end_date: e.target.value }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Item category
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, category: e.target.value }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  >
                    <option value="">All categories</option>
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Reset form
              </button>
            </div>
          </section>

          <section className="rounded-xl bg-white/90 p-6 shadow-sm backdrop-blur dark:bg-gray-800/70">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {editingId ? "Edit inspection" : "New inspection"}
            </h2>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              Fill in the general information, item details, and checklist items.
              Conditions use the same scale as the legacy paper form.
            </p>

            <form className="space-y-8" onSubmit={handleSubmit}>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-lg border border-gray-200 bg-white/60 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                    General Information
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Inspection date
                      </span>
                      <input
                        type="date"
                        value={formState.inspection_date}
                        onChange={(e) => handleFieldChange("inspection_date", e.target.value)}
                        required
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Location
                      </span>
                      <input
                        type="text"
                        value={formState.location}
                        onChange={(e) => handleFieldChange("location", e.target.value)}
                        placeholder="Clinic, ward, or warehouse"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">Inspector 1</span>
                      <input
                        type="text"
                        value={formState.inspectors[0]?.name || ""}
                        onChange={(e) => handleInspectorChange(0, "name", e.target.value)}
                        placeholder="Name"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="text"
                        value={formState.inspectors[0]?.title || ""}
                        onChange={(e) => handleInspectorChange(0, "title", e.target.value)}
                        placeholder="Title"
                        className="rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="text"
                        value={formState.inspectors[0]?.department || ""}
                        onChange={(e) => handleInspectorChange(0, "department", e.target.value)}
                        placeholder="Department"
                        className="rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">Inspector 2</span>
                      <input
                        type="text"
                        value={formState.inspectors[1]?.name || ""}
                        onChange={(e) => handleInspectorChange(1, "name", e.target.value)}
                        placeholder="Name"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="text"
                        value={formState.inspectors[1]?.title || ""}
                        onChange={(e) => handleInspectorChange(1, "title", e.target.value)}
                        placeholder="Title"
                        className="rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="text"
                        value={formState.inspectors[1]?.department || ""}
                        onChange={(e) => handleInspectorChange(1, "department", e.target.value)}
                        placeholder="Department"
                        className="rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">Inspector 3</span>
                      <input
                        type="text"
                        value={formState.inspectors[2]?.name || ""}
                        onChange={(e) => handleInspectorChange(2, "name", e.target.value)}
                        placeholder="Name"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="text"
                        value={formState.inspectors[2]?.title || ""}
                        onChange={(e) => handleInspectorChange(2, "title", e.target.value)}
                        placeholder="Title"
                        className="rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="text"
                        value={formState.inspectors[2]?.department || ""}
                        onChange={(e) => handleInspectorChange(2, "department", e.target.value)}
                        placeholder="Department"
                        className="rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Contact information
                      </span>
                      <textarea
                        value={formState.inspectors[0]?.contact_information || ""}
                        onChange={(e) => handleInspectorChange(0, "contact_information", e.target.value)}
                        placeholder="Phone or email"
                        className="h-full min-h-[96px] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border border-gray-200 bg-white/60 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                    Item Information
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Item name
                      </span>
                      <input
                        type="text"
                        value={formState.item_name}
                        onChange={(e) => handleFieldChange("item_name", e.target.value)}
                        required
                        placeholder="Item name"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Item category
                      </span>
                      <select
                        value={formState.item_category}
                        onChange={(e) => handleFieldChange("item_category", e.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      >
                        <option value="">Select category</option>
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Model / Code
                      </span>
                      <input
                        type="text"
                        value={formState.model_number}
                        onChange={(e) => handleFieldChange("model_number", e.target.value)}
                        placeholder="Model or catalogue number"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Serial / Batch number
                      </span>
                      <input
                        type="text"
                        value={formState.serial_number}
                        onChange={(e) => handleFieldChange("serial_number", e.target.value)}
                        placeholder="Serial or batch number"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">Lot number</span>
                      <input
                        type="text"
                        value={formState.lot_number}
                        onChange={(e) => handleFieldChange("lot_number", e.target.value)}
                        placeholder="Lot number (if applicable)"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">Manufacturer</span>
                      <input
                        type="text"
                        value={formState.manufacturer}
                        onChange={(e) => handleFieldChange("manufacturer", e.target.value)}
                        placeholder="Manufacturer"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Supplier
                      </span>
                      <input
                        type="text"
                        value={formState.supplier_name}
                        onChange={(e) => handleFieldChange("supplier_name", e.target.value)}
                        placeholder="Supplier"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-lg border border-gray-200 bg-white/60 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                    A. General Condition
                  </h3>
                  <div className="space-y-3">
                    {formState.general_checklist.map((entry, index) => (
                      <div
                        key={entry.item}
                        className="rounded-md border border-gray-200 p-3 shadow-sm dark:border-gray-700"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                            {entry.item}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {CONDITION_OPTIONS.map((option) => (
                              <label
                                key={option.value}
                                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700 shadow-sm dark:bg-gray-800 dark:text-gray-200"
                              >
                                <input
                                  type="radio"
                                  name={`general-${index}`}
                                  value={option.value}
                                  checked={entry.condition === option.value}
                                  onChange={(e) =>
                                    handleChecklistChange(
                                      "general_checklist",
                                      index,
                                      "condition",
                                      e.target.value,
                                    )
                                  }
                                />
                                {option.label}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <textarea
                            value={entry.comment}
                            onChange={(e) =>
                              handleChecklistChange(
                                "general_checklist",
                                index,
                                "comment",
                                e.target.value,
                              )
                            }
                            placeholder="Comments"
                            className="min-h-[80px] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                          />
                          <textarea
                            value={entry.action_required}
                            onChange={(e) =>
                              handleChecklistChange(
                                "general_checklist",
                                index,
                                "action_required",
                                e.target.value,
                              )
                            }
                            placeholder="Action required"
                            className="min-h-[80px] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border border-gray-200 bg-white/60 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                    B. Specific to Item Category
                  </h3>
                  <div className="space-y-3">
                    {formState.category_checklist.map((entry, index) => (
                      <div
                        key={entry.item}
                        className="rounded-md border border-gray-200 p-3 shadow-sm dark:border-gray-700"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                            {entry.item}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {CONDITION_OPTIONS.map((option) => (
                              <label
                                key={option.value}
                                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700 shadow-sm dark:bg-gray-800 dark:text-gray-200"
                              >
                                <input
                                  type="radio"
                                  name={`category-${index}`}
                                  value={option.value}
                                  checked={entry.condition === option.value}
                                  onChange={(e) =>
                                    handleChecklistChange(
                                      "category_checklist",
                                      index,
                                      "condition",
                                      e.target.value,
                                    )
                                  }
                                />
                                {option.label}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <textarea
                            value={entry.comment}
                            onChange={(e) =>
                              handleChecklistChange(
                                "category_checklist",
                                index,
                                "comment",
                                e.target.value,
                              )
                            }
                            placeholder="Comments"
                            className="min-h-[80px] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                          />
                          <textarea
                            value={entry.action_required}
                            onChange={(e) =>
                              handleChecklistChange(
                                "category_checklist",
                                index,
                                "action_required",
                                e.target.value,
                              )
                            }
                            placeholder="Action required"
                            className="min-h-[80px] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-lg border border-gray-200 bg-white/60 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                    Summary of Findings
                  </h3>
                  <div className="grid gap-4">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Overall condition
                      </span>
                      <select
                        value={formState.summary.overall_condition}
                        onChange={(e) => handleSummaryChange("overall_condition", e.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      >
                        <option value="">Select condition</option>
                        {CONDITION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Immediate actions required
                      </span>
                      <textarea
                        value={formState.summary.immediate_actions}
                        onChange={(e) => handleSummaryChange("immediate_actions", e.target.value)}
                        className="min-h-[100px] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        placeholder="List urgent follow-up actions"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Recommended maintenance/actions
                      </span>
                      <textarea
                        value={formState.summary.recommended_actions}
                        onChange={(e) => handleSummaryChange("recommended_actions", e.target.value)}
                        className="min-h-[80px] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        placeholder="Preventive maintenance, calibration, or escalation"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Additional comments
                      </span>
                      <textarea
                        value={formState.summary.additional_comments}
                        onChange={(e) => handleSummaryChange("additional_comments", e.target.value)}
                        className="min-h-[60px] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        placeholder="Notes, risks, or attachments referenced"
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border border-gray-200 bg-white/60 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                    Approval and Signatures
                  </h3>
                  <div className="space-y-3 text-sm">
                    {formState.approvals.inspector_signatures.map((signature, index) => (
                      <div key={index} className="grid gap-2 sm:grid-cols-3">
                        <label className="flex flex-col gap-1">
                          <span className="font-medium text-gray-700 dark:text-gray-200">
                            Inspector {index + 1} name
                          </span>
                          <input
                            type="text"
                            value={signature.name}
                            onChange={(e) =>
                              handleSignatureChange(index, "name", e.target.value)
                            }
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="font-medium text-gray-700 dark:text-gray-200">
                            Title
                          </span>
                          <input
                            type="text"
                            value={signature.title}
                            onChange={(e) =>
                              handleSignatureChange(index, "title", e.target.value)
                            }
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="font-medium text-gray-700 dark:text-gray-200">
                            Date
                          </span>
                          <input
                            type="date"
                            value={signature.date}
                            onChange={(e) =>
                              handleSignatureChange(index, "date", e.target.value)
                            }
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                          />
                        </label>
                      </div>
                    ))}

                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="flex flex-col gap-1">
                        <span className="font-medium text-gray-700 dark:text-gray-200">
                          Procurement supervisor
                        </span>
                        <input
                          type="text"
                          value={formState.approvals.procurement_supervisor?.name || ""}
                          onChange={(e) => handleSupervisorChange("name", e.target.value)}
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="font-medium text-gray-700 dark:text-gray-200">
                          Title
                        </span>
                        <input
                          type="text"
                          value={formState.approvals.procurement_supervisor?.title || ""}
                          onChange={(e) => handleSupervisorChange("title", e.target.value)}
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="font-medium text-gray-700 dark:text-gray-200">
                          Date
                        </span>
                        <input
                          type="date"
                          value={formState.approvals.procurement_supervisor?.date || ""}
                          onChange={(e) => handleSupervisorChange("date", e.target.value)}
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  All required fields mirror the paper form. Use the checklists to
                  capture specific findings and any follow-up.
                </div>
                <div className="flex gap-3">
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      Cancel edit
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-70"
                  >
                    {submitting ? "Saving..." : editingId ? "Update inspection" : "Save inspection"}
                  </button>
                </div>
              </div>
            </form>
          </section>

          <section className="rounded-xl bg-white/80 p-6 shadow-sm backdrop-blur dark:bg-gray-800/70">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Inspection log
              </h2>
              <span className="text-sm text-gray-500 dark:text-gray-300">
                {inspections.length} record{inspections.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 shadow-sm dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Supplier
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Location
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Overall condition
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-600 dark:text-gray-300">
                        Loading inspections...
                      </td>
                    </tr>
                  ) : inspections.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-600 dark:text-gray-300">
                        No inspections found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    inspections.map((inspection) => (
                      <tr key={inspection.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-100">
                          {inspection.inspection_date || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-50">
                          {inspection.item_name}
                          {inspection.model_number && (
                            <span className="block text-xs font-normal text-gray-500 dark:text-gray-300">
                              Model: {inspection.model_number}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                          {inspection.item_category || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                          {inspection.supplier_name || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                          {inspection.location || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                          {inspection.summary?.overall_condition
                            ? inspection.summary.overall_condition.replace("_", " ")
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-200">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(inspection)}
                              className="rounded-md border border-indigo-200 px-3 py-1 text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-700/60 dark:text-indigo-200 dark:hover:bg-indigo-900/40"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(inspection.id)}
                              className="rounded-md border border-red-200 px-3 py-1 text-red-700 transition hover:bg-red-50 dark:border-red-700/60 dark:text-red-200 dark:hover:bg-red-900/40"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default TechnicalInspectionsPage;