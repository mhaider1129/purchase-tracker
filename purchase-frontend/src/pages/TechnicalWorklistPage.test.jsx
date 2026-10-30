import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Page from "./TechnicalInspectionsPage";
import {
  getTechnicalWorklist,
  getTechnicalInspection,
} from "../api/technicalInspections";
jest.mock("../api/technicalInspections");
const result = {
  rows: [
    {
      id: 3,
      type: "PRE_PROCUREMENT",
      reference: "PR-20",
      item_name: "Patient monitor",
      assigned_department: "Medical Devices",
      status: "PENDING",
      decision: "IN_REVIEW",
      awaiting_me: true,
    },
  ],
  total: 30,
  page: 1,
  page_size: 25,
  can_manage: false,
  summary: { awaiting_my_review: 8, in_progress: 3, on_hold: 0, completed: 5 },
  departments: [{ id: 4, name: "Medical Devices" }],
  warnings: [],
};
const mount = (url = "/technical-inspections") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Page />
    </MemoryRouter>,
  );
beforeEach(() => {
  jest.resetAllMocks();
  getTechnicalWorklist.mockResolvedValue(result);
});
test("the landing page is a scoped worklist, not an empty inspection form", async () => {
  mount();
  await screen.findByText("Patient monitor");
  expect(screen.queryByLabelText("Request ID")).not.toBeInTheDocument();
  expect(screen.queryByText("New inspection")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Awaiting My Review count")).toHaveTextContent(
    "8",
  );
  expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute(
    "href",
    "/technical-inspections/pre-procurement?review=3",
  );
  expect(
    screen.queryByRole("link", { name: "Request technical review" }),
  ).not.toBeInTheDocument();
});
test("dates and tab filters refresh scorecards and the list together", async () => {
  mount();
  await screen.findByText("Patient monitor");
  getTechnicalWorklist.mockResolvedValue({
    ...result,
    rows: [],
    total: 0,
    summary: {
      awaiting_my_review: 0,
      in_progress: 0,
      on_hold: 0,
      completed: 0,
    },
  });
  fireEvent.change(screen.getByLabelText("From"), {
    target: { value: "2026-10-01" },
  });
  await waitFor(() =>
    expect(getTechnicalWorklist).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: "2026-10-01", page: 1 }),
    ),
  );
  await screen.findByText("No technical tasks match these filters.");
  expect(screen.getByLabelText("Awaiting My Review count")).toHaveTextContent(
    "0",
  );
  fireEvent.click(screen.getByRole("tab", { name: "History" }));
  await waitFor(() =>
    expect(getTechnicalWorklist).toHaveBeenLastCalledWith(
      expect.objectContaining({ tab: "history", from: "2026-10-01" }),
    ),
  );
});
test("pagination uses server totals, and changing a department resets the page", async () => {
  mount();
  await screen.findByText("Patient monitor");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(getTechnicalWorklist).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    ),
  );
  await screen.findByText("30 matching tasks · Page 2");
  fireEvent.change(screen.getByLabelText("Assigned department"), {
    target: { value: "4" },
  });
  await waitFor(() =>
    expect(getTechnicalWorklist).toHaveBeenLastCalledWith(
      expect.objectContaining({ department: "4", page: 1 }),
    ),
  );
});
test("failed loads clear stale scorecard values and offer retry", async () => {
  getTechnicalWorklist.mockRejectedValueOnce({
    response: { data: { message: "Review service unavailable" } },
  });
  mount();
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Awaiting My Review count")).toHaveTextContent(
    "—",
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText("Patient monitor");
});
test("historical records open a read-only detail without a new form or invented assignment", async () => {
  getTechnicalInspection.mockResolvedValue({
    id: 9,
    item_name: "Infusion pump",
    request_id: 20,
    acceptance_status: "passed",
    summary: {},
    general_checklist: [],
    category_checklist: [],
  });
  mount("/technical-inspections?inspection=9");
  await screen.findByText("Infusion pump");
  expect(
    screen.getByRole("link", { name: "Open original inspection form" }),
  ).toHaveAttribute("href", "/technical-inspections/legacy?inspection=9");
  expect(
    screen.queryByRole("button", { name: "Submit" }),
  ).not.toBeInTheDocument();
});
