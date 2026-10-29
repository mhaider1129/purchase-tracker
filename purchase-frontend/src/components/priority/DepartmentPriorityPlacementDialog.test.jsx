import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DepartmentPriorityPlacementDialog from "./DepartmentPriorityPlacementDialog";
import axios from "../../api/axios";
jest.mock("../../api/axios", () => ({
  get: jest.fn(),
  put: jest.fn(),
  post: jest.fn(),
}));
const row = (id, title) => ({
  request_id: id,
  request_reference: `PR-${id}`,
  public_title: title,
  item_count: id === 3 ? 4 : 1,
  snapshot: { rank_version: "2", cases: { [id + 100]: "1" } },
});
const queue = [
  row(1, "Existing first"),
  row(2, "Existing second"),
  row(3, "New surgical equipment"),
];
const gate = { requestId: 3, queue };
beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: { data: gate } });
  axios.put.mockResolvedValue({ data: {} });
  axios.post.mockResolvedValue({ data: {} });
});

test("new request starts separately and must be placed; drag inserts the whole request without reversing existing priorities", async () => {
  const complete = jest.fn();
  render(
    <DepartmentPriorityPlacementDialog approvalId={33} onComplete={complete} />,
  );
  await screen.findByLabelText("Newly approved request");
  expect(
    screen.getByRole("button", { name: "Save department priority" }),
  ).toBeDisabled();
  const transfer = { setData: jest.fn(), getData: jest.fn(() => "3") };
  fireEvent.dragStart(screen.getByLabelText("Newly approved request"), {
    dataTransfer: transfer,
  });
  expect(transfer.setData).toHaveBeenCalledWith("text/plain", "3");
  fireEvent.drop(screen.getByLabelText("Place new request at priority 2"), {
    dataTransfer: transfer,
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save department priority" }),
  );
  await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
  expect(axios.put).toHaveBeenCalledWith(
    "/procurement-priority/requests/department/order",
    {
      ordered_request_ids: [1, 3, 2],
      snapshots: Object.fromEntries(
        queue.map((row) => [row.request_id, row.snapshot]),
      ),
    },
  );
  expect(axios.post).not.toHaveBeenCalled();
});
test("touch/keyboard placement works in an empty department and the gate continues only after a successful save", async () => {
  axios.get.mockResolvedValue({
    data: { data: { requestId: 3, queue: [queue[2]] } },
  });
  const complete = jest.fn();
  render(
    <DepartmentPriorityPlacementDialog
      approvalId={33}
      continueApproval
      onComplete={complete}
    />,
  );
  await screen.findByText(/first active approved request/);
  fireEvent.change(screen.getByLabelText("Priority position"), {
    target: { value: "0" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save priority and continue approval" }),
  );
  await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
  expect(axios.post).toHaveBeenCalledWith(
    "/approvals/33/department-ranking",
    expect.objectContaining({ ordered_request_ids: [3] }),
  );
});
test("a completion/concurrent change rejects the stale save and reload requires a fresh deliberate placement", async () => {
  axios.put.mockRejectedValueOnce({
    response: { status: 409, data: { message: "Queue changed" } },
  });
  const complete = jest.fn();
  render(
    <DepartmentPriorityPlacementDialog approvalId={33} onComplete={complete} />,
  );
  await screen.findByLabelText("Newly approved request");
  fireEvent.click(screen.getByLabelText("Place new request at priority 1"));
  fireEvent.click(
    screen.getByRole("button", { name: "Save department priority" }),
  );
  await screen.findByText("Queue changed");
  expect(complete).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Save department priority" }),
  ).toBeDisabled();
  axios.get.mockResolvedValueOnce({
    data: { data: { requestId: 3, queue: [queue[1], queue[2]] } },
  });
  fireEvent.click(screen.getByRole("button", { name: "Reload current list" }));
  await waitFor(() =>
    expect(screen.queryByText(/#PR-1/)).not.toBeInTheDocument(),
  );
  expect(
    screen.getByRole("button", { name: "Save department priority" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByLabelText("Place new request at priority 2"));
  fireEvent.click(
    screen.getByRole("button", { name: "Save department priority" }),
  );
  await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
  expect(axios.put.mock.calls[1][1].ordered_request_ids).toEqual([2, 3]);
});
test("load failure is visible and retryable; no rank can be saved from the old approval response", async () => {
  axios.get.mockRejectedValueOnce(new Error("Unable to load"));
  render(
    <DepartmentPriorityPlacementDialog
      approvalId={33}
      onComplete={jest.fn()}
    />,
  );
  await screen.findByRole("alert");
  expect(
    screen.getByRole("button", { name: "Save department priority" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Reload current list" }));
  await screen.findByLabelText("Newly approved request");
  expect(axios.put).not.toHaveBeenCalled();
});
test("a request fulfilled while the popup opens exits without writing a rank", async () => {
  axios.get.mockResolvedValueOnce({ data: { data: null } });
  const complete = jest.fn();
  render(
    <DepartmentPriorityPlacementDialog approvalId={33} onComplete={complete} />,
  );
  await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
  expect(axios.put).not.toHaveBeenCalled();
});
