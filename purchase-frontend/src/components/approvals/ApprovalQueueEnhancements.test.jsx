import React from "react";
import {
  render,
  renderHook,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import i18n from "../../i18n";
import useApprovalsData from "../../hooks/useApprovalsData";
import api from "../../api/axios";
import ApprovalRequestCard from "./ApprovalRequestCard";
import ApprovalQueueControls from "./ApprovalQueueControls";
import { compareApprovalDates } from "../../utils/approvalQueue";

jest.mock("../../api/axios", () => ({ get: jest.fn(), post: jest.fn() }));
const requests = [
  {
    request_id: 1,
    approval_id: 11,
    approval_status: "Pending",
    request_type: "IT",
    is_urgent: false,
    created_at: "2026-10-01",
    updated_at: "2026-10-08",
  },
  {
    request_id: 2,
    approval_id: 12,
    approval_status: "On Hold",
    request_type: "Stock",
    is_urgent: true,
    created_at: "2026-10-02",
  },
  {
    request_id: 3,
    approval_id: 13,
    approval_status: "Pending",
    request_type: "Stock",
    is_urgent: false,
    created_at: "2026-10-03",
  },
  {
    request_id: 4,
    approval_id: 14,
    approval_status: "Pending",
    request_type: "IT",
    is_urgent: false,
  },
];
const user = { id: 1, role: "HOD" };
beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage("en");
  api.get.mockResolvedValue({ data: requests });
});

test("queue views combine with urgency and type filters and reset completely", async () => {
  const { result } = renderHook(() => useApprovalsData(user));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.setApprovalStatusFilter("hold"));
  expect(result.current.filteredRequests.map((row) => row.request_id)).toEqual([
    2,
  ]);
  expect(result.current.hasActiveFilters).toBe(true);
  act(() => {
    result.current.setApprovalStatusFilter("pending");
    result.current.setTypeFilter("IT");
  });
  expect(result.current.filteredRequests.map((row) => row.request_id)).toEqual([
    1, 4,
  ]);
  act(() => result.current.setUrgencyFilter("urgent"));
  expect(result.current.filteredRequests).toHaveLength(0);
  act(() => result.current.clearFilters());
  expect(result.current.approvalStatusFilter).toBe("all");
  expect(result.current.filteredRequests).toHaveLength(4);
  expect(result.current.hasActiveFilters).toBe(false);
  expect(api.post).not.toHaveBeenCalled();
});

test("oldest sort uses submission history, keeps urgent priority, and places missing dates last", async () => {
  const { result } = renderHook(() => useApprovalsData(user));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.setSortOption("oldest"));
  expect(result.current.filteredRequests.map((row) => row.request_id)).toEqual([
    2, 1, 3, 4,
  ]);
  expect(
    compareApprovalDates(
      { created_at: "invalid" },
      { created_at: "2026-10-01" },
      "oldest",
    ),
  ).toBe(1);
  expect(compareApprovalDates({}, {}, "newest")).toBe(0);
});

test("queue controls expose counts and selected view with accessible buttons", () => {
  const onChange = jest.fn(),
    onUrgencyChange = jest.fn(),
    onSortChange = jest.fn();
  render(
    <ApprovalQueueControls
      requests={requests}
      value="hold"
      onChange={onChange}
      urgency="all"
      onUrgencyChange={onUrgencyChange}
      sort="newest"
      onSortChange={onSortChange}
    />,
  );
  expect(screen.getByRole("button", { name: "On hold 1" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Awaiting decision 3" }));
  expect(onChange).toHaveBeenCalledWith("pending");
  fireEvent.click(screen.getByRole("button", { name: "Urgent only" }));
  expect(onUrgencyChange).toHaveBeenCalledWith("urgent");
  fireEvent.click(
    screen.getByRole("button", { name: "Longest waiting first" }),
  );
  expect(onSortChange).toHaveBeenCalledWith("oldest");
});

test("cards explain hold and review actions without submitting a decision", () => {
  const props = {
    request: requests[1],
    requesterDisplay: "Ahmed",
    isExpanded: false,
    onToggle: jest.fn(),
    formatDateTime: () => "—",
    estimatedCostValue: 0,
  };
  const { rerender } = render(
    <ApprovalRequestCard {...props} approvalStatus="On Hold" />,
  );
  expect(
    screen.getByText("Resume approval when ready to continue."),
  ).toBeInTheDocument();
  rerender(
    <ApprovalRequestCard
      {...props}
      request={{
        ...requests[0],
        next_required_action: "Review clinical specifications",
      }}
      approvalStatus="Pending"
    />,
  );
  expect(
    screen.getByText("Review clinical specifications"),
  ).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test("Arabic queue controls use the real translations", async () => {
  await i18n.changeLanguage("ar");
  render(
    <ApprovalQueueControls
      requests={requests}
      value="all"
      onChange={() => {}}
      urgency="all"
      onUrgencyChange={() => {}}
      sort="newest"
      onSortChange={() => {}}
    />,
  );
  expect(
    screen.getByRole("button", { name: "بانتظار القرار 3" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "الأطول انتظارًا أولًا" }),
  ).toBeInTheDocument();
});


test('bulk summary excludes held requests from the selected queue view', async () => {
  const approver = {id:1,role:'COO'};
  const {result} = renderHook(() => useApprovalsData(approver));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { await result.current.approvalSummary.open(result.current.filteredRequests); });
  expect(result.current.approvalSummary.requestIds).toEqual(expect.arrayContaining([1,3,4]));
  expect(result.current.approvalSummary.requestIds).not.toContain(2);
  expect(api.get).not.toHaveBeenCalledWith('/requests/2/items');
  expect(api.post).not.toHaveBeenCalled();
});
