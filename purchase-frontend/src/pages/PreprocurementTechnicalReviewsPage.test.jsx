import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Page from "./PreprocurementTechnicalReviewsPage";
import * as api from "../api/preprocurementTechnicalReviews";
jest.mock("../api/preprocurementTechnicalReviews");
jest.mock("../hooks/useRequestAttachments", () => () => ({
  handleDownloadAttachment: jest.fn(),
}));
const schema = {
  can_manage: false,
  form_reference: "DPP.SC.001.F07",
  categories: ["Other", "Furniture"],
  checklist: {
    specifications: ["met", "not_met", "not_assessed"],
    packaging: ["intact", "not_applicable", "not_assessed"],
  },
};
const review = {
  id: 7,
  request_id: 20,
  status: "IN_REVIEW",
  row_version: 3,
  current_user_id: 2,
  can_manage: false,
  requesting_department_name: "Laboratory",
  created_by_name: "SCM",
  created_at: "2026-10-28T08:00:00Z",
  instructions: "Assess proposed sample",
  attachments: [],
  item_packets: [
    {
      item_id: "30",
      snapshot: {
        item_name: "Chair",
        quantity: "1",
        unit_of_measure: "Piece",
        specs: "Two arms",
      },
      evidence: {
        basis: "description",
        category: "Furniture",
        evidence_description: "Proposed chair specification",
        no_sample_reason: "Custom made",
        attachment_ids: [],
      },
    },
  ],
  assignments: [
    {
      id: 10,
      reviewer_id: 2,
      reviewer_name: "Inspector",
      reviewer_title: "HOD",
      department_name: "Laboratory",
      status: "PENDING",
      reports: [],
    },
  ],
};
function mount(url = "/?review=7") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Page />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  jest.resetAllMocks();
  api.reviewSchema.mockResolvedValue(schema);
  api.listPreprocurementReviews.mockResolvedValue([
    {
      id: 7,
      request_id: 20,
      status: "IN_REVIEW",
      pending_count: 1,
      rejected_count: 0,
    },
  ]);
  api.getPreprocurementReview.mockResolvedValue(review);
  api.eligibleReviewRequests.mockResolvedValue([
    {
      id: 20,
      department_name: "Laboratory",
      justification: "Chairs",
      items: [{ id: 30, item_name: "Chair", specs: "Two arms" }],
    },
  ]);
  api.reviewDirectory.mockResolvedValue([
    { id: 2, name: "Inspector", role: "HOD", department_name: "Laboratory" },
  ]);
  api.reviewPolicy.mockResolvedValue({ require_for_all: false });
  api.requestEvidence.mockResolvedValue([
    { id: 9, file_name: "Chair data sheet.pdf" },
  ]);
});
async function fillOpinion() {
  await screen.findByText("My departmental inspection report");
  fireEvent.change(
    screen.getByLabelText("Compliance with specifications condition 30"),
    { target: { value: "met" } },
  );
  fireEvent.change(screen.getByLabelText("Packaging condition 30"), {
    target: { value: "not_applicable" },
  });
  fireEvent.change(screen.getByLabelText("Overall condition"), {
    target: { value: "good" },
  });
  fireEvent.change(screen.getByLabelText("Findings"), {
    target: { value: "Fits the requested use" },
  });
  fireEvent.change(screen.getByLabelText("Technical recommendation 30"), {
    target: { value: "APPROVED" },
  });
}
test("assigned reviewer submits structured opinion with current version and no client signature", async () => {
  api.submitTechnicalOpinion.mockResolvedValue({
    ...review,
    row_version: 4,
    assignments: [{ ...review.assignments[0], status: "APPROVED" }],
  });
  mount();
  await fillOpinion();
  fireEvent.click(screen.getByText("Submit departmental opinion and attest"));
  await waitFor(() =>
    expect(api.submitTechnicalOpinion).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        row_version: 3,
        reports: [
          expect.objectContaining({
            item_id: "30",
            findings: "Fits the requested use",
            decision: "APPROVED",
            checklist: {
              specifications: {
                condition: "met",
                comment: "",
                action_required: "",
              },
              packaging: {
                condition: "not_applicable",
                comment: "",
                action_required: "",
              },
            },
          }),
        ],
      }),
    ),
  );
  expect(api.submitTechnicalOpinion.mock.calls[0][1]).not.toHaveProperty(
    "signature",
  );
  expect(
    screen.queryByText("Send a request for technical review"),
  ).not.toBeInTheDocument();
});
test("stale response preserves typed report until the user explicitly reloads", async () => {
  api.submitTechnicalOpinion.mockRejectedValue({
    response: {
      status: 409,
      data: { message: "The review changed; reload before submitting" },
    },
  });
  mount();
  await fillOpinion();
  fireEvent.click(screen.getByText("Submit departmental opinion and attest"));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "The review changed",
  );
  expect(screen.getByLabelText("Findings")).toHaveValue(
    "Fits the requested use",
  );
  expect(api.getPreprocurementReview).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText("Reload latest review"));
  await waitFor(() =>
    expect(screen.getByLabelText("Findings")).toHaveValue(""),
  );
});
test.each(["PENDING", "REJECTED"])(
  "SCM cannot approve while a departmental opinion is %s",
  async (status) => {
    api.reviewSchema.mockResolvedValue({ ...schema, can_manage: true });
    api.getPreprocurementReview.mockResolvedValue({
      ...review,
      current_user_id: 1,
      can_manage: true,
      assignments: [{ ...review.assignments[0], status }],
    });
    mount();
    await screen.findByText("SCM / procurement supervisor sign-off");
    fireEvent.change(screen.getByLabelText("SCM decision notes"), {
      target: { value: "Review completed" },
    });
    expect(screen.getByText("Approve technical clearance")).toBeDisabled();
    expect(screen.getByText("Reject technical clearance")).toBeEnabled();
    expect(
      screen.queryByText("My departmental inspection report"),
    ).not.toBeInTheDocument();
  },
);
test("SCM sends request-specific data sheet and named departmental inspector", async () => {
  api.reviewSchema.mockResolvedValue({ ...schema, can_manage: true });
  api.sendTechnicalReview.mockResolvedValue({
    ...review,
    current_user_id: 1,
    can_manage: true,
  });
  mount("/");
  await screen.findByText("Send a request for technical review");
  fireEvent.click(screen.getByText("Send a request for technical review"));
  fireEvent.change(screen.getByLabelText("Approved request"), {
    target: { value: "20" },
  });
  await screen.findByText("Chair data sheet.pdf");
  fireEvent.change(screen.getByLabelText("Review basis 30"), {
    target: { value: "data_sheet" },
  });
  fireEvent.change(screen.getByLabelText("Sample / evidence description"), {
    target: { value: "Manufacturer technical specification" },
  });
  fireEvent.change(
    screen.getByLabelText("Why is a physical sample unavailable?"),
    { target: { value: "Custom manufacture" } },
  );
  fireEvent.click(screen.getByLabelText("Chair data sheet.pdf"));
  fireEvent.click(screen.getByLabelText("Inspector · HOD · Laboratory"));
  fireEvent.change(screen.getByLabelText("Review instructions"), {
    target: { value: "Confirm dimensions and safety" },
  });
  fireEvent.click(screen.getByText("Send technical review"));
  await waitFor(() =>
    expect(api.sendTechnicalReview).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "20",
        reviewer_ids: ["2"],
        items: [
          {
            item_id: "30",
            evidence: expect.objectContaining({
              basis: "data_sheet",
              attachment_ids: [9],
              no_sample_reason: "Custom manufacture",
            }),
          },
        ],
      }),
    ),
  );
  await screen.findByText("Technical review sent to the selected departments.");
  expect(api.getPreprocurementReview).not.toHaveBeenCalled();
});
test("SCM signs all-approved review with version and decision reason", async () => {
  api.reviewSchema.mockResolvedValue({ ...schema, can_manage: true });
  const ready = {
    ...review,
    can_manage: true,
    current_user_id: 1,
    assignments: [{ ...review.assignments[0], status: "APPROVED" }],
  };
  api.getPreprocurementReview.mockResolvedValue(ready);
  api.signTechnicalReview.mockResolvedValue({
    ...ready,
    status: "APPROVED",
    row_version: 4,
  });
  mount();
  await screen.findByText("SCM / procurement supervisor sign-off");
  fireEvent.change(screen.getByLabelText("SCM decision notes"), {
    target: { value: "All departmental opinions accepted" },
  });
  fireEvent.click(screen.getByText("Approve technical clearance"));
  await waitFor(() =>
    expect(api.signTechnicalReview).toHaveBeenCalledWith(7, {
      row_version: 3,
      decision: "APPROVED",
      notes: "All departmental opinions accepted",
    }),
  );
});

