import {
  isApplicationNotFound,
  isDefinitiveAuthenticationFailure,
} from "./axios";

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

describe("authentication failure classification", () => {
  test("does not end the session for a generic feature-endpoint 401", () => {
    expect(
      isDefinitiveAuthenticationFailure({
        config: { url: "/approval-policies/12" },
        response: { status: 401, data: { message: "Unauthorized" } },
      }),
    ).toBe(false);
  });

  test("recognizes authoritative token failures and auth session checks", () => {
    expect(
      isDefinitiveAuthenticationFailure({
        config: { url: "/approval-policies/12" },
        response: { status: 401, data: { code: "INVALID_TOKEN" } },
      }),
    ).toBe(true);
    expect(
      isDefinitiveAuthenticationFailure({
        config: { url: "/auth/me" },
        response: { status: 401, data: { message: "Unauthorized" } },
      }),
    ).toBe(true);
  });
});