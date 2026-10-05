import React, { useState } from "react";
import { createItemMasterReference } from "../../api/itemMaster";

const labels = {
  categories: "category",
  uom: "UOM",
  manufacturers: "manufacturer",
};

// A fieldset, rather than a nested form, so reference setup can live inside an item draft.
export default function ReferenceDataEditor({ type, onCreated, onClose }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = labels[type];
  const save = async () => {
    if (busy || !name.trim() || (type === "uom" && !code.trim())) return;
    setBusy(true);
    setError("");
    try {
      const created = await createItemMasterReference(type, {
        name: name.trim(),
        code: code.trim(),
      });
      await onCreated(created);
    } catch (e) {
      setError(
        e.response?.data?.message ||
          "Unable to add reference. Check your reference maintenance permission and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <fieldset disabled={busy} className="space-y-3 rounded border bg-white p-3">
      <legend className="px-1 font-semibold">Add {label}</legend>
      {type === "uom" && (
        <label className="block text-sm">
          UOM code
          <input
            className="ml-3 rounded border p-2"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. EA"
          />
        </label>
      )}
      <label className="block text-sm">
        {label === "UOM"
          ? "UOM"
          : label.charAt(0).toUpperCase() + label.slice(1)}{" "}
        name
        <input
          className="ml-3 rounded border p-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={busy || !name.trim() || (type === "uom" && !code.trim())}
          onClick={save}
          className="rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-40"
        >
          {busy ? "Adding…" : `Save ${label}`}
        </button>
        <button type="button" onClick={onClose}>
          Cancel reference setup
        </button>
      </div>
    </fieldset>
  );
}
