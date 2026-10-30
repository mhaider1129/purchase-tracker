import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Settings from "./TechnicalReviewSettings";
import * as api from "../api/technicalWorkflow";
jest.mock("../api/technicalWorkflow");
const settings = {
  pre_required: false,
  delivery_required: false,
  level: 2,
  evidence_required: false,
  pre_checks: [],
  delivery_checks: [
    "specifications",
    "physical_condition",
    "documents",
    "functional_test",
  ],
  reviewers: [{ department_id: "REQUESTING", reviewer_id: null }],
};
const directory = {
  profiles: [],
  keys: ["unclassified", "medical_device"],
  base_checks: settings.delivery_checks,
  delivery_checks: {
    specifications: ["yes", "no"],
    physical_condition: ["yes", "no"],
    documents: ["yes", "no"],
    functional_test: ["pass", "fail"],
    calibration: ["pass", "fail"],
  },
  departments: [{ id: 8, name: "Medical Devices" }],
  users: [{ id: 5, name: "Engineer", department_id: 8 }],
};
beforeEach(() => {
  jest.resetAllMocks();
  api.technicalProfiles.mockResolvedValue(directory);
});
test("Management configures optional controlled-category requirements without enabling every purchase", async () => {
  api.saveTechnicalProfile.mockResolvedValue({
    profile_key: "medical_device",
    row_version: 1,
    settings: { ...settings, pre_required: true, delivery_required: true },
  });
  render(<Settings />);
  await screen.findByText("Save technical profile");
  fireEvent.change(screen.getByLabelText("Item type"), {
    target: { value: "medical_device" },
  });
  fireEvent.click(
    screen.getByLabelText(
      "Require pre-procurement technical review and create tasks on final PR approval",
    ),
  );
  fireEvent.click(
    screen.getByLabelText(
      "Require delivery inspection before accepting receipt quantities",
    ),
  );
  fireEvent.change(screen.getByLabelText("Change reason"), {
    target: { value: "Controlled device rollout" },
  });
  fireEvent.click(screen.getByText("Save technical profile"));
  await waitFor(() =>
    expect(api.saveTechnicalProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_key: "medical_device",
        row_version: 0,
        settings: expect.objectContaining({
          pre_required: true,
          delivery_required: true,
        }),
      }),
    ),
  );
});
test("missing SQL 054 displays the setup error instead of a misleading save form", async () => {
  api.technicalProfiles.mockRejectedValue({
    response: {
      data: {
        message:
          "Apply complete SQL 054 for technical profiles and delivery inspections",
      },
    },
  });
  render(<Settings />);
  await screen.findByRole("alert");
  expect(screen.queryByText("Save technical profile")).not.toBeInTheDocument();
});