test("send form exposes grouped evidence fields and preserves inspectors across search", async () => {
  api.reviewSchema.mockResolvedValue({ ...schema, can_manage: true });
  api.reviewDirectory.mockResolvedValue([
    { id: 2, name: "Inspector", role: "HOD", department_name: "Laboratory" },
    {
      id: 3,
      name: "Other inspector",
      role: "Requester",
      department_name: "Imaging",
    },
  ]);
  mount("/");
  fireEvent.click(
    await screen.findByRole("button", { name: "New technical review" }),
  );
  expect(
    screen.getByRole("form", { name: "Send technical review request" }),
  ).toBeVisible();
  expect(
    screen.getByRole("group", { name: /Request and supporting evidence/ }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Approved request"), {
    target: { value: "20" },
  });
  await screen.findByText("Chair data sheet.pdf");
  expect(screen.getByLabelText("Supplier name")).toBeInTheDocument();
  expect(screen.getByLabelText("Manufacturer")).toBeInTheDocument();
  expect(screen.getByLabelText("Model number")).toBeInTheDocument();
  expect(screen.getByLabelText("Sample received date")).toBeRequired();
  fireEvent.change(screen.getByLabelText("Review basis 30"), {
    target: { value: "description" },
  });
  expect(
    screen.getByLabelText("Why is a physical sample unavailable?"),
  ).toBeRequired();
  fireEvent.click(screen.getByLabelText("Inspector · HOD · Laboratory"));
  fireEvent.change(screen.getByRole("searchbox", { name: "Find inspectors" }), {
    target: { value: "Other Imaging" },
  });
  expect(
    screen.queryByLabelText("Inspector · HOD · Laboratory"),
  ).not.toBeInTheDocument();
  expect(screen.getByText("1 selected · 1 of 2 shown")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Clear inspector search" }),
  );
  expect(screen.getByLabelText("Inspector · HOD · Laboratory")).toBeChecked();
  expect(api.sendTechnicalReview).not.toHaveBeenCalled();
});

