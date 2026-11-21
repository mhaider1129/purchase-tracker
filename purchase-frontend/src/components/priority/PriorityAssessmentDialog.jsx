import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function PriorityAssessmentDialog({
  title,
  saving,
  onClose,
  children,
}) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab") return;
      const nodes = [
        ...dialog.current.querySelectorAll(
          "button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)",
        ),
      ].filter((node) => !node.closest("[hidden]"));
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current ||
          !dialog.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current ||
          !dialog.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);
  return createPortal(
    <div className="priority-modal-overlay">
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Priority details"
        aria-describedby="priority-dialog-title"
        tabIndex={-1}
        className="priority-assessment-dialog"
      >
        <header className="priority-dialog-heading">
          <div>
            <p>Priority assessment</p>
            <h2 id="priority-dialog-title">{title}</h2>
          </div>
          <button type="button" disabled={saving} onClick={onClose}>
            Close
          </button>
        </header>
        <div className="priority-dialog-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
