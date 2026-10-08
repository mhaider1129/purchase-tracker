import React from "react";
import { useTranslation } from "react-i18next";
import { isLowStock, isExpiryDue } from "../../utils/warehouseInventoryFilters";

export default function InventoryAttention({
  items,
  threshold,
  onThresholdChange,
  activeFilter,
  onFilterChange,
  disabled,
}) {
  const { t } = useTranslation();
  const label = (key, fallback) =>
    t(`warehouseInventory.enhancements.${key}`, fallback);
  const counts = {
    outOfStock: items.filter((item) => Number(item.quantity) <= 0).length,
    lowStock: items.filter((item) => isLowStock(item, threshold)).length,
    expiryDue: items.filter((item) => isExpiryDue(item)).length,
  };
  return (
    <section
      className="inventory-attention"
      aria-labelledby="inventory-attention-heading"
    >
      <div className="inventory-attention-heading">
        <div>
          <h3 id="inventory-attention-heading">
            {label("attention", "Stock attention")}
          </h3>
          <p>
            {label(
              "attentionHelp",
              "Filter stock rows by quantity or expiry date. Counts include all rows in this warehouse.",
            )}
          </p>
        </div>
        <label htmlFor="low-stock-threshold">
          {label("threshold", "Low-stock cutoff (units)")}
          <input
            id="low-stock-threshold"
            type="number"
            min="0"
            step="1"
            value={threshold}
            onChange={(event) =>
              onThresholdChange(Math.max(0, Number(event.target.value) || 0))
            }
          />
        </label>
      </div>
      <div className="inventory-attention-options">
        {Object.entries(counts).map(([filter, count]) => (
          <button
            key={filter}
            type="button"
            disabled={disabled}
            aria-pressed={activeFilter === filter}
            onClick={() =>
              onFilterChange(activeFilter === filter ? "all" : filter)
            }
          >
            <strong>{count}</strong>
            <span>
              {label(
                filter,
                {
                  outOfStock: "Out of stock",
                  lowStock: "Low stock",
                  expiryDue: "Expired / due within 30 days",
                }[filter],
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
