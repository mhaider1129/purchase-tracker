import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Locations, Movements } from "./Operations";
import { fixedAssetsApi as api } from "../../api/fixedAssets";
jest.mock("../../api/fixedAssets", () => ({
  fixedAssetsApi: {
    locations: jest.fn(),
    saveLocation: jest.fn(),
    reparentLocation: jest.fn(),
    setLocationActive: jest.fn(),
    movementList: jest.fn(),
    move: jest.fn(),
    transitionMovement: jest.fn(),
    initiateReturn: jest.fn(),
    departments: jest.fn(),
    list: jest.fn(),
  },
}));
const manager = {
  permissions: [
    "fixed-assets.manage-locations",
    "fixed-assets.move",
    "fixed-assets.manage",
    "fixed-assets.verify",
  ],
};
beforeEach(() => {
  jest.clearAllMocks();
  api.locations.mockResolvedValue([
    {
      id: 5,
      display_path: "Campus › Room",
      location_type: "ROOM",
      is_active: true,
    },
  ]);
  api.departments.mockResolvedValue([]);
  api.list.mockResolvedValue({
    data: [{ id: 8, asset_number: "A-8", description: "Pump" }],
  });
  api.movementList.mockResolvedValue([]);
});
test("location hierarchy renders and manager can open create flow", async () => {
  api.locations.mockResolvedValue([
    {
      id: 1,
      code: "C",
      name: "Campus",
      location_type: "CAMPUS",
      display_path: "Campus",
      is_active: true,
      asset_count: 0,
    },
    {
      id: 2,
      parent_location_id: 1,
      code: "R",
      name: "Room",
      location_type: "ROOM",
      display_path: "Campus › Room",
      is_active: true,
      asset_count: 2,
    },
  ]);
  render(<Locations user={manager} />);
  expect(await screen.findByText("Campus › Room")).toBeInTheDocument();
  await userEvent.click(screen.getByText("Add physical location"));
  expect(screen.getByLabelText("Location code")).toBeInTheDocument();
});
test("dependency error is rendered", async () => {
  api.locations.mockResolvedValue([
    {
      id: 1,
      code: "C",
      name: "Campus",
      location_type: "CAMPUS",
      is_active: true,
      asset_count: 1,
    },
  ]);
  api.setLocationActive.mockRejectedValue({
    response: { data: { message: "Location has active assigned assets" } },
  });
  render(<Locations user={manager} />);
  await userEvent.click(await screen.findByText("Deactivate"));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "active assigned assets",
  );
});
test("movement actions are state and permission gated with receive confirmation", async () => {
  api.movementList.mockResolvedValue([
    {
      id: 4,
      status: "IN_TRANSIT",
      asset_number: "A-1",
      movement_type: "TEMPORARY_LOAN",
    },
  ]);
  window.confirm = jest.fn(() => false);
  render(<Movements user={manager} />);
  await userEvent.click(await screen.findByText("receive"));
  expect(window.confirm).toHaveBeenCalled();
  expect(api.transitionMovement).not.toHaveBeenCalled();
  expect(screen.queryByText("approve")).not.toBeInTheDocument();
});
test("movement creation and backend errors are operational", async () => {
  api.move.mockRejectedValue({
    response: { data: { message: "Asset already has an active movement" } },
  });
  render(<Movements user={manager} />);
  await userEvent.click(screen.getByText("Request movement"));
  await userEvent.selectOptions(await screen.findByLabelText("Asset"), "8");
  await userEvent.selectOptions(
    screen.getByLabelText("Destination location"),
    "5",
  );
  await userEvent.type(screen.getByLabelText("Movement reason"), "Needed");
  await userEvent.click(screen.getByText("Create draft"));
  expect(await screen.findByRole("alert")).toHaveTextContent("active movement");
});
test("external maintenance filters destinations and exposes expected return", async () => {
  api.locations.mockResolvedValue([
    {
      id: 5,
      display_path: "Campus › Room",
      location_type: "ROOM",
      is_active: true,
    },
    {
      id: 6,
      display_path: "External › Vendor",
      location_type: "EXTERNAL",
      is_active: true,
    },
  ]);
  render(<Movements user={manager} />);
  await userEvent.click(screen.getByText("Request movement"));
  await userEvent.selectOptions(
    screen.getByLabelText("Movement type"),
    "EXTERNAL_MAINTENANCE",
  );
  expect(screen.getByLabelText("Destination location")).toHaveTextContent(
    "External › Vendor",
  );
  expect(screen.getByLabelText("Destination location")).not.toHaveTextContent(
    "Campus › Room",
  );
  expect(screen.getByLabelText("Expected return")).toBeRequired();
});
test("eligible receipt alone exposes canonical return action", async () => {
  api.movementList.mockResolvedValue([
    {
      id: 4,
      status: "RECEIVED",
      asset_number: "A-1",
      movement_type: "TEMPORARY_LOAN",
    },
    {
      id: 5,
      status: "RECEIVED",
      asset_number: "A-2",
      movement_type: "PERMANENT_TRANSFER",
    },
  ]);
  render(<Movements user={manager} />);
  expect(await screen.findAllByText("initiate return")).toHaveLength(1);
});
test("location tree expands and reparent selector displays paths", async () => {
  api.locations.mockResolvedValue([
    {
      id: 1,
      code: "C",
      name: "Campus",
      location_type: "CAMPUS",
      display_path: "Campus",
      is_active: true,
      asset_count: 0,
    },
    {
      id: 2,
      parent_location_id: 1,
      code: "R",
      name: "Room",
      location_type: "ROOM",
      display_path: "Campus › Room",
      is_active: true,
      asset_count: 0,
    },
  ]);
  render(<Locations user={manager} />);
  await screen.findByText("Campus › Room");
  await userEvent.click(screen.getByLabelText("Collapse Campus"));
  expect(screen.queryByText("Campus › Room")).not.toBeInTheDocument();
  await userEvent.click(screen.getByLabelText("Expand Campus"));
  await userEvent.click(screen.getAllByText("Reparent")[1]);
  expect(
    screen.getByRole("dialog", { name: "Reparent location" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("New parent location")).toHaveTextContent(
    "Campus",
  );
});

test("empty location hierarchy provides a complete first-location workflow", async () => {
  api.locations.mockResolvedValue([]);
  api.saveLocation.mockResolvedValue({ id: 9 });
  render(<Locations user={manager} />);
  expect(
    await screen.findByText("No physical locations configured"),
  ).toBeInTheDocument();
  await userEvent.click(screen.getByText("Create first location"));
  expect(
    screen.getByRole("form", { name: "Create physical location" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Location form type")).toHaveValue("CAMPUS");
  await userEvent.type(screen.getByLabelText("Location code"), "main");
  await userEvent.type(screen.getByLabelText("Location name"), "Main Campus");
  await userEvent.click(
    screen.getByRole("button", { name: /Create location/ }),
  );
  expect(api.saveLocation).toHaveBeenCalledWith(
    undefined,
    expect.objectContaining({
      code: "MAIN",
      name: "Main Campus",
      locationType: "CAMPUS",
    }),
  );
});