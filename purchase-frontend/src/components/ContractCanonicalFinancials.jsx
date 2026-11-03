import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import useUiTranslation from "../utils/useUiTranslation";
const metrics = [
  ["contract_ceiling", "Contract ceiling"],
  ["approved_po_commitments", "Approved and issued PO commitments"],
  ["received_value", "Accepted receipt value"],
  ["invoiced_value", "Registered invoice value"],
  ["posted_payable", "Posted AP liability"],
  ["paid_amount", "Recorded paid allocations"],
  ["outstanding_ap_balance", "Outstanding AP balance"],
  ["remaining_contract_capacity", "Remaining contract capacity"],
];
export default function ContractCanonicalFinancials({ contractId }) {
  const text = useUiTranslation();
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setData(null);
    setError("");
    api
      .get(`/contracts/${contractId}/canonical-financials`)
      .then((r) => {
        if (current) setData(r.data);
      })
      .catch((e) => {
        if (current)
          setError(
            e.response?.data?.message ||
              text("Canonical financial information is unavailable."),
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [contractId, attempt, text]);
  return (
    <section
      aria-label={text("Accounts payable and payments")}
      className="space-y-3 rounded border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900 dark:bg-blue-950/20"
    >
      <h3 className="font-semibold">{text("Accounts payable and payments")}</h3>
      <p className="text-sm">
        {text(
          "These are separate stages of the same obligation. Do not add commitments, invoices and payments together. Values stay in the contract currency; no exchange conversion is applied.",
        )}
      </p>
      {loading && <p role="status">{text("Loading...")}</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="mt-2 underline"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {text("Retry")}
          </button>
        </div>
      )}
      {data && (
        <>
          {data.source_model === "UNSUPPORTED_CONTRACT_SOURCE" && (
            <p role="alert">
              {text(
                "New financial transactions are unavailable for this contract source.",
              )}
            </p>
          )}
          {data.reconciliation_required && (
            <p
              role="alert"
              className="font-semibold text-amber-800 dark:text-amber-200"
            >
              {text(
                "Reconciliation required. Legacy evidence is preserved separately and blocks new settlement until an approved source mapping exists.",
              )}
            </p>
          )}
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map(([key, label]) => (
              <div key={key} className="rounded border p-2">
                <dt className="text-sm">{text(label)}</dt>
                <dd className="font-semibold" dir="ltr">
                  {data.metrics[key]} {data.currency}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-sm">
            {text(
              "Contract capacity reserves issued PO face value, including closed orders. Historical legacy totals below are not included in canonical amounts.",
            )}
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            {(data.documents.purchase_orders || []).map((p) => (
              <Link
                className="underline"
                key={`po-${p.id}`}
                to={`/requests/${data.request_id}/procure-to-pay#canonical-document-po-${p.id}`}
              >
                {text("Purchase order")} #{p.id}: {p.amount} {data.currency}
              </Link>
            ))}
            {(data.documents.invoices || []).map((i) => (
              <Link
                className="underline"
                key={`invoice-${i.id}`}
                to={`/requests/${data.request_id}/procure-to-pay#canonical-document-invoice-${i.id}`}
              >
                {text("Invoice")} #{i.id}: {i.amount} {data.currency}
              </Link>
            ))}
            {(data.documents.payables || []).map((a) => (
              <Link
                className="underline"
                key={`ap-${a.id}`}
                to={`/requests/${data.request_id}/procure-to-pay#canonical-document-payable-${a.id}`}
              >
                {text("Posted AP liability")} #{a.id}: {a.amount}{" "}
                {data.currency}
              </Link>
            ))}
            {(data.documents.allocations || []).map((a) => (
              <Link
                className="underline"
                key={`allocation-${a.allocation_id}`}
                to={`/requests/${data.request_id}/procure-to-pay#canonical-document-payment-${a.payment_id}`}
              >
                {text("Payment")} #{a.payment_id}: {a.amount} {data.currency}
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
