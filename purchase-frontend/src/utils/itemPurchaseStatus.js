const STATUS_KEYS = {
  PURCHASED: "purchased",
  PARTIALLY_PURCHASED: "partiallyPurchased",
  NOT_PURCHASED: "notPurchased",
};

const stringToNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const pickNumberFromItem = (item, keys) => {
  for (const key of keys) {
    if (Array.isArray(key)) {
      let nestedValue = item;
      for (const nestedKey of key) {
        if (!nestedValue || typeof nestedValue !== "object") {
          nestedValue = undefined;
          break;
        }
        nestedValue = nestedValue[nestedKey];
      }
      const parsedNested = stringToNumber(nestedValue);
      if (parsedNested !== null) {
        return parsedNested;
      }
      continue;
    }

    const parsed = stringToNumber(item?.[key]);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
};

const pickStatusText = (item) => {
  const candidates = [
    item?.status,
    item?.procurement_status,
    item?.procurementStatus,
    item?.fulfillment_status,
    item?.fulfillmentStatus,
    item?.purchase_status,
    item?.purchaseStatus,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) {
      continue;
    }

    const text = String(candidate).trim();
    if (text) {
      return text.toLowerCase();
    }
  }

  return "";
};

export const deriveItemPurchaseState = (item) => {
  if (!item || typeof item !== "object") {
    return {
      statusKey: STATUS_KEYS.NOT_PURCHASED,
      quantity: null,
      purchasedQuantity: 0,
    };
  }

  const quantity = pickNumberFromItem(item, [
    "quantity",
    "qty",
    "requested_quantity",
    "requestedQuantity",
    ["item", "quantity"],
  ]);

  const purchasedQuantityRaw =
    pickNumberFromItem(item, [
      "purchased_quantity",
      "purchasedQuantity",
      "received_quantity",
      "receivedQuantity",
      "fulfilled_quantity",
      "fulfilledQuantity",
    ]) ?? 0;

  const purchasedQuantity = purchasedQuantityRaw;
  const statusText = pickStatusText(item);

  if (
    ["purchased", "completed", "received", "fulfilled"].includes(statusText)
  ) {
    return {
      statusKey: STATUS_KEYS.PURCHASED,
      quantity,
      purchasedQuantity,
    };
  }

  if (
    [
      "partially purchased",
      "partially received",
      "partial",
      "partial purchase",
      "in progress",
      "processing",
    ].includes(statusText)
  ) {
    return {
      statusKey: STATUS_KEYS.PARTIALLY_PURCHASED,
      quantity,
      purchasedQuantity,
    };
  }

  if (
    ["not purchased", "pending", "awaiting purchase", "requested"].includes(
      statusText,
    )
  ) {
    return {
      statusKey: STATUS_KEYS.NOT_PURCHASED,
      quantity,
      purchasedQuantity,
    };
  }

  if (quantity !== null) {
    if (purchasedQuantity >= quantity && quantity > 0) {
      return {
        statusKey: STATUS_KEYS.PURCHASED,
        quantity,
        purchasedQuantity,
      };
    }

    if (purchasedQuantity > 0 && purchasedQuantity < quantity) {
      return {
        statusKey: STATUS_KEYS.PARTIALLY_PURCHASED,
        quantity,
        purchasedQuantity,
      };
    }

    if (quantity === 0 && purchasedQuantity > 0) {
      return {
        statusKey: STATUS_KEYS.PARTIALLY_PURCHASED,
        quantity,
        purchasedQuantity,
      };
    }
  } else if (purchasedQuantity > 0) {
    return {
      statusKey: STATUS_KEYS.PARTIALLY_PURCHASED,
      quantity,
      purchasedQuantity,
    };
  }

  return {
    statusKey: STATUS_KEYS.NOT_PURCHASED,
    quantity,
    purchasedQuantity,
  };
};

export const getItemPurchaseStatusLabel = (item, labels = {}) => {
  const { statusKey } = deriveItemPurchaseState(item);
  return labels?.[statusKey] ?? statusKey;
};

export { STATUS_KEYS as ITEM_PURCHASE_STATUS_KEYS };
