import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTechnicalInspection } from "../api/technicalInspections";

export default function HistoricalInspectionDetail({ id }) {
  const [record, setRecord] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setRecord(null);
    setError("");
    getTechnicalInspection(id)
      .then((data) => {
        if (active) setRecord(data);
      })
      .catch((e) => {
        if (active)
          setError(
            e.response?.data?.message ||
              "Unable to load the inspection record.",
          );
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <main className="mx-auto max-w-5xl space-y-5 p-6">
      <Link to="/technical-inspections" className="text-indigo-700 underline">
        Back to technical worklist
      </Link>
      <h1 className="text-2xl font-bold">Historical inspection · TI-{id}</h1>
      {error && <p role="alert">{error}</p>}
      {!record && !error && <p role="status">Loading inspection…</p>}
      {record && (
        <>
          <section className="rounded-xl border bg-white p-5 dark:bg-slate-800">
            <h2 className="text-lg font-semibold">Item information</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {[
                ["Item", record.item_name],
                [
                  "Request",
                  record.request_id ? `PR-${record.request_id}` : "Not linked",
                ],
                ["Category", record.item_category],
                ["Supplier", record.supplier_name],
                ["Manufacturer", record.manufacturer],
                ["Model", record.model_number],
                ["Serial", record.serial_number],
                ["Lot", record.lot_number],
                ["Location", record.location],
                ["Inspection date", record.inspection_date?.slice(0, 10)],
              ].map(([title, value]) => (
                <div key={title}>
                  <dt className="text-sm text-slate-500">{title}</dt>
                  <dd>{value || "Not recorded"}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rounded-xl border bg-white p-5 dark:bg-slate-800">
            <h2 className="text-lg font-semibold">Recorded assessment</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {["Check", "Condition", "Comments", "Action required"].map(
                      (v) => (
                        <th key={v} className="p-2">
                          {v}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...(record.general_checklist || []),
                    ...(record.category_checklist || []),
                  ].map((check, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2">{check.item}</td>
                      <td>
                        {check.condition?.replaceAll("_", " ") ||
                          "Not recorded"}
                      </td>
                      <td>{check.comment}</td>
                      <td>{check.action_required}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {Object.entries(record.summary || {}).map(
              ([key, value]) =>
                value && (
                  <p className="mt-2" key={key}>
                    <strong>{key.replaceAll("_", " ")}: </strong>
                    {String(value)}
                  </p>
                ),
            )}
          </section>
          <section className="rounded-xl border bg-white p-5 dark:bg-slate-800">
            <h2 className="text-lg font-semibold">Technical inspection status</h2>
            <p className="text-sm text-slate-500">
              Inspection evidence only. Request completion and procurement status are managed separately.
            </p>
            <p>
              {{ passed: "Accepted", failed: "Rejected", pending: "Pending" }[
                record.acceptance_status
              ] || record.acceptance_status}
            </p>
            <p>{record.acceptance_notes}</p>
            <p className="mt-2 text-sm text-slate-500">
              Recorded by {record.created_by_name || "Unknown"}. This historical
              form has no assigned task or quantity disposition; it is not a
              Goods Receipt acceptance decision.
            </p>
            <Link
              className="mt-4 inline-block text-indigo-700 underline"
              to={`/technical-inspections/legacy?inspection=${id}`}
            >
              Open original inspection form
            </Link>
          </section>
        </>
      )}
    </main>
  );
}
