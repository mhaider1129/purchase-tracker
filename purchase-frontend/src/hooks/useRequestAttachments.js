import { useCallback, useRef, useState } from "react";
import axios from "../api/axios";

const getFilenameFromAttachment = (attachment = {}) => {
  if (attachment.file_name) {
    return attachment.file_name;
  }

  const storedPath = attachment.file_path || "";
  if (storedPath) {
    const parts = storedPath.split(/[\\/]/);
    return parts[parts.length - 1] || "attachment";
  }

  return "attachment";
};

const normalizeDownloadEndpoint = (endpoint = "") => {
  if (!endpoint || typeof endpoint !== "string") return null;
  if (/^https?:\/\//i.test(endpoint)) return endpoint;

  const prefixedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return prefixedEndpoint.replace(/^\/api\//, "/");
};

const useRequestAttachments = () => {
  const [attachmentsMap, setAttachmentsMap] = useState({});
  const [attachmentLoadingMap, setAttachmentLoadingMap] = useState({});
  const [attachmentErrorMap, setAttachmentErrorMap] = useState({});
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState(null);
  const loadedRequestsRef = useRef(new Set());

  const resetAttachments = useCallback(() => {
    setAttachmentsMap({});
    setAttachmentLoadingMap({});
    setAttachmentErrorMap({});
    loadedRequestsRef.current = new Set();
  }, []);

  const loadAttachmentsForRequest = useCallback(
    async (requestId, options = {}) => {
      if (!requestId) {
        return;
      }

      const { force = false } = options;
      if (!force && loadedRequestsRef.current.has(requestId)) {
        return;
      }

      setAttachmentLoadingMap((prev) => ({ ...prev, [requestId]: true }));
      setAttachmentErrorMap((prev) => ({ ...prev, [requestId]: "" }));

      try {
        const res = await axios.get(`/attachments/${requestId}`);
        const attachments = Array.isArray(res.data) ? res.data : [];
        setAttachmentsMap((prev) => ({ ...prev, [requestId]: attachments }));
        loadedRequestsRef.current.add(requestId);
      } catch (err) {
        console.error(
          `❌ Failed to load attachments for request ${requestId}:`,
          err,
        );
        setAttachmentsMap((prev) => ({ ...prev, [requestId]: [] }));
        setAttachmentErrorMap((prev) => ({
          ...prev,
          [requestId]: "Failed to load attachments.",
        }));
        loadedRequestsRef.current.delete(requestId);
      } finally {
        setAttachmentLoadingMap((prev) => ({ ...prev, [requestId]: false }));
      }
    },
    [],
  );

  const handleDownloadAttachment = useCallback(async (attachment) => {
    if (!attachment) {
      return;
    }

    const storedPath = attachment.file_path || "";
    const filename = getFilenameFromAttachment(attachment);
    const fallbackName = storedPath
      ? storedPath.split(/[\\/]/).pop()
      : attachment.file_name || filename;
    const idBasedEndpoint = attachment?.id ? `/attachments/${attachment.id}/download` : null;
    const filenameBasedEndpoint = fallbackName
      ? `/attachments/download/${encodeURIComponent(fallbackName)}`
      : null;
    const normalizedAttachmentEndpoint = normalizeDownloadEndpoint(
      attachment?.download_url,
    );
    const downloadCandidates = Array.from(
      new Set(
        [idBasedEndpoint, normalizedAttachmentEndpoint, filenameBasedEndpoint]
          .map(normalizeDownloadEndpoint)
          .filter(Boolean),
      ),
    );

    if (downloadCandidates.length === 0) {
      alert("Attachment file is missing.");
      return;
    }

    setDownloadingAttachmentId(attachment.id);
    try {
      let response = null;
      let lastError = null;

      for (const endpoint of downloadCandidates) {
        try {
          response = await axios.get(endpoint, {
            responseType: "blob",
          });
          break;
        } catch (error) {
          lastError = error;
          if (error?.response?.status !== 404) {
            throw error;
          }
        }
      }

      if (!response) {
        throw lastError || new Error("Attachment download failed");
      }

      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || "application/octet-stream",
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename || "attachment";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(`❌ Error downloading attachment ${attachment?.id}:`, err);
      alert("Failed to download attachment. Please try again.");
    } finally {
      setDownloadingAttachmentId(null);
    }
  }, []);

  return {
    attachmentsMap,
    attachmentLoadingMap,
    attachmentErrorMap,
    downloadingAttachmentId,
    loadAttachmentsForRequest,
    handleDownloadAttachment,
    resetAttachments,
  };
};

export default useRequestAttachments;
