import { renderHook, act } from "@testing-library/react";
import useRequestListPagination from "./useRequestListPagination";
const items = Array.from({ length: 23 }, (_, id) => ({ id }));
test("paginates filtered records and resets when filters or sort change", () => {
  const { result, rerender } = renderHook(
    ({ list, filters }) => useRequestListPagination(list, filters),
    { initialProps: { list: items, filters: "all" } },
  );
  expect(result.current.paginatedItems).toHaveLength(10);
  act(() => result.current.setPage(3));
  expect(result.current.paginatedItems.map((x) => x.id)).toEqual([20, 21, 22]);
  rerender({ list: [...items], filters: "all" });
  expect(result.current.currentPage).toBe(3);
  rerender({ list: items.slice(0, 11), filters: "urgent" });
  expect(result.current.currentPage).toBe(1);
});
test("shrinking results clamp the current page without leaving an empty page", () => {
  const { result, rerender } = renderHook(
    ({ list }) => useRequestListPagination(list, "all"),
    { initialProps: { list: items } },
  );
  act(() => result.current.setPage(3));
  rerender({ list: items.slice(0, 12) });
  expect(result.current.currentPage).toBe(2);
  expect(result.current.paginatedItems).toHaveLength(2);
  rerender({ list: [] });
  expect(result.current.currentPage).toBe(1);
  expect(result.current.paginatedItems).toHaveLength(0);
});
