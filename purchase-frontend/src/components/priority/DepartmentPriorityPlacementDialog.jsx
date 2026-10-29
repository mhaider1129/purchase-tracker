import React, { useEffect, useRef, useState } from "react";
import axios from "../../api/axios";

// A fresh server queue is loaded for every approved request, including each
// request in a batch. Never save a snapshot captured before another decision.
export default function DepartmentPriorityPlacementDialog({
  approvalId,
  continueApproval = false,
  onComplete,
}) {
  const [queue, setQueue] = useState([]);
  const [candidate, setCandidate] = useState(null);
  const [placed, setPlaced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [stale, setStale] = useState(false);
  const dialog = useRef(null);
  const completion = useRef(onComplete);
  completion.current = onComplete;
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    setStale(false);
    axios
      .get(`/approvals/${approvalId}/department-ranking`)
      .then(({ data }) => {
        if (!live) return;
        const gate = data.data;
        if (!gate) {
          completion.current();
          return;
        }
        const selected = gate.queue.find(
          (row) => String(row.request_id) === String(gate.requestId),
        );
        if (!selected)
          throw new Error(
            "This request is no longer in the active department queue.",
          );
        setCandidate(selected);
        setQueue(
          gate.queue.filter(
            (row) => String(row.request_id) !== String(gate.requestId),
          ),
        );
        setPlaced(false);
      })
      .catch((err) => {
        if (live)
          setError(
            err.response?.data?.message ||
              err.message ||
              "Unable to load department priorities.",
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [approvalId, reload]);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus();
    const trap = (event) => {
      if (event.key !== "Tab") return;
      const nodes = [
        ...dialog.current.querySelectorAll(
          "button:not(:disabled),a[href],select:not(:disabled)",
        ),
      ];
      if (!nodes.length) {
        event.preventDefault();
        return;
      }
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    const node = dialog.current;
    node.addEventListener("keydown", trap);
    return () => {
      node.removeEventListener("keydown", trap);
      previous?.focus?.();
    };
  }, []);
  const existing = queue.filter(
    (row) => String(row.request_id) !== String(candidate?.request_id),
  );
  const place = (index) => {
    if (!candidate || loading || saving || stale) return;
    const ordered = [...existing];
    ordered.splice(index, 0, candidate);
    setQueue(ordered);
    setPlaced(true);
    setError("");
  };
  const save = async () => {
    if (!placed || saving || stale) return;
    setSaving(true);
    setError("");
    const payload = {
      ordered_request_ids: queue.map((row) => row.request_id),
      snapshots: Object.fromEntries(
        queue.map((row) => [row.request_id, row.snapshot]),
      ),
    };
    try {
      if (continueApproval)
        await axios.post(
          `/approvals/${approvalId}/department-ranking`,
          payload,
        );
      else
        await axios.put(
          "/procurement-priority/requests/department/order",
          payload,
        );
      completion.current();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Priority was not saved. Retry or reload the latest list.",
      );
      if (err.response?.status === 409) setStale(true);
    } finally {
      setSaving(false);
    }
  };
  const startDrag = (event) => {
    event.dataTransfer.setData("text/plain", String(candidate.request_id));
    event.dataTransfer.effectAllowed = "move";
  };
  const disabled = loading || saving || stale;
  const dropSlot = (index) => (
    <button
      key={`slot-${index}`}
      type="button"
      disabled={disabled || !candidate}
      aria-label={`Place new request at priority ${index + 1}`}
      onClick={() => place(index)}
      onDragOver={(event) => {
        if (!disabled) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (
          event.dataTransfer.getData("text/plain") ===
          String(candidate?.request_id)
        )
          place(index);
      }}
      className="my-1 w-full rounded border border-dashed border-indigo-300 p-2 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
    >
      Place here · priority {index + 1}
    </button>
  );
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4">
      <section
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="department-placement-title"
        aria-describedby="department-placement-help"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 id="department-placement-title" className="text-xl font-semibold">
          Place the approved request in department priority
        </h2>
        <p
          id="department-placement-help"
          className="mt-2 text-sm text-slate-600"
        >
          Your HOD approval is recorded. Drag the new request into the list, or
          choose a position below. One position represents the whole request.
          Previous requests retain their relative order.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Only your department’s HOD-approved active requests appear. Rejected,
          completed, closed, in-stock and cancelled requests are excluded.
        </p>
        {loading && (
          <p role="status" className="py-4">
            Loading current department priorities…
          </p>
        )}
        {error && (
          <p role="alert" className="my-3 rounded bg-red-50 p-3 text-red-800">
            {error}
          </p>
        )}
        {!loading && candidate && (
          <>
            <div
              className="my-4 rounded-lg border-2 border-indigo-400 bg-indigo-50 p-4"
              draggable={!disabled}
              onDragStart={startDrag}
              aria-label="Newly approved request"
            >
              <p className="text-xs font-bold uppercase text-indigo-700">
                Newly approved request · drag to a position
              </p>
              <p className="font-semibold">
                #{candidate.request_reference || candidate.request_id} ·{" "}
                {candidate.public_title}
              </p>
              <p className="text-sm">
                {candidate.item_count} active item(s)
                {placed
                  ? ` · selected priority ${queue.findIndex((row) => String(row.request_id) === String(candidate.request_id)) + 1}`
                  : " · awaiting placement"}
              </p>
              <label className="mt-2 block text-sm">
                Priority position{" "}
                <select
                  aria-label="Priority position"
                  className="ml-2 rounded border bg-white p-2"
                  disabled={disabled}
                  value={
                    placed
                      ? queue.findIndex(
                          (row) =>
                            String(row.request_id) ===
                            String(candidate.request_id),
                        )
                      : ""
                  }
                  onChange={(event) => place(Number(event.target.value))}
                >
                  <option value="" disabled>
                    Choose position
                  </option>
                  {Array.from({ length: existing.length + 1 }, (_, index) => (
                    <option key={index} value={index}>
                      {index + 1}
                      {index === 0 ? " · highest" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <h3 className="font-semibold">
              Department priority list · {existing.length + 1} active requests
            </h3>
            {!existing.length && (
              <p className="mt-2 text-sm text-slate-600">
                This is the department’s first active approved request. Place it
                at priority 1.
              </p>
            )}
            <div className="mt-2" aria-label="Priority placement positions">
              {existing.map((row, index) => (
                <React.Fragment key={row.request_id}>
                  {dropSlot(index)}
                  {placed &&
                    queue[index]?.request_id === candidate.request_id && (
                      <div className="rounded border-2 border-indigo-500 bg-indigo-50 p-3 font-semibold">
                        {index + 1}. {candidate.public_title} · New request
                      </div>
                    )}
                  <div className="rounded border bg-slate-50 p-3">
                    <strong className="mr-2">
                      {placed
                        ? queue.findIndex(
                            (entry) =>
                              String(entry.request_id) ===
                              String(row.request_id),
                          ) + 1
                        : index + 1}
                      .
                    </strong>
                    <span>
                      #{row.request_reference || row.request_id} ·{" "}
                      {row.public_title}
                    </span>
                    <p className="text-xs text-slate-500">
                      {row.item_count} active item(s) ·{" "}
                      {row.request_status || row.case_status}
                    </p>
                  </div>
                </React.Fragment>
              ))}
              {dropSlot(existing.length)}
              {placed &&
                String(queue.at(-1)?.request_id) ===
                  String(candidate.request_id) && (
                  <div className="rounded border-2 border-indigo-500 bg-indigo-50 p-3 font-semibold">
                    {queue.length}. {candidate.public_title} · New request
                  </div>
                )}
            </div>
          </>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            disabled={saving || loading}
            className="rounded border px-4 py-2"
            onClick={() => setReload((value) => value + 1)}
          >
            Reload current list
          </button>
          <button
            type="button"
            disabled={!placed || disabled}
            className="rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-40"
            onClick={save}
          >
            {saving
              ? "Saving priority…"
              : continueApproval
                ? "Save priority and continue approval"
                : "Save department priority"}
          </button>
        </div>
      </section>
    </div>
  );
}
