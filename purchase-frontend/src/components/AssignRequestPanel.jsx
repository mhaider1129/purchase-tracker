//src/components/AssignRequestPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "../api/axios";
import { Button } from "./ui/Button";

const AssignRequestPanel = ({ requestId, currentAssignee, onSuccess }) => {
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [mode, setMode] = useState("single");
  const [itemAssignments, setItemAssignments] = useState({});
  const [itemNotes, setItemNotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const fetchProcurementUsers = async () => {
      try {
        const res = await axios.get("/requests/procurement-users");
        setUsers(res.data);
      } catch (err) {
        console.error("❌ Failed to fetch procurement users:", err);
        setMessage({ type: "error", text: "Failed to load users." });
      }
    };

    fetchProcurementUsers();
  }, []);

  useEffect(() => {
    const fetchRequestItems = async () => {
      if (!requestId) return;

      setLoadingItems(true);
      try {
        const res = await axios.get(`/requests/${requestId}/items`);
        setItems(res.data.items || []);
        const nextAssignments = {};
        const nextNotes = {};
        (res.data.items || []).forEach((item) => {
          if (item.assigned_to) nextAssignments[item.id] = String(item.assigned_to);
          if (item.assignment_notes) nextNotes[item.id] = item.assignment_notes;
        });
        setItemAssignments(nextAssignments);
        setItemNotes(nextNotes);
      } catch (err) {
        console.error(`❌ Failed to fetch items for request ${requestId}:`, err);
        setMessage({ type: "error", text: "Failed to load request items for split assignment." });
      } finally {
        setLoadingItems(false);
      }
    };

    fetchRequestItems();
  }, [requestId]);

  const assignableItems = useMemo(
    () => items.filter((item) => item.approval_status !== "Rejected"),
    [items],
  );

  const splitAssignments = useMemo(() => Object.entries(itemAssignments).map(([itemId, userId]) => {
    if (!userId) return null;
    const item = assignableItems.find((row) => String(row.id) === String(itemId));
    if (!item) return null;

    return {
      user_id: Number(userId),
      requested_item_ids: [Number(itemId)],
      notes: itemNotes[itemId]?.trim() || null,
    };
  }).filter(Boolean), [assignableItems, itemAssignments, itemNotes]);

  const handleAssign = async () => {
    if (!selectedUser) {
      setMessage({ type: "error", text: "Please select a user." });
      return;
    }

    setLoading(true);
    try {
      await axios.put("/requests/assign-procurement", {
        request_id: requestId,
        user_id: selectedUser,
      });
      setMessage({
        type: "success",
        text: "✅ Request successfully assigned!",
      });

      setTimeout(() => setMessage(null), 3000); // Auto-dismiss success
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to assign request",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSplitAssign = async () => {
    if (splitAssignments.length === 0) {
      setMessage({ type: "error", text: "Assign at least one item to a procurement user." });
      return;
    }

    setLoading(true);
    try {
      await axios.put(`/requests/${requestId}/split-assign-procurement`, {
        assignments: splitAssignments,
      });
      setMessage({
        type: "success",
        text: "✅ Split assignment saved!",
      });
      setTimeout(() => setMessage(null), 3000);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to save split assignment",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow mt-4">
      <h2 className="text-lg font-semibold mb-3">
        {currentAssignee
          ? `Reassign Request (currently ${currentAssignee})`
          : "Assign to Procurement Staff"}
      </h2>

      <div className="mb-4 flex rounded border bg-gray-50 p-1 text-sm">
        <button
          type="button"
          className={`flex-1 rounded px-3 py-2 ${mode === "single" ? "bg-white font-semibold shadow" : "text-gray-600"}`}
          onClick={() => setMode("single")}
        >
          Assign whole request
        </button>
        <button
          type="button"
          className={`flex-1 rounded px-3 py-2 ${mode === "split" ? "bg-white font-semibold shadow" : "text-gray-600"}`}
          onClick={() => setMode("split")}
        >
          Split by items
        </button>
      </div>

      {mode === "single" ? (
        <>
          <label htmlFor="assign-user" className="sr-only">
            Select User
          </label>
          <select
            id="assign-user"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="border p-2 rounded w-full mb-3"
          >
            <option value="">Select User</option>
            {users.length > 0 ? (
              users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))
            ) : (
              <option disabled>Loading users...</option>
            )}
          </select>

          <Button
            onClick={handleAssign}
            isLoading={loading}
            fullWidth
            disabled={loading || users.length === 0}
          >
            {currentAssignee ? "Reassign" : "Assign"}
          </Button>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Assign individual request items to one or more procurement users. Items left blank remain unassigned.
          </p>

          {loadingItems ? (
            <p className="text-sm text-gray-500">Loading request items...</p>
          ) : assignableItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="border p-2">Item</th>
                    <th className="border p-2">Qty</th>
                    <th className="border p-2">Procurement User</th>
                    <th className="border p-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {assignableItems.map((item) => (
                    <tr key={item.id}>
                      <td className="border p-2">
                        <div className="font-medium">{item.item_name}</div>
                        {item.brand && <div className="text-xs text-gray-500">Brand: {item.brand}</div>}
                      </td>
                      <td className="border p-2">{item.quantity}</td>
                      <td className="border p-2">
                        <select
                          value={itemAssignments[item.id] || ""}
                          onChange={(e) => setItemAssignments((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className="w-full rounded border p-2"
                        >
                          <option value="">Unassigned</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name} ({user.role})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border p-2">
                        <input
                          type="text"
                          value={itemNotes[item.id] || ""}
                          onChange={(e) => setItemNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="Optional note"
                          className="w-full rounded border p-2"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No assignable items found.</p>
          )}

          <Button
            onClick={handleSplitAssign}
            isLoading={loading}
            fullWidth
            disabled={loading || users.length === 0 || assignableItems.length === 0}
          >
            Save Split Assignment
          </Button>
        </div>
      )}

      {message && (
        <div
          className={`mt-2 text-sm ${
            message.type === "error" ? "text-red-600" : "text-green-600"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
};

export default AssignRequestPanel;