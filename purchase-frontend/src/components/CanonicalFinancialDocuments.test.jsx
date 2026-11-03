import React from "react";
import { render, screen } from "@testing-library/react";
import Component from "./CanonicalFinancialDocuments";
jest.mock("../utils/useUiTranslation", () => () => (value) => value);
test("canonical document links resolve to exact records without a settlement writer or float conversion", () => {
  const scroll = jest.fn();
  Element.prototype.scrollIntoView = scroll;
  window.location.hash = "#canonical-document-payable-3";
  try {
    render(
      <Component
        data={{
          purchase_orders: [
            {
              id: 1,
              po_number: "PO-1",
              total_amount: "100.00",
              currency: "USD",
            },
          ],
          invoices: [
            {
              id: 2,
              invoice_number: "INV-2",
              total_amount: "90.00",
              currency: "USD",
            },
          ],
          payables: [
            { id: 3, invoice_total: "9007199254740993.12", currency: "USD" },
          ],
          payments: [{ id: 4, amount_paid: "30.00", currency: "USD" }],
        }}
      />,
    );
    expect(
      document.getElementById("canonical-document-payable-3"),
    ).toHaveTextContent("9007199254740993.12 USD");
    expect(scroll).toHaveBeenCalled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  } finally {
    window.location.hash = "";
    delete Element.prototype.scrollIntoView;
  }
});
