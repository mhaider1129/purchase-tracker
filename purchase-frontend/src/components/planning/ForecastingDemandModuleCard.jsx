import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const historicalRows = [
  {
    item: "Surgical gloves",
    pastUsage: 12400,
    currentStock: 3600,
    openPos: 1800,
    pendingReq: 950,
    nearExpiry: 120,
  },
  {
    item: "IV cannula",
    pastUsage: 5400,
    currentStock: 2100,
    openPos: 1000,
    pendingReq: 420,
    nearExpiry: 60,
  },
  {
    item: "Syringe 10ml",
    pastUsage: 9800,
    currentStock: 3000,
    openPos: 2200,
    pendingReq: 640,
    nearExpiry: 80,
  },
];

const integrationLinks = [
  { label: "Item master", to: "/item-master" },
  { label: "Inventory", to: "/warehouse-inventory" },
  { label: "Budget", to: "/dashboard" },
  { label: "PR module", to: "/all-requests" },
  { label: "Contract planning", to: "/contracts" },
  { label: "PO planning", to: "/procure-to-pay/purchase-orders" },
  { label: "Reporting", to: "/analytics" },
];

const formatQuantity = (value) => new Intl.NumberFormat().format(value);

const ForecastingDemandModuleCard = () => {
  const [forecastInput, setForecastInput] = useState({
    institute: "",
    item: "",
    cycle: "monthly",
    baselineQty: 1000,
    forecastQty: 1000,
    justification: "",
  });

  const percentageChange = useMemo(() => {
    const baseline = Number(forecastInput.baselineQty) || 0;
    const forecast = Number(forecastInput.forecastQty) || 0;
    if (!baseline) return 0;
    return ((forecast - baseline) / baseline) * 100;
  }, [forecastInput.baselineQty, forecastInput.forecastQty]);

  const needsJustification = Math.abs(percentageChange) >= 15;

  return (
    <section className="space-y-6 rounded-lg border border-blue-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
          Forecasting &amp; Demand Planning module
        </p>
        <h2 className="text-xl font-bold text-gray-900">
          Institute-level demand capture with centralized procurement planning
        </h2>
        <p className="text-sm text-gray-600">
          Collect, review, and consolidate institute forecasts through a full A-to-Z workflow,
          then translate approved demand into a procurement action plan.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900">Permissions involved</h3>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {[
            "department requester",
            "institute planning",
            "pharmacy",
            "warehouse",
            "central planning",
            "SCM",
          ].map((role) => (
            <span key={role} className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
              {role}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-md border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-900">A. Historical consumption snapshot</p>
          <p className="mt-1 text-xs text-gray-500">
            Auto-displays past usage, current stock, open POs, pending requisitions, and near-expiry stock.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-2 py-2">Item</th>
                  <th className="px-2 py-2">Past usage</th>
                  <th className="px-2 py-2">Stock</th>
                  <th className="px-2 py-2">Open POs</th>
                  <th className="px-2 py-2">Pending req.</th>
                  <th className="px-2 py-2">Near expiry</th>
                </tr>
              </thead>
              <tbody>
                {historicalRows.map((row) => (
                  <tr key={row.item} className="border-t border-gray-100">
                    <td className="px-2 py-2 font-medium text-gray-800">{row.item}</td>
                    <td className="px-2 py-2 text-gray-600">{formatQuantity(row.pastUsage)}</td>
                    <td className="px-2 py-2 text-gray-600">{formatQuantity(row.currentStock)}</td>
                    <td className="px-2 py-2 text-gray-600">{formatQuantity(row.openPos)}</td>
                    <td className="px-2 py-2 text-gray-600">{formatQuantity(row.pendingReq)}</td>
                    <td className="px-2 py-2 text-amber-700">{formatQuantity(row.nearExpiry)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-md border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-900">B–D. Forecast entry, justification, and submission</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Institute"
              value={forecastInput.institute}
              onChange={(event) =>
                setForecastInput((current) => ({ ...current, institute: event.target.value }))
              }
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Item"
              value={forecastInput.item}
              onChange={(event) =>
                setForecastInput((current) => ({ ...current, item: event.target.value }))
              }
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <select
              value={forecastInput.cycle}
              onChange={(event) =>
                setForecastInput((current) => ({ ...current, cycle: event.target.value }))
              }
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
            <input
              type="number"
              placeholder="Baseline quantity"
              value={forecastInput.baselineQty}
              onChange={(event) =>
                setForecastInput((current) => ({ ...current, baselineQty: event.target.value }))
              }
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              placeholder="Forecast quantity"
              value={forecastInput.forecastQty}
              onChange={(event) =>
                setForecastInput((current) => ({ ...current, forecastQty: event.target.value }))
              }
              className="rounded border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
            />
          </div>

          <p className="mt-3 text-xs text-gray-600">
            Change vs baseline: <span className="font-semibold text-gray-900">{percentageChange.toFixed(1)}%</span>
          </p>
          <textarea
            value={forecastInput.justification}
            onChange={(event) =>
              setForecastInput((current) => ({ ...current, justification: event.target.value }))
            }
            placeholder="Justify unusual change: expected patient growth, service expansion, seasonality, campaigns, commissioning..."
            className="mt-2 min-h-[84px] w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          {needsJustification && !forecastInput.justification.trim() && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              Justification is required for unusual increases/decreases (≥15%).
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            On submit, institute reviewer validates first, then central planning consolidates and SCM adjusts for budget, contracts, MOQ, storage, and supply risks.
          </p>
        </article>
      </div>

      <article className="rounded-md border border-gray-200 p-4">
        <p className="text-sm font-semibold text-gray-900">E–G. Consolidation to procurement plan</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-700">
          <li>Central planning aggregates all institute forecasts in ERP.</li>
          <li>SCM/planning tunes the consolidated view to strategic and operational constraints.</li>
          <li>Approved forecast is converted into sourcing, framework contracts, and procurement schedules.</li>
        </ol>
        <p className="mt-2 text-xs text-green-700">
          Completion point: Forecast is reviewed, approved, consolidated, and translated into procurement action plans.
        </p>
      </article>

      <article className="rounded-md border border-gray-200 p-4">
        <p className="text-sm font-semibold text-gray-900">Linked modules</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {integrationLinks.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:border-blue-400 hover:text-blue-700"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </article>
    </section>
  );
};

export default ForecastingDemandModuleCard;