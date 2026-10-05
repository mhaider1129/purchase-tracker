import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import RequestItemIdentityFields from "./RequestItemIdentityFields";
import { searchApprovedProducts } from "../../api/itemMaster";
jest.mock("./GenericItemSelector", () => ({ value, onChange }) => (
  <button
    onClick={() =>
      onChange({
        generic_item_id: 4,
        request_mode: "generic_item",
        catalog_status: "catalogued",
      })
    }
  >
    Select Generic
  </button>
));
jest.mock("../../api/itemMaster", () => ({
  searchApprovedProducts: jest.fn(),
}));
beforeEach(() => searchApprovedProducts.mockReset());
test("ordinary requester cannot choose an approved exception", () => {
  render(
    <RequestItemIdentityFields
      value={{}}
      onChange={jest.fn()}
      user={{ permissions: [] }}
    />,
  );
  expect(
    screen.queryByRole("option", { name: "Authorized catalog exception" }),
  ).not.toBeInTheDocument();
});
test("service choice explicitly clears physical identity and classifies services", () => {
  const onChange = jest.fn();
  render(<RequestItemIdentityFields value={{}} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("Item identity mode"), {
    target: { value: "service" },
  });
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      request_mode: "service",
      catalog_status: "approved_exception",
      generic_item_id: null,
      stocking_policy: "service",
    }),
  );
});
test("Generic selection preserves preference rather than introducing a mandatory restriction", () => {
  const onChange = jest.fn();
  render(
    <RequestItemIdentityFields
      value={{ request_mode: "generic_item_with_preference" }}
      onChange={onChange}
    />,
  );
  fireEvent.click(screen.getByText("Select Generic"));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      generic_item_id: 4,
      request_mode: "generic_item_with_preference",
      mandatory_product_id: null,
    }),
  );
});
test("Product selector uses active approved products of the chosen Generic", async () => {
  searchApprovedProducts.mockResolvedValue({
    data: [
      {
        id: 8,
        product_name: "Approved",
        is_active: true,
        approval_status: "approved",
      },
      {
        id: 9,
        product_name: "Inactive",
        is_active: false,
        approval_status: "approved",
      },
    ],
  });
  const onChange = jest.fn();
  render(
    <RequestItemIdentityFields
      value={{ request_mode: "specific_approved_product", generic_item_id: 4 }}
      onChange={onChange}
    />,
  );
  expect(
    await screen.findByRole("option", { name: "Approved" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("option", { name: "Inactive" }),
  ).not.toBeInTheDocument();
  expect(searchApprovedProducts).toHaveBeenCalledWith(
    expect.objectContaining({
      generic_item_id: 4,
      approval_status: "approved",
    }),
  );
  fireEvent.change(screen.getByLabelText("Required approved Product"), {
    target: { value: "8" },
  });
  expect(onChange).toHaveBeenCalledWith({ mandatory_product_id: 8 });
});
