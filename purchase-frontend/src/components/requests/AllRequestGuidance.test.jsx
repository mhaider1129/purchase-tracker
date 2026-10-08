import React from "react";
import { render, screen } from "@testing-library/react";
import i18n from "../../i18n";
import AllRequestGuidance, {
  getRequestGuidanceKey,
} from "./AllRequestGuidance";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

test.each(["Completed", "Received", "Available in Stock"])(
  "terminal %s overrides stale approver and assignment",
  (status) => {
    expect(
      getRequestGuidanceKey({ status, current_approver_role: "SCM" }),
    ).toBe("completed");
  },
);
test.each([" rejected ", "Cancelled", "canceled"])(
  "closed %s overrides stale approver",
  (status) => {
    expect(
      getRequestGuidanceKey({ status, current_approver_role: "SCM" }),
    ).toBe("closed");
  },
);
test("holds take precedence over approval and assignment guidance", () => {
  expect(
    getRequestGuidanceKey({ status: "On Hold", current_approver_role: "HOD" }),
  ).toBe("held");
});
test("distinguishes pending approval, unassigned procurement and split assignment", () => {
  expect(
    getRequestGuidanceKey({ status: "Approved", current_approver_role: "SCM" }),
  ).toBe("approval");
  expect(getRequestGuidanceKey({ status: "Approved" })).toBe("unassigned");
  expect(
    getRequestGuidanceKey({ status: "Approved", split_assignees: [{ id: 2 }] }),
  ).toBe("procurement");
  expect(getRequestGuidanceKey({ status: "Assigned", assigned_to: 2 })).toBe(
    "procurement",
  );
  expect(getRequestGuidanceKey({})).toBe("review");
});
test("displays supplied action, assignment and approval level zero", () => {
  render(
    <AllRequestGuidance
      request={{
        status: "Pending",
        current_approver_role: "SCM",
        current_approval_level: 0,
        next_required_action: "Review specifications",
      }}
      step="SCM Approval"
      assignedDisplay="Ahmed"
    />,
  );
  expect(screen.getByText("Review specifications")).toBeTruthy();
  expect(screen.getByText("Ahmed")).toBeTruthy();
  expect(screen.getByText("Approval level 0")).toBeTruthy();
});
test("does not show a stale server action on a completed request", () => {
  render(
    <AllRequestGuidance
      request={{ status: "Completed", next_required_action: "Approve now" }}
      step="Completed"
    />,
  );
  expect(screen.queryByText("Approve now")).toBeNull();
  expect(screen.getByText(/Fulfillment recorded/)).toBeTruthy();
});
test("shows Arabic unassigned guidance and falls back from an empty server action", async () => {
  await i18n.changeLanguage("ar");
  render(
    <AllRequestGuidance
      request={{ status: "Approved", next_required_action: "   " }}
      step="Approved"
    />,
  );
  expect(
    screen.getByRole("region", { name: "تقدم الطلب والخطوة التالية" }),
  ).toBeTruthy();
  expect(
    screen.getByText(
      "لم يتم تسجيل مسؤول مشتريات. راجع الإسناد في مساحة العمل.",
    ),
  ).toBeTruthy();
});
test("does not report a known assignment ID as unassigned when its name is missing", () => {
  render(
    <AllRequestGuidance
      request={{ status: "Approved", assigned_to: 7 }}
      step="Approved"
    />,
  );
  expect(screen.getByText("Assignee name unavailable")).toBeTruthy();
  expect(screen.queryByText("Not assigned")).toBeNull();
});
