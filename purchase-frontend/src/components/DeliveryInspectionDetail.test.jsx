import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Page from "./DeliveryInspectionDetail";
import * as api from "../api/technicalWorkflow";
jest.mock("../api/technicalWorkflow");
jest.mock("../api/preprocurementTechnicalReviews");
jest.mock("../hooks/useRequestAttachments", () => () => ({
  handleDownloadAttachment: jest.fn(),
}));
const task = {
  id: 7,
  row_version: 3,
  current_user_id: 2,
  can_manage: false,
  can_receive: false,
  status: "PENDING",
  item_name: "Patient monitor",
  receipt_number: "GR-12",
  po_number: "PO-5",
  request_id: 10,
  received_quantity: "10",
  remaining_quantity: "10",
  technical_accepted_quantity: "0",
  technical_rejected_quantity: "0",
  assignments: [
    {
      id: 9,
      reviewer_id: 2,
      name: "Engineer",
      department_name: "Medical Devices",
      opinion: null,
    },
  ],
  profile_snapshot: {
    delivery_checks: [
      "specifications",
      "physical_condition",
      "documents",
      "functional_test",
    ],
    evidence_required: false,
  },
  checks: {
    specifications: ["yes", "no"],
    physical_condition: ["yes", "no"],
    documents: ["yes", "no", "not_applicable"],
    functional_test: ["pass", "fail", "not_required"],
  },
  attachments: [],
  history: [],
};
const mount = () =>
  render(
    <MemoryRouter>
      <Page id="7" />
    </MemoryRouter>,
  );
beforeEach(() => {
  jest.resetAllMocks();
  api.deliveryTask.mockResolvedValue(task);
});
test("inspector records exact accepted/rejected quantities without re-entering source data", async () => {
  api.deliveryAction.mockResolvedValue({
    ...task,
    row_version: 4,
    assignments: [
      {
        ...task.assignments[0],
        opinion: {
          decision: "PARTIAL",
          accepted_quantity: "8",
          rejected_quantity: "1",
          held_quantity: "1",
          signature: { name: "Engineer" },
        },
      },
    ],
  });
  mount();
  await screen.findByText("Patient monitor");
  for (const key of [
    "specifications",
    "physical_condition",
    "documents",
    "functional_test",
  ])
    fireEvent.change(screen.getByLabelText(`Delivery ${key}`), {
      target: { value: key === "functional_test" ? "pass" : "yes" },
    });
  fireEvent.change(screen.getByLabelText("Decision"), {
    target: { value: "PARTIAL" },
  });
  fireEvent.change(screen.getByLabelText("Accepted quantity"), {
    target: { value: "8" },
  });
  fireEvent.change(screen.getByLabelText("Rejected quantity"), {
    target: { value: "1" },
  });
  fireEvent.change(screen.getByLabelText("Comments / corrective action"), {
    target: { value: "One damaged unit; one unit needs clarification" },
  });
  fireEvent.click(screen.getByText("Submit inspection opinion and attest"));
  await waitFor(() =>
    expect(api.deliveryAction).toHaveBeenCalledWith(
      "7",
      "opinion",
      expect.objectContaining({
        row_version: 3,
        accepted_quantity: "8",
        rejected_quantity: "1",
        decision: "PARTIAL",
      }),
    ),
  );
  expect(api.deliveryAction.mock.calls[0][2]).not.toHaveProperty("item_name");
});
test("receiving applies only the immutable authorized disposition identifier", async () => {
  const ready = {
    ...task,
    current_user_id: 3,
    can_receive: true,
    status: "DECIDED",
    pending_disposition: { history_id: 55 },
  };
  api.deliveryTask.mockResolvedValue(ready);
  api.deliveryAction.mockResolvedValue({
    task: {
      ...ready,
      status: "ON_HOLD",
      row_version: 4,
      remaining_quantity: "1",
    },
    idempotent: false,
  });
  mount();
  await screen.findByText("Apply authorized receiving disposition");
  fireEvent.click(screen.getByText("Apply authorized receiving disposition"));
  await waitFor(() =>
    expect(api.deliveryAction).toHaveBeenCalledWith("7", "apply", {
      row_version: 3,
      disposition_id: 55,
    }),
  );
  expect(
    screen.queryByText("Submit inspection opinion and attest"),
  ).not.toBeInTheDocument();
});
test("SCM sees final disposition but cannot invent accepted quantities", async () => {
  api.deliveryTask.mockResolvedValue({
    ...task,
    current_user_id: 1,
    can_manage: true,
    status: "IN_PROGRESS",
    assignments: [
      {
        ...task.assignments[0],
        opinion: {
          decision: "ACCEPTED",
          accepted_quantity: "10",
          rejected_quantity: "0",
          held_quantity: "0",
        },
      },
    ],
  });
  api.deliveryAction.mockResolvedValue({
    ...task,
    current_user_id: 1,
    can_manage: true,
    status: "DECIDED",
    pending_disposition: { history_id: 55 },
  });
  mount();
  await screen.findByText("Independent final disposition");
  fireEvent.change(screen.getByLabelText("Disposition / clarification notes"), {
    target: { value: "Both departments agreed" },
  });
  fireEvent.click(screen.getByText("Authorize agreed disposition"));
  await waitFor(() =>
    expect(api.deliveryAction).toHaveBeenCalledWith("7", "decide", {
      row_version: 3,
      notes: "Both departments agreed",
    }),
  );
});
test("stale decision failure keeps the entered corrective findings", async () => {
  api.deliveryAction.mockRejectedValue({
    response: {
      data: { message: "Inspection changed; reload before submitting" },
    },
  });
  mount();
  await screen.findByText("Patient monitor");
  fireEvent.change(screen.getByLabelText("Comments / corrective action"), {
    target: { value: "Retain my findings" },
  });
  fireEvent.click(screen.getByText("Start inspection"));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Comments / corrective action")).toHaveValue(
    "Retain my findings",
  );
});
