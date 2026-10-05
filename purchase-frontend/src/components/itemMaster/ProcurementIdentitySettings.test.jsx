import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProcurementIdentitySettings from "./ProcurementIdentitySettings";
import api from "../../api/axios";
jest.mock("../../api/axios", () => ({ get: jest.fn(), put: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
test("administrator can disable strict enforcement with an audited reason", async () => {
  api.get.mockResolvedValue({
    data: { configured: true, enforce_item_identity: true },
  });
  api.put.mockResolvedValue({
    data: {
      configured: true,
      enforce_item_identity: false,
      reason: "Catalog setup",
    },
  });
  render(<ProcurementIdentitySettings />);
  const control = await screen.findByRole("switch");
  expect(control).toBeChecked();
  fireEvent.click(control);
  fireEvent.change(screen.getByLabelText("Reason for this change"), {
    target: { value: "Catalog setup" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save procurement policy" }),
  );
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith("/item-master/procurement-policy", {
      enforce_item_identity: false,
      reason: "Catalog setup",
    }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent("saved");
});
test("missing policy migration leaves strict mode on and change controls disabled", async () => {
  api.get.mockResolvedValue({
    data: { configured: false, enforce_item_identity: true },
  });
  render(<ProcurementIdentitySettings />);
  expect(await screen.findByRole("switch")).toBeDisabled();
  expect(screen.getByRole("switch")).toBeChecked();
  expect(
    screen.getByText(/Apply the manual policy migration/),
  ).toBeInTheDocument();
});
