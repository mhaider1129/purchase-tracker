const ORIGINAL_ENV = process.env;

const loadClient = ({ nodeEnv = "test", override } = {}) => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, NODE_ENV: nodeEnv };
  delete process.env.REACT_APP_API_BASE_URL;
  delete process.env.REACT_APP_API_BASE;
  delete process.env.REACT_APP_API_URL;
  if (override !== undefined) process.env.REACT_APP_API_BASE_URL = override;
  return require("./axios");
};

const requestInterceptor = (api) => api.interceptors.request.handlers[0].fulfilled;
const responseSuccessInterceptor = (api) => api.interceptors.response.handlers[0].fulfilled;
const responseErrorInterceptor = (api) => api.interceptors.response.handlers[0].rejected;

describe("canonical API client", () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test("uses the browser hostname and backend port in development", () => {
    const { API_BASE } = loadClient({ nodeEnv: "development" });
    expect(API_BASE).toBe(`${window.location.protocol}//${window.location.hostname}:5000/api`);
  });

  test("uses the same-origin /api mount in production", () => {
    expect(loadClient({ nodeEnv: "production" }).API_BASE).toBe("/api");
  });

  test("honors and normalizes an environment override", () => {
    expect(
      loadClient({ nodeEnv: "production", override: "https://api.example.test/custom///" }).API_BASE,
    ).toBe("https://api.example.test/custom");
  });

  test("injects the JWT authorization header", () => {
    const { default: api } = loadClient();
    localStorage.setItem("token", "jwt-value");
    const config = requestInterceptor(api)({ headers: {}, method: "get" });
    expect(config.headers.Authorization).toBe("Bearer jwt-value");
  });

  test("leaves FormData content type unset so Axios can add its boundary", () => {
    const { default: api } = loadClient();
    const headers = { "Content-Type": "application/json" };
    requestInterceptor(api)({ headers, method: "post", data: new FormData() });
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers["content-type"]).toBeUndefined();
  });

  test("uses JSON content type for normal requests", () => {
    const { default: api } = loadClient();
    const config = requestInterceptor(api)({ headers: {}, method: "post", data: { name: "test" } });
    expect(config.headers["Content-Type"]).toBe("application/json");
  });

  test("announces successful and failed mutating actions but mutes notification polling", async () => {
    const { default: api, API_ACTION_NOTIFICATION_EVENT } = loadClient();
    const listener = jest.fn();
    window.addEventListener(API_ACTION_NOTIFICATION_EVENT, listener);

    responseSuccessInterceptor(api)({ config: { method: "post", url: "/suppliers" }, data: { message: "Saved" } });
    await expect(
      responseErrorInterceptor(api)({
        config: { method: "delete", url: "/suppliers/1" },
        response: { status: 400, data: { message: "Cannot delete" } },
      }),
    ).rejects.toBeDefined();
    responseSuccessInterceptor(api)({ config: { method: "patch", url: "/notifications/1/read" }, data: {} });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[0][0].detail).toMatchObject({ type: "success", message: "Saved" });
    expect(listener.mock.calls[1][0].detail).toMatchObject({ type: "error", message: "Cannot delete" });
    window.removeEventListener(API_ACTION_NOTIFICATION_EVENT, listener);
  });

  test.each([
    [404, { message: "Route not found" }],
    [401, { message: "Unauthorized" }],
  ])("does not retry requests after HTTP %s", async (status, data) => {
    const { default: api } = loadClient();
    const request = jest.spyOn(api, "request");
    const error = { config: { method: "get", url: "/contracts" }, response: { status, data } };
    await expect(responseErrorInterceptor(api)(error)).rejects.toBe(error);
    expect(request).not.toHaveBeenCalled();
    expect(api.defaults.baseURL).toBe("/api");
  });

  test("recognizes only authoritative authentication failures", () => {
    const { isDefinitiveAuthenticationFailure } = loadClient();
    expect(isDefinitiveAuthenticationFailure({
      config: { url: "/contracts" },
      response: { status: 401, data: { message: "Unauthorized" } },
    })).toBe(false);
    expect(isDefinitiveAuthenticationFailure({
      config: { url: "/contracts" },
      response: { status: 401, data: { code: "INVALID_TOKEN" } },
    })).toBe(true);
    expect(isDefinitiveAuthenticationFailure({
      config: { url: "/auth/me" },
      response: { status: 401, data: {} },
    })).toBe(true);
  });

  test("removes the token and redirects after a definitive authentication failure", async () => {
    const { default: api } = loadClient();
    localStorage.setItem("token", "expired");
    const originalWindow = global.window;
    const fakeWindow = { location: { href: "/current" }, dispatchEvent: jest.fn() };
    Object.defineProperty(global, "window", { configurable: true, value: fakeWindow });
    const error = {
      config: { method: "get", url: "/auth/me" },
      response: { status: 401, data: { message: "Unauthorized" } },
    };

    await expect(responseErrorInterceptor(api)(error)).rejects.toBe(error);
    expect(localStorage.getItem("token")).toBeNull();
    expect(fakeWindow.location.href).toBe("/login");
    Object.defineProperty(global, "window", { configurable: true, value: originalWindow });
  });

  test("replaces an HTTP 413 response with the friendly upload-size message", async () => {
    const { default: api } = loadClient();
    const error = {
      config: { method: "post", url: "/attachments" },
      response: { status: 413, data: "Payload Too Large" },
    };
    await expect(responseErrorInterceptor(api)(error)).rejects.toBe(error);
    expect(error.response.data.message).toMatch(/Request is too large/);
  });

  test("preserves canceled request errors", async () => {
    const { default: api } = loadClient();
    const error = { code: "ERR_CANCELED", config: { method: "get", url: "/requests" } };
    await expect(responseErrorInterceptor(api)(error)).rejects.toBe(error);
  });
});