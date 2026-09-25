import { isApplicationNotFound } from "./axios";

describe("API fallback error classification", () => {
  test("recognizes resource-level API 404 responses", () => {
    expect(
      isApplicationNotFound({
        response: { status: 404, data: { error: "Policy not found" } },
      }),
    ).toBe(true);
    expect(
      isApplicationNotFound({
        response: { status: 404, data: { message: "Policy not found" } },
      }),
    ).toBe(true);
  });

  test("allows mount discovery for generic route and proxy 404 responses", () => {
    expect(
      isApplicationNotFound({
        response: {
          status: 404,
          data: { success: false, message: "Route not found" },
        },
      }),
    ).toBe(false);
    expect(
      isApplicationNotFound({ response: { status: 404, data: "Not Found" } }),
    ).toBe(false);
  });
});