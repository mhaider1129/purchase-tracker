import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import i18n from "../../i18n";
import RequestItemsFocus from "./RequestItemsFocus";
import {
  filterWorkspaceItems,
  hasRemainingItemQuantity,
  needsItemIdentity,
} from "../../pages/RequestDetailWorkspace";
beforeEach(async () => {
  await i18n.changeLanguage("en");
});
test("remaining view excludes rejected and closed unpurchased items", () => {
  const items = [
    { id: 1, remaining_quantity: 2 },
    { id: 2, remaining_quantity: 4, approval_status: "Rejected" },
    { id: 3, remaining_quantity: 3, procurement_status: "not_procured" },
    { id: 4, remaining_quantity: 5, procurement_status: "cancelled" },
  ];
  expect(filterWorkspaceItems(items, "", "all", "remaining")).toEqual([
    items[0],
  ]);
  expect(hasRemainingItemQuantity({ remaining_quantity: -1 })).toBe(false);
});
test("identity view respects catalog resolution, service and approved exceptions", () => {
  expect(needsItemIdentity({ generic_item_id: 5 })).toBe(false);
  expect(needsItemIdentity({ request_mode: "service" })).toBe(false);
  expect(
    needsItemIdentity({ request_mode: "approved_free_text_exception" }),
  ).toBe(false);
  expect(needsItemIdentity({ approval_status: "Rejected" })).toBe(false);
  expect(needsItemIdentity({ request_mode: "free_text" })).toBe(true);
});
test("search spans fields and IDs and combines with status and focus", () => {
  const item = {
    item_id: 12,
    item_name: "Portable pump",
    supplier_name: "MediCo",
    generic_item_id: 77,
    remaining_quantity: 1,
    procurement_status: "pending",
  };
  expect(
    filterWorkspaceItems([item], "pump MediCo 77", "pending", "remaining"),
  ).toEqual([item]);
  expect(
    filterWorkspaceItems([item], "pump", "purchased", "remaining"),
  ).toEqual([]);
  expect(filterWorkspaceItems([item], "pump", "pending", "identity")).toEqual(
    [],
  );
});
test("counted views change focus and reset is available for an empty result", () => {
  const change = jest.fn(),
    reset = jest.fn();
  render(
    <RequestItemsFocus
      items={[{}, {}]}
      counts={{ remaining: 1, identity: 0 }}
      value="remaining"
      onChange={change}
      visibleCount={0}
      filtered
      onReset={reset}
    />,
  );
  expect(
    screen
      .getByRole("button", { name: "Remaining quantity 1" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Needs identity 0" }));
  expect(change).toHaveBeenCalledWith("identity");
  fireEvent.click(screen.getByRole("button", { name: "Clear item filters" }));
  expect(reset).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status").textContent).toBe("Showing 0 of 2 items");
});
test("Arabic view names are localized", async () => {
  await i18n.changeLanguage("ar");
  render(
    <RequestItemsFocus
      items={[]}
      counts={{ remaining: 0, identity: 0 }}
      value="all"
      onChange={() => {}}
      visibleCount={0}
      filtered={false}
      onReset={() => {}}
    />,
  );
  expect(screen.getByRole("group", { name: "طرق عرض الأصناف" })).toBeTruthy();
});
