import api from "./axios";
import { getPriorityManagementQueue } from "./procurementPriority";
jest.mock("./axios", () => ({ get: jest.fn() }));
test("queue cancellation is passed through the canonical authenticated API client", async () => {
  api.get.mockResolvedValue({ data: { data: [] } });
  const controller = new AbortController();
  await expect(
    getPriorityManagementQueue(undefined, { signal: controller.signal }),
  ).resolves.toEqual({ data: [] });
  expect(api.get).toHaveBeenCalledWith(
    "/procurement-priority/requests/manage",
    { params: undefined, signal: controller.signal },
  );
});
