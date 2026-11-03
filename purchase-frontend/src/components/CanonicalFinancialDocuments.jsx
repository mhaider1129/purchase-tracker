import React, { useEffect } from "react";
import useUiTranslation from "../utils/useUiTranslation";
const groups = [
  ["po", "purchase_orders", "Purchase order", "total_amount"],
  ["invoice", "invoices", "Invoice", "total_amount"],
  ["payable", "payables", "Accounts payable", "invoice_total"],
  ["payment", "payments", "Payment", "amount_paid"],
];
export default function CanonicalFinancialDocuments({ data }) {
  const text = useUiTranslation();
  useEffect(() => {
    if (window.location.hash.startsWith("#canonical-document-"))
      document
        .getElementById(window.location.hash.slice(1))
        ?.scrollIntoView?.({ block: "center" });
  }, [data]);
  return (
    <section
      className="rounded border bg-white p-4"
      aria-label={text("Financial documents")}
    >
      <h3 className="font-semibold">{text("Financial documents")}</h3>
      <ul className="space-y-2 text-sm">
        {groups.flatMap(([kind, key, label, amount]) =>
          (data?.[key] || []).map((record) => (
            <li
              className="rounded p-2 target:ring-2 target:ring-blue-500"
              key={`${kind}-${record.id}`}
              id={`canonical-document-${kind}-${record.id}`}
            >
              {text(label)} #{record.id} ·{" "}
              {record.invoice_number || record.po_number || ""} ·{" "}
              <span dir="ltr">
                {record[amount] ?? "—"} {record.currency}
              </span>
            </li>
          )),
        )}
      </ul>
    </section>
  );
}
