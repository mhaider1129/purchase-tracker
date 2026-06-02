export const normalizeAmountInputValue = (value) => {
  if (value === null || value === undefined) return "";

  const text = String(value).replace(/,/g, "").replace(/[^\d.]/g, "");
  const [integerPart = "", ...decimalParts] = text.split(".");
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "");

  if (decimalParts.length === 0) {
    return normalizedInteger;
  }

  return `${normalizedInteger || "0"}.${decimalParts.join("")}`;
};

export const formatAmountInputValue = (value) => {
  const normalized = normalizeAmountInputValue(value);

  if (!normalized) return "";

  const [integerPart = "0", decimalPart] = normalized.split(".");
  const formattedInteger = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(Number(integerPart || 0));

  if (normalized.includes(".")) {
    return `${formattedInteger}.${decimalPart ?? ""}`;
  }

  return formattedInteger;
};