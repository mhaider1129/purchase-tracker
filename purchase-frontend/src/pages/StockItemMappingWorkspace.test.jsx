import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StockItemMappingWorkspace, {
  isBulkApprovalSafe,
} from "./StockItemMappingWorkspace";
import { searchGenericItems, searchApprovedProducts } from "../api/itemMaster";
import {
  listMappings,
  mappingCoverage,
  proposeMapping,
  mappingHistory,
  rollbackMapping,
} from "../api/stockItemMappings";

import { useAuth } from "../hooks/useAuth";
jest.mock("../hooks/useAuth", () => ({ useAuth: jest.fn() }));
beforeEach(() =>
  useAuth.mockReturnValue({ user: { permissions: ["item-master.stock-map"] } }),
);
jest.mock("../api/itemMaster", () => ({
  searchGenericItems: jest.fn(),
  searchApprovedProducts: jest.fn(),
}));
jest.mock("../api/stockItemMappings", () => ({
  listMappings: jest.fn(),
  mappingCoverage: jest.fn(),
  mappingAction: jest.fn(),
  proposeMapping: jest.fn(),
  mappingHistory: jest.fn(),
  rollbackMapping: jest.fn(),
  supersedeMapping: jest.fn(),
}));

const row = {
  stock_item_id: 7,
  stock_item_name: "Atorvastatin 20 mg Tab",
  mapping_status: "unmapped",
  source_attributes: { category: "Medication", uom: "Tab" },
};

describe("StockItemMappingWorkspace", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listMappings.mockResolvedValue({ data: [row] });
    mappingCoverage.mockResolvedValue({ total: 1, mapped: 0, unmapped: 1 });
    searchGenericItems.mockResolvedValue({
      data: [
        {
          id: 42,
          item_code: "GEN-42",
          generic_name: "Atorvastatin tablet",
          canonical_description: "Atorvastatin oral tablet",
          category: "Medication",
          inventory_uom: "Tab",
        },
      ],
    });
    searchApprovedProducts.mockResolvedValue({ data: [] });
    proposeMapping.mockResolvedValue({ id: 99 });
  });

  it("lets a steward select a Generic Item and create a mapping proposal", async () => {
    render(<StockItemMappingWorkspace />);

    fireEvent.click(await screen.findByRole("button", { name: "Map item" }));
    expect(
      screen.getByRole("dialog", { name: "Map stock item" }),
    ).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: /GEN-42 Atorvastatin tablet/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Create mapping proposal" }),
    );

    await waitFor(() =>
      expect(proposeMapping).toHaveBeenCalledWith({
        stock_item_id: 7,
        generic_item_id: 42,
        reason: "Manual mapping by steward",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});

test("bulk approval requires homogeneous conflict-free fresh targets and permission", () => {
  const user = { permissions: ["item-master.stock-map.bulk"] };
  const safe = (id) => ({
    id,
    generic_item_id: 1,
    approved_product_id: 2,
    parser_version: "v1",
    hard_exclusions: [],
    stale: false,
  });
  expect(isBulkApprovalSafe([safe(1), safe(2)], user)).toBe(true);
  expect(
    isBulkApprovalSafe([safe(1), { ...safe(2), generic_item_id: 9 }], user),
  ).toBe(false);
  expect(
    isBulkApprovalSafe(
      [{ ...safe(1), hard_exclusions: ["route_conflict"] }],
      user,
    ),
  ).toBe(false);
  expect(isBulkApprovalSafe([safe(1)], { permissions: [] })).toBe(false);
});
test("review decisions expose server conflicts and require an explicit reason", async () => {
  const { mappingAction } = require("../api/stockItemMappings");
  listMappings.mockResolvedValue({
    data: [
      {
        ...row,
        id: 99,
        version: 2,
        mapping_status: "review_required",
        generic_item_id: 42,
      },
    ],
  });
  mappingCoverage.mockResolvedValue({ total: 1, mapped: 0, unmapped: 1 });
  mappingAction.mockRejectedValue({
    response: {
      data: {
        message: "Stock quantity unit must match the Generic inventory UOM.",
      },
    },
  });
  render(<StockItemMappingWorkspace />);
  fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
  expect(
    screen.getByRole("button", { name: "Save mapping decision" }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Decision reason"), {
    target: { value: "Unit confirmed" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save mapping decision" }),
  );
  await waitFor(() =>
    expect(mappingAction).toHaveBeenCalledWith(99, "approve", {
      stock_item_id: 7,
      expected_version: 2,
      reason: "Unit confirmed",
    }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Stock quantity unit must match",
  );
});

test("authorized steward can restore history using the current mapping and its version", async () => {
  useAuth.mockReturnValue({
    user: {
      permissions: ["item-master.stock-map", "item-master.stock-map.override"],
    },
  });
  const current = {
    ...row,
    id: 99,
    version: 3,
    active: true,
    mapping_status: "approved",
    generic_item_id: 42,
  };
  const previous = {
    id: 98,
    version: 4,
    active: false,
    mapping_status: "superseded",
    generic_item_id: 40,
  };
  listMappings.mockResolvedValue({ data: [current] });
  mappingCoverage.mockResolvedValue({ total: 1, mapped: 1, unmapped: 0 });
  mappingHistory.mockResolvedValue({ data: [current, previous] });
  rollbackMapping.mockResolvedValue({});
  render(<StockItemMappingWorkspace />);
  fireEvent.click(await screen.findByRole("button", { name: "History" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Restore this mapping" }),
  );
  fireEvent.change(screen.getByLabelText("Decision reason"), {
    target: { value: "Restore validated identity" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save mapping decision" }),
  );
  await waitFor(() =>
    expect(rollbackMapping).toHaveBeenCalledWith(7, 99, {
      expected_current_mapping_id: 99,
      expected_version: 3,
      restore_mapping_id: 98,
      reason: "Restore validated identity",
    }),
  );
});
