import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DepartmentRequestedItemsBoard from "./DepartmentRequestedItemsBoard";
import api from "../api/axios";
import {
  getDepartmentRequestedItems,
  previewDepartmentFollowUpMessage,
} from "../api/departmentRequestedItems";

jest.mock("../api/axios", () => ({ get: jest.fn() }));
jest.mock("../api/departmentRequestedItems", () => ({
  getDepartmentRequestedItems: jest.fn(),
  previewDepartmentFollowUpMessage: jest.fn(),
  saveDepartmentFollowUpNote: jest.fn(),
}));

const items = [
  { item_id: 11, request_id: 101, request_number: "101", department_id: 1, department_name: "Clinical", section_name: "Ward", requester_name: "Amina", item_name: "Infusion pump", requested_quantity: 4, purchased_quantity: 1, remaining_quantity: 3, procurement_status: "pending", days_since_request: 8, overdue_flag: true },
  { item_id: 12, request_id: 102, request_number: "102", department_id: 2, department_name: "IT", section_name: "Support", requester_name: "Sam", item_name: "Laptop", requested_quantity: 2, purchased_quantity: 0, remaining_quantity: 2, procurement_status: "pending", days_since_request: 2 },
];

const response = {
  data: items,
  grouped: [
    { department_id: 1, department_name: "Clinical", open_items_count: 1, overdue_count: 1, emergency_count: 0, partially_procured_count: 1, items: [items[0]] },
    { department_id: 2, department_name: "IT", open_items_count: 1, overdue_count: 0, emergency_count: 0, partially_procured_count: 0, items: [items[1]] },
  ],
  summary: { total_open_items: 2, total_departments: 2, overdue_items: 1, emergency_items: 0, partially_procured_items: 1 },
  pagination: { page: 1, limit: 100, total: 2, total_pages: 1 },
};

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue({ data: [] });
  getDepartmentRequestedItems.mockResolvedValue(response);
  previewDepartmentFollowUpMessage.mockResolvedValue({ message: "Please confirm pending items." });
});

const show = () => render(<MemoryRouter><DepartmentRequestedItemsBoard /></MemoryRouter>);

test("supports server-side sorting and bulk selection", async () => {
  show();
  expect(await screen.findByText("Infusion pump")).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Sort requested items"), "remaining_quantity");
  await waitFor(() => expect(getDepartmentRequestedItems).toHaveBeenLastCalledWith(expect.objectContaining({ sort_by: "remaining_quantity", sort_dir: "asc" })));
  await waitFor(() => expect(screen.queryByText("Loading department requested items...")).not.toBeInTheDocument());
  await userEvent.click(screen.getAllByLabelText("Select all items in this table")[0]);
  expect(screen.getByRole("status", { name: "1 item selected" })).toHaveTextContent("item selected");
});

test("prevents a follow-up message from mixing departments", async () => {
  show();
  await screen.findByText("Infusion pump");
  await userEvent.click(screen.getByLabelText("Select Infusion pump"));
  await userEvent.click(screen.getByLabelText("Select Laptop"));
  await userEvent.click(screen.getByRole("button", { name: "Prepare message" }));
  expect(screen.getByText(/only include items from one department/i)).toBeInTheDocument();
  expect(previewDepartmentFollowUpMessage).not.toHaveBeenCalled();
});