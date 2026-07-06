import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import procurementEvaluationsApi from "../api/procurementEvaluations";

const tabs = ["Overview", "Scenarios", "Items and Services", "Coverage Analysis", "Commercial Models", "Utilization Analysis", "Break-even Analysis", "TCO Analysis", "Risk Analysis", "Scores", "Results", "Sensitivity Analysis", "Documents", "Recommendation"];
const inputClass = "rounded-lg border border-slate-300 p-2 text-sm";

const money = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

const parseNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPercentInput = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const numeric = parseNumber(value);
  return numeric > 0 && numeric <= 1 ? String(Number((numeric * 100).toFixed(4))) : String(value);
};

const calculateWastePercentage = ({ tests_per_kit, usable_tests_per_kit, repeat_rate_percentage }) => {
  const testsPerKit = parseNumber(tests_per_kit);
  const usableTests = parseNumber(usable_tests_per_kit);
  const repeatValue = parseNumber(repeat_rate_percentage);
  const repeatRate = repeatValue > 1 ? repeatValue / 100 : repeatValue;
  const denominator = testsPerKit * (1 - repeatRate);

  if (testsPerKit <= 0 || usableTests <= 0 || denominator <= 0) return "";

  const waste = Math.max(0, Math.min(100, (1 - usableTests / denominator) * 100));
  return String(Number(waste.toFixed(4)));
};

const normalizeCostDraft = (draft) => ({
  ...draft,
  expected_waste_percentage: formatPercentInput(draft.expected_waste_percentage),
  repeat_rate_percentage: formatPercentInput(draft.repeat_rate_percentage),
});

