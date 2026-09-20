import React from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Paperclip,
} from "lucide-react";

const AttachmentsPanel = ({
  attachments = [],
  loading,
  error,
  onDownload,
  onView,
  title = "Attachments",
  downloadingId,
  emptyLabel = "No attachments uploaded.",
}) => {
  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4"
      aria-labelledby="attachments-heading"
    >
      <div className="flex items-center justify-between gap-3">
        <h4
          id="attachments-heading"
          className="flex items-center gap-2 text-sm font-semibold text-slate-800"
        >
          <Paperclip className="h-4 w-4 text-blue-600" aria-hidden />
          {title}
        </h4>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
          {attachments.length}
        </span>
      </div>
      {loading ? (
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden />
          <span>Loading attachments…</span>
        </div>
      ) : error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : attachments.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-200 p-5 text-center">
          <FileText className="mx-auto h-6 w-6 text-slate-300" aria-hidden />
          <p className="mt-2 text-sm text-slate-500">{emptyLabel}</p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm text-slate-700">
          {attachments.map((att) => {
            const filename =
              att.file_name || (att.file_path || "").split(/[\\/]/).pop();
            const itemName = att.item_name || att.itemName;
            return (
              <li
                key={att.id}
                className="flex flex-wrap items-center gap-3 p-3 hover:bg-slate-50"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
                  <FileText className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 break-all font-medium text-slate-800">
                  {filename}
                </span>
                {itemName ? (
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {itemName}
                  </span>
                ) : null}
                {att.file_url && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-800"
                    onClick={() => onView?.(att.file_url)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden /> View
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDownload(att)}
                  className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  disabled={downloadingId === att.id}
                >
                  {downloadingId === att.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Download className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {downloadingId === att.id ? "Downloading…" : "Download"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default AttachmentsPanel;