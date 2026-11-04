import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "../api/axios";
import Panel from "./ProcurementItemStatusPanel";
jest.mock("../api/axios");
jest.mock("../utils/useUiTranslation", () => () => (text) => text);
jest.mock("../utils/usePageTranslation", () => {
  const tr = (key, fallback) => fallback;
  return () => tr;
});
const item = {
  id: 30,
  request_id: 20,
  item_name: "Clinical chair",
  quantity: 10,
  purchased_quantity: 4,
  remaining_quantity: 6,
  procurement_status: "partially_procured",
  unit_cost: 25,
};
beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: [] });
  axios.post.mockResolvedValue({ data: {} });
});
const open = () =>
  fireEvent.click(screen.getByRole("button", { name: "Register Procurement" }));
test("assigned inline entry records a partial purchase with the existing event payload", async () => {
  const onUpdate = jest.fn();
  render(<Panel item={item} onUpdate={onUpdate} inlineRegistration />);
  open();
  const quantity = screen.getByLabelText("Quantity purchased");
  expect(quantity).toHaveFocus();
  expect(quantity).toHaveValue(6);
  fireEvent.change(quantity, { target: { value: "2" } });
  expect(screen.getByText(/will remain open/)).toHaveTextContent(
    "2 to record · 4 will remain open",
  );
  fireEvent.change(screen.getByLabelText("Unit cost (optional)"), {
    target: { value: "30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Record purchase" }));
  await waitFor(() =>
    expect(axios.post).toHaveBeenCalledWith(
      "/requests/20/items/30/procurement-events",
      expect.objectContaining({
        event_quantity: 2,
        unit_cost: 30,
        supplier_id: null,
        procurement_note: null,
      }),
    ),
  );
  expect(onUpdate).toHaveBeenCalledTimes(1);
  expect(
    await screen.findByText("✅ Procurement entry added successfully."),
  ).toBeInTheDocument();
  expect(screen.queryByRole("form")).not.toBeInTheDocument();
});
test("invalid quantities and costs do not submit; remaining shortcut and optional fields stay available", async () => {
  axios.get.mockImplementation((url) =>
    Promise.resolve({
      data: url === "/suppliers" ? [{ id: 9, name: "Vendor" }] : [],
    }),
  );
  render(<Panel item={item} inlineRegistration />);
  open();
  await screen.findByRole("option", { name: "Vendor", hidden: true });
  fireEvent.change(screen.getByLabelText("Quantity purchased"), {
    target: { value: "7" },
  });
  expect(
    screen.getByRole("button", { name: "Record purchase" }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Quantity purchased"), {
    target: { value: "1.5" },
  });
  expect(
    screen.getByRole("button", { name: "Record purchase" }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Use remaining quantity" }),
  );
  expect(screen.getByLabelText("Quantity purchased")).toHaveValue(6);
  fireEvent.change(screen.getByLabelText("Unit cost (optional)"), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByText("Supplier, purchase date and note"));
  fireEvent.change(screen.getByLabelText("Supplier (optional)"), {
    target: { value: "9" },
  });
  fireEvent.change(screen.getByLabelText("Procurement date"), {
    target: { value: "2026-11-03" },
  });
  fireEvent.change(screen.getByLabelText("Note (optional)"), {
    target: { value: "Delivery confirmed" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Record purchase" }));
  await waitFor(() =>
    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        event_quantity: 6,
        unit_cost: null,
        supplier_id: "9",
        procurement_date: "2026-11-03",
        procurement_note: "Delivery confirmed",
      }),
    ),
  );
});
test("failed saves retain input and show the server control failure beside the form", async () => {
  axios.post.mockRejectedValue({
    response: { data: { message: "Technical clearance required" } },
  });
  render(<Panel item={item} inlineRegistration />);
  open();
  fireEvent.change(screen.getByLabelText("Quantity purchased"), {
    target: { value: "3" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Record purchase" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Technical clearance required",
  );
  expect(screen.getByLabelText("Quantity purchased")).toHaveValue(3);
});
test("saving disables editing, cancellation and repeated registration", async () => {
  let finish;
  axios.post.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<Panel item={item} inlineRegistration />);
  open();
  fireEvent.click(screen.getByRole("button", { name: "Record purchase" }));
  expect(screen.getByLabelText("Quantity purchased")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Hide entry" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Saving…" }));
  expect(axios.post).toHaveBeenCalledTimes(1);
  finish({ data: {} });
  await screen.findByText("✅ Procurement entry added successfully.");
});
test.each([
  { ...item, supports_procurement_events: false },
  { ...item, remaining_quantity: 0 },
])("unavailable entry remains disabled", (row) => {
  render(<Panel item={row} inlineRegistration />);
  expect(
    screen.getByRole("button", { name: "Register Procurement" }),
  ).toBeDisabled();
});
