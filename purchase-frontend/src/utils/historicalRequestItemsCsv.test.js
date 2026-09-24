import {
  historicalItemsCsvTemplate,
  parseHistoricalItemsCsv,
} from "./historicalRequestItemsCsv";

describe("historical request item CSV", () => {
  it("imports friendly header aliases and optional values", () => {
    expect(
      parseHistoricalItemsCsv(
        'Item,Qty,Unit Cost,Brand,Specifications\n"Printer, color",2,150,Acme,"A4, duplex"',
      ),
    ).toEqual([
      expect.objectContaining({
        item_name: "Printer, color",
        quantity: 2,
        unit_cost: 150,
        brand: "Acme",
        specs: "A4, duplex",
      }),
    ]);
  });

  it("reports the source row for invalid quantities", () => {
    expect(() =>
      parseHistoricalItemsCsv("item_name,quantity\nPaper,1.5"),
    ).toThrow("CSV row 2 quantity must be a whole number greater than 0.");
  });

  it("produces a template that can be imported", () => {
    expect(parseHistoricalItemsCsv(historicalItemsCsvTemplate())).toHaveLength(
      1,
    );
  });
});