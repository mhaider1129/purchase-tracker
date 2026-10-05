import {
  withRequestItemIdentity,
  stableRequestItemId,
} from "./requestItemIdentity";
test("omitted mode becomes unresolved without dropping identity fields", () => {
  expect(
    withRequestItemIdentity({
      item_name: "Demand",
      quantity: 1,
      required_date: "2026-11-01",
    }),
  ).toMatchObject({
    request_mode: "free_text",
    catalog_status: "pending_mapping",
    required_date: "2026-11-01",
  });
});
test.each([
  ["generic_item", "catalogued"],
  ["generic_item_with_preference", "catalogued"],
  ["specific_approved_product", "catalogued"],
  ["free_text", "pending_mapping"],
  ["pending_item_creation", "pending_mapping"],
  ["approved_free_text_exception", "approved_exception"],
  ["service", "approved_exception"],
])(
  "preserves %s semantics and derives status",
  (request_mode, catalog_status) => {
    expect(
      withRequestItemIdentity({
        request_mode,
        generic_item_id: 4,
        preferred_product_id: 8,
        restriction_justification: "Reason",
        catalog_status: "forged",
      }),
    ).toMatchObject({
      request_mode,
      catalog_status,
      generic_item_id: 4,
      preferred_product_id: 8,
      restriction_justification: "Reason",
    });
  },
);
test("edits retain stable IDs and do not assign new identity to historical lines", () => {
  expect(stableRequestItemId({ id: 22, request_mode: null })).toEqual({
    id: 22,
  });
  expect(stableRequestItemId({ item_id: 33 })).toEqual({ id: 33 });
});
