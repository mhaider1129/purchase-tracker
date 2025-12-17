import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Target,
} from "lucide-react";
import Navbar from "../components/Navbar";
import { createRisk, listRisks, updateRisk } from "../api/riskManagement";

const likelihoodOptions = [
  { value: "rare", label: "Rare" },
  { value: "unlikely", label: "Unlikely" },
  { value: "possible", label: "Possible" },
  { value: "likely", label: "Likely" },
  { value: "almost_certain", label: "Almost Certain" },
];

const impactOptions = [
  { value: "insignificant", label: "Insignificant" },
  { value: "minor", label: "Minor" },
  { value: "moderate", label: "Moderate" },
  { value: "major", label: "Major" },
  { value: "critical", label: "Critical" },
];

const statusOptions = [
  { value: "open", label: "Open" },
  { value: "mitigating", label: "Mitigating" },
  { value: "monitoring", label: "Monitoring" },
  { value: "closed", label: "Closed" },
];

const numberOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const scoreToLevel = (score = 0) => {
  if (score >= 20) return { label: "Critical", color: "bg-red-100 text-red-800" };
  if (score >= 12) return { label: "High", color: "bg-orange-100 text-orange-800" };
  if (score >= 7) return { label: "Medium", color: "bg-amber-100 text-amber-800" };
  return { label: "Low", color: "bg-green-100 text-green-800" };
};

const formatDate = (value) => {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not set" : date.toLocaleDateString();
};

const supplierScoreLevel = (score) => {
  if (!score || score <= 0) return "";
  if (score >= 16) return "Critical";
  if (score >= 10) return "High";
  if (score >= 6) return "Medium";
  return "Low";
};

