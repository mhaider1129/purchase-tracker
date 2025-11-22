// src/components/RequestTableWithFilters.jsx
import React from "react";

const RequestTableWithFilters = ({ requests }) => {
  if (!requests || requests.length === 0) {
    return <p className="text-gray-500 text-sm italic">No requests found.</p>;
  }

  return (
    <div className="overflow-x-auto border rounded shadow-sm">
      <table
        className="min-w-full text-sm text-left"
        aria-label="Request Table"
      >
        <thead className="bg-gray-100 text-gray-700">
          <tr>
            <th className="p-2 border">ID</th>
            <th className="p-2 border">Type</th>
            <th className="p-2 border">Department</th>
            <th className="p-2 border">Justification</th>
            <th className="p-2 border">Estimated Cost</th>
            <th className="p-2 border">Status</th>
            <th className="p-2 border">Created At</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => {
            const formattedCost = req.estimated_cost
              ? req.estimated_cost.toLocaleString("en-US", {
                  style: "currency",
                  currency: "IQD",
                  minimumFractionDigits: 0,
                })
              : "—";

            const formattedDate = new Date(req.created_at).toLocaleDateString(
              "en-GB",
            );

            const statusColor =
              req.status === "rejected"
                ? "bg-red-50 text-red-700"
                : req.status === "approved"
                  ? "bg-green-50 text-green-700"
                  : req.status === "pending"
                    ? "bg-yellow-50 text-yellow-700"
                    : "";

            return (
              <tr key={req.id} className={statusColor}>
                <td className="p-2 border">{req.id}</td>
                <td className="p-2 border">{req.request_type}</td>
                <td className="p-2 border">{req.department_name}</td>
                <td className="p-2 border">{req.justification}</td>
                <td className="p-2 border">{formattedCost}</td>
                <td className="p-2 border capitalize">{req.status}</td>
                <td className="p-2 border">{formattedDate}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default RequestTableWithFilters;
