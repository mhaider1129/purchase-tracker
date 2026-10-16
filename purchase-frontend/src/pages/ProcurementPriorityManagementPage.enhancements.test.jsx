import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Page from "./ProcurementPriorityManagementPage";
import * as api from "../api/procurementPriority";
import { useAuth } from "../hooks/useAuth";
jest.mock("../api/procurementPriority", () => ({
  getPriorityManagementQueue: jest.fn(),
  reorderInstitutionalPriorities: jest.fn(),
  getPriorityProfile: jest.fn(),
  getPriorityHistory: jest.fn(),
  getPriorityGroups: jest.fn(),
  createPriorityGroup: jest.fn(),
  updatePriorityGroup: jest.fn(),
  archivePriorityGroup: jest.fn(),
}));
jest.mock("../hooks/useAuth", () => ({ useAuth: jest.fn() }));
const rows = [
  {
    request_id: 208,
    public_title: "Hook",
    department_name: "Pharmacy",
    item_count: 1,
    institutional_rank: 1,
    system_suggested_rank: 1,
    snapshot: { version: 1 },
    members: [
      {
        procurement_case_id: 11,
        public_title: "Hook",
        department_name: "Pharmacy",
      },
    ],
  },
  {
    request_id: 209,
    public_title: "Chair",
    department_name: "Facilities",
    system_tier: "P1",
    system_score: 0,
    item_count: 1,
    institutional_rank: 2,
    system_suggested_rank: 2,
    snapshot: { version: 2 },
    members: [
      {
        procurement_case_id: 12,
        public_title: "Chair",
        department_name: "Facilities",
      },
    ],
  },
];
beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({
    user: {
      permissions: [
        "procurement-priority.override",
        "procurement-priority.manage-groups",
      ],
    },
  });
  api.getPriorityManagementQueue.mockResolvedValue({ data: rows });
  api.getPriorityGroups.mockResolvedValue({ data: [] });
});
test("search spans request ID, title and department and can be cleared from no results", async () => {
  render(<Page />);
  const search = await screen.findByRole("textbox", {
    name: "Search priorities",
  });
  fireEvent.change(search, { target: { value: "208 Hook Pharmacy" } });
  expect(screen.getByText("Showing 1 of 2 requests")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Move Hook down" })).toBeDisabled();
  fireEvent.change(search, { target: { value: "missing" } });
  expect(
    screen.getByText("No requests match the selected filters."),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getByText("Showing 2 of 2 requests")).toBeInTheDocument();
  expect(screen.getByText("Not assessed")).toBeInTheDocument();
});
test("reset changes restores saved order without sending a reorder", async () => {
  render(<Page />);
  fireEvent.click(await screen.findByRole("button", { name: "Move Chair up" }));
  fireEvent.change(
    screen.getByLabelText("Institutional order override reason"),
    { target: { value: "Temporary draft" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Reset changes" }));
  expect(
    screen.queryByText("Unsaved organizational order"),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Move Hook up" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Save institutional order" }),
  ).toBeDisabled();
  expect(api.reorderInstitutionalPriorities).not.toHaveBeenCalled();
});
test("assessment has a keyboard-accessible button and read-only users cannot reorder or manage groups", async () => {
  useAuth.mockReturnValue({ user: { permissions: [] } });
  api.getPriorityProfile.mockResolvedValue({
    data: { procurement_case_id: 11 },
  });
  api.getPriorityHistory.mockResolvedValue({ data: [] });
  render(<Page />);
  fireEvent.click(await screen.findByRole("button", { name: "Hook" }));
  expect(
    await screen.findByRole("dialog", { name: "Priority details" }),
  ).toBeInTheDocument();
  expect(api.getPriorityProfile).toHaveBeenCalledWith(11);
  expect(
    screen.queryByRole("button", { name: "Move Hook up" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Create Group" }),
  ).not.toBeInTheDocument();
});
test("group search preserves selections and failed save keeps user input", async () => {
  api.createPriorityGroup.mockRejectedValue({
    response: { data: { message: "Group creation failed" } },
  });
  render(<Page />);
  await screen.findByText("No priority groups yet.");
  fireEvent.change(screen.getByLabelText("Group public title"), {
    target: { value: "Clinical equipment" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /Hook/ }));
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Find procurement cases" }),
    { target: { value: "Chair" } },
  );
  expect(
    screen.queryByRole("checkbox", { name: /Hook/ }),
  ).not.toBeInTheDocument();
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Find procurement cases" }),
    { target: { value: "" } },
  );
  expect(screen.getByRole("checkbox", { name: /Hook/ })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Create Group" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Group creation failed",
  );
  expect(screen.getByLabelText("Group public title")).toHaveValue(
    "Clinical equipment",
  );
  expect(screen.getByRole("checkbox", { name: /Hook/ })).toBeChecked();
  await waitFor(() =>
    expect(api.createPriorityGroup).toHaveBeenCalledWith({
      public_title: "Clinical equipment",
      public_description: "",
      is_public: false,
      member_case_ids: [11],
    }),
  );
});
