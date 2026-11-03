import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Component from "./ContractCanonicalFinancials";
import api from "../api/axios";
jest.mock("../api/axios", () => ({ get: jest.fn() }));
jest.mock("../utils/useUiTranslation", () => () => (text) => text);
const payload = {
  request_id: "7",
  currency: "USD",
  metrics: {
    contract_ceiling: "9007199254740993.12",
    approved_po_commitments: "100.00",
    received_value: "50.00",
    invoiced_value: "50.00",
    posted_payable: "50.00",
    paid_amount: "15.00",
    outstanding_ap_balance: "35.00",
    remaining_contract_capacity: "9007199254740893.12",
  },
  reconciliation_required: true,
  documents: {
    purchase_orders: [{ id: "5", amount: "100.00" }],
    invoices: [{ id: "6", amount: "50.00" }],
    payables: [{ id: "7", amount: "50.00" }],
    allocations: [{ allocation_id: "9", payment_id: "8", amount: "15.00" }],
  },
};
test("canonical values remain exact, independent and linked while legacy evidence is held", async () => {
  api.get.mockResolvedValue({ data: payload });
  render(
    <MemoryRouter>
      <Component contractId={3} />
    </MemoryRouter>,
  );
  await screen.findByText("9007199254740993.12 USD");
  expect(screen.getByText("15.00 USD")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Reconciliation required",
  );
  expect(screen.getByRole("link", { name: /Purchase order/ })).toHaveAttribute(
    "href",
    "/requests/7/procure-to-pay#canonical-document-po-5",
  );
  expect(api.get).toHaveBeenCalledWith("/contracts/3/canonical-financials");
  expect(
    screen.queryByRole("button", { name: /pay|settle/i }),
  ).not.toBeInTheDocument();
});
test("authorization or schema failure is displayed without misleading zero totals", async () => {
  api.get.mockRejectedValue({
    response: { data: { message: "Permission required" } },
  });
  render(
    <MemoryRouter>
      <Component contractId={3} />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Permission required"),
  );
  expect(screen.queryByText("0.00 USD")).not.toBeInTheDocument();
});