const RiskManagementPage = () => {
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingRiskId, setSavingRiskId] = useState(null);
  const [savingMedication, setSavingMedication] = useState(false);
  const [savingHighRisk, setSavingHighRisk] = useState(false);
  const [savingSupplier, setSavingSupplier] = useState(false);

  const [form, setForm] = useState({
    title: "",
    category: "",
    description: "",
    likelihood: "possible",
    impact: "moderate",
    status: "open",
    owner: "",
    response_plan: "",
    due_date: "",
  });

  const [medicationForm, setMedicationForm] = useState({
    item_description: "",
    criticality: "",
    consumption_variability: "",
    lead_time_risk: "",
    financial_exposure: "",
    expiry_risk: "",
    supplier_reliability: "",
  });

  const [highRiskForm, setHighRiskForm] = useState({
    item: "",
    purchasing: { severity: "", rating: "", risk: "", control: "" },
    transporting: { severity: "", rating: "", risk: "", control: "" },
    receiving: { severity: "", rating: "", risk: "", control: "" },
    storing: { severity: "", rating: "", risk: "", control: "" },
    distribution: { severity: "", rating: "", risk: "", control: "" },
    shortage: { severity: "", rating: "", risk: "", control: "" },
    control_measures: "",
    initial_risk_score: "",
    risk_level: "",
    risk_category: "",
    high_risk_flag: false,
  });

  const [supplierForm, setSupplierForm] = useState({
    supplier_name: "",
    criticality_level: "",
    financial_likelihood: "",
    financial_impact: "",
    operational_likelihood: "",
    operational_impact: "",
    compliance_likelihood: "",
    compliance_impact: "",
    supply_continuity_likelihood: "",
    supply_continuity_impact: "",
    last_assessment_date: "",
    risk_mitigation_actions: "",
  });

  const [drafts, setDrafts] = useState({});

  const sortedRisks = useMemo(
    () =>
      [...risks].sort((a, b) => {
        if (b.risk_score === a.risk_score) {
          return (a.id || 0) < (b.id || 0) ? 1 : -1;
        }
        return (b.risk_score || 0) - (a.risk_score || 0);
      }),
    [risks],
  );

  const loadRisks = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listRisks();
      setRisks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Failed to load risks", err);
      setError(err?.response?.data?.message || "Failed to load risk register");
      setRisks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRisks();
  }, []);

  const updateDraft = (riskId, field, value) => {
    setDrafts((current) => ({
      ...current,
      [riskId]: {
        ...risks.find((risk) => risk.id === riskId),
        ...current[riskId],
        [field]: value,
      },
    }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createRisk(form);
      setForm({
        title: "",
        category: "",
        description: "",
        likelihood: "possible",
        impact: "moderate",
        status: "open",
        owner: "",
        response_plan: "",
        due_date: "",
      });
      await loadRisks();
    } catch (err) {
      console.error("❌ Failed to create risk", err);
      setError(err?.response?.data?.message || "Unable to create risk");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (riskId) => {
    const payload = drafts[riskId];
    if (!payload) return;
    setSavingRiskId(riskId);
    setError("");
    try {
      await updateRisk(riskId, payload);
      setDrafts((current) => {
        const copy = { ...current };
        delete copy[riskId];
        return copy;
      });
      await loadRisks();
    } catch (err) {
      console.error("❌ Failed to update risk", err);
      setError(err?.response?.data?.message || "Unable to update risk");
    } finally {
      setSavingRiskId(null);
    }
  };

  const medicationTotal = useMemo(() => {
    const values = [
      medicationForm.criticality,
      medicationForm.consumption_variability,
      medicationForm.lead_time_risk,
      medicationForm.financial_exposure,
      medicationForm.expiry_risk,
      medicationForm.supplier_reliability,
    ].map(numberOrNull);
    return values.reduce((sum, value) => sum + (value ?? 0), 0);
  }, [medicationForm]);

  const highRiskTotal = useMemo(() => {
    const stages = [
      highRiskForm.purchasing,
      highRiskForm.transporting,
      highRiskForm.receiving,
      highRiskForm.storing,
      highRiskForm.distribution,
      highRiskForm.shortage,
    ];
    return stages.reduce(
      (sum, stage) => sum + (numberOrNull(stage.severity) ?? 0) + (numberOrNull(stage.rating) ?? 0),
      0,
    );
  }, [highRiskForm]);

  const supplierScores = useMemo(() => {
    const score = (likelihood, impact) => (numberOrNull(likelihood) ?? 0) * (numberOrNull(impact) ?? 0);
    const financial = score(supplierForm.financial_likelihood, supplierForm.financial_impact);
    const operational = score(supplierForm.operational_likelihood, supplierForm.operational_impact);
    const compliance = score(supplierForm.compliance_likelihood, supplierForm.compliance_impact);
    const supplyContinuity = score(
      supplierForm.supply_continuity_likelihood,
      supplierForm.supply_continuity_impact,
    );
    return {
      financial,
      operational,
      compliance,
      supplyContinuity,
      total: financial + operational + compliance + supplyContinuity,
    };
  }, [supplierForm]);

  const handleMedicationSubmit = async (event) => {
    event.preventDefault();
    setSavingMedication(true);
    setError("");
    try {
      await createRisk({
        title: medicationForm.item_description || "Medication / Supply risk",
        category: "Medications & Supplies",
        description:
          "Risk identification for medications and supplies with consumption, supplier, and expiry considerations.",
        likelihood: "possible",
        impact: "moderate",
        medication_risk: {
          item_description: medicationForm.item_description,
          criticality: numberOrNull(medicationForm.criticality),
          consumption_variability: numberOrNull(medicationForm.consumption_variability),
          lead_time_risk: numberOrNull(medicationForm.lead_time_risk),
          financial_exposure: numberOrNull(medicationForm.financial_exposure),
          expiry_risk: numberOrNull(medicationForm.expiry_risk),
          supplier_reliability: numberOrNull(medicationForm.supplier_reliability),
        },
      });
      setMedicationForm({
        item_description: "",
        criticality: "",
        consumption_variability: "",
        lead_time_risk: "",
        financial_exposure: "",
        expiry_risk: "",
        supplier_reliability: "",
      });
      await loadRisks();
    } catch (err) {
      console.error("❌ Failed to create medication risk", err);
      setError(err?.response?.data?.message || "Unable to create medication/supply risk");
    } finally {
      setSavingMedication(false);
    }
  };

  const updateHighRiskStage = (stageKey, field, value) => {
    setHighRiskForm((current) => ({
      ...current,
      [stageKey]: {
        ...current[stageKey],
        [field]: value,
      },
    }));
  };

  const handleHighRiskSubmit = async (event) => {
    event.preventDefault();
    setSavingHighRisk(true);
    setError("");
    try {
      await createRisk({
        title: highRiskForm.item || "High risk item",
        category: "High Risk Item",
        description: "High risk item controls across the purchasing lifecycle.",
        likelihood: "likely",
        impact: "major",
        high_risk_item: {
          item: highRiskForm.item,
          purchasing: {
            severity: numberOrNull(highRiskForm.purchasing.severity),
            rating: numberOrNull(highRiskForm.purchasing.rating),
            risk: highRiskForm.purchasing.risk,
            control: highRiskForm.purchasing.control,
          },
          transporting: {
            severity: numberOrNull(highRiskForm.transporting.severity),
            rating: numberOrNull(highRiskForm.transporting.rating),
            risk: highRiskForm.transporting.risk,
            control: highRiskForm.transporting.control,
          },
          receiving: {
            severity: numberOrNull(highRiskForm.receiving.severity),
            rating: numberOrNull(highRiskForm.receiving.rating),
            risk: highRiskForm.receiving.risk,
            control: highRiskForm.receiving.control,
          },
          storing: {
            severity: numberOrNull(highRiskForm.storing.severity),
            rating: numberOrNull(highRiskForm.storing.rating),
            risk: highRiskForm.storing.risk,
            control: highRiskForm.storing.control,
          },
          distribution: {
            severity: numberOrNull(highRiskForm.distribution.severity),
            rating: numberOrNull(highRiskForm.distribution.rating),
            risk: highRiskForm.distribution.risk,
            control: highRiskForm.distribution.control,
          },
          shortage: {
            severity: numberOrNull(highRiskForm.shortage.severity),
            rating: numberOrNull(highRiskForm.shortage.rating),
            risk: highRiskForm.shortage.risk,
            control: highRiskForm.shortage.control,
          },
          control_measures: highRiskForm.control_measures,
          initial_risk_score: numberOrNull(highRiskForm.initial_risk_score) ?? highRiskTotal,
          risk_level: highRiskForm.risk_level,
          risk_category: highRiskForm.risk_category,
          high_risk_flag: Boolean(highRiskForm.high_risk_flag),
          total_risk: highRiskTotal,
        },
      });
      setHighRiskForm({
        item: "",
        purchasing: { severity: "", rating: "", risk: "", control: "" },
        transporting: { severity: "", rating: "", risk: "", control: "" },
        receiving: { severity: "", rating: "", risk: "", control: "" },
        storing: { severity: "", rating: "", risk: "", control: "" },
        distribution: { severity: "", rating: "", risk: "", control: "" },
        shortage: { severity: "", rating: "", risk: "", control: "" },
        control_measures: "",
        initial_risk_score: "",
        risk_level: "",
        risk_category: "",
        high_risk_flag: false,
      });
      await loadRisks();
    } catch (err) {
      console.error("❌ Failed to create high risk item", err);
      setError(err?.response?.data?.message || "Unable to create high risk item entry");
    } finally {
      setSavingHighRisk(false);
    }
  };

  const handleSupplierSubmit = async (event) => {
    event.preventDefault();
    setSavingSupplier(true);
    setError("");
    try {
      await createRisk({
        title: supplierForm.supplier_name || "Supplier risk profile",
        category: "Supplier",
        description: "Supplier risk profile across financial, operational, compliance, and continuity dimensions.",
        likelihood: "possible",
        impact: "moderate",
        supplier_risk: {
          supplier_name: supplierForm.supplier_name,
          criticality_level: supplierForm.criticality_level,
          last_assessment_date: supplierForm.last_assessment_date,
          risk_mitigation_actions: supplierForm.risk_mitigation_actions,
          financial: {
            likelihood: numberOrNull(supplierForm.financial_likelihood),
            impact: numberOrNull(supplierForm.financial_impact),
          },
          operational: {
            likelihood: numberOrNull(supplierForm.operational_likelihood),
            impact: numberOrNull(supplierForm.operational_impact),
          },
          compliance: {
            likelihood: numberOrNull(supplierForm.compliance_likelihood),
            impact: numberOrNull(supplierForm.compliance_impact),
          },
          supply_continuity: {
            likelihood: numberOrNull(supplierForm.supply_continuity_likelihood),
            impact: numberOrNull(supplierForm.supply_continuity_impact),
          },
          total_score: supplierScores.total,
        },
      });
      setSupplierForm({
        supplier_name: "",
        criticality_level: "",
        financial_likelihood: "",
        financial_impact: "",
        operational_likelihood: "",
        operational_impact: "",
        compliance_likelihood: "",
        compliance_impact: "",
        supply_continuity_likelihood: "",
        supply_continuity_impact: "",
        last_assessment_date: "",
        risk_mitigation_actions: "",
      });
      await loadRisks();
    } catch (err) {
      console.error("❌ Failed to create supplier risk", err);
      setError(err?.response?.data?.message || "Unable to create supplier risk");
    } finally {
      setSavingSupplier(false);
    }
  };

  const renderRiskCard = (risk) => {
    const level = scoreToLevel(risk.risk_score);
    const draft = drafts[risk.id] || risk;

    const medication = risk.medication_risk;
    const highRiskItem = risk.high_risk_item;
    const supplier = risk.supplier_risk;

    return (
      <div
        key={risk.id}
        className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/80"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-amber-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{risk.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{risk.category || "Uncategorized"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={`rounded-full px-3 py-1 font-semibold ${level.color}`}>
              {level.label} ({risk.risk_score || 0})
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
              {risk.status || "open"}
            </span>
          </div>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-200">{risk.description || "No description provided."}</p>

        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
          <div className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            <span>
              Likelihood: <strong className="font-semibold capitalize">{risk.likelihood?.replace(/_/g, " ")}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-orange-50 px-3 py-2 text-orange-800 dark:bg-orange-900/40 dark:text-orange-100">
            <Target className="h-4 w-4" aria-hidden="true" />
            <span>
              Impact: <strong className="font-semibold capitalize">{risk.impact?.replace(/_/g, " ")}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>
              Owner: <strong className="font-semibold">{risk.owner || "Unassigned"}</strong>
            </span>
          </div>
        </div>

        {medication && (
          <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm dark:border-blue-800 dark:bg-blue-900/30">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold text-blue-900 dark:text-blue-100">Medication &amp; Supply risk factors</p>
              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                Total: {medication.total_risk ?? 0}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <div>Item: {medication.item_description || "N/A"}</div>
              <div>Criticality: {medication.criticality ?? "-"}</div>
              <div>Consumption variability: {medication.consumption_variability ?? "-"}</div>
              <div>Lead time risk: {medication.lead_time_risk ?? "-"}</div>
              <div>Financial exposure: {medication.financial_exposure ?? "-"}</div>
              <div>Expiry risk: {medication.expiry_risk ?? "-"}</div>
              <div>Supplier reliability: {medication.supplier_reliability ?? "-"}</div>
            </div>
          </div>
        )}

        {highRiskItem && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm dark:border-amber-700 dark:bg-amber-900/30">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-amber-900 dark:text-amber-100">High risk item lifecycle</p>
              <div className="flex gap-2 text-xs">
                {highRiskItem.risk_level && (
                  <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-800 dark:bg-amber-800 dark:text-amber-100">
                    Level: {highRiskItem.risk_level}
                  </span>
                )}
                {highRiskItem.risk_category && (
                  <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-800 dark:bg-amber-800 dark:text-amber-100">
                    {highRiskItem.risk_category}
                  </span>
                )}
                {highRiskItem.high_risk_flag && (
                  <span className="rounded-full bg-red-100 px-2 py-1 font-semibold text-red-800 dark:bg-red-800 dark:text-red-100">
                    High risk
                  </span>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead>
                  <tr className="text-gray-600 dark:text-gray-200">
                    <th className="px-2 py-1">Stage</th>
                    <th className="px-2 py-1">Severity (S)</th>
                    <th className="px-2 py-1">Rating (R)</th>
                    <th className="px-2 py-1">Risk</th>
                    <th className="px-2 py-1">Control</th>
                  </tr>
                </thead>
                <tbody>
                  {(highRiskItem.stages || []).map((stage) => (
                    <tr key={stage.name} className="border-t border-amber-100 dark:border-amber-800">
                      <td className="px-2 py-1 capitalize">{stage.name}</td>
                      <td className="px-2 py-1">{stage.severity ?? "-"}</td>
                      <td className="px-2 py-1">{stage.rating ?? "-"}</td>
                      <td className="px-2 py-1">{stage.risk || ""}</td>
                      <td className="px-2 py-1">{stage.control || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-100">
              <span>Control measures: {highRiskItem.control_measures || "N/A"}</span>
              <span>Initial score: {highRiskItem.initial_risk_score ?? "-"}</span>
              <span>Total risk: {highRiskItem.total_risk ?? "-"}</span>
            </div>
          </div>
        )}

        {supplier && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm dark:border-emerald-700 dark:bg-emerald-900/30">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">Supplier risk profile</p>
              <div className="flex gap-2 text-xs">
                {supplier.criticality_level && (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100">
                    Criticality: {supplier.criticality_level}
                  </span>
                )}
                {supplier.total_score !== undefined && (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100">
                    Total: {supplier.total_score}
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>Supplier: {supplier.supplier_name || "N/A"}</div>
              <div>Last assessment: {formatDate(supplier.last_assessment_date)}</div>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead>
                  <tr className="text-gray-600 dark:text-gray-200">
                    <th className="px-2 py-1">Risk area</th>
                    <th className="px-2 py-1">Likelihood</th>
                    <th className="px-2 py-1">Impact</th>
                    <th className="px-2 py-1">Score</th>
                    <th className="px-2 py-1">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {["financial", "operational", "compliance", "supply_continuity"].map((key) => {
                    const data = supplier[key];
                    if (!data) return null;
                    return (
                      <tr key={key} className="border-t border-emerald-100 dark:border-emerald-800">
                        <td className="px-2 py-1 capitalize">{key.replace("_", " ")}</td>
                        <td className="px-2 py-1">{data.likelihood ?? "-"}</td>
                        <td className="px-2 py-1">{data.impact ?? "-"}</td>
                        <td className="px-2 py-1">{data.score ?? "-"}</td>
                        <td className="px-2 py-1">{data.level || supplierScoreLevel(data.score)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-emerald-900 dark:text-emerald-100">
              Mitigation: {supplier.risk_mitigation_actions || "N/A"}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
            Status
            <select
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              value={draft.status || "open"}
              onChange={(event) => updateDraft(risk.id, "status", event.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
            Due date
            <input
              type="date"
              value={draft.due_date || risk.due_date || ""}
              onChange={(event) => updateDraft(risk.id, "due_date", event.target.value)}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
          Mitigation / response plan
          <textarea
            value={draft.response_plan || ""}
            onChange={(event) => updateDraft(risk.id, "response_plan", event.target.value)}
            className="min-h-[80px] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            placeholder="Outline mitigations, contingency plans, or owners"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex gap-3">
            <span>Created: {formatDate(risk.created_at)}</span>
            <span>Updated: {formatDate(risk.updated_at)}</span>
            <span>Due: {formatDate(risk.due_date)}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDrafts((current) => ({ ...current, [risk.id]: risk }))}
              className="rounded-md border border-gray-200 px-3 py-1 font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => handleUpdate(risk.id)}
              disabled={savingRiskId === risk.id}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1 font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-60"
            >
              {savingRiskId === risk.id ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Save updates
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <Navbar />
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Risk management</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Maintain a centralized register of procurement and operational risks, with clear owners and mitigation plans.
            </p>
          </div>
          <button
            type="button"
            onClick={loadRisks}
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-100">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <form
            onSubmit={handleCreate}
            className="lg:col-span-1 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/80"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Add general risk</h2>
            </div>

            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
              Title
              <input
                type="text"
                required
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="e.g. Supplier capacity constraints"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
              Category
              <input
                type="text"
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="Logistics, compliance, operational, etc."
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
              Description
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className="min-h-[100px] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="Describe the risk, trigger events, and potential impact"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
                Likelihood
                <select
                  value={form.likelihood}
                  onChange={(event) => setForm((current) => ({ ...current, likelihood: event.target.value }))}
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  {likelihoodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
                Impact
                <select
                  value={form.impact}
                  onChange={(event) => setForm((current) => ({ ...current, impact: event.target.value }))}
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  {impactOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
              Owner
              <input
                type="text"
                value={form.owner}
                onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="Person or team responsible"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
              Mitigation / response plan
              <textarea
                value={form.response_plan}
                onChange={(event) => setForm((current) => ({ ...current, response_plan: event.target.value }))}
                className="min-h-[80px] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="Preventive actions, contingency, and escalation paths"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
              Due date
              <input
                type="date"
                value={form.due_date}
                onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>

            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden="true" />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                All entries include automatic scoring so the highest risks stay at the top of the register.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Create risk
                </>
              )}
            </button>
          </form>

          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <span>Active risk register</span>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white/80 px-4 py-3 text-sm text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-100">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Loading risks...</span>
              </div>
            ) : sortedRisks.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 bg-white/60 px-4 py-6 text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <span>No risks have been captured yet.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {sortedRisks.map((risk) => renderRiskCard(risk))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleMedicationSubmit}
            className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/80"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Medication &amp; supplies risk</h2>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Total risk: {medicationTotal}</span>
            </div>

            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
              Item description
              <input
                type="text"
                value={medicationForm.item_description}
                onChange={(event) => setMedicationForm((current) => ({ ...current, item_description: event.target.value }))}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="Medication or supply"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {["criticality", "consumption_variability", "lead_time_risk", "financial_exposure", "expiry_risk", "supplier_reliability"].map((field) => (
                <label key={field} className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
                  {field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  <input
                    type="number"
                    min="0"
                    max="25"
                    value={medicationForm[field]}
                    onChange={(event) => setMedicationForm((current) => ({ ...current, [field]: event.target.value }))}
                    className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                  />
                </label>
              ))}
            </div>

            <button
              type="submit"
              disabled={savingMedication}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-60"
            >
              {savingMedication ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Capturing...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Save medication/supply risk
                </>
              )}
            </button>
          </form>

          <form
            onSubmit={handleHighRiskSubmit}
            className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/80"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-amber-600" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">High risk item controls</h2>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Lifecycle total: {highRiskTotal}</span>
            </div>

            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
              Item
              <input
                type="text"
                value={highRiskForm.item}
                onChange={(event) => setHighRiskForm((current) => ({ ...current, item: event.target.value }))}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="Critical product or category"
              />
            </label>

            <div className="overflow-x-auto rounded-lg border border-amber-100 bg-amber-50/60 p-2 text-xs dark:border-amber-700 dark:bg-amber-900/30 md:text-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-amber-900 dark:text-amber-100">
                    <th className="px-2 py-1">Stage</th>
                    <th className="px-2 py-1">S</th>
                    <th className="px-2 py-1">R</th>
                    <th className="px-2 py-1">Risk</th>
                    <th className="px-2 py-1">Control</th>
                  </tr>
                </thead>
                <tbody>
                  {["purchasing", "transporting", "receiving", "storing", "distribution", "shortage"].map((stage) => (
                    <tr key={stage} className="border-t border-amber-100 dark:border-amber-800">
                      <td className="px-2 py-1 capitalize">{stage}</td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min="0"
                          className="w-full rounded border border-amber-200 bg-white px-2 py-1 text-xs dark:border-amber-700 dark:bg-amber-900"
                          value={highRiskForm[stage].severity}
                          onChange={(event) => updateHighRiskStage(stage, "severity", event.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min="0"
                          className="w-full rounded border border-amber-200 bg-white px-2 py-1 text-xs dark:border-amber-700 dark:bg-amber-900"
                          value={highRiskForm[stage].rating}
                          onChange={(event) => updateHighRiskStage(stage, "rating", event.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          className="w-full rounded border border-amber-200 bg-white px-2 py-1 text-xs dark:border-amber-700 dark:bg-amber-900"
                          value={highRiskForm[stage].risk}
                          onChange={(event) => updateHighRiskStage(stage, "risk", event.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          className="w-full rounded border border-amber-200 bg-white px-2 py-1 text-xs dark:border-amber-700 dark:bg-amber-900"
                          value={highRiskForm[stage].control}
                          onChange={(event) => updateHighRiskStage(stage, "control", event.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
                Control measures
                <textarea
                  value={highRiskForm.control_measures}
                  onChange={(event) => setHighRiskForm((current) => ({ ...current, control_measures: event.target.value }))}
                  className="min-h-[60px] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                  placeholder="Preventive and detective controls"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
                Initial risk score
                <input
                  type="number"
                  min="0"
                  value={highRiskForm.initial_risk_score}
                  onChange={(event) => setHighRiskForm((current) => ({ ...current, initial_risk_score: event.target.value }))}
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
                Risk level
                <input
                  type="text"
                  value={highRiskForm.risk_level}
                  onChange={(event) => setHighRiskForm((current) => ({ ...current, risk_level: event.target.value }))}
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                  placeholder="Low / Medium / High"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
                Risk category
                <input
                  type="text"
                  value={highRiskForm.risk_category}
                  onChange={(event) => setHighRiskForm((current) => ({ ...current, risk_category: event.target.value }))}
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                  placeholder="Safety, quality, availability"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={highRiskForm.high_risk_flag}
                  onChange={(event) => setHighRiskForm((current) => ({ ...current, high_risk_flag: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                Mark as high risk
              </label>
            </div>

            <button
              type="submit"
              disabled={savingHighRisk}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-amber-700 disabled:opacity-60"
            >
              {savingHighRisk ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving controls...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Save high risk item
                </>
              )}
            </button>
          </form>
        </div>

        <form
          onSubmit={handleSupplierSubmit}
          className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/80"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Supplier risk management</h2>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Total score: {supplierScores.total}</span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
              Supplier name
              <input
                type="text"
                value={supplierForm.supplier_name}
                onChange={(event) => setSupplierForm((current) => ({ ...current, supplier_name: event.target.value }))}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
              Criticality level
              <input
                type="text"
                value={supplierForm.criticality_level}
                onChange={(event) => setSupplierForm((current) => ({ ...current, criticality_level: event.target.value }))}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
              Last assessment date
              <input
                type="date"
                value={supplierForm.last_assessment_date}
                onChange={(event) => setSupplierForm((current) => ({ ...current, last_assessment_date: event.target.value }))}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
          </div>

          <div className="overflow-x-auto rounded-lg border border-emerald-100 bg-emerald-50/60 p-2 text-xs dark:border-emerald-700 dark:bg-emerald-900/30 md:text-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="text-emerald-900 dark:text-emerald-100">
                  <th className="px-2 py-1">Risk area</th>
                  <th className="px-2 py-1">Likelihood</th>
                  <th className="px-2 py-1">Impact</th>
                  <th className="px-2 py-1">Score</th>
                  <th className="px-2 py-1">Level</th>
                </tr>
              </thead>
              <tbody>
                {[{
                  key: "financial",
                  label: "Financial",
                  likelihood: "financial_likelihood",
                  impact: "financial_impact",
                  score: supplierScores.financial,
                },
                {
                  key: "operational",
                  label: "Operational",
                  likelihood: "operational_likelihood",
                  impact: "operational_impact",
                  score: supplierScores.operational,
                },
                {
                  key: "compliance",
                  label: "Compliance",
                  likelihood: "compliance_likelihood",
                  impact: "compliance_impact",
                  score: supplierScores.compliance,
                },
                {
                  key: "supply_continuity",
                  label: "Supply continuity",
                  likelihood: "supply_continuity_likelihood",
                  impact: "supply_continuity_impact",
                  score: supplierScores.supplyContinuity,
                }].map((row) => (
                  <tr key={row.key} className="border-t border-emerald-100 dark:border-emerald-800">
                    <td className="px-2 py-1 capitalize">{row.label}</td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        min="0"
                        value={supplierForm[row.likelihood]}
                        onChange={(event) => setSupplierForm((current) => ({ ...current, [row.likelihood]: event.target.value }))}
                        className="w-full rounded border border-emerald-200 bg-white px-2 py-1 text-xs dark:border-emerald-700 dark:bg-emerald-900"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        min="0"
                        value={supplierForm[row.impact]}
                        onChange={(event) => setSupplierForm((current) => ({ ...current, [row.impact]: event.target.value }))}
                        className="w-full rounded border border-emerald-200 bg-white px-2 py-1 text-xs dark:border-emerald-700 dark:bg-emerald-900"
                      />
                    </td>
                    <td className="px-2 py-1">{row.score}</td>
                    <td className="px-2 py-1">{supplierScoreLevel(row.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
            Risk mitigation actions
            <textarea
              value={supplierForm.risk_mitigation_actions}
              onChange={(event) => setSupplierForm((current) => ({ ...current, risk_mitigation_actions: event.target.value }))}
              className="min-h-[80px] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="Diversification, audits, training, etc."
            />
          </label>

          <button
            type="submit"
            disabled={savingSupplier}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {savingSupplier ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving profile...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Save supplier risk
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RiskManagementPage;