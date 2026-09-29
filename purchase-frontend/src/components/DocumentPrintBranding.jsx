import { useEffect, useRef } from "react";
import api from "../api/axios";
import { useAuth } from "../hooks/useAuth";

export const DOCUMENT_BRANDING_UPDATED_EVENT =
  "purchase-tracker:document-branding-updated";

const BRANDING_ID = "system-document-print-branding";
const STYLE_ID = "system-document-print-branding-styles";

const escapeText = (value) => String(value || "").trim();

export const applyDocumentBranding = (documentRef, settings = {}) => {
  if (!documentRef?.head || !documentRef?.body) return;

  documentRef.getElementById(BRANDING_ID)?.remove();
  documentRef.getElementById(STYLE_ID)?.remove();

  const logo = escapeText(settings.logo_data);
  const code = escapeText(settings.document_code);
  const template = escapeText(settings.template_data);
  if (!logo && !code && !template) return;

  const style = documentRef.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${BRANDING_ID} { display: none; }
    @media print {
      #${BRANDING_ID} {
        display: flex !important;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        border-bottom: 2px solid #2563eb;
        padding: 0 0 12px;
        margin: 0 0 18px;
        color: #111827;
        font-family: "Segoe UI", Arial, sans-serif;
        direction: ltr;
      }
      #${BRANDING_ID} img {
        display: block;
        max-width: 150px;
        max-height: 72px;
        width: auto;
        height: auto;
        object-fit: contain;
      }
      #${BRANDING_ID} .system-document-code {
        margin-inline-start: auto;
        font-size: 12px;
        font-weight: 700;
        overflow-wrap: anywhere;
      }
      ${
        template
          ? `body::before {
              content: "";
              position: fixed;
              inset: 0;
              background: url("${template.replace(/"/g, "%22")}") center / contain no-repeat;
              opacity: .16;
              pointer-events: none;
              z-index: -1;
            }`
          : ""
      }
    }
  `;
  documentRef.head.appendChild(style);

  if (logo || code) {
    const header = documentRef.createElement("div");
    header.id = BRANDING_ID;
    header.setAttribute("aria-hidden", "true");
    if (logo) {
      const image = documentRef.createElement("img");
      image.src = logo;
      image.alt = "";
      header.appendChild(image);
    }
    if (code) {
      const codeElement = documentRef.createElement("div");
      codeElement.className = "system-document-code";
      codeElement.textContent = code;
      header.appendChild(codeElement);
    }
    documentRef.body.prepend(header);
  }
};

const bindPopup = (popup, settingsRef) => {
  try {
    if (!popup || popup.__documentBrandingBound) return;
    popup.__documentBrandingBound = true;
    const nativePrint = popup.print.bind(popup);
    popup.print = () => {
      applyDocumentBranding(popup.document, settingsRef.current);
      nativePrint();
    };
    popup.addEventListener("beforeprint", () =>
      applyDocumentBranding(popup.document, settingsRef.current),
    );
  } catch (_error) {
    // Cross-origin popups cannot be branded by the application.
  }
};

const DocumentPrintBranding = () => {
  const { user } = useAuth();
  const settingsRef = useRef({});

  useEffect(() => {
    if (!user) {
      settingsRef.current = {};
      return undefined;
    }

    let active = true;
    const loadSettings = async () => {
      try {
        const response = await api.get("/document-branding", {
          __skipActionNotification: true,
        });
        if (active) settingsRef.current = response.data?.settings || {};
      } catch (error) {
        console.error("Failed to load document print branding", error);
      }
    };

    loadSettings();
    window.addEventListener(DOCUMENT_BRANDING_UPDATED_EVENT, loadSettings);
    return () => {
      active = false;
      window.removeEventListener(DOCUMENT_BRANDING_UPDATED_EVENT, loadSettings);
    };
  }, [user]);

  useEffect(() => {
    const nativeOpen = window.open;
    const handleBeforePrint = () =>
      applyDocumentBranding(document, settingsRef.current);

    window.open = (...args) => {
      const popup = nativeOpen.apply(window, args);
      bindPopup(popup, settingsRef);
      return popup;
    };
    window.addEventListener("beforeprint", handleBeforePrint);

    return () => {
      window.open = nativeOpen;
      window.removeEventListener("beforeprint", handleBeforePrint);
      document.getElementById(BRANDING_ID)?.remove();
      document.getElementById(STYLE_ID)?.remove();
    };
  }, []);

  return null;
};

export default DocumentPrintBranding;