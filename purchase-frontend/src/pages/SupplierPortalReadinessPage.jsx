import React from "react";
import { Link } from "react-router-dom";

const readinessCards = [
  {
    title: "Supplier access",
    table: "supplier_users",
    details: "Enable supplier-specific identities, roles, and account status for portal login.",
  },
  {
    title: "Session lifecycle",
    table: "supplier_portal_sessions",
    details: "Track supplier portal sessions, expiry windows, revocation, and security metadata.",
  },
  {
    title: "Document intake",
    table: "supplier_document_submissions",
    details: "Capture RFQ, quotation, and PO-related supplier uploads in a single workflow record.",
  },
];

export default function SupplierPortalReadinessPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-xl border border-indigo-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Supplier Portal Readiness</h1>
          <p className="mt-2 text-sm text-gray-600">
            Backend schema is prepared. Frontend should now align on supplier login, RFQ response upload,
            and PO acknowledgment user flows.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/rfx-portal"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Open RFx Portal
            </Link>
            <Link
              to="/procure-to-pay/purchase-orders"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Open Purchase Orders
            </Link>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {readinessCards.map((card) => (
            <article key={card.table} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">{card.title}</h2>
              <p className="mt-1 font-mono text-xs text-indigo-600">{card.table}</p>
              <p className="mt-3 text-sm text-gray-600">{card.details}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}