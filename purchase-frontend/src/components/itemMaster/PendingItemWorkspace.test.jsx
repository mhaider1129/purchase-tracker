import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PendingItemWorkspace from "./PendingItemWorkspace";
import * as api from "../../api/itemMaster";
jest.mock("../../api/itemMaster");
const refs = {
  categories: [{ id: 3, name: "Furniture" }],
  uom: [{ id: 4, code: "EA", name: "Piece" }],
  manufacturers: [],
};
const referral = {
  id: 11,
  proposed_name: "Chair",
  required_specifications: "Chair with two arms",
  item_type: "general_item",
  request_id: 69,
  requested_item_id: 70,
  status: "submitted",
};
beforeEach(() => {
  jest.clearAllMocks();
  api.listPendingItems.mockResolvedValue({ data: [referral], total: 1 });
  api.getItemMasterReferences.mockResolvedValue(refs);
  api.searchGenericItems.mockResolvedValue({ data: [] });
});
test("resolver cannot create a second pending referral and still supports information requests", async () => {
  render(<PendingItemWorkspace user={{ permissions: ["item-master.map"] }} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Resolve referral" }),
  );
  expect(
    screen.getByRole("textbox", { name: "Search active Generic Items" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Cannot find the item" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", {
      name: "Create Generic Item draft for this referral",
    }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Save referral decision" }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Decision"), {
    target: { value: "needs_information" },
  });
  fireEvent.change(screen.getByLabelText("Decision notes"), {
    target: { value: "Confirm chair dimensions." },
  });
  api.resolvePendingItem.mockResolvedValue({});
  fireEvent.click(
    screen.getByRole("button", { name: "Save referral decision" }),
  );
  await waitFor(() =>
    expect(api.resolvePendingItem).toHaveBeenCalledWith(11, {
      resolution_type: "needs_information",
      generic_item_id: undefined,
      notes: "Confirm chair dimensions.",
    }),
  );
});
test("draft creation prefills details, leaves the referral open, and links only after active selection", async () => {
  api.searchGenericItems.mockResolvedValue({
    data: [{ id: 7, generic_name: "Old Chair", item_code: "OLD-7" }],
  });
  render(
    <PendingItemWorkspace
      user={{
        permissions: [
          "item-master.map",
          "item-master.create",
          "item-master.references-maintain",
        ],
      }}
    />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Resolve referral" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /OLD-7.*Old Chair/ }),
  );
  fireEvent.change(screen.getByLabelText("Decision notes"), {
    target: { value: "Use a new governed item instead." },
  });
  expect(
    screen.getByRole("button", { name: "Save referral decision" }),
  ).toBeEnabled();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Create Generic Item draft for this referral",
    }),
  );
  expect(screen.getByLabelText("Generic name")).toHaveValue("Chair");
  expect(screen.getByLabelText("Canonical description")).toHaveValue(
    "Chair with two arms",
  );
  await screen.findByRole("option", { name: "EA · Piece" });
  fireEvent.change(screen.getByLabelText("Internal item code"), {
    target: { value: "WICI00001" },
  });
  fireEvent.change(screen.getByLabelText("Category"), {
    target: { value: "3" },
  });
  fireEvent.change(screen.getByLabelText("Inventory UOM"), {
    target: { value: "4" },
  });
  api.createGenericItem.mockResolvedValue({
    id: 8,
    item_code: "WICI00001",
    lifecycle_status: "draft",
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Create governed record" }),
  );
  expect(
    await screen.findByText(/This referral remains open/),
  ).toBeInTheDocument();
  expect(api.resolvePendingItem).not.toHaveBeenCalled();
  expect(api.transitionGenericItem).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Save referral decision" }),
  ).toBeDisabled();
  api.searchGenericItems.mockResolvedValue({
    data: [
      {
        id: 8,
        generic_name: "Chair",
        item_code: "WICI00001",
        inventory_uom: "EA",
      },
    ],
  });
  fireEvent.change(
    screen.getByRole("textbox", { name: "Search active Generic Items" }),
    { target: { value: "WICI00001" } },
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /WICI00001.*Chair/ }),
  );
  fireEvent.change(screen.getByLabelText("Decision notes"), {
    target: { value: "Approved chair identity confirmed." },
  });
  api.resolvePendingItem.mockResolvedValue({});
  fireEvent.click(
    screen.getByRole("button", { name: "Save referral decision" }),
  );
  await waitFor(() =>
    expect(api.resolvePendingItem).toHaveBeenCalledWith(11, {
      resolution_type: "existing_generic",
      generic_item_id: 8,
      notes: "Approved chair identity confirmed.",
    }),
  );
  expect(api.searchGenericItems).toHaveBeenCalledWith(
    expect.objectContaining({ status: "active" }),
  );
});
