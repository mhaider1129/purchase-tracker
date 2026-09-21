import { getRequestProgress, sortAssignedRequests } from "./assignedRequests";

describe("assigned request presentation helpers", () => {
  test("calculates progress from all finalized items", () => {
    expect(
      getRequestProgress({
        status_summary: {
          total_items: 4,
          purchased_count: 2,
          not_procured_count: 1,
        },
      }),
    ).toBe(75);
    expect(getRequestProgress({ status_summary: { total_items: 0 } })).toBe(0);
  });

  test("sorts urgent requests first without mutating the source collection", () => {
    const requests = [
      { id: 1, is_urgent: false, created_at: "2026-01-01" },
      { id: 2, is_urgent: true, created_at: "2026-01-02" },
    ];

    expect(sortAssignedRequests(requests).map(({ id }) => id)).toEqual([2, 1]);
    expect(requests.map(({ id }) => id)).toEqual([1, 2]);
  });

  test("supports progress and date ordering", () => {
    const requests = [
      {
        id: 1,
        created_at: "2026-01-01",
        status_summary: { total_items: 4, purchased_count: 1 },
      },
      {
        id: 2,
        created_at: "2026-01-02",
        status_summary: { total_items: 4, purchased_count: 3 },
      },
    ];

    expect(
      sortAssignedRequests(requests, "progress").map(({ id }) => id),
    ).toEqual([2, 1]);
    expect(
      sortAssignedRequests(requests, "oldest").map(({ id }) => id),
    ).toEqual([1, 2]);
    expect(
      sortAssignedRequests(requests, "newest").map(({ id }) => id),
    ).toEqual([2, 1]);
  });
});