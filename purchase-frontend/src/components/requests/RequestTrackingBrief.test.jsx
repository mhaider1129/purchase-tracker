import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "../../i18n";
import api from "../../api/axios";
import OpenRequestsPage from "../../pages/OpenRequestsPage";
import RequestTrackingBrief from "./RequestTrackingBrief";
import {
  matchesSubmissionDates,
  sortTrackedRequests,
} from "../../utils/openRequestTracking";

jest.mock("../../api/axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../api/requests", () => ({ updateRequest: jest.fn() }));

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage("en");
});

test("includes the entire local end date and rejects submissions outside the range", () => {
  expect(
    matchesSubmissionDates(
      { created_at: "2026-10-08T23:59:59.999" },
      "2026-10-08",
      "2026-10-08",
    ),
  ).toBe(true);
  expect(
    matchesSubmissionDates(
      { created_at: "2026-10-09T00:00:00" },
      "",
      "2026-10-08",
    ),
  ).toBe(false);
  expect(
    matchesSubmissionDates(
      { created_at: "2026-10-07T23:59:59" },
      "2026-10-08",
      "",
    ),
  ).toBe(false);
  expect(matchesSubmissionDates({}, "", "")).toBe(true);
  expect(
    matchesSubmissionDates({ created_at: "invalid" }, "2026-10-08", ""),
  ).toBe(false);
});

test("sorts known dates first in either direction without mutating requests", () => {
  const requests = [
    { id: 1 },
    { id: 2, created_at: "2026-10-01" },
    { id: 3, created_at: "2026-10-02" },
    { id: 4, created_at: "invalid" },
  ];
  expect(sortTrackedRequests(requests, "newest").map((r) => r.id)).toEqual([
    3, 2, 1, 4,
  ]);
  expect(sortTrackedRequests(requests, "oldest").map((r) => r.id)).toEqual([
    2, 3, 1, 4,
  ]);
  expect(requests.map((r) => r.id)).toEqual([1, 2, 3, 4]);
});

test("shows stage, server next action and edit availability", () => {
  render(
    <RequestTrackingBrief
      request={{ next_required_action: "Review specifications" }}
      stage="Awaiting HOD"
      canEdit
    />,
  );
  expect(screen.getByText("Awaiting HOD")).toBeTruthy();
  expect(screen.getByText("Review specifications")).toBeTruthy();
  expect(
    screen.getByText("Editing available before approval activity starts."),
  ).toBeTruthy();
});

test("uses Arabic guidance for locked requests", async () => {
  await i18n.changeLanguage("ar");
  render(
    <RequestTrackingBrief request={{}} stage="قيد الموافقة" canEdit={false} />,
  );
  expect(
    screen.getByRole("region", { name: "ملخص متابعة الطلب" }),
  ).toBeTruthy();
  expect(
    screen.getByText("التعديل مقفل. تابع الموافقات والمشتريات في مساحة العمل."),
  ).toBeTruthy();
});

test("page search matches words across fields and end date includes evening submissions", async () => {
  api.get.mockResolvedValue({
    data: [
      {
        id: 42,
        request_type: "IT",
        status: "Submitted",
        assigned_user_name: "Ahmed",
        justification: "Workstation refresh",
        created_at: "2026-10-08T18:00:00",
        current_approver_role: "HOD",
        has_approval_activity: false,
      },
      {
        id: 43,
        request_type: "Stock",
        status: "Approved",
        assigned_user_name: "Sara",
        justification: "Supply replenishment",
        created_at: "2026-10-09T10:00:00",
        has_approval_activity: true,
      },
    ],
  });
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <OpenRequestsPage />
    </MemoryRouter>,
  );
  await screen.findAllByText(
    "Editing available before approval activity starts.",
  );
  expect(
    screen.getAllByText(
      "Editing locked. Follow approvals and procurement in the workspace.",
    ).length,
  ).toBe(2);
  fireEvent.change(screen.getByLabelText("To date"), {
    target: { value: "2026-10-08" },
  });
  await waitFor(() =>
    expect(screen.queryByText("Supply replenishment")).toBeNull(),
  );
  expect(screen.getByText("Workstation refresh")).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "IT Ahmed Workstation" },
  });
  expect(screen.getByText("Workstation refresh")).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "IT Sara" },
  });
  await waitFor(() =>
    expect(screen.queryByText("Workstation refresh")).toBeNull(),
  );
  expect(api.post).not.toHaveBeenCalled();
});
