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
