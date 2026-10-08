import React from "react";
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
  act,
} from "@testing-library/react";
import i18n from "../i18n";
import WarehouseInventoryPage from "./WarehouseInventoryPage";
import {
  isLowStock,
  isExpiryDue,
  isTransferReviewable,
} from "../utils/warehouseInventoryFilters";
import api from "../api/axios";

jest.mock("../api/axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../hooks/useCurrentUser", () => {
  const user = {
    id: 1,
    warehouse_id: 1,
    permissions: ["warehouse.view-supply"],
  };
  return { __esModule: true, default: () => ({ user, loading: false }) };
});
jest.mock("../hooks/useWarehouses", () => {
  const warehouses = [
    { id: 1, name: "Medical warehouse" },
    { id: 2, name: "General warehouse" },
  ];
  return {
    __esModule: true,
    default: () => ({ warehouses, loading: false, error: "" }),
  };
});
jest.mock("../hooks/useWarehouseStockItems", () => {
  const items = [
    {
      stock_item_id: 1,
      item_name: "Gloves",
      quantity: 4,
      lot_number: "LOT-42",
      category: "Consumables",
    },
    { stock_item_id: 2, item_name: "Masks", quantity: 0 },
    {
      stock_item_id: 3,
      item_name: "Gauze",
      quantity: 100,
      expiry_date: "2020-01-01",
    },
  ];
  const refresh = jest.fn();
  return {
    __esModule: true,
    default: () => ({ items, loading: false, error: "", refresh }),
  };
});
const transfer = {
  transfer: {
    id: 7,
    status: "Pending",
    origin_warehouse_id: 1,
    destination_warehouse_id: 2,
  },
  items: [{ id: 1, item_name: "Gloves", quantity: 5, notes: "Keep dry" }],
};
beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage("en");
  api.get.mockImplementation((url) =>
    Promise.resolve({
      data: url.includes("/warehouse-transfers/")
        ? transfer
        : url.includes("report")
          ? { departments: [] }
          : [],
    }),
  );
  api.post.mockResolvedValue({ data: {} });
});

test("inventory search matches batch metadata and attention filters select the correct rows", async () => {
  render(<WarehouseInventoryPage />);
  await waitFor(() =>
    expect(screen.queryByText("Loading report...")).not.toBeInTheDocument(),
  );
  const search = screen.getByLabelText("Search inventory");
  fireEvent.change(search, { target: { value: "LOT-42" } });
  expect(screen.getByText("Gloves")).toBeInTheDocument();
  expect(screen.queryByText("Masks")).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Reset inventory filters" }),
  );
  fireEvent.click(screen.getByRole("button", { name: /Low stock/ }));
  expect(screen.getByText("Gloves")).toBeInTheDocument();
  expect(screen.queryByText("Gauze")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Low-stock cutoff (units)"), {
    target: { value: "2" },
  });
  expect(screen.queryByText("Gloves")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Expired \/ due/ }));
  expect(screen.getByText("Gauze")).toBeInTheDocument();
  expect(screen.queryByText("Gloves")).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test("transfer decisions require a loaded pending transfer matching the current ID", async () => {
  render(<WarehouseInventoryPage />);
  const approve = screen.getByRole("button", { name: "Approve" });
  expect(approve).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Transfer ID"), {
    target: { value: "7" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load" }));
  await waitFor(() => expect(approve).toBeEnabled());
  const review = within(
    screen.getByRole("region", { name: "Loaded transfer details" }),
  );
  expect(review.getByText("Medical warehouse")).toBeInTheDocument();
  expect(review.getByText("General warehouse")).toBeInTheDocument();
  expect(review.getByText("Keep dry")).toBeInTheDocument();
  fireEvent.click(approve);
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith("/warehouse-transfers/7/approve", {
      reason: undefined,
    }),
  );
  await waitFor(() => expect(approve).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Transfer ID"), {
    target: { value: "8" },
  });
  expect(approve).toBeDisabled();
  expect(
    screen.queryByRole("region", { name: "Loaded transfer details" }),
  ).not.toBeInTheDocument();
});

test("stock attention handles invalid quantities and expiry dates without inferred thresholds", () => {
  const today = new Date(2026, 9, 8, 18);
  expect(isLowStock({ quantity: 0 }, 10)).toBe(false);
  expect(isLowStock({ quantity: 5 }, 5)).toBe(true);
  expect(isLowStock({ quantity: "invalid" }, 10)).toBe(false);
  expect(isExpiryDue({ quantity: 1, expiry_date: "2026-11-07" }, today)).toBe(
    true,
  );
  expect(isExpiryDue({ quantity: 1, expiry_date: "2026-11-08" }, today)).toBe(
    false,
  );
  expect(isExpiryDue({ quantity: 0, expiry_date: "2020-01-01" }, today)).toBe(
    false,
  );
  expect(isExpiryDue({ quantity: 1, expiry_date: "invalid" }, today)).toBe(
    false,
  );
  expect(isTransferReviewable(transfer, 8)).toBe(false);
  expect(
    isTransferReviewable({ transfer: { id: 7, status: "Approved" } }, 7),
  ).toBe(false);
});

test("an earlier load response cannot restore details after selecting a different transfer", async () => {
  let resolveTransfer;
  api.get.mockImplementation((url) =>
    url.includes("/warehouse-transfers/")
      ? new Promise((resolve) => {
          resolveTransfer = resolve;
        })
      : Promise.resolve({ data: [] }),
  );
  render(<WarehouseInventoryPage />);
  fireEvent.change(screen.getByLabelText("Transfer ID"), {
    target: { value: "7" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load" }));
  fireEvent.change(screen.getByLabelText("Transfer ID"), {
    target: { value: "8" },
  });
  await act(async () => {
    resolveTransfer({ data: transfer });
  });
  expect(
    screen.queryByRole("region", { name: "Loaded transfer details" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
});

test("Arabic stock attention controls resolve through the application translations", async () => {
  await i18n.changeLanguage("ar");
  const { container } = render(<WarehouseInventoryPage />);
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  expect(screen.getByText("متابعة المخزون")).toBeInTheDocument();
  expect(
    screen.getByLabelText("حد انخفاض المخزون (وحدات)"),
  ).toBeInTheDocument();
  expect(container.textContent).not.toContain(
    "warehouseInventory.enhancements.",
  );
});
