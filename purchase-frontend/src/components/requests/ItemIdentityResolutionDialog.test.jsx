import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ItemIdentityResolutionDialog from "./ItemIdentityResolutionDialog";
import api from "../../api/axios";
import {
  getItemMasterReferences,
  searchGenericItems,
} from "../../api/itemMaster";
jest.mock("../../api/axios", () => ({ post: jest.fn() }));
jest.mock("../../api/itemMaster", () => ({
  getItemMasterReferences: jest.fn(),
  searchGenericItems: jest.fn(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  getItemMasterReferences.mockResolvedValue({ categories: [] });
  searchGenericItems.mockResolvedValue({
    data: [
      {
        id: 5,
        item_code: "GEN-5",
        generic_name: "Infusion stand",
        inventory_uom: "EA",
      },
    ],
  });
});
test("resolution uses the existing request line and retains requester wording", async () => {
  api.post.mockResolvedValue({ data: {} });
  const saved = jest.fn();
  render(
    <MemoryRouter>
      <ItemIdentityResolutionDialog
        requestId={78}
        item={{ id: 12, item_name: "Original wording" }}
        onSaved={saved}
        onClose={() => {}}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText("Original wording")).toBeInTheDocument();
  fireEvent.click(
    await screen.findByRole("button", { name: /GEN-5 Infusion stand/ }),
  );
  fireEvent.change(screen.getByLabelText("Resolution / referral reason"), {
    target: { value: "Steward confirmed identity" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save identity resolution" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/requests/78/items/12/resolve-identity",
      { generic_item_id: 5, reason: "Steward confirmed identity" },
    ),
  );
  expect(saved).toHaveBeenCalled();
});
