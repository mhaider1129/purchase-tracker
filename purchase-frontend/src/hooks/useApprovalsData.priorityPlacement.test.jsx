import { renderHook, act, waitFor } from "@testing-library/react";
import useApprovalsData from "./useApprovalsData";
import axios from "../api/axios";
jest.mock("../api/axios", () => ({ get: jest.fn(), put: jest.fn() }));
const rows = [
  {
    request_id: 41,
    approval_id: 81,
    department_id: 9,
    approval_status: "Pending",
  },
  {
    request_id: 42,
    approval_id: 82,
    department_id: 9,
    approval_status: "Pending",
  },
];
let confirm, alert;
beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: rows });
  axios.put.mockResolvedValue({ data: {} });
  confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
  alert = jest.spyOn(window, "alert").mockImplementation(() => {});
});
afterEach(() => {
  confirm.mockRestore();
  alert.mockRestore();
});
async function decide(result, id = 81, requestId = 41, decision = "Approved") {
  act(() => result.current.openCommentModal(id, requestId, decision));
  await act(async () => result.current.submitDecision());
}
test("a successful own-department HOD approval opens priority placement after the decision completes", async () => {
  const user = { id: 5, role: "HOD", department_id: 9 };
  const { result } = renderHook(() => useApprovalsData(user));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await decide(result);
  expect(axios.put).toHaveBeenCalledWith(
    "/requests/approval/81",
    expect.objectContaining({ status: "Approved" }),
  );
  expect(result.current.priorityPlacementApprovalId).toBe(81);
  expect(result.current.showCommentBox).toBe(false);
  // A second decision is queued rather than replacing an unsaved placement.
  await decide(result, 82, 42);
  expect(result.current.priorityPlacementApprovalId).toBe(81);
  act(() => result.current.completePriorityPlacement());
  expect(result.current.priorityPlacementApprovalId).toBe(82);
});
test.each([
  ["HOD", 10, "Approved"],
  ["SCM", 9, "Approved"],
  ["HOD", 9, "Rejected"],
])(
  "%s/%s/%s does not create a departmental HOD placement",
  async (role, department_id, decision) => {
    const user = { id: 5, role, department_id };
    const { result } = renderHook(() => useApprovalsData(user));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await decide(result, 81, 41, decision);
    expect(result.current.priorityPlacementApprovalId).toBeNull();
  },
);
test("a failed approval never opens placement or removes the undecided request", async () => {
  axios.put.mockRejectedValueOnce({
    response: { status: 409, data: { message: "Already changed" } },
  });
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  const user = { id: 5, role: "HOD", department_id: 9 };
  const { result } = renderHook(() => useApprovalsData(user));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await decide(result);
  expect(result.current.priorityPlacementApprovalId).toBeNull();
  expect(result.current.requests).toHaveLength(2);
  log.mockRestore();
});
