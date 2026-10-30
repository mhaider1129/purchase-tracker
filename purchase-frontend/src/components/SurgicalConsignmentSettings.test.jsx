import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import Component from "./SurgicalConsignmentSettings";
import * as api from "../api/surgicalConsignments";
jest.mock("../api/surgicalConsignments");
const data = {
  configured: true,
  departments: [
    { id: 1, name: "Surgery" },
    { id: 2, name: "Imaging" },
  ],
  sections: [{ id: 10, department_id: 1, name: "Operating room" }],
  users: [
    { id: 3, name: "Department nurse", role: "Requester" },
    { id: 4, name: "Section nurse", role: "Requester" },
    {
      id: 5,
      name: "Warehouse receiver",
      role: "WarehouseKeeper",
      warehouse_id: 8,
    },
    {
      id: 6,
      name: "Other warehouse keeper",
      role: "WarehouseKeeper",
      warehouse_id: 9,
    },
  ],
  warehouses: [{ id: 8, name: "Surgical warehouse" }],
  settings: [],
};
beforeEach(() => {
  jest.resetAllMocks();
  api.settings.mockResolvedValue(data);
});
test("Management configures eligible surgical departments, nursing responsibility and the actual warehouse receiver", async () => {
  api.saveSettings.mockImplementation(async (input) => ({
    ...data,
    settings: [{ ...input, row_version: 1 }],
  }));
  render(<Component />);
  fireEvent.change(await screen.findByLabelText("Surgical department"), {
    target: { value: "1" },
  });
  fireEvent.change(screen.getByLabelText("Responsible department nurse"), {
    target: { value: "3" },
  });
  fireEvent.change(screen.getByLabelText("Receiving warehouse"), {
    target: { value: "8" },
  });
  expect(
    within(screen.getByLabelText("Responsible warehouse receiver")).queryByRole(
      "option",
      { name: "Other warehouse keeper · WarehouseKeeper" },
    ),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Responsible warehouse receiver"), {
    target: { value: "5" },
  });
  fireEvent.click(screen.getByText("Add section nurse override"));
  fireEvent.change(screen.getByLabelText("Nurse override section 1"), {
    target: { value: "10" },
  });
  fireEvent.change(screen.getByLabelText("Section nurse 1"), {
    target: { value: "4" },
  });
  fireEvent.change(screen.getByLabelText("Setup change reason"), {
    target: { value: "Set surgical responsibilities" },
  });
  fireEvent.click(screen.getByText("Save surgical department setup"));
  await screen.findByText("Surgical department setup saved.");
  expect(api.saveSettings).toHaveBeenCalledWith(
    expect.objectContaining({
      department_id: "1",
      nurse_id: "3",
      warehouse_id: "8",
      receiver_id: "5",
      section_nurses: [{ section_id: "10", nurse_id: "4" }],
      is_enabled: true,
      row_version: 0,
    }),
  );
});
test("a stale settings save preserves the draft and exposes the conflict instead of overwriting", async () => {
  api.saveSettings.mockRejectedValue({
    response: { data: { message: "Setup changed. Reload before saving." } },
  });
  render(<Component />);
  fireEvent.change(await screen.findByLabelText("Surgical department"), {
    target: { value: "1" },
  });
  fireEvent.change(screen.getByLabelText("Setup change reason"), {
    target: { value: "Keep my reason" },
  });
  fireEvent.click(screen.getByText("Save surgical department setup"));
  await screen.findByText("Setup changed. Reload before saving.");
  expect(screen.getByLabelText("Setup change reason")).toHaveValue(
    "Keep my reason",
  );
});
test("an absent migration cannot save or fabricate an eligible department list", async () => {
  api.settings.mockResolvedValue({ ...data, configured: false });
  render(<Component />);
  await screen.findByText(
    "Apply complete SQL 053 before configuring surgical departments.",
  );
  expect(screen.getByText("Save surgical department setup")).toBeDisabled();
  expect(api.saveSettings).not.toHaveBeenCalled();
});
