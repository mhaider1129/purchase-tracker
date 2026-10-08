import React from "react";
import { useTranslation } from "react-i18next";

export default function TransferReviewDetails({ details, warehouses }) {
  const { t } = useTranslation();
  const label = (key, fallback) =>
    t(`warehouseInventory.enhancements.${key}`, fallback);
  if (!details?.transfer) return null;
  const { transfer, items = [] } = details;
  const warehouseName = (id) =>
    warehouses.find((warehouse) => String(warehouse.id) === String(id))?.name ||
    `#${id}`;
  return (
    <section
      className="warehouse-transfer-review"
      aria-label={label("reviewDetails", "Loaded transfer details")}
    >
      <div className="warehouse-transfer-heading">
        <h4>
          {label("transfer", "Transfer")} #{transfer.id}
        </h4>
        <span>{transfer.status}</span>
      </div>
      <dl className="warehouse-transfer-route">
        <div>
          <dt>{label("origin", "Origin")}</dt>
          <dd>{warehouseName(transfer.origin_warehouse_id)}</dd>
        </div>
        <div>
          <dt>{label("destination", "Destination")}</dt>
          <dd>{warehouseName(transfer.destination_warehouse_id)}</dd>
        </div>
      </dl>
      {transfer.notes && (
        <p className="warehouse-transfer-notes">{transfer.notes}</p>
      )}
      {items.length ? (
        <ul className="warehouse-transfer-items">
          {items.map((item, index) => (
            <li key={item.id ?? index}>
              <div>
                <strong>{item.item_name || `#${item.stock_item_id}`}</strong>
                {item.notes && <p>{item.notes}</p>}
              </div>
              <span>
                {label("quantity", "Quantity")}: <b>{item.quantity}</b>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>{label("noTransferItems", "No transfer items provided.")}</p>
      )}
    </section>
  );
}
