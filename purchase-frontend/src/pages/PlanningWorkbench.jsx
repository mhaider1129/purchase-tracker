
import React, { useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import {
  calculateSafetyStock as calculateSafetyStockApi,
  fetchDemandForecast,
  runMrp,
} from "../api/planning";
import formatNumber from "../utils/formatNumber";

const defaultForecastForm = {
  item_name: "",
  method: "moving_average",
  horizon_months: 6,
  window_size: 3,
  sop_adjustments: [],
};

const defaultSafetyForm = {
  item_name: "",
  service_level: 0.95,
  lead_time_days: 14,
  review_period_days: 7,
  on_hand: 0,
  on_order: 0,
};

const defaultMrpItem = {
  item_name: "",
  on_hand: 0,
  on_order: 0,
  safety_stock: 0,
  lead_time_days: 14,
  lot_size: 0,
  horizon_days: 84,
  bucket_days: 7,
};

const PlanningWorkbench = () => {
  const [forecastForm, setForecastForm] = useState(defaultForecastForm);
  const [sopRows, setSopRows] = useState([]);
  const [forecastResult, setForecastResult] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState("");

  const [safetyForm, setSafetyForm] = useState(defaultSafetyForm);
  const [safetyResult, setSafetyResult] = useState(null);
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetyError, setSafetyError] = useState("");

  const [mrpItem, setMrpItem] = useState(defaultMrpItem);
  const [demandRows, setDemandRows] = useState([{ date: "", quantity: 0 }]);
  const [openOrders, setOpenOrders] = useState([]);
  const [mrpResult, setMrpResult] = useState(null);
  const [mrpLoading, setMrpLoading] = useState(false);
  const [mrpError, setMrpError] = useState("");

  const addSopRow = () => {
    setSopRows((rows) => [...rows, { period: "", adjustment: 0 }]);
  };

  const updateSopRow = (index, field, value) => {
    setSopRows((rows) =>
      rows.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)),
    );
  };

  const removeSopRow = (index) => {
    setSopRows((rows) => rows.filter((_, idx) => idx !== index));
  };

  const handleForecastSubmit = async (event) => {
    event.preventDefault();
    setForecastLoading(true);
    setForecastError("");
    setForecastResult(null);

    try {
      const payload = { ...forecastForm, sop_adjustments: sopRows };
      const res = await fetchDemandForecast(payload);
      setForecastResult(res.data);
    } catch (err) {
      console.error("Failed to generate forecast", err);
      setForecastError(
        err?.response?.data?.message ||
          "Unable to generate a forecast. Please try again.",
      );
    } finally {
      setForecastLoading(false);
    }
  };

  const handleSafetySubmit = async (event) => {
    event.preventDefault();
    setSafetyLoading(true);
    setSafetyError("");
    setSafetyResult(null);

    try {
      const res = await calculateSafetyStockApi(safetyForm);
      setSafetyResult(res.data);
    } catch (err) {
      console.error("Failed to calculate safety stock", err);
      setSafetyError(
        err?.response?.data?.message ||
          "Unable to calculate safety stock. Please try again.",
      );
    } finally {
      setSafetyLoading(false);
    }
  };

  const handleMrpSubmit = async (event) => {
    event.preventDefault();
    setMrpLoading(true);
    setMrpError("");
    setMrpResult(null);

    try {
      const payload = {
        horizon_days: mrpItem.horizon_days,
        bucket_days: mrpItem.bucket_days,
        items: [
          {
            ...mrpItem,
            forecast: demandRows.filter((row) => row.date && row.quantity),
            open_orders: openOrders.filter(
              (row) => row.due_date && row.quantity,
            ),
          },
        ],
      };
      const res = await runMrp(payload);
      setMrpResult(res.data);
    } catch (err) {
      console.error("Failed to run MRP", err);
      setMrpError(
        err?.response?.data?.message || "Unable to run MRP. Please try again.",
      );
    } finally {
      setMrpLoading(false);
    }
  };

  const adoptForecastForMrp = () => {
    if (!forecastResult?.forecast?.length) return;
    setMrpItem((current) => ({ ...current, item_name: forecastForm.item_name }));
    const mapped = forecastResult.forecast.map((entry) => ({
      date: `${entry.month}-01`,
      quantity: entry.forecast_qty,
    }));
    setDemandRows(mapped);
  };

  const addDemandRow = () =>
    setDemandRows((rows) => [...rows, { date: "", quantity: 0 }]);

  const updateDemandRow = (index, field, value) => {
    setDemandRows((rows) =>
      rows.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)),
    );
  };

  const removeDemandRow = (index) => {
    setDemandRows((rows) => rows.filter((_, idx) => idx !== index));
  };

  const addOpenOrder = () =>
    setOpenOrders((rows) => [...rows, { due_date: "", quantity: 0 }]);

  const updateOpenOrder = (index, field, value) => {
    setOpenOrders((rows) =>
      rows.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)),
    );
  };

  const removeOpenOrder = (index) => {
    setOpenOrders((rows) => rows.filter((_, idx) => idx !== index));
  };

  const forecastTable = useMemo(() => {
    if (!forecastResult?.forecast?.length) return null;
    return (
      <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200" aria-label="Forecast table">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Period
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Forecast Qty
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {forecastResult.forecast.map((entry) => (
              <tr key={entry.month} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-sm font-medium text-gray-900">{entry.month}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{formatNumber(entry.forecast_qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [forecastResult]);

  const bucketTable = useMemo(() => {
    if (!mrpResult?.plans?.[0]?.buckets?.length) return null;
    const buckets = mrpResult.plans[0].buckets;
    return (
      <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200" aria-label="Bucketed demand table">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Bucket</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Start</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Demand</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Receipts</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Projected Available</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {buckets.map((bucket) => (
              <tr key={bucket.index} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-sm font-medium text-gray-900">Week {bucket.index}</td>
                <td className="px-4 py-2 text-sm text-gray-700">
                  {new Date(bucket.start).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-sm text-gray-700">{formatNumber(bucket.demand)}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{formatNumber(bucket.receipts)}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{formatNumber(bucket.projected_available)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [mrpResult]);

  const plannedOrders = useMemo(() => {
    if (!mrpResult?.plans?.[0]?.planned_orders?.length) return null;
    const orders = mrpResult.plans[0].planned_orders;
    return (
      <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200" aria-label="Planned orders table">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Need by</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Release</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Quantity</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Bucket</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders.map((order, index) => (
              <tr key={`${order.need_by}-${index}`} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-sm font-medium text-gray-900">
                  {new Date(order.need_by).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-sm text-gray-700">
                  {new Date(order.planned_release).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-sm text-gray-700">{formatNumber(order.quantity)}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{order.bucket}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [mrpResult]);

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl space-y-10 p-6">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Demand planning</p>
          <h1 className="text-3xl font-bold text-gray-900">Forecasting, safety stock, and MRP</h1>
          <p className="max-w-3xl text-sm text-gray-600">
            Use the new planning services to build statistical forecasts, compute safety stock policies, and net demand into dated planned orders.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Demand forecast</h2>
                <p className="text-sm text-gray-600">Generate a monthly forecast using moving-average or linear trend.</p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Forecast</span>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleForecastSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="forecast-item">
                  Item name
                </label>
                <input
                  id="forecast-item"
                  type="text"
                  value={forecastForm.item_name}
                  onChange={(e) =>
                    setForecastForm((form) => ({ ...form, item_name: e.target.value }))
                  }
                  required
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Surgical gloves"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="forecast-method">
                    Method
                  </label>
                  <select
                    id="forecast-method"
                    value={forecastForm.method}
                    onChange={(e) =>
                      setForecastForm((form) => ({ ...form, method: e.target.value }))
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="moving_average">Moving average</option>
                    <option value="linear_trend">Linear trend</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="forecast-horizon">
                    Horizon (months)
                  </label>
                  <input
                    id="forecast-horizon"
                    type="number"
                    min="1"
                    max="18"
                    value={forecastForm.horizon_months}
                    onChange={(e) =>
                      setForecastForm((form) => ({
                        ...form,
                        horizon_months: Number(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="forecast-window">
                    Window size
                  </label>
                  <input
                    id="forecast-window"
                    type="number"
                    min="1"
                    max="12"
                    value={forecastForm.window_size}
                    onChange={(e) =>
                      setForecastForm((form) => ({
                        ...form,
                        window_size: Number(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={forecastForm.method !== "moving_average"}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">S&OP adjustments</h3>
                    <p className="text-xs text-gray-500">Optional overrides by period (YYYY-MM).</p>
                  </div>
                  <button
                    type="button"
                    onClick={addSopRow}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Add adjustment
                  </button>
                </div>
                {sopRows.length === 0 && (
                  <p className="text-xs text-gray-500">No overrides added.</p>
                )}
                <div className="space-y-2">
                  {sopRows.map((row, index) => (
                    <div key={`sop-${index}`} className="grid gap-3 sm:grid-cols-5 sm:items-end">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-600" htmlFor={`period-${index}`}>
                          Period (YYYY-MM)
                        </label>
                        <input
                          id={`period-${index}`}
                          type="text"
                          value={row.period}
                          onChange={(e) => updateSopRow(index, "period", e.target.value)}
                          placeholder="2024-11"
                          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-600" htmlFor={`adjustment-${index}`}>
                          Adjustment
                        </label>
                        <input
                          id={`adjustment-${index}`}
                          type="number"
                          value={row.adjustment}
                          onChange={(e) =>
                            updateSopRow(index, "adjustment", Number(e.target.value))
                          }
                          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeSopRow(index)}
                          className="text-sm font-semibold text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                disabled={forecastLoading}
              >
                {forecastLoading ? "Generating forecast…" : "Run forecast"}
              </button>

              {forecastError && (
                <p className="text-sm text-red-600" role="alert">
                  {forecastError}
                </p>
              )}
            </form>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Safety stock policy</h2>
                <p className="text-sm text-gray-600">Calculate reorder point and buffer based on daily volatility.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Safety</span>
            </div>

            <form className="space-y-4" onSubmit={handleSafetySubmit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="safety-item">
                    Item name
                  </label>
                  <input
                    id="safety-item"
                    type="text"
                    value={safetyForm.item_name}
                    onChange={(e) =>
                      setSafetyForm((form) => ({ ...form, item_name: e.target.value }))
                    }
                    required
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Same item as forecast"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="service-level">
                    Service level (0-1)
                  </label>
                  <input
                    id="service-level"
                    type="number"
                    step="0.01"
                    min="0.5"
                    max="0.999"
                    value={safetyForm.service_level}
                    onChange={(e) =>
                      setSafetyForm((form) => ({
                        ...form,
                        service_level: Number(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="lead-time">
                    Lead time (days)
                  </label>
                  <input
                    id="lead-time"
                    type="number"
                    min="1"
                    value={safetyForm.lead_time_days}
                    onChange={(e) =>
                      setSafetyForm((form) => ({
                        ...form,
                        lead_time_days: Number(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="review-period">
                    Review period (days)
                  </label>
                  <input
                    id="review-period"
                    type="number"
                    min="1"
                    value={safetyForm.review_period_days}
                    onChange={(e) =>
                      setSafetyForm((form) => ({
                        ...form,
                        review_period_days: Number(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="on-hand">
                    On hand
                  </label>
                  <input
                    id="on-hand"
                    type="number"
                    min="0"
                    value={safetyForm.on_hand}
                    onChange={(e) =>
                      setSafetyForm((form) => ({
                        ...form,
                        on_hand: Number(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="on-order">
                    On order
                  </label>
                  <input
                    id="on-order"
                    type="number"
                    min="0"
                    value={safetyForm.on_order}
                    onChange={(e) =>
                      setSafetyForm((form) => ({
                        ...form,
                        on_order: Number(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="inline-flex items-center justify-center rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                disabled={safetyLoading}
              >
                {safetyLoading ? "Calculating…" : "Calculate"}
              </button>

              {safetyError && (
                <p className="text-sm text-red-600" role="alert">
                  {safetyError}
                </p>
              )}

              {safetyResult && (
                <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <p className="font-semibold">Reorder point: {formatNumber(safetyResult.reorder_point)}</p>
                  <p>Safety stock: {formatNumber(safetyResult.safety_stock)}</p>
                  <p>Recommended order (gap): {formatNumber(safetyResult.reorder_recommendation)}</p>
                  <p className="mt-2 text-xs text-emerald-700">
                    Avg daily demand {formatNumber(safetyResult.average_daily_demand)} · Std dev {formatNumber(safetyResult.demand_std_dev)} · Z {safetyResult.z_value}
                  </p>
                </div>
              )}
            </form>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">MRP / DRP netting</h2>
              <p className="text-sm text-gray-600">Bucket your demand, apply inventory, and generate planned orders.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Netting</span>
              {forecastResult?.forecast?.length > 0 && (
                <button
                  type="button"
                  onClick={adoptForecastForMrp}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Use forecast above
                </button>
              )}
            </div>
          </div>

          <form className="mt-4 space-y-6" onSubmit={handleMrpSubmit}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="mrp-item">
                  Item name
                </label>
                <input
                  id="mrp-item"
                  type="text"
                  value={mrpItem.item_name}
                  onChange={(e) => setMrpItem((item) => ({ ...item, item_name: e.target.value }))}
                  required
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="mrp-horizon">
                  Horizon (days)
                </label>
                <input
                  id="mrp-horizon"
                  type="number"
                  min="7"
                  value={mrpItem.horizon_days}
                  onChange={(e) =>
                    setMrpItem((item) => ({
                      ...item,
                      horizon_days: Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="mrp-bucket">
                  Bucket size (days)
                </label>
                <input
                  id="mrp-bucket"
                  type="number"
                  min="1"
                  value={mrpItem.bucket_days}
                  onChange={(e) =>
                    setMrpItem((item) => ({
                      ...item,
                      bucket_days: Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="mrp-on-hand">
                  On hand
                </label>
                <input
                  id="mrp-on-hand"
                  type="number"
                  min="0"
                  value={mrpItem.on_hand}
                  onChange={(e) =>
                    setMrpItem((item) => ({ ...item, on_hand: Number(e.target.value) }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="mrp-on-order">
                  On order
                </label>
                <input
                  id="mrp-on-order"
                  type="number"
                  min="0"
                  value={mrpItem.on_order}
                  onChange={(e) =>
                    setMrpItem((item) => ({ ...item, on_order: Number(e.target.value) }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="mrp-safety">
                  Safety stock
                </label>
                <input
                  id="mrp-safety"
                  type="number"
                  min="0"
                  value={mrpItem.safety_stock}
                  onChange={(e) =>
                    setMrpItem((item) => ({
                      ...item,
                      safety_stock: Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="mrp-lot">
                  Lot size (0 for any)
                </label>
                <input
                  id="mrp-lot"
                  type="number"
                  min="0"
                  value={mrpItem.lot_size}
                  onChange={(e) =>
                    setMrpItem((item) => ({ ...item, lot_size: Number(e.target.value) }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Forecasted demand</h3>
                <button
                  type="button"
                  onClick={addDemandRow}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Add row
                </button>
              </div>
              <div className="space-y-2">
                {demandRows.map((row, index) => (
                  <div key={`demand-${index}`} className="grid gap-3 sm:grid-cols-5 sm:items-end">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600" htmlFor={`demand-date-${index}`}>
                        Demand date
                      </label>
                      <input
                        id={`demand-date-${index}`}
                        type="date"
                        value={row.date}
                        onChange={(e) => updateDemandRow(index, "date", e.target.value)}
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600" htmlFor={`demand-qty-${index}`}>
                        Quantity
                      </label>
                      <input
                        id={`demand-qty-${index}`}
                        type="number"
                        min="0"
                        value={row.quantity}
                        onChange={(e) =>
                          updateDemandRow(index, "quantity", Number(e.target.value))
                        }
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeDemandRow(index)}
                        className="text-sm font-semibold text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Open orders (scheduled receipts)</h3>
                <button
                  type="button"
                  onClick={addOpenOrder}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Add receipt
                </button>
              </div>
              {openOrders.length === 0 && (
                <p className="text-xs text-gray-500">No scheduled receipts captured.</p>
              )}
              <div className="space-y-2">
                {openOrders.map((row, index) => (
                  <div key={`receipt-${index}`} className="grid gap-3 sm:grid-cols-5 sm:items-end">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600" htmlFor={`receipt-date-${index}`}>
                        Due date
                      </label>
                      <input
                        id={`receipt-date-${index}`}
                        type="date"
                        value={row.due_date}
                        onChange={(e) => updateOpenOrder(index, "due_date", e.target.value)}
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600" htmlFor={`receipt-qty-${index}`}>
                        Quantity
                      </label>
                      <input
                        id={`receipt-qty-${index}`}
                        type="number"
                        min="0"
                        value={row.quantity}
                        onChange={(e) =>
                          updateOpenOrder(index, "quantity", Number(e.target.value))
                        }
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeOpenOrder(index)}
                        className="text-sm font-semibold text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              disabled={mrpLoading}
            >
              {mrpLoading ? "Running MRP…" : "Run MRP"}
            </button>

            {mrpError && (
              <p className="text-sm text-red-600" role="alert">
                {mrpError}
              </p>
            )}
          </form>

          {mrpResult && (
            <div className="mt-6 space-y-4">
              <div className="rounded border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
                <p className="font-semibold">Planned orders: {mrpResult.summary?.total_planned_orders ?? 0}</p>
                <p>Horizon {mrpResult.horizon_days} days · Bucket size {mrpResult.bucket_days} days</p>
              </div>
              {plannedOrders}
              {bucketTable}
            </div>
          )}
        </section>

        {forecastResult && (
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Forecast output</h2>
                <p className="text-sm text-gray-600">
                  History and projected monthly demand for {forecastResult.item_name}.
                </p>
                {forecastResult.history_source && (
                  <p className="text-xs text-indigo-700">
                    History source: {forecastResult.history_source === 'monthly_dispensing' ? 'Monthly dispensing feeds' : 'Request demand logs'}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Output</span>
            </div>
            <div className="mt-4 space-y-4">
              {forecastTable}
              {forecastResult.history?.length > 0 && (
                <details className="rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  <summary className="cursor-pointer font-semibold text-gray-800">View history used</summary>
                  <ul className="mt-2 space-y-1 text-xs text-gray-600">
                    {forecastResult.history.map((entry) => (
                      <li key={entry.bucket}>
                        {entry.bucket}: {formatNumber(entry.quantity)}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </section>
        )}
      </main>
    </>
  );
};

export default PlanningWorkbench;