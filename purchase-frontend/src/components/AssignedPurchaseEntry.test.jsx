import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Entry from "./AssignedPurchaseEntry";
import axios from "../api/axios";
jest.mock("../api/axios");
const items = [
  { id: 1, item_name: "Chair", quantity: 10, purchased_quantity: 4 },
  { id: 2, item_name: "Desk", quantity: 2, purchased_quantity: 0 },
];
beforeEach(() => {
  jest.clearAllMocks();
  axios.post.mockResolvedValue({ data: {} });
});
const fill = () => {
  fireEvent.change(screen.getByLabelText("Unit cost for Chair"), {
    target: { value: "30" },
  });
  fireEvent.change(screen.getByLabelText("Unit cost for Desk"), {
    target: { value: "40" },
  });
};
test("costs are required and all selected purchases save from a single form", async () => {
  const refresh = jest.fn();
  render(<Entry requestId={10} items={items} onUpdate={refresh} />);
  expect(
    screen.getByRole("button", { name: "Save purchased quantities and costs" }),
  ).toBeDisabled();
  expect(screen.getByLabelText("Quantity purchased for Chair")).toHaveValue(6);
  expect(screen.getByLabelText("Unit cost for Chair")).toBeRequired();
  fill();
  fireEvent.change(screen.getByLabelText("Quantity purchased for Chair"), {
    target: { value: "2" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save purchased quantities and costs" }),
  );
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(axios.post).toHaveBeenNthCalledWith(
    1,
    "/requests/10/items/1/procurement-events",
    expect.objectContaining({ event_quantity: 2, unit_cost: 30 }),
  );
  expect(axios.post).toHaveBeenNthCalledWith(
    2,
    "/requests/10/items/2/procurement-events",
    expect.objectContaining({ event_quantity: 2, unit_cost: 40 }),
  );
});
test("unchecked items do not need a cost; zero is an explicit valid free purchase", async () => {
  render(<Entry requestId={10} items={items} onUpdate={jest.fn()} />);
  fireEvent.click(screen.getByLabelText("Include Desk"));
  fireEvent.change(screen.getByLabelText("Unit cost for Chair"), {
    target: { value: "0" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save purchased quantities and costs" }),
  );
  await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
  expect(axios.post).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ unit_cost: 0 }),
  );
});
test("partial failures report saved entries and prevent replay until quantities are reloaded", async () => {
  axios.post
    .mockResolvedValueOnce({ data: {} })
    .mockRejectedValueOnce(new Error("Network"));
  const refresh = jest.fn();
  render(<Entry requestId={10} items={items} onUpdate={refresh} />);
  fill();
  fireEvent.click(
    screen.getByRole("button", { name: "Save purchased quantities and costs" }),
  );
  expect(await screen.findByText("Chair: Saved")).toBeInTheDocument();
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Earlier successful purchases remain saved",
  );
  expect(
    screen.queryByRole("button", {
      name: "Save purchased quantities and costs",
    }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Unit cost for Chair")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Reload quantities" }));
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(axios.post).toHaveBeenCalledTimes(2);
});
test("over-remaining and fractional quantities block saving", () => {
  render(<Entry requestId={10} items={items} onUpdate={jest.fn()} />);
  fill();
  for (const value of ["7", "1.5", "0"]) {
    fireEvent.change(screen.getByLabelText("Quantity purchased for Chair"), {
      target: { value },
    });
    expect(
      screen.getByRole("button", {
        name: "Save purchased quantities and costs",
      }),
    ).toBeDisabled();
  }
  expect(axios.post).not.toHaveBeenCalled();
});

test("an in-progress save cannot be submitted twice", async () => {
  let finish;
  axios.post.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const refresh = jest.fn();
  render(<Entry requestId={10} items={items} onUpdate={refresh} />);
  fill();
  const form = screen.getByRole("form", { name: "Record request purchases" });
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Unit cost for Chair")).toBeDisabled();
  finish({ data: {} });
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(axios.post).toHaveBeenCalledTimes(2);
});