test("requirement edits are draft-only until saved with a reason", async () => {
  api.reviewSchema.mockResolvedValue({ ...schema, can_manage: true });
  api.saveReviewPolicy.mockResolvedValue({ require_for_all: true });
  mount("/");
  fireEvent.click(await screen.findByText("Technical review requirement"));
  const save = screen.getByRole("button", { name: "Save review requirement" });
  expect(save).toBeDisabled();
  fireEvent.click(
    screen.getByLabelText("Require clearance for every approved request"),
  );
  expect(screen.getByText("All approved requests")).toBeInTheDocument();
  expect(
    screen.getByRole("complementary", { name: "Draft review requirement" }),
  ).toBeVisible();
  expect(api.saveReviewPolicy).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Technical review policy reason"), {
    target: { value: "   " },
  });
  expect(save).toBeDisabled();
  const reason = "Align technical clearance\nwith procurement controls";
  fireEvent.change(screen.getByLabelText("Technical review policy reason"), {
    target: { value: reason },
  });
  fireEvent.click(save);
  await waitFor(() =>
    expect(api.saveReviewPolicy).toHaveBeenCalledWith({
      require_for_all: true,
      reason,
    }),
  );
  await screen.findByText("Technical review requirement saved.");
  expect(screen.getByLabelText("Technical review policy reason")).toHaveValue(
    "",
  );
});

test("failed requirement save retains the draft and reason for correction", async () => {
  api.reviewSchema.mockResolvedValue({ ...schema, can_manage: true });
  api.saveReviewPolicy.mockRejectedValue({
    response: { data: { message: "Policy update denied" } },
  });
  mount("/");
  fireEvent.click(await screen.findByText("Technical review requirement"));
  fireEvent.click(
    screen.getByLabelText("Require clearance for every approved request"),
  );
  fireEvent.change(screen.getByLabelText("Technical review policy reason"), {
    target: { value: "Keep this audit reason" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save review requirement" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Policy update denied",
  );
  expect(screen.getByLabelText("Technical review policy reason")).toHaveValue(
    "Keep this audit reason",
  );
  expect(
    screen.getByLabelText("Require clearance for every approved request"),
  ).toBeChecked();
});
