import React, { useEffect, useRef } from "react";
import { Keyboard, X } from "lucide-react";
export const DOCUMENT_MODES = [
  ["preview", "Preview"],
  ["visual", "Visual diff"],
  ["split", "Split diff"],
  ["unified", "Unified diff"],
  ["source", "Source"],
];
export const SHORTCUTS = [
  ["F", "Expand the document across the workspace"],
  ["Shift + F", "Fullscreen"],
  ["Esc", "Close dialog or leave expanded preview"],
  ["J / K", "Next / previous file"],
  ["1–5", "Preview / visual / split / unified diff / source"],
  ["N", "Show / hide notes"],
  ["T", "Switch folder tree / list"],
  ["R", "Mark reviewed / unreviewed"],
  ["Q", "Quote selected text"],
  ["Ctrl / ⌘ + K", "Search files"],
  ["?", "Keyboard shortcut reference"],
];
export function ShortcutsDialog({ onClose }) {
  const ref = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.querySelector("button")?.focus();
    function trap(e) {
      if (e.key === "Tab") {
        e.preventDefault();
        dialog.querySelector("button")?.focus();
      }
    }
    dialog.addEventListener("keydown", trap);
    return () => {
      dialog.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={ref}
        className="modal shortcuts-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <h2 id="shortcuts-title">
            <Keyboard size={20} /> Keyboard shortcuts
          </h2>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="muted">
          The same actions are available as buttons in the workspace.
        </p>
        <dl className="shortcuts-list">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
        <small>
          Document shortcuts also work in HTML previews. They are disabled while
          typing; search and Esc remain available.
        </small>
      </section>
    </div>
  );
}
