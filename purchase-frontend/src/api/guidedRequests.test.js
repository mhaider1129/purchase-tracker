import api from "./axios";
import { submitGuidedRequest, searchGuidedItems } from "./guidedRequests";
jest.mock("./axios", () => ({ get: jest.fn(), post: jest.fn() }));
test("submission uses canonical authenticated client and multipart attachment fields", async () => {
  const payload = {
    family: "general",
    client_submission_key: "guided-fixture-123",
  };
  const file = new File(["fixture evidence"], "evidence.pdf", {
    type: "application/pdf",
  });
  api.post.mockResolvedValue({ data: { request_id: 1 } });
  await expect(submitGuidedRequest(payload, [file])).resolves.toEqual({
    request_id: 1,
  });
  const [path, body] = api.post.mock.calls[0];
  expect(path).toBe("/requests/guided");
  expect(JSON.parse(body.get("payload"))).toEqual(payload);
  expect(body.getAll("attachments")).toEqual([file]);
  expect(api.post.mock.calls[0]).toHaveLength(2);
});
test("catalog search sends no client institute or availability data", async () => {
  api.get.mockResolvedValue({ data: { data: [] } });
  await searchGuidedItems({ q: "needle", institute_id: 999 });
  expect(api.get).toHaveBeenCalledWith("/requests/guided/catalog", {
    params: { q: "needle" },
  });
});
