import {
  getNotificationDestinationKey,
  resolveNotificationDestination,
} from "./NotificationBell";

describe("notification navigation", () => {
  test("opens an assigned request in its workstation", () => {
    expect(
      resolveNotificationDestination({
        link: "/requests/42",
        metadata: { action: "procurement_assignment", requestId: 42 },
      }),
    ).toEqual({ path: "/requests/42" });
  });

  test("groups approval notifications by their shared destination page", () => {
    const first = {
      metadata: { action: "approval_required", requestId: 10 },
    };
    const second = {
      metadata: { action: "approval_required", requestId: 20 },
    };

    expect(getNotificationDestinationKey(first)).toBe("/approvals");
    expect(getNotificationDestinationKey(second)).toBe("/approvals");
  });

  test("does not group assignments for different request workstations", () => {
    const first = {
      metadata: { action: "procurement_assignment", requestId: 10 },
    };
    const second = {
      metadata: { action: "procurement_assignment", requestId: 20 },
    };

    expect(getNotificationDestinationKey(first)).not.toBe(
      getNotificationDestinationKey(second),
    );
  });
});