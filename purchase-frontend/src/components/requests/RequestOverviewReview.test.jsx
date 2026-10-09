import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import i18n from "../../i18n";
import RequestOverviewReview from "./RequestOverviewReview";
import { summarizeWorkspaceItems } from "../../pages/RequestDetailWorkspace";
beforeEach(async () => {
  await i18n.changeLanguage("en");
});
test("excludes rejected quantities and counts actual purchases", () => {
  expect(
    summarizeWorkspaceItems(
      [
        {
          approval_status: "Rejected",
          requested_quantity: 20,
          purchased_quantity: 10,
          remaining_quantity: 10,
        },
        { requested_quantity: 5, purchased_quantity: 5, remaining_quantity: 0 },
        { requested_quantity: 4, purchased_quantity: 1, remaining_quantity: 3 },
        {
          requested_quantity: 2,
          purchased_quantity: 0,
          remaining_quantity: 0,
          procurement_status: "not_procured",
        },
      ],
      [{ status: " Pending " }],
      [{}],
    ),
  ).toEqual({
    totalItems: 4,
    fullyProcured: 1,
    partiallyProcured: 1,
    remainingQuantity: 3,
    pendingApprovals: 1,
    attachmentsCount: 1,
  });
});
test("handles empty and negative remaining quantities", () => {
  expect(summarizeWorkspaceItems().remainingQuantity).toBe(0);
  expect(
    summarizeWorkspaceItems([
      { remaining_quantity: -3 },
      { remaining_quantity: 2 },
    ]).remainingQuantity,
  ).toBe(2);
});
test("shortcuts navigate to existing sections and missing dates are explicit", () => {
  const navigate = jest.fn();
  render(
    <RequestOverviewReview
      request={{ updated_at: "invalid" }}
      summary={{ pendingApprovals: 1, attachmentsCount: 0 }}
      unfinishedCount={2}
      onNavigate={navigate}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Review items/ }));
  fireEvent.click(screen.getByRole("button", { name: /Review approvals/ }));
  fireEvent.click(screen.getByRole("button", { name: /View documents/ }));
  expect(navigate.mock.calls).toEqual([
    ["Items"],
    ["Approvals"],
    ["Documents"],
  ]);
  expect(screen.getByText("2 items awaiting final status")).toBeTruthy();
  expect(screen.getByText("Last updated: Not recorded")).toBeTruthy();
});
test("supports Arabic labels", async () => {
  await i18n.changeLanguage("ar");
  render(
    <RequestOverviewReview
      request={{}}
      summary={{ pendingApprovals: 0, attachmentsCount: 0 }}
      unfinishedCount={0}
      onNavigate={() => {}}
    />,
  );
  expect(screen.getByRole("region", { name: "مراجعة هذا الطلب" })).toBeTruthy();
  expect(screen.getByRole("button", { name: /مراجعة الأصناف/ })).toBeTruthy();
});
