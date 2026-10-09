import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import i18n from "../../i18n";
import RequestApprovalsReview, {
  approvalMatchesView,
} from "./RequestApprovalsReview";
beforeEach(async () => {
  await i18n.changeLanguage("en");
});
test("only active pending records are shown as active", () => {
  expect(
    approvalMatchesView({ status: " Pending ", is_active: true }, "active"),
  ).toBe(true);
  expect(
    approvalMatchesView({ status: "Approved", is_active: true }, "active"),
  ).toBe(false);
  expect(
    approvalMatchesView({ status: "Pending", is_active: false }, "active"),
  ).toBe(false);
  expect(approvalMatchesView({ status: "On Hold" }, "decisions")).toBe(false);
  expect(approvalMatchesView({ status: "Rejected" }, "decisions")).toBe(true);
});
test("combines view and cross-field search, then resets an empty result", () => {
  render(
    <RequestApprovalsReview
      approvals={[
        {
          approval_id: 1,
          approval_level: 0,
          approver_name: "Ahmed",
          approver_role: "SCM",
          comments: "Review quote",
          status: "Pending",
          is_active: true,
        },
        {
          approval_id: 2,
          approver_name: "Sara",
          status: "Approved",
          is_active: true,
        },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Active pending 1" }));
  expect(screen.queryByText("Sara")).toBeNull();
  expect(screen.getByText("Level 0")).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Ahmed SCM quote" },
  });
  expect(screen.getByText("Ahmed")).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "missing" },
  });
  expect(
    screen.getByText("No approval steps match these filters."),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Clear approval filters" }),
  );
  expect(screen.getByText("Sara")).toBeTruthy();
  expect(screen.getAllByText("Active step").length).toBe(1);
});
test("missing timing is explicit and saved zero hours remains visible", () => {
  render(
    <RequestApprovalsReview
      approvals={[
        {
          approval_id: 1,
          status: "Pending",
          approved_at: "invalid",
          waiting_time_hours: null,
        },
        { approval_id: 2, status: "Rejected", waiting_time_hours: 0 },
      ]}
    />,
  );
  expect(screen.getAllByText("Not recorded").length).toBe(3);
  expect(screen.getByText("0", { selector: "dd" })).toBeTruthy();
  expect(screen.queryByText("Invalid Date")).toBeNull();
});
test("Arabic labels and true empty state", async () => {
  await i18n.changeLanguage("ar");
  render(<RequestApprovalsReview approvals={[]} />);
  expect(screen.getByRole("region", { name: "موافقات الطلب" })).toBeTruthy();
  expect(screen.getByText("لا توجد خطوات موافقة مسجلة.")).toBeTruthy();
});
