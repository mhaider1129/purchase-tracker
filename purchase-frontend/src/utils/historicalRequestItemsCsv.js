import Papa from "papaparse";

export const HISTORICAL_ITEM_COLUMNS = [
  "item_name",
  "brand",
  "quantity",
  "unit_cost",
  "available_quantity",
  "intended_use",
  "specs",
];

const HEADER_ALIASES = {
  item: "item_name",
  name: "item_name",
  "item name": "item_name",
  item_name: "item_name",
  brand: "brand",
  quantity: "quantity",
  qty: "quantity",
  "unit cost": "unit_cost",
  unit_cost: "unit_cost",
  price: "unit_cost",
  "available quantity": "available_quantity",
  available_quantity: "available_quantity",
  "intended use": "intended_use",
  intended_use: "intended_use",
  specifications: "specs",
  specification: "specs",
  specs: "specs",
};

const normalizeHeader = (header) =>
  String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ");

const canonicalHeader = (header) => HEADER_ALIASES[normalizeHeader(header)];

export const parseHistoricalItemsCsv = (contents) => {
  const parsed = Papa.parse(contents, { skipEmptyLines: "greedy" });
  if (parsed.errors.length) {
    throw new Error(
      `CSV row ${parsed.errors[0].row + 1}: ${parsed.errors[0].message}`,
    );
  }
  if (parsed.data.length < 2)
    throw new Error("The CSV must include a header and at least one item.");

  const headers = parsed.data[0].map(canonicalHeader);
  const nameIndex = headers.indexOf("item_name");
  const quantityIndex = headers.indexOf("quantity");
  if (nameIndex < 0 || quantityIndex < 0) {
    throw new Error(
      "The CSV must include item_name (or item) and quantity columns.",
    );
  }

  const rows = parsed.data.slice(1).map((values, index) => {
    const row = Object.fromEntries(
      HISTORICAL_ITEM_COLUMNS.map((column) => [column, ""]),
    );
    headers.forEach((header, columnIndex) => {
      if (header) row[header] = String(values[columnIndex] ?? "").trim();
    });

    if (!row.item_name)
      throw new Error(`CSV row ${index + 2} is missing an item name.`);
    const quantity = Number(row.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(
        `CSV row ${index + 2} quantity must be a whole number greater than 0.`,
      );
    }
    row.quantity = quantity;

    ["unit_cost", "available_quantity"].forEach((field) => {
      if (row[field] === "") return;
      const value = Number(row[field]);
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(
          `CSV row ${index + 2} ${field} must be a non-negative whole number.`,
        );
      }
      row[field] = value;
    });
    return row;
  });

  return rows;
};

export const historicalItemsCsvTemplate = () =>
  Papa.unparse([
    HISTORICAL_ITEM_COLUMNS,
    [
      "Example item",
      "Example brand",
      1,
      0,
      0,
      "Department use",
      "Paper form details",
    ],
  ]);