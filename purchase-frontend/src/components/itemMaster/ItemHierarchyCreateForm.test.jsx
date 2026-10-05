import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ItemHierarchyCreateForm from "./ItemHierarchyCreateForm";
import * as api from "../../api/itemMaster";
jest.mock("../../api/itemMaster");
test("creation writes a normalized Generic draft with controlled references", async () => {
  api.getItemMasterReferences.mockResolvedValue({
    categories: [{ id: 3, name: "General" }],
    uom: [{ id: 4, code: "EA", name: "Piece" }],
    manufacturers: [],
  });
  api.createGenericItem.mockResolvedValue({ id: 8, lifecycle_status: "draft" });
  const saved = jest.fn();
  render(
    <ItemHierarchyCreateForm
      level="generic"
      onSaved={saved}
      onClose={() => {}}
    />,
  );
  await screen.findByRole("option", { name: "EA · Piece" });
  for (const [label, value] of [
    ["Internal item code", "GEN-01"],
    ["Generic name", "Infusion stand"],
    ["Canonical description", "Mobile infusion stand"],
    ["Category", "3"],
    ["Inventory UOM", "4"],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(
    screen.getByRole("button", { name: "Create governed record" }),
  );
  await waitFor(() =>
    expect(api.createGenericItem).toHaveBeenCalledWith(
      expect.objectContaining({
        item_code: "GEN-01",
        generic_name: "Infusion stand",
        category_id: "3",
        category: "General",
        base_uom_id: 4,
        base_uom: "EA",
        inventory_uom_id: "4",
        inventory_uom: "EA",
      }),
    ),
  );
  expect(api.createItemMaster).not.toHaveBeenCalled();
  expect(saved).toHaveBeenCalledWith({ id: 8, lifecycle_status: "draft" });
});

beforeEach(() => {
  jest.clearAllMocks();
});
const emptyRefs = { categories: [], uom: [], manufacturers: [] };
test("creates missing category and UOM inline, preserving and saving the draft", async () => {
  let refs = { ...emptyRefs };
  api.getItemMasterReferences.mockImplementation(async () => refs);
  api.createItemMasterReference.mockImplementation(async (type, payload) => {
    if (type === "categories") {
      refs = { ...refs, categories: [{ id: 3, name: payload.name }] };
      return { id: 3, category_name: payload.name };
    }
    refs = {
      ...refs,
      uom: [{ id: 4, code: payload.code, name: payload.name }],
    };
    return { id: 4, uom_code: payload.code, uom_name: payload.name };
  });
  api.createGenericItem.mockResolvedValue({ id: 8, lifecycle_status: "draft" });
  render(
    <ItemHierarchyCreateForm
      level="generic"
      canMaintainReferences
      onSaved={jest.fn()}
      onClose={() => {}}
    />,
  );
  await screen.findByText(/Required reference data is missing/);
  for (const [label, value] of [
    ["Internal item code", "WICI00001"],
    ["Generic name", "Chair"],
    ["Canonical description", "Chair with two arms"],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  expect(
    screen.getByRole("button", { name: "Create governed record" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Add category" }));
  fireEvent.change(screen.getByLabelText("Category name"), {
    target: { value: "Furniture" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save category" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Category")).toHaveValue("3"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Add UOM" }));
  fireEvent.change(screen.getByLabelText("UOM code"), {
    target: { value: "EA" },
  });
  fireEvent.change(screen.getByLabelText("UOM name"), {
    target: { value: "Piece" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save UOM" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Inventory UOM")).toHaveValue("4"),
  );
  expect(screen.getByLabelText("Internal item code")).toHaveValue("WICI00001");
  expect(screen.getByLabelText("Generic name")).toHaveValue("Chair");
  expect(screen.getByLabelText("Canonical description")).toHaveValue(
    "Chair with two arms",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Create governed record" }),
  );
  await waitFor(() =>
    expect(api.createGenericItem).toHaveBeenCalledWith(
      expect.objectContaining({
        category_id: "3",
        inventory_uom_id: "4",
        base_uom: "EA",
        generic_name: "Chair",
      }),
    ),
  );
  expect(api.createItemMasterReference).toHaveBeenCalledWith("categories", {
    name: "Furniture",
    code: "",
  });
  expect(api.createItemMasterReference).toHaveBeenCalledWith("uom", {
    name: "Piece",
    code: "EA",
  });
});
test("unauthorized creators get guidance and can refresh without losing their draft", async () => {
  api.getItemMasterReferences.mockResolvedValue(emptyRefs);
  render(
    <ItemHierarchyCreateForm
      level="generic"
      onSaved={jest.fn()}
      onClose={() => {}}
    />,
  );
  await screen.findByText(/Required reference data is missing/);
  expect(
    screen.queryByRole("button", { name: "Add category" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText(/requires item-master.references-maintain/),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Generic name"), {
    target: { value: "Chair" },
  });
  api.getItemMasterReferences.mockResolvedValue({
    categories: [{ id: 3, name: "Furniture" }],
    uom: [{ id: 4, code: "EA", name: "Piece" }],
    manufacturers: [],
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh reference lists" }),
  );
  await screen.findByRole("option", { name: "Furniture" });
  expect(screen.getByLabelText("Generic name")).toHaveValue("Chair");
  expect(api.createItemMasterReference).not.toHaveBeenCalled();
});
test("load failures are visible and retry preserves entered text", async () => {
  api.getItemMasterReferences.mockRejectedValue({
    response: { data: { message: "Access denied" } },
  });
  render(
    <ItemHierarchyCreateForm
      level="generic"
      onSaved={jest.fn()}
      onClose={() => {}}
    />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
  expect(
    screen.queryByText(/Required reference data is missing/),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Create governed record" }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Generic name"), {
    target: { value: "Chair" },
  });
  api.getItemMasterReferences.mockResolvedValue(emptyRefs);
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh reference lists" }),
  );
  await screen.findByText(/Required reference data is missing/);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Generic name")).toHaveValue("Chair");
});
test("reference create failures retain inputs and do not create an item", async () => {
  api.getItemMasterReferences.mockResolvedValue(emptyRefs);
  api.createItemMasterReference.mockRejectedValue({
    response: { data: { message: "Reference already exists" } },
  });
  render(
    <ItemHierarchyCreateForm
      level="generic"
      canMaintainReferences
      onSaved={jest.fn()}
      onClose={() => {}}
    />,
  );
  await screen.findByText(/Required reference data is missing/);
  fireEvent.click(screen.getByRole("button", { name: "Add category" }));
  fireEvent.change(screen.getByLabelText("Category name"), {
    target: { value: "Furniture" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save category" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Reference already exists",
  );
  expect(screen.getByLabelText("Category name")).toHaveValue("Furniture");
  expect(api.createGenericItem).not.toHaveBeenCalled();
});

test("Product creation selects active identities without offering nested referrals", async () => {
  api.getItemMasterReferences.mockResolvedValue({
    categories: [],
    uom: [{ id: 4, code: "EA", name: "Piece" }],
    manufacturers: [{ id: 5, name: "Acme" }],
  });
  api.searchGenericItems.mockResolvedValue({
    data: [{ id: 8, generic_name: "Chair", item_code: "WICI00001" }],
  });
  render(
    <ItemHierarchyCreateForm
      level="products"
      onSaved={jest.fn()}
      onClose={() => {}}
    />,
  );
  await screen.findByRole("option", { name: "Acme" });
  expect(
    screen.queryByRole("button", { name: "Cannot find the item" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Create governed record" }),
  ).toBeDisabled();
  fireEvent.click(
    await screen.findByRole("button", { name: /WICI00001.*Chair/ }),
  );
  expect(
    screen.getByRole("button", { name: "Create governed record" }),
  ).toBeEnabled();
  expect(api.createGenericItem).not.toHaveBeenCalled();
});