const ProcurementEvaluationDetail = () => {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState(window.location.hash === "#recommendation" ? "Recommendation" : "Overview");
  const [evaluation, setEvaluation] = useState(null);
  const [offers, setOffers] = useState([]);
  const [tests, setTests] = useState([]);
  const [costs, setCosts] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [scores, setScores] = useState([]);
  const [results, setResults] = useState([]);
  const [sensitivity, setSensitivity] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [itemComparison, setItemComparison] = useState([]);
  const [importText, setImportText] = useState("");
  const [importOfferId, setImportOfferId] = useState("");
  const [importOption, setImportOption] = useState("APPEND");
  const [importPreview, setImportPreview] = useState(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [offerForm, setOfferForm] = useState({ supplier_name: "", offer_name: "", pricing_model: "KIT_OWNERSHIP", warranty_years: 0, delivery_time_days: "" });
  const [testForm, setTestForm] = useState({ test_name: "", expected_monthly_volume: 0 });
  const [criteriaForm, setCriteriaForm] = useState({ criteria_name: "", criteria_group: "Manual", weight: 0, scoring_type: "manual", higher_is_better: true });
  const [costDrafts, setCostDrafts] = useState({});
  const [scoreDrafts, setScoreDrafts] = useState({});
  const [summaryDraft, setSummaryDraft] = useState("");

  const readOnly = evaluation?.status === "Finalized";
  const criteriaWeightTotal = useMemo(() => criteria.reduce((sum, item) => sum + Number(item.weight || 0), 0), [criteria]);
  const costByPair = useMemo(() => Object.fromEntries(costs.map((item) => [`${item.offer_id}:${item.test_id}`, item])), [costs]);
  const cheapestByTest = useMemo(() => {
    const map = {};
    tests.forEach((test) => {
      const annualCosts = offers.map((offer) => costByPair[`${offer.id}:${test.id}`]).filter(Boolean).map((item) => Number(item.annual_test_cost || 0)).filter((value) => value > 0);
      map[test.id] = annualCosts.length ? Math.min(...annualCosts) : null;
    });
    return map;
  }, [costByPair, offers, tests]);

  const loadAll = useCallback(async () => {
    try {
      const [caseRes, offerRes, testRes, costRes, criteriaRes, scoreRes, resultRes] = await Promise.all([
        procurementEvaluationsApi.get(id),
        procurementEvaluationsApi.listOffers(id),
        procurementEvaluationsApi.listTests(id),
        procurementEvaluationsApi.listCosts(id),
        procurementEvaluationsApi.listCriteria(id),
        procurementEvaluationsApi.listScores(id),
        procurementEvaluationsApi.results(id),
      ]);
      setEvaluation(caseRes.data);
      setOffers(offerRes.data || []);
      setTests(testRes.data || []);
      setCosts(costRes.data || []);
      setCriteria(criteriaRes.data || []);
      setScores(scoreRes.data || []);
      setResults(resultRes.data || []);
      setWarning(criteriaRes.warning || caseRes.warning || "");
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load evaluation.");
    }
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const createOffer = async (event) => {
    event.preventDefault();
    try {
      await procurementEvaluationsApi.createOffer(id, offerForm);
      setOfferForm({ supplier_name: "", offer_name: "", pricing_model: "KIT_OWNERSHIP", warranty_years: 0, delivery_time_days: "" });
      setError("");
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create offer.");
    }
  };
  const createTest = async (event) => {
    event.preventDefault();
    await procurementEvaluationsApi.createTest(id, testForm);
    setTestForm({ test_name: "", expected_monthly_volume: 0 });
    await loadAll();
  };

  const createCriteria = async (event) => {
    event.preventDefault();
    const response = await procurementEvaluationsApi.createCriteria(id, criteriaForm);
    setWarning(response.warning || "");
    setCriteriaForm({ criteria_name: "", criteria_group: "Manual", weight: 0, scoring_type: "manual", higher_is_better: true });
    await loadAll();
  };

  const saveCostMatrix = async (keysToSave = null) => {
    const draftEntries = Object.entries(costDrafts).filter(([key]) => !keysToSave || keysToSave.includes(key));
    const items = draftEntries.map(([key, value]) => {
      const [offerId, testId] = key.split(":");
      const test = tests.find((item) => Number(item.id) === Number(testId));
      return { offer_id: Number(offerId), test_id: Number(testId), expected_monthly_volume: test?.expected_monthly_volume || 0, ...value };
    });
    if (items.length === 0) return;
    await procurementEvaluationsApi.bulkSaveCosts(id, items);
    setCostDrafts((previous) => {
      const next = { ...previous };
      draftEntries.forEach(([key]) => { delete next[key]; });
      return next;
    });
    await loadAll();
  };

  const updateCostDraft = (key, current, field, value) => {
    setCostDrafts((previous) => {
      const nextDraft = normalizeCostDraft({ ...current, ...(previous[key] || {}), [field]: value });
      if (["tests_per_kit", "usable_tests_per_kit", "repeat_rate_percentage"].includes(field)) {
        const autoWaste = calculateWastePercentage(nextDraft);
        if (autoWaste !== "") nextDraft.expected_waste_percentage = autoWaste;
      }
      return { ...previous, [key]: nextDraft };
    });
  };

  const saveScores = async () => {
    const items = Object.entries(scoreDrafts).map(([key, value]) => {
      const [offerId, criteriaId] = key.split(":");
      return { offer_id: Number(offerId), criteria_id: Number(criteriaId), ...value };
    });
    if (items.length === 0) return;
    await procurementEvaluationsApi.bulkSaveScores(id, items);
    setScoreDrafts({});
    await loadAll();
  };

  const calculate = async () => {
    await procurementEvaluationsApi.calculate(id);
    await loadAll();
  };

  const loadSensitivity = useCallback(async () => {
    const response = await procurementEvaluationsApi.sensitivity(id);
    setSensitivity(response.data || []);
  }, [id]);

  const loadRecommendation = useCallback(async () => {
    const response = await procurementEvaluationsApi.recommendation(id);
    setRecommendation(response.data);
    setSummaryDraft(response.data?.summary || "");
  }, [id]);

  const loadCoverage = async () => { const response = await procurementEvaluationsApi.coverage(id); setCoverage(response.data); };
  const loadItemComparison = async () => { const response = await procurementEvaluationsApi.itemComparison(id); setItemComparison(response.data || []); };
  const previewImport = async () => { const response = await procurementEvaluationsApi.previewImport(id, { text: importText }); setImportPreview(response.data); };
  const confirmImport = async () => { if (!importOfferId) return; await procurementEvaluationsApi.confirmImport(id, importOfferId, { text: importText, option: importOption, columnMap: importPreview?.columnMap }); setImportText(""); setImportPreview(null); await loadAll(); };

  const finalize = async () => {
    const selected = recommendation?.final_recommended_offer || results[0];
    if (!selected) return;
    await procurementEvaluationsApi.finalize(id, { selected_offer_id: selected.offer_id, recommendation_summary: summaryDraft });
    await loadAll();
  };

  useEffect(() => {
    if (activeTab === "Sensitivity Analysis") loadSensitivity().catch((err) => setError(err.response?.data?.message || "Failed to load sensitivity."));
    if (activeTab === "Recommendation") loadRecommendation().catch((err) => setError(err.response?.data?.message || "Failed to load recommendation."));
  }, [activeTab, loadRecommendation, loadSensitivity]);

  if (!evaluation) return <div className="p-6 text-slate-600">Loading procurement evaluation…</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <Link to="/procurement-evaluations" className="text-sm font-semibold text-indigo-700 hover:underline">← Procurement Evaluations</Link>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{evaluation.title}</h1>
              <p className="mt-1 text-sm text-slate-600">{evaluation.evaluation_type} · {evaluation.category} · {evaluation.evaluation_period_years} year TCO · {evaluation.currency}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={calculate} disabled={readOnly} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">Calculate</button>
              <span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{evaluation.status}</span>
            </div>
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {warning && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{warning}</div>}

        <div className="flex gap-2 overflow-x-auto rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
          {tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === tab ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}>{tab}</button>)}
        </div>

        {activeTab === "Overview" && (
          <section className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:grid-cols-2">
            {[['Title', evaluation.title], ['Description', evaluation.description || '—'], ['Category', evaluation.category], ['Linked request', evaluation.request_id ? `#${evaluation.request_id}` : 'Manual'], ['Department', evaluation.department_id || '—'], ['Evaluation type', evaluation.evaluation_type], ['Evaluation period years', evaluation.evaluation_period_years], ['Annual growth rate', evaluation.expected_annual_growth_rate], ['Currency', evaluation.currency], ['Status', evaluation.status]].map(([label, value]) => <div key={label}><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 text-slate-900">{value}</p></div>)}
          </section>
        )}

        {activeTab === "Scenarios" && (
          <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            {!readOnly && <form onSubmit={createOffer} className="grid gap-3 md:grid-cols-6">
              <input className={inputClass} placeholder="Supplier name" value={offerForm.supplier_name} onChange={(e) => setOfferForm({ ...offerForm, supplier_name: e.target.value })} required />
              <input className={inputClass} placeholder="Offer name" value={offerForm.offer_name} onChange={(e) => setOfferForm({ ...offerForm, offer_name: e.target.value })} required />
              <input className={inputClass} placeholder="Manufacturer" onChange={(e) => setOfferForm({ ...offerForm, manufacturer_name: e.target.value })} />
              <input className={inputClass} placeholder="Model" onChange={(e) => setOfferForm({ ...offerForm, model_name: e.target.value })} />
              <select className={inputClass} value={offerForm.pricing_model} onChange={(e) => setOfferForm({ ...offerForm, pricing_model: e.target.value })}>{['KIT_OWNERSHIP','PAY_PER_REPORTABLE','REAGENT_RENTAL','HYBRID'].map((type) => <option key={type}>{type}</option>)}</select>
              <button className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">Add Offer</button>
            </form>}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {offers.map((offer) => <div key={offer.id} className="rounded-xl border border-slate-200 p-4"><h3 className="font-bold text-slate-900">{offer.offer_name}</h3><p className="text-sm text-slate-600">{offer.supplier_name} · {offer.manufacturer_name || '—'} {offer.model_name || ''}</p><dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><dt>Pricing</dt><dd>{offer.pricing_model}</dd><dt>Initial</dt><dd>{money(Number(offer.device_price) + Number(offer.installation_cost) + Number(offer.training_cost) + Number(offer.shipping_cost) + Number(offer.customs_cost) + Number(offer.other_initial_cost) - Number(offer.device_discount_value))}</dd><dt>Warranty</dt><dd>{offer.warranty_years || 0} years</dd><dt>Delivery</dt><dd>{offer.delivery_time_days || '—'} days</dd>{offer.pricing_model === 'REAGENT_RENTAL' && <><dt>Min amount</dt><dd>{money(offer.minimum_annual_commitment_amount)}</dd><dt>Min tests</dt><dd>{money(offer.minimum_annual_commitment_tests)}</dd></>}</dl></div>)}
            </div>
          </section>
        )}

        {["Items and Services", "Commercial Models", "Utilization Analysis"].includes(activeTab) && (
          <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            {!readOnly && <form onSubmit={createTest} className="flex flex-wrap gap-3"><input className={inputClass} placeholder="Test name" value={testForm.test_name} onChange={(e) => setTestForm({ ...testForm, test_name: e.target.value })} required /><input type="number" className={inputClass} placeholder="Monthly volume" value={testForm.expected_monthly_volume} onChange={(e) => setTestForm({ ...testForm, expected_monthly_volume: e.target.value })} /><button className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">Add Test</button><button type="button" onClick={() => saveCostMatrix()} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">Bulk Save</button><button type="button" onClick={() => navigator.clipboard?.writeText(costs.map((c) => `${c.test_name},${c.offer_name},${c.annual_test_cost}`).join("\n"))} className="rounded-lg border px-4 py-2 font-semibold text-slate-700">Export CSV</button></form>}
            <div className="overflow-x-auto"><table className="min-w-full border-separate border-spacing-0 text-xs"><thead><tr><th className="sticky left-0 bg-slate-100 p-2 text-left">Test / Monthly / Annual Volume</th>{offers.map((offer) => <th key={offer.id} className="min-w-[280px] bg-slate-100 p-2 text-left">{offer.offer_name}</th>)}</tr></thead><tbody>{tests.map((test) => <tr key={test.id}><td className="sticky left-0 border-t bg-white p-2 font-semibold">{test.test_name}<br /><span className="text-slate-500">{money(test.expected_monthly_volume)} tests/month / {money(Number(test.expected_monthly_volume) * 12)} tests/year</span></td>{offers.map((offer) => { const key = `${offer.id}:${test.id}`; const current = { pricing_method: 'KIT_OWNERSHIP', ...(costByPair[key] || {}), ...(costDrafts[key] || {}) }; const cheapest = cheapestByTest[test.id] && Number(current.annual_test_cost || 0) === cheapestByTest[test.id]; return <td key={key} className={`border-t p-2 align-top ${cheapest ? 'bg-emerald-50' : ''}`}><select className={inputClass} value={current.pricing_method} onChange={(e) => updateCostDraft(key, current, "pricing_method", e.target.value)}><option>KIT_OWNERSHIP</option><option>PAY_PER_REPORTABLE</option></select>{current.pricing_method === 'PAY_PER_REPORTABLE' ? <div className="mt-2 grid grid-cols-2 gap-2"><input className={inputClass} placeholder="Price/report" value={current.price_per_reportable_test || ''} onChange={(e) => updateCostDraft(key, current, "price_per_reportable_test", e.target.value)} /><label><input type="checkbox" checked={Boolean(current.company_absorbs_waste)} onChange={(e) => updateCostDraft(key, current, "company_absorbs_waste", e.target.checked)} /> Waste</label><label><input type="checkbox" checked={Boolean(current.company_absorbs_qc)} onChange={(e) => updateCostDraft(key, current, "company_absorbs_qc", e.target.checked)} /> QC</label><label><input type="checkbox" checked={Boolean(current.company_absorbs_repeats)} onChange={(e) => updateCostDraft(key, current, "company_absorbs_repeats", e.target.checked)} /> Repeats</label></div> : <div className="mt-2 grid grid-cols-2 gap-2">{[['kit_price','Kit price'],['tests_per_kit','Tests/kit'],['usable_tests_per_kit','Usable tests'],['expected_waste_percentage','Waste %'],['repeat_rate_percentage','Repeat %'],['qc_cost_per_kit','QC/test'],['calibrator_cost_per_kit','Calibrator/test'],['fixed_consumable_cost_per_kit','Fixed cons./test'],['other_kit_related_cost','Other']].map(([field,label]) => <input key={field} className={inputClass} placeholder={label} value={["expected_waste_percentage", "repeat_rate_percentage"].includes(field) ? formatPercentInput(current[field]) : (current[field] || '')} onChange={(e) => updateCostDraft(key, current, field, e.target.value)} />)}</div>}{!readOnly && <button type="button" disabled={!costDrafts[key]} onClick={() => saveCostMatrix([key])} className="mt-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-slate-300">Save values</button>}<p className="mt-2 font-semibold text-slate-700">Effective: {money(current.calculated_effective_cost_per_reported_test)} / Monthly: {money(Number(current.annual_test_cost || 0) / 12)} / Annual: {money(current.annual_test_cost)}</p></td>; })}</tr>)}</tbody></table></div>
          </section>
        )}

        {activeTab === "TCO Analysis" && (
          <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><p className={criteriaWeightTotal === 100 ? "text-emerald-700" : "text-amber-700"}>Total weight: {criteriaWeightTotal} (should total 100)</p>{!readOnly && <form onSubmit={createCriteria} className="flex flex-wrap gap-3"><input className={inputClass} placeholder="Criteria" value={criteriaForm.criteria_name} onChange={(e) => setCriteriaForm({ ...criteriaForm, criteria_name: e.target.value })} required /><input className={inputClass} placeholder="Group" value={criteriaForm.criteria_group} onChange={(e) => setCriteriaForm({ ...criteriaForm, criteria_group: e.target.value })} /><input type="number" className={inputClass} placeholder="Weight" value={criteriaForm.weight} onChange={(e) => setCriteriaForm({ ...criteriaForm, weight: e.target.value })} /><select className={inputClass} value={criteriaForm.scoring_type} onChange={(e) => setCriteriaForm({ ...criteriaForm, scoring_type: e.target.value })}><option>manual</option><option>automatic</option></select><button className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">Add Criteria</button></form>}<table className="min-w-full text-sm"><tbody>{criteria.map((item) => <tr key={item.id} className="border-t"><td className="p-2 font-semibold">{item.criteria_name}</td><td>{item.criteria_group}</td><td>{item.weight}</td><td>{item.scoring_type}</td></tr>)}</tbody></table></section>
        )}

        {activeTab === "Scores" && (
          <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><button onClick={saveScores} disabled={readOnly} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:bg-slate-300">Save Manual Scores</button><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr><th className="p-2 text-left">Offer</th>{criteria.map((c) => <th key={c.id} className="p-2 text-left">{c.criteria_name}<br /><span className="text-xs text-slate-500">{c.weight}% · {c.scoring_type}</span></th>)}</tr></thead><tbody>{offers.map((offer) => <tr key={offer.id} className="border-t"><td className="p-2 font-semibold">{offer.offer_name}</td>{criteria.map((c) => { const key = `${offer.id}:${c.id}`; const existing = scores.find((s) => Number(s.offer_id) === Number(offer.id) && Number(s.criteria_id) === Number(c.id)); return <td key={key} className="p-2"><input disabled={readOnly || c.scoring_type === 'automatic'} className={inputClass} type="number" min="0" max="100" defaultValue={existing?.score || ''} onChange={(e) => setScoreDrafts({ ...scoreDrafts, [key]: { ...(scoreDrafts[key] || {}), score: e.target.value } })} /><input disabled={readOnly || c.scoring_type === 'automatic'} className={`${inputClass} mt-1`} placeholder="Comments" defaultValue={existing?.comments || ''} onChange={(e) => setScoreDrafts({ ...scoreDrafts, [key]: { ...(scoreDrafts[key] || {}), comments: e.target.value } })} /></td>; })}</tr>)}</tbody></table></div></section>
        )}

        {activeTab === "Results" && (
          <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><div className="grid gap-4 md:grid-cols-3">{results.map((row) => <div key={row.offer_id} className="rounded-xl border p-4"><p className="text-sm font-semibold text-indigo-700">Rank #{row.rank}</p><h3 className="font-bold">{row.offer_name}</h3><p>TCO: {money(row.tco_period_cost)}</p><p>Annual running: {money(row.total_annual_cost)}</p><p>Avg/test: {money(row.average_cost_per_reported_test)}</p><p>Score: {Number(row.final_weighted_score || 0).toFixed(2)}</p>{row.commitment_warning && <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">{row.commitment_warning}</p>}</div>)}</div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="bg-slate-100"><th>Rank</th><th>Offer</th><th>Pricing</th><th>Initial</th><th>Annual fixed</th><th>Annual variable</th><th>Commitment adj.</th><th>Total annual</th><th>TCO</th><th>Avg/test</th><th>Score</th><th>Warning</th></tr></thead><tbody>{results.map((row) => <tr key={row.offer_id} className="border-t"><td>{row.rank}</td><td>{row.offer_name}</td><td>{row.pricing_model}</td><td>{money(row.initial_cost)}</td><td>{money(row.annual_fixed_cost)}</td><td>{money(row.annual_variable_test_cost)}</td><td>{money(row.annual_commitment_adjustment)}</td><td>{money(row.total_annual_cost)}</td><td>{money(row.tco_period_cost)}</td><td>{money(row.average_cost_per_reported_test)}</td><td>{Number(row.final_weighted_score || 0).toFixed(2)}</td><td>{row.commitment_warning || '—'}</td></tr>)}</tbody></table></div></section>
        )}

        {activeTab === "Coverage Analysis" && (
          <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><button onClick={loadCoverage} className="rounded-lg border px-4 py-2 font-semibold">Refresh Coverage</button><div className="grid gap-4 md:grid-cols-3">{coverage?.offers?.map((offer) => <div key={offer.offer_id} className="rounded-xl border p-4"><h3 className="font-bold">{offer.offer_name}</h3><p className="text-2xl font-bold text-indigo-700">{offer.coverage_percentage}%</p><p>{offer.covered_count}/{offer.required_count} required items</p><p className="text-sm text-red-700">Missing: {offer.missing_items?.join(', ') || 'None'}</p></div>)}</div>{coverage?.unavailable_items?.length ? <p className="rounded bg-red-50 p-3 text-red-700">Unavailable: {coverage.unavailable_items.join(', ')}</p> : null}</section>
        )}

        {activeTab === "Break-even Analysis" && (
          <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><button onClick={loadItemComparison} className="rounded-lg border px-4 py-2 font-semibold">Refresh Comparison</button><table className="min-w-full text-sm"><tbody>{itemComparison.map((item) => <tr key={item.test_name} className="border-t"><td className="p-2 font-semibold">{item.test_name}</td><td>Cheapest: {item.cheapest_supplier?.offer_name || '—'}</td><td>{item.savings_opportunities?.map((saving) => `${saving.offer_name}: ${money(saving.potential_saving)}`).join('; ') || 'No savings gap'}</td></tr>)}</tbody></table></section>
        )}

        {activeTab === "Commercial Models" && !readOnly && (
          <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><h2 className="text-xl font-bold">Bulk Excel / CSV Import and Commercial Model Mapping</h2><div className="flex flex-wrap gap-3"><select className={inputClass} value={importOfferId} onChange={(e) => setImportOfferId(e.target.value)}><option value="">Company offer</option>{offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.offer_name}</option>)}</select><select className={inputClass} value={importOption} onChange={(e) => setImportOption(e.target.value)}><option>APPEND</option><option>REPLACE</option><option>UPDATE_MATCHING</option></select><button onClick={previewImport} className="rounded-lg border px-4 py-2 font-semibold">Preview</button><button onClick={confirmImport} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">Confirm Import</button></div><textarea className="min-h-[150px] w-full rounded-lg border p-3" placeholder="Paste Excel/CSV rows with headers" value={importText} onChange={(e) => setImportText(e.target.value)} />{importPreview && <div className="rounded bg-slate-50 p-3 text-sm"><p>Valid: {importPreview.valid_count}; Errors: {importPreview.error_count}</p><p>Mapping: {Object.entries(importPreview.columnMap || {}).map(([key, value]) => `${key}=${value}`).join(', ')}</p></div>}</section>
        )}

        {activeTab === "Sensitivity Analysis" && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><button onClick={loadSensitivity} className="mb-4 rounded-lg border px-4 py-2 font-semibold">Refresh Sensitivity</button><div className="grid gap-4 md:grid-cols-2">{sensitivity.map((scenario) => <div key={scenario.key} className="rounded-xl border p-4"><h3 className="font-bold">{scenario.label}</h3><p className={scenario.recommendation_changes ? 'text-amber-700' : 'text-emerald-700'}>Winner: {scenario.winner?.offer_name || '—'} {scenario.recommendation_changes ? '(recommendation changes)' : ''}</p>{scenario.offers?.map((offer) => <p key={offer.offer_id} className="text-sm text-slate-600">{offer.offer_name}: TCO {money(offer.tco_period_cost)}</p>)}</div>)}</div></section>
        )}

        {activeTab === "Documents" && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><h2 className="text-xl font-bold">Documents</h2><p className="mt-2 text-slate-600">Attach quotations, brochures, technical specs, price lists, service terms, warranty documents, compliance certificates, and committee reports here when the shared document module is linked to procurement evaluations.</p><input type="file" multiple className="mt-4 rounded-lg border p-3" disabled /></section>
        )}

        {activeTab === "Recommendation" && (
          <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><button onClick={loadRecommendation} className="rounded-lg border px-4 py-2 font-semibold">Generate Recommendation</button>{recommendation && <div className="grid gap-4 md:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><h3 className="font-bold">Decision Support</h3><p>Lowest TCO: {recommendation.lowest_tco_offer?.offer_name || recommendation.lowest_tco_offer?.offer_id || '—'}</p><p>Lowest average cost/test: {recommendation.lowest_average_cost_offer?.offer_name || recommendation.lowest_average_cost_offer?.offer_id || '—'}</p><p>Best weighted score: {recommendation.best_final_weighted_score_offer?.offer_name || recommendation.best_final_weighted_score_offer?.offer_id || '—'}</p><p>Recommended: {recommendation.final_recommended_offer?.offer_name || recommendation.final_recommended_offer?.offer_id || '—'}</p></div><div className="rounded-xl bg-amber-50 p-4"><h3 className="font-bold">Warnings</h3>{recommendation.risk_warnings?.length ? recommendation.risk_warnings.map((item) => <p key={item} className="text-sm text-amber-800">{item}</p>) : <p className="text-sm text-slate-600">No commitment warnings.</p>}</div></div>}<textarea className="min-h-[160px] w-full rounded-lg border border-slate-300 p-3" value={summaryDraft} onChange={(e) => setSummaryDraft(e.target.value)} placeholder="Editable recommendation summary before finalization" /><button onClick={finalize} disabled={readOnly} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:bg-slate-300">Finalize Selected Offer</button></section>
        )}
      </div>
    </div>
  );
};

export default ProcurementEvaluationDetail;