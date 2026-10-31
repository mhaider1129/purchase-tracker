import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "../i18n";
import api from "../api/axios";
import AssignRequestPanel from "./AssignRequestPanel";
jest.mock("../api/axios", () => ({ get: jest.fn(), put: jest.fn() }));
beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage("en");
  api.get.mockImplementation(async (path) => ({
    data: path.endsWith("procurement-users")
      ? [{ id: 10, name: "Buyer", role: "ProcurementSpecialist" }]
      : {
          items: [
            {
              id: 100,
              item_name: "Pump",
              quantity: 1,
              approval_status: "Approved",
              assigned_to: null,
            },
          ],
        },
  }));
  api.put.mockResolvedValue({ data: {} });
});
test("whole-request assignment submits the original assignee snapshot for stale-update protection", async () => {
  render(<AssignRequestPanel requestId={55} currentAssigneeId={null} />);
  await screen.findByRole("option", { name: "Buyer (ProcurementSpecialist)" });
  fireEvent.change(screen.getByLabelText("Select User"), {
    target: { value: "10" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Assign" }));
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith("/requests/assign-procurement", {
      request_id: 55,
      user_id: "10",
      expected_assignee_id: null,
    }),
  );
});
test("split assignment submits item-level snapshots without changing item or user IDs", async () => {
  render(<AssignRequestPanel requestId={55} currentAssigneeId={null} />);
  await screen.findByRole("option", { name: "Buyer (ProcurementSpecialist)" });
  fireEvent.click(screen.getByRole("button", { name: "Split by items" }));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "10" } });
  fireEvent.click(
    screen.getByRole("button", { name: "Save Split Assignment" }),
  );
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith(
      "/requests/55/split-assign-procurement",
      expect.objectContaining({
        expected_assignee_id: null,
        expected_item_assignees: { 100: null },
        assignments: [{ user_id: 10, requested_item_ids: [100], notes: null }],
      }),
    ),
  );
});
