import React from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Paperclip,
  RefreshCw,
} from "lucide-react";

const getFilenameFromAttachment = (attachment = {}) => {
  if (attachment.file_name) {
    return attachment.file_name;
  }

  const storedPath = attachment.file_path || "";
  if (storedPath) {
    const parts = storedPath.split(/[\\/]/);
    return parts[parts.length - 1] || "Attachment";
  }

  return "Attachment";
};

const RequestAttachmentsSection = ({
  attachments = [],
  isLoading = false,
  error = "",
  onDownload,
  downloadingAttachmentId,
  onRetry,
  retryLabel = "Try again",
  title = "Attachments",
  emptyMessage = "No attachments uploaded.",
  loadingMessage = "Loading attachments…",
  className = "",
}) => {
  const formatSize = (attachment) => {
    const bytes = Number(attachment.file_size ?? attachment.size);
    if (!Number.isFinite(bytes) || bytes <= 0) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-slate-800">
          <Paperclip className="h-4 w-4 text-blue-600" aria-hidden="true" />
          {title}
        </h3>
        {!isLoading && !error && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {attachments.length} {attachments.length === 1 ? "file" : "files"}
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2" aria-live="polite">
          <div className="h-14 animate-pulse rounded-lg bg-slate-100" />
          <p className="text-sm text-slate-500">{loadingMessage}</p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 space-y-2">
          <p className="text-sm text-red-600">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {retryLabel}
            </button>
          )}
        </div>
      ) : attachments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
          <Paperclip className="mx-auto mb-2 h-6 w-6 text-slate-400" />
          <p className="text-sm text-slate-500">{emptyMessage}</p>
        </div>
      ) : (
        <ul className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          {attachments.map((attachment) => {
            const filename = getFilenameFromAttachment(attachment);
            const viewUrl = attachment.file_url || attachment.view_url || null;
            const itemName = attachment.item_name || attachment.itemName;
            const size = formatSize(attachment);

            return (
              <li
                key={attachment.id}
                className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-200 hover:bg-blue-50/40"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-blue-600 shadow-sm">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate font-medium text-slate-800"
                    title={filename}
                  >
                    {filename}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-1 text-xs text-slate-500">
                    {itemName && <span>{itemName}</span>}
                    {itemName && size && <span>•</span>}
                    {size && <span>{size}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {viewUrl && (
                    <a
                      href={viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md p-2 text-slate-500 hover:bg-white hover:text-blue-700"
                      aria-label={`View ${filename}`}
                      title="View attachment"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  {onDownload && (
                    <button
                      type="button"
                      onClick={() => onDownload(attachment)}
                      className="rounded-md p-2 text-slate-500 hover:bg-white hover:text-blue-700 disabled:opacity-50"
                      disabled={downloadingAttachmentId === attachment.id}
                      aria-label={`Download ${filename}`}
                      title="Download attachment"
                    >
                      {downloadingAttachmentId === attachment.id ? (
                        <span className="text-xs">…</span>
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default RequestAttachmentsSection;