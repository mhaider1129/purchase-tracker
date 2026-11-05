import React, { useCallback, useEffect, useState } from "react";
import { fixedAssetsApi as api } from "../../api/fixedAssets";
import useUiTranslation from "../../utils/useUiTranslation";
const date = (value) => (value ? new Date(value).toLocaleString() : "—");
export default function RfidJobQueue() {
  const text = useUiTranslation();
  const [rows, setRows] = useState([]),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const result = await api.rfid("jobs", { status, limit: 25 });
      setRows(result.data);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  }, [status]);
  useEffect(() => {
    load();
  }, [load]);
  const recover = async (row) => {
    setBusy(true);
    setError("");
    try {
      await api.recoverRfidJob(row.id, reason);
      setReason("");
      await load();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      aria-label="RFID processing jobs"
      className="border-t bg-slate-50 p-4"
    >
      <h3 className="font-semibold">RFID processing jobs</h3>
      <p className="my-2 text-sm text-slate-600">
        Recovery preserves received observations. Terminal failures require
        investigation before any further processing.
      </p>
      <div className="my-3 flex flex-wrap gap-3">
        <label>
          Status
          <select
            aria-label="RFID job status"
            className="ml-2 rounded border p-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{text("All")}</option>
            {[
              "PENDING",
              "PROCESSING",
              "FAILED",
              "DEAD_LETTER",
              "PROCESSED",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={load}
          className="rounded border bg-white px-3"
        >
          {text("Refresh")}
        </button>
        <input
          aria-label="RFID recovery reason"
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Recovery reason"
          className="rounded border p-2"
        />
      </div>
      {error && (
        <p role="alert" className="my-2 text-rose-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {[
                "Read",
                "Status",
                "Attempts",
                "Heartbeat",
                "Lease expiry",
                "Next retry",
                "Error category",
                "Recoveries",
                "Recovery",
              ].map((t) => (
                <th key={t} className="p-2">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-2">{row.id}</td>
                <td className="p-2">{row.processing_status}</td>
                <td className="p-2">{row.processing_attempts} / 5</td>
                <td className="p-2">{date(row.processing_heartbeat_at)}</td>
                <td className="p-2">{date(row.processing_lease_expires_at)}</td>
                <td className="p-2">{date(row.processing_next_attempt_at)}</td>
                <td className="p-2">{row.processing_error_code || "—"}</td>
                <td className="p-2">{row.processing_recovery_count}</td>
                <td className="p-2">
                  {(row.processing_status === "FAILED" ||
                    row.recovery_status === "LEASE_EXPIRED") &&
                  row.processing_attempts < 5 ? (
                    <button
                      type="button"
                      disabled={busy || reason.trim().length < 3}
                      onClick={() => recover(row)}
                      className="rounded border bg-white px-3 py-1 disabled:opacity-40"
                    >
                      {text("Recover")}
                    </button>
                  ) : (
                    row.recovery_status
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-3">No matching processing jobs.</p>}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Most recent 25 matching reads. Automatic recovery continues while the
        worker is running.
      </p>
    </section>
  );
}
