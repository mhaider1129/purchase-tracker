export const isLowStock = (item, threshold) => {
  const quantity = Number(item.quantity);
  return Number.isFinite(quantity) && quantity > 0 && quantity <= threshold;
};

// Compare calendar dates so stock due today is included throughout the day.
export const isExpiryDue = (item, now = new Date()) => {
  if (!item.expiry_date || !(Number(item.quantity) > 0)) return false;
  const expiry = new Date(item.expiry_date);
  if (!Number.isFinite(expiry.getTime())) return false;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const due = Date.UTC(
    expiry.getUTCFullYear(),
    expiry.getUTCMonth(),
    expiry.getUTCDate(),
  );
  return due <= today + 30 * 86400000;
};

export const isTransferReviewable = (details, transferId) =>
  Number.isInteger(Number(transferId)) &&
  Number(transferId) > 0 &&
  Number(details?.transfer?.id) === Number(transferId) &&
  details?.transfer?.status === "Pending";
