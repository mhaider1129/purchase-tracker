import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import api from "../api/axios";
import Component from "./ContractFinancialReconciliation";
import i18n from "../i18n";
let mockUser = {
  permissions: ["finance.verify", "procure-to-pay.lifecycle.view"],
};
jest.mock("../hooks/useAuth", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("../api/axios", () => ({ get: jest.fn(), post: jest.fn() }));
const payload = {
  report: {
    institute_id: 101,
    acceptance: { canonical_integrity_passed: true, defects: [] },
    contracts: [],
    totals: [
      {
        record_type: "legacy_invoice",
        currency: "USD",
        legacy_unreconciled_value: "9007199254740993.12",
        confirmed_matched_value: "0.00",
        potential_duplicate_exposure: "25.00",
        conflicting_records: 0,
      },
    ],
  },
  rows: [
    {
      record_type: "legacy_invoice",
      source_id: "3",
      contract_title: "A",
      institute_id: 101,
      amount: "25.00",
      currency: "USD",
      classification: "Possible match",
      fingerprint: "a".repeat(64),
      version: 0,
      reasons: [],
      source_snapshot: { source: { invoice_number: "INV-1" } },
      history: [],
      candidates: [
        {
          id: "5",
          type: "supplier_invoice",
          problems: [],
          evidence: {
            invoice: {
              invoice_number: "INV-1",
              total_amount: "25.00",
              currency: "USD",
            },
          },
        },
      ],
    },
  ],
};
beforeAll(() => {
  Object.defineProperty(global, "crypto", {
    configurable: true,
    value: { randomUUID: () => "test-review-command-0001" },
  });
});
beforeEach(async () => {
  mockUser = {
    permissions: ["finance.verify", "procure-to-pay.lifecycle.view"],
  };
  jest.clearAllMocks();
  api.get.mockResolvedValue({ data: payload });
  api.post.mockResolvedValue({ data: {} });
  await i18n.changeLanguage("en");
});
afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("en");
  });
});
test("worklist preserves exact currency totals and requires evidence for explicit review", async () => {
  render(<Component contractId={9} />);
  await screen.findByText("9007199254740993.12");
  expect(api.get).toHaveBeenCalledWith(
    "/contracts/financial-reconciliation/worklist",
    { params: { contractId: 9 } },
  );
  const confirm = screen.getByRole("button", {
    name: "Confirm supported relationship",
  });
  expect(confirm).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByLabelText("Review notes"), {
    target: { value: "Reviewed" },
  });
  fireEvent.change(screen.getByLabelText("Supporting evidence reference"), {
    target: { value: "Archive 2026/42" },
  });
  fireEvent.click(confirm);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][1]).toMatchObject({
    source_id: "3",
    canonical_ids: ["5"],
    expected_version: 0,
    decision: "CONFIRMED_MATCH",
    notes: "Reviewed",
    supporting_evidence: "Archive 2026/42",
  });
  expect(api.post.mock.calls[0][1]).not.toHaveProperty("institute_id");
});
test("contract management alone neither fetches nor exposes finance review controls", () => {
  mockUser = { permissions: ["contracts.manage"] };
  render(<Component />);
  expect(api.get).not.toHaveBeenCalled();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
test("failure displays an error without false zero report", async () => {
  api.get.mockRejectedValue({
    response: { data: { message: "Permission required" } },
  });
  render(<Component />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Permission required",
  );
  expect(screen.queryByText("0.00")).not.toBeInTheDocument();
});
test("Arabic financial review has the same explicit evidence controls", async () => {
  await i18n.changeLanguage("ar");
  render(<Component />);
  await screen.findByText("مطابقة السجلات المالية التاريخية");
  expect(
    await screen.findByRole("button", {
      name: "تأكيد العلاقة المدعومة بالأدلة",
    }),
  ).toBeDisabled();
  expect(screen.getByLabelText("مرجع الأدلة الداعمة")).toBeInTheDocument();
});
