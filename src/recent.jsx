import React, { useEffect, useState, useRef } from "react";
import {
  History,
  GitPullRequest,
  X,
  ChevronRight,
  Loader2,
  Plus,
} from "lucide-react";
export function RecentList({ items, onSelect, busy }) {
  if (!items.length)
    return <p className="empty-small">No recent pull requests yet.</p>;
  return (
    <div className="recent-list">
      {items.map((item) => (
        <button
          type="button"
          className="recent-item"
          key={item.url}
          disabled={busy}
          onClick={() => onSelect(item)}
        >
          <GitPullRequest size={18} />
          <span>
            <strong>{item.title || "Pull request #" + item.id}</strong>
            <small>
              {item.org} / {item.project} / {item.repo} · PR #{item.id}
            </small>
            <small>
              {new Date(item.lastOpened).toLocaleString("en-US")}
              {!item.canOpen ? " · PAT required" : ""}
            </small>
          </span>
          <ChevronRight size={15} />
        </button>
      ))}
    </div>
  );
}
export function RecentDialog({ api, onClose, onSelect, demo }) {
  const dialogRef = useRef();
  const [items, setItems] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/recent")
      .then((result) => setItems(result.items))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const previous = document.activeElement,
      dialog = dialogRef.current;
    dialog.querySelector("button")?.focus();
    function trap(event) {
      if (event.key !== "Tab") return;
      const buttons = [
        ...dialog.querySelectorAll(
          "button:not(:disabled),a[href],input:not(:disabled)",
        ),
      ];
      const first = buttons[0],
        last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    dialog.addEventListener("keydown", trap);
    return () => {
      dialog.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  async function select(item) {
    setBusy(true);
    setError("");
    try {
      await onSelect(item);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={dialogRef}
        className="modal recent-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recent-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <h2 id="recent-title">
            <History size={20} /> Recent pull requests
          </h2>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="muted">
          Each PR keeps its repository and review. PATs are never stored in
          history.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {items ? (
          <RecentList items={items} busy={busy} onSelect={select} />
        ) : (
          <Loader2 size={20} className="spin" />
        )}
        {demo && (
          <button
            className="demo-other-repo"
            disabled={busy}
            onClick={() => select({ demo: true, repo: "operations-docs" })}
          >
            <Plus size={15} /> Open a second sample repository
          </button>
        )}
      </section>
    </div>
  );
}
