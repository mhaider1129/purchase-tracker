import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import Page from "./ProcurementPriorityManagementPage";
import * as api from "../api/procurementPriority";
import { useAuth } from "../hooks/useAuth";
jest.mock("../api/procurementPriority");
jest.mock("../hooks/useAuth", () => ({ useAuth: jest.fn() }));
const members = [
  { procurement_case_id: 11, public_title: "Monitor" },
  { procurement_case_id: 12, public_title: "Cable" },
];
const row = {
  request_id: 208,
  request_reference: "REQ-208",
  public_title: "Monitor and cable",
  item_count: 2,
  members,
  institutional_rank: 1,
};
beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({
    user: { permissions: ["procurement-priority.manage"] },
  });
  api.getPriorityManagementQueue.mockResolvedValue({ data: [row] });
  api.getPriorityProfile.mockImplementation((id) =>
    Promise.resolve({
      data: {
        procurement_case_id: id,
        public_title: id === 11 ? "Monitor" : "Cable",
        scm_assessment: 50,
        scm_reason: "Existing reason",
      },
    }),
  );
  api.getPriorityHistory.mockResolvedValue({ data: [] });
  api.previewPriorityAssessment.mockResolvedValue({
    data: { score: 64, tier: "P2" },
  });
  api.updatePriorityAssessment.mockResolvedValue({ data: {} });
});
async function open() {
  render(<Page />);
  const opener = await screen.findByRole("button", {
    name: "Monitor and cable",
  });
  opener.focus();
  fireEvent.click(opener);
  return screen.findByRole("dialog", { name: "Priority details" });
}
test("compact queue toggles detailed columns and popup contains keyboard focus", async () => {
  const dialog = await open();
  expect(
    screen.getByRole("region", { name: "Institutional priority queue table" }),
  ).toHaveAttribute("data-view", "summary");
  // Portal is outside the page and scroll locking survives switching views.
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.keyDown(dialog, { key: "Tab" });
  expect(within(dialog).getByRole("button", { name: "Close" })).toHaveFocus();
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(document.body.style.overflow).toBe("");
  expect(
    screen.getByRole("button", { name: "Monitor and cable" }),
  ).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Detailed" }));
  expect(
    screen.getByRole("region", { name: "Institutional priority queue table" }),
  ).toHaveAttribute("data-view", "detailed");
});
test("assessment drafts survive score/history navigation and require discard before item switching", async () => {
  const dialog = await open();
  fireEvent.change(screen.getByLabelText("Mandatory SCM reason"), {
    target: { value: "Draft clinical reason" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Score breakdown" }));
  fireEvent.click(screen.getByRole("button", { name: "History" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Assessment", exact: true }),
  );
  expect(screen.getByLabelText("Mandatory SCM reason")).toHaveValue(
    "Draft clinical reason",
  );
  fireEvent.change(screen.getByLabelText("Item assessment"), {
    target: { value: "12" },
  });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "unsaved assessment changes",
  );
  expect(api.getPriorityProfile).not.toHaveBeenCalledWith(12);
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "unsaved assessment changes",
  );
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  fireEvent.change(screen.getByLabelText("Item assessment"), {
    target: { value: "12" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  await waitFor(() => expect(api.getPriorityProfile).toHaveBeenCalledWith(12));
  await waitFor(() =>
    expect(screen.getByLabelText("Item assessment")).toHaveValue("12"),
  );
});
test("failed saves preserve multiline reason and send the same canonical fields", async () => {
  api.updatePriorityAssessment.mockRejectedValue({
    response: { data: { message: "Assessment conflict" } },
  });
  await open();
  fireEvent.change(screen.getByLabelText("Mandatory SCM reason"), {
    target: { value: "Clinical need\nService continuity" },
  });
  fireEvent.change(screen.getByLabelText("Impact reason"), {
    target: { value: "Critical clinical coverage" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save assessment" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Assessment conflict",
  );
  expect(screen.getByLabelText("Mandatory SCM reason")).toHaveValue(
    "Clinical need\nService continuity",
  );
  expect(api.updatePriorityAssessment).toHaveBeenCalledWith(
    11,
    expect.objectContaining({
      scm_assessment: 50,
      scm_reason: "Clinical need\nService continuity",
      impact_reason: "Critical clinical coverage",
      deadline_at: null,
      approved_initiative_id: null,
    }),
  );
});
test("P0 justification remains required when projected by the server", async () => {
  api.previewPriorityAssessment.mockResolvedValue({
    data: { score: 99, tier: "P0", p0JustificationRequired: true },
  });
  await open();
  expect(await screen.findByLabelText("P0 justification")).toBeRequired();
  fireEvent.change(screen.getByLabelText("P0 justification"), {
    target: { value: " " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save assessment" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "P0 justification is required",
  );
  expect(api.updatePriorityAssessment).not.toHaveBeenCalled();
});
test("read-only users can inspect score/history without editable assessment controls", async () => {
  useAuth.mockReturnValue({ user: { permissions: [] } });
  await open();
  expect(
    screen.queryByRole("button", { name: "Save assessment" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Score breakdown" }));
  expect(screen.getByText("System Score")).toBeInTheDocument();
});

test("saving locks item changes and close until the server responds", async () => {
  let complete;
  api.updatePriorityAssessment.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const dialog = await open();
  fireEvent.change(screen.getByLabelText("Mandatory SCM reason"), {
    target: { value: "Confirmed clinical need" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save assessment" }));
  expect(screen.getByLabelText("Item assessment")).toBeDisabled();
  expect(screen.getByLabelText("Mandatory SCM reason")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(
    screen.getByRole("dialog", { name: "Priority details" }),
  ).toBeInTheDocument();
  complete({ data: {} });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Close" })).toBeEnabled(),
  );
  expect(api.updatePriorityAssessment).toHaveBeenCalledTimes(1);
});
