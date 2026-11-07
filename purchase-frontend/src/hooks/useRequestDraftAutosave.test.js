import { act, renderHook } from "@testing-library/react";
import useRequestDraftAutosave from "./useRequestDraftAutosave";
beforeEach(() => {
  window.localStorage.clear();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
test("clearing a submitted draft cancels a queued save", () => {
  const { result } = renderHook(() =>
    useRequestDraftAutosave({
      storageKey: "draft-account-fixture",
      data: { justification: "Draft evidence" },
    }),
  );
  act(() => result.current.clearDraft());
  act(() => jest.advanceTimersByTime(1000));
  expect(window.localStorage.getItem("draft-account-fixture")).toBeNull();
});
test("manual save persists immediately and reports storage failures", () => {
  const { result } = renderHook(() =>
    useRequestDraftAutosave({
      storageKey: "draft-account-fixture",
      data: { justification: "Draft evidence" },
    }),
  );
  act(() => result.current.saveDraft());
  expect(
    JSON.parse(window.localStorage.getItem("draft-account-fixture"))
      .justification,
  ).toBe("Draft evidence");
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  act(() => result.current.saveDraft());
  expect(result.current.status).toBe("error");
});
