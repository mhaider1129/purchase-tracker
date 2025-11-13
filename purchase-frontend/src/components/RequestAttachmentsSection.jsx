import React from 'react';

const getFilenameFromAttachment = (attachment = {}) => {
  if (attachment.file_name) {
    return attachment.file_name;
  }

  const storedPath = attachment.file_path || '';
  if (storedPath) {
    const parts = storedPath.split(/[\\/]/);
    return parts[parts.length - 1] || 'Attachment';
  }

  return 'Attachment';
};

const RequestAttachmentsSection = ({
  attachments = [],
  isLoading = false,
  error = '',
  onDownload,
  downloadingAttachmentId,
  onRetry,
  title = 'Attachments',
  emptyMessage = 'No attachments uploaded.',
  loadingMessage = 'Loading attachments…',
  className = '',
}) => {
  return (
    <section className={className}>
      <h3 className="font-semibold mb-2 text-gray-800">{title}</h3>
      {isLoading ? (
        <p className="text-sm text-gray-500">{loadingMessage}</p>
      ) : error ? (
        <div className="space-y-2">
          <p className="text-sm text-red-600">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-sm text-blue-600 underline hover:text-blue-800"
            >
              Try again
            </button>
          )}
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm text-gray-700">
          {attachments.map((attachment) => {
            const filename = getFilenameFromAttachment(attachment);
            const viewUrl = attachment.file_url || attachment.view_url || null;

            return (
              <li key={attachment.id} className="flex flex-wrap items-center gap-3">
                <span className="break-all">{filename}</span>
                {viewUrl && (
                  <a
                    href={viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline hover:text-blue-800"
                  >
                    View
                  </a>
                )}
                {onDownload && (
                  <button
                    type="button"
                    onClick={() => onDownload(attachment)}
                    className="text-blue-600 underline hover:text-blue-800 disabled:opacity-50"
                    disabled={downloadingAttachmentId === attachment.id}
                  >
                    {downloadingAttachmentId === attachment.id ? 'Downloading…' : 'Download'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default RequestAttachmentsSection;