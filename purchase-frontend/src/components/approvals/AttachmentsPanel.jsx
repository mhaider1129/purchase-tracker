import React from 'react';
import { Loader2 } from 'lucide-react';

const AttachmentsPanel = ({
  attachments = [],
  loading,
  error,
  onDownload,
  onView,
  title = 'Attachments',
  downloadingId,
  emptyLabel = 'No attachments uploaded.',
}) => {
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      {loading ? (
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden />
          <span>Loading attachments…</span>
        </div>
      ) : error ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : attachments.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm text-slate-700">
          {attachments.map((att) => {
            const filename = att.file_name || (att.file_path || '').split(/[\\/]/).pop();
            return (
              <li key={att.id} className="flex flex-wrap items-center gap-3">
                <span className="break-all">{filename}</span>
                {att.file_url && (
                  <button
                    type="button"
                    className="text-blue-600 underline hover:text-blue-800"
                    onClick={() => onView?.(att.file_url)}
                  >
                    View
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDownload(att)}
                  className="text-blue-600 underline hover:text-blue-800 disabled:opacity-50"
                  disabled={downloadingId === att.id}
                >
                  {downloadingId === att.id ? 'Downloading…' : 'Download'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AttachmentsPanel;