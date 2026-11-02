import React from "react";
import { Link } from "react-router-dom";
import useUiTranslation from "../utils/useUiTranslation";

export default function ContractFinancialHistoryNotice() {
  const text = useUiTranslation();
  return (
    <div
      role="note"
      className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      <p className="font-semibold">
        {text("Legacy contract financial history is read-only.")}
      </p>
      <p>
        {text(
          "Use verified invoices and posted AP payables for new transactions. Do not recreate an already settled obligation. Contract-only records without a canonical source require finance reconciliation.",
        )}
      </p>
      <Link
        className="mt-2 inline-block underline"
        to="/procure-to-pay/accounts-payable"
      >
        {text("Open Accounts Payable")}
      </Link>
    </div>
  );
}
