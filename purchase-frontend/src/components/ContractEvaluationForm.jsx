import React, { useState, useEffect, useMemo } from "react";
import api from "../api/axios";

const normalizeComponents = (components) => {
  if (!Array.isArray(components)) {
    return [];
  }

  return components
    .map((component) => {
      if (typeof component === "string") {
        const name = component.trim();
        return name ? { name, score: null } : null;
      }

      if (component && typeof component === "object") {
        const name = (
          component.name ||
          component.component ||
          component.label ||
          ""
        ).trim();
        return name ? { name, score: component.score ?? null } : null;
      }

      return null;
    })
    .filter(Boolean);
};

const ContractEvaluationForm = ({ contractId, onClose }) => {
  const [criteriaOptions, setCriteriaOptions] = useState([]);
  const [selectedCriterionId, setSelectedCriterionId] = useState("");
  const [evaluatorId, setEvaluatorId] = useState("");
  const [formError, setFormError] = useState("");
  const [candidateError, setCandidateError] = useState("");
  const [criteriaLoading, setCriteriaLoading] = useState(false);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [eligibleEvaluators, setEligibleEvaluators] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchCriteria = async () => {
      setCriteriaLoading(true);
      setFormError("");
      try {
        const { data } = await api.get("/api/contract-evaluations/criteria");
        if (!isMounted) return;
        const criteriaData = Array.isArray(data) ? data : [];
        setCriteriaOptions(criteriaData);
      } catch (err) {
        console.error("Failed to load evaluation criteria", err);
        if (!isMounted) return;
        setFormError("Unable to load evaluation prerequisites.");
      } finally {
        if (isMounted) {
          setCriteriaLoading(false);
        }
      }
    };

    fetchCriteria();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setCandidateError("");

    if (!selectedCriterionId) {
      setEligibleEvaluators([]);
      return;
    }

    setEligibleEvaluators([]);
    let isMounted = true;
    const fetchCandidates = async () => {
      setCandidatesLoading(true);
      try {
        const { data } = await api.get(
          `/api/contracts/${contractId}/evaluation-candidates`,
          {
            params: { criterionId: selectedCriterionId },
          },
        );
        if (!isMounted) return;
        const candidates = Array.isArray(data) ? data : [];
        setEligibleEvaluators(candidates);
      } catch (err) {
        console.error("Failed to load evaluation candidates", err);
        if (!isMounted) return;
        setEligibleEvaluators([]);
        setCandidateError(
          err?.response?.data?.message ||
            "Unable to load eligible evaluators for this criterion.",
        );
      } finally {
        if (isMounted) {
          setCandidatesLoading(false);
        }
      }
    };

    fetchCandidates();

    return () => {
      isMounted = false;
    };
  }, [contractId, selectedCriterionId]);

  const selectedCriterion = useMemo(() => {
    if (!selectedCriterionId) {
      return undefined;
    }

    return criteriaOptions.find(
      (criterion) => String(criterion.id) === String(selectedCriterionId),
    );
  }, [criteriaOptions, selectedCriterionId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!selectedCriterionId) {
      setFormError("Please select an evaluation criterion.");
      return;
    }

    if (!evaluatorId) {
      setFormError("Please select an evaluator.");
      return;
    }

    const criterionId = Number(selectedCriterionId);
    const evaluationTemplate = {
      criterionId: criterionId || null,
      criterionName: selectedCriterion?.name || null,
      criterionRole: selectedCriterion?.role || null,
      components: normalizeComponents(selectedCriterion?.components),
      overallScore: null,
    };

    if (evaluationTemplate.components.length === 0) {
      setFormError(
        "The selected criterion does not have any components to evaluate.",
      );
      return;
    }

    setSaving(true);

    try {
      await api.post("/api/contract-evaluations", {
        contract_id: contractId,
        evaluator_id: evaluatorId,
        criterion_id: criterionId || null,
        evaluation_criteria: evaluationTemplate,
      });
      onClose();
    } catch (err) {
      console.error("Failed to send for evaluation", err);
      setFormError(
        err?.response?.data?.message ||
          "Failed to send for evaluation. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3 text-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Send for Evaluation
          </h3>
          <div className="mt-2 px-7 py-3">
            <form onSubmit={handleSubmit}>
              <div className="mb-4 text-left">
                <label
                  htmlFor="criterion"
                  className="block text-sm font-medium text-gray-700"
                >
                  Evaluation Criterion
                </label>
                <select
                  id="criterion"
                  name="criterion"
                  value={selectedCriterionId}
                  onChange={(e) => {
                    setSelectedCriterionId(e.target.value);
                    setEvaluatorId("");
                  }}
                  disabled={criteriaLoading}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">Select criterion</option>
                  {criteriaOptions.map((criterion) => (
                    <option key={criterion.id} value={criterion.id}>
                      {criterion.name}
                    </option>
                  ))}
                </select>
                {selectedCriterion && (
                  <div className="mt-2 rounded-md bg-gray-50 p-3 text-left text-xs text-gray-600">
                    <p className="font-semibold text-gray-700">
                      Components to score:
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {normalizeComponents(selectedCriterion.components).map(
                        (component) => (
                          <li key={component.name}>{component.name}</li>
                        ),
                      )}
                    </ul>
                    <p className="mt-2 text-[11px] text-gray-500">
                      Assigned role: {selectedCriterion.role || "—"}
                    </p>
                  </div>
                )}
              </div>
              <div className="mb-4">
                <label
                  htmlFor="evaluator"
                  className="block text-sm font-medium text-gray-700"
                >
                  Evaluator
                </label>
                <select
                  id="evaluator"
                  name="evaluator"
                  value={evaluatorId}
                  onChange={(e) => setEvaluatorId(e.target.value)}
                  disabled={criteriaLoading || candidatesLoading}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">
                    {candidatesLoading
                      ? "Loading evaluators…"
                      : "Select an evaluator"}
                  </option>
                  {eligibleEvaluators.map((user) => (
                    <option key={user.id} value={String(user.id)}>
                      {user.name || user.email || `User #${user.id}`}{" "}
                      {user.role ? `(${(user.role || "").toUpperCase()})` : ""}
                    </option>
                  ))}
                </select>
                {candidateError && (
                  <p className="mt-2 text-xs text-red-500">{candidateError}</p>
                )}
                {!candidateError &&
                  !candidatesLoading &&
                  selectedCriterion &&
                  eligibleEvaluators.length === 0 && (
                    <p className="mt-2 text-xs text-red-500">
                      No eligible evaluators are available for this criterion
                      right now.
                    </p>
                  )}
              </div>
              {formError && (
                <p className="text-red-500 text-xs italic">{formError}</p>
              )}
              <div className="items-center px-4 py-3">
                <button
                  type="submit"
                  disabled={saving || criteriaLoading || candidatesLoading}
                  className="w-full rounded-md bg-blue-500 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                >
                  {saving ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </div>
          <div className="items-center px-4 py-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractEvaluationForm;
