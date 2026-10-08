import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "../../i18n";
import api from "../../api/axios";
import AssignedRequestsPage from "../../pages/AssignedRequestsPage";
import AssignedWorkGuidance from "./AssignedWorkGuidance";

jest.mock("../../api/axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));
jest.mock("../../api/requests", () => ({ printRequest: jest.fn() }));
const requests = [
  {
    id: 1,
    request_type: "IT",
    status: "Approved",
    estimated_cost: 0,
    justification: "Ready workstation",
    status_summary: {
      total_items: 2,
      purchased_count: 2,
      pending_count: 0,
      not_procured_count: 0,
    },
  },
  {
    id: 2,
    request_type: "Non-Stock",
    status: "Approved",
    estimated_cost: null,
    justification: "Pending supplies",
    is_urgent: true,
    status_summary: {
      total_items: 2,
      purchased_count: 1,
      pending_count: 1,
      not_procured_count: 0,
    },
  },
];
beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage("en");
  api.get.mockResolvedValue({ data: { data: requests } });
});
const renderPage = () =>
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AssignedRequestsPage />
    </MemoryRouter>,
  );

test("completion guidance is visible before expanding and preserves existing completion gating", async () => {
  renderPage();
  expect(await screen.findByText("Ready workstation")).toBeInTheDocument();
  expect(
    screen.getByText("Record and save the request total cost."),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "Review item statuses and recorded quantities; finalize any outstanding items.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByText("2 of 2 items finalized")).toBeInTheDocument();
  expect(screen.getByText("1 of 2 items finalized")).toBeInTheDocument();
  const buttons = screen.getAllByRole("button", {
    name: "Mark Request as Completed",
  });
  expect(buttons.filter((button) => button.disabled)).toHaveLength(1);
  const bars = screen.getAllByRole("progressbar", {
    name: "Procurement progress",
  });
  expect(bars.map((bar) => bar.getAttribute("aria-valuenow")).sort()).toEqual([
    "100",
    "50",
  ]);
  expect(api.post).not.toHaveBeenCalled();
});

test("ready and attention views combine with urgency and can be reset", async () => {
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", { name: "Ready to complete 1" }),
  );
  expect(screen.getByText("Ready workstation")).toBeInTheDocument();
  expect(screen.queryByText("Pending supplies")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Urgent only" }));
  expect(
    screen.getByText("No assigned requests match your search or filters."),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getAllByRole("button", { name: "Reset filters" }).at(-1),
  );
  expect(screen.getByText("Pending supplies")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Needs attention 1" }));
  expect(screen.queryByText("Ready workstation")).not.toBeInTheDocument();
  expect(screen.getByText("Pending supplies")).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test("fully finalized counts do not override missing cost or item-quantity checks", () => {
  render(
    <AssignedWorkGuidance
      request={requests[0]}
      completionState={{
        canComplete: false,
        missingCost: true,
        incompleteItems: true,
      }}
    />,
  );
  const checklist = within(
    screen.getByRole("region", { name: "Completion checklist" }),
  );
  expect(
    checklist.getByText("Before completing this request"),
  ).toBeInTheDocument();
  expect(checklist.getByText("2 of 2 items finalized")).toBeInTheDocument();
  expect(checklist.queryByText("Ready for completion")).not.toBeInTheDocument();
});

test("Arabic guidance uses application translations", async () => {
  await i18n.changeLanguage("ar");
  render(
    <AssignedWorkGuidance
      request={requests[1]}
      completionState={{
        canComplete: false,
        missingCost: true,
        incompleteItems: true,
      }}
    />,
  );
  expect(
    screen.getByRole("region", { name: "قائمة تحقق الإكمال" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("سجّل واحفظ التكلفة الإجمالية للطلب."),
  ).toBeInTheDocument();
});
