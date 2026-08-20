import React from "react";

const PrintableRequestsReport = ({ requests, title, labels, formatDate }) => (
  <section className="hidden print:block" aria-hidden="true">
    <div className="mb-6 border-b border-gray-400 pb-3">
      <h1 className="text-2xl font-bold text-black">{title}</h1>
      <p className="mt-1 text-sm text-gray-700">
        {labels.printedAt}: {formatDate(new Date())}
      </p>
    </div>

    <table className="w-full border-collapse text-xs text-black">
      <thead>
        <tr>
          {[
            "id",
            "type",
            "project",
            "status",
            "assigned",
            "submitted",
            "updated",
          ].map((key) => (
            <th
              key={key}
              className="border border-gray-500 px-2 py-2 text-start font-semibold"
            >
              {labels[key]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {requests.map((request) => (
          <tr key={request.id} className="break-inside-avoid">
            <td className="border border-gray-400 px-2 py-2">{request.id}</td>
            <td className="border border-gray-400 px-2 py-2">
              {request.request_type || labels.notAvailable}
            </td>
            <td className="border border-gray-400 px-2 py-2">
              {request.project_name || labels.notAvailable}
            </td>
            <td className="border border-gray-400 px-2 py-2">
              {request.status || labels.notAvailable}
            </td>
            <td className="border border-gray-400 px-2 py-2">
              {request.assigned_user_name || labels.notAvailable}
            </td>
            <td className="border border-gray-400 px-2 py-2">
              {formatDate(request.created_at)}
            </td>
            <td className="border border-gray-400 px-2 py-2">
              {formatDate(request.updated_at || request.created_at)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);

export default PrintableRequestsReport;