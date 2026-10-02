import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  GitPullRequest,
  GitBranch,
  ArrowRight,
  ArrowLeft,
  Search,
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  Code2,
  List,
  FolderTree,
  MessageSquare,
  Share2,
  ExternalLink,
  X,
  Plus,
  Trash2,
  Copy,
  Download,
  RefreshCw,
  PanelRightClose,
  PanelRightOpen,
  Quote,
  Send,
  Sun,
  Moon,
  Palette,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Expand,
  Shrink,
  Keyboard,
  History,
  ArrowDownToLine,
  AlertCircle,
  Menu,
  Plug,
} from "lucide-react";
import { diffLines } from "diff";
import { Document } from "./render.jsx";
import { McpDialog } from "./mcp.jsx";
import { DOCUMENT_MODES, ShortcutsDialog } from "./shortcuts.jsx";
import { RecentDialog, RecentList } from "./recent.jsx";
import "./styles.css";

export async function api(url, options = {}) {
  const response = await fetch("/api" + url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(new URLSearchParams(window.location.search).has("demo")
        ? { "X-Leafdock-Demo": "1" }
        : {}),
      ...options.headers,
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(data.error || "The request failed."), {
      status: response.status,
      code: data.code,
    });
  return data;
}
function IconButton({ icon: Icon, label, ...props }) {
  return (
    <button className="icon-button" title={label} aria-label={label} {...props}>
      <Icon size={17} />
    </button>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <BookOpen size={20} />
      </span>
      <strong>
        Leafdock<span className="brand-dot">.</span>
      </strong>
    </div>
  );
}
function Spinner() {
  return (
    <span className="loading">
      <Loader2 size={18} className="spin" /> Loading…
    </span>
  );
}
function useLocal(key, initial) {
  const [value, set] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, set];
}
const skins = [
  ["paper", "Paper", Sun],
  ["midnight", "Midnight", Moon],
  ["parchment", "Parchment", Palette],
];
function ThemePicker({ theme, setTheme }) {
  return (
    <label className="theme-picker">
      <Palette size={16} />
      <select
        aria-label="Theme"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
      >
        {skins.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Connect({ onConnect, theme, setTheme, initialUrl = "" }) {
  const [url, setUrl] = useState(initialUrl),
    [pat, setPat] = useState(""),
    [config, setConfig] = useState(null),
    [wizard, setWizard] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [recent, setRecent] = useState([]);
  useEffect(() => {
    api("/config")
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    api("/recent")
      .then((result) => setRecent(result.items))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (initialUrl) void submit(null, false, initialUrl, undefined, "");
  }, []);
  async function submit(
    e,
    demo = false,
    targetUrl = url,
    demoRepository,
    submittedPat = pat,
  ) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      onConnect(
        await api("/connect", {
          method: "POST",
          body: { url: targetUrl, pat: submittedPat, demo, demoRepository },
        }),
      );
      setPat("");
    } catch (e) {
      if (e.code === "PAT_REQUIRED") {
        setError(e.message);
        try {
          const info = await api("/pat-link", {
            method: "POST",
            body: { url: targetUrl },
          });
          setWizard(info);
          window.open(info.url, "_blank", "noopener,noreferrer");
        } catch (linkError) {
          setError(linkError.message);
        }
      } else setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="welcome">
      <header>
        <Brand />
        <ThemePicker theme={theme} setTheme={setTheme} />
      </header>
      <main className="welcome-main">
        <div className="eyebrow">
          <span className="status-dot" /> YOUR QUIET SPACE FOR REVIEW
        </div>
        <h1>
          Pull request.
          <br />
          <span>A fresh perspective.</span>
        </h1>
        <p className="welcome-copy">
          Read documentation the way it was meant to look.
          <br />
          Diagrams, changes, and your notes. All in one place.
        </p>
        <form className="connect-card" onSubmit={submit}>
          <div className="card-heading">
            <GitPullRequest size={20} />
            <h2>Open pull request</h2>
            <span className="badge">AZURE DEVOPS</span>
          </div>
          <label htmlFor="pr-url">Pull request URL</label>
          <input
            id="pr-url"
            type="url"
            autoFocus
            required
            placeholder="https://dev.azure.com/organization/project/_git/repo/pullrequest/142"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setWizard(null);
            }}
          />
          {wizard && (
            <div className="pat-guide">
              <h3>Connect Azure DevOps</h3>
              <p>
                We opened the token settings in a new tab. Create a token with
                these values:
              </p>
              <dl>
                <dt>Name</dt>
                <dd>{wizard.name}</dd>
                <dt>Organization</dt>
                <dd>{wizard.organization}</dd>
                <dt>Permissions</dt>
                <dd>{wizard.scope}</dd>
              </dl>
              <p className="muted">
                Choose a short expiry. DevOps does not document a URL for
                prefilling this form.
              </p>
              <a href={wizard.url} target="_blank" rel="noreferrer">
                Open token settings <ExternalLink size={13} />
              </a>
              <label htmlFor="pat">Personal Access Token</label>
              <input
                id="pat"
                type="password"
                autoComplete="off"
                required
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="Paste your new PAT"
              />
              <small>
                The token stays in server session memory. It is never saved in
                notes or browser storage.
              </small>
            </div>
          )}
          {config?.hasPat && (
            <p className="connection-state">
              <CheckCircle2 size={15} /> Token configured through the
              environment
              {config.organization ? " · " + config.organization : ""}
            </p>
          )}
          {error && (
            <div className="error" role="alert">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          <button
            disabled={busy || !config}
            className="primary connect-submit"
            type="submit"
          >
            {busy ? (
              <Spinner />
            ) : (
              <>
                Open review <ArrowRight size={17} />
              </>
            )}
          </button>
          <div className="demo-row">
            Want to look around first?{" "}
            <button
              type="button"
              className="text-button"
              onClick={(e) => submit(e, true)}
              disabled={busy}
            >
              Try the demo <ArrowRight size={13} />
            </button>
          </div>
        </form>
        {recent.length > 0 && (
          <section className="welcome-recent">
            <div className="eyebrow">
              <History size={15} /> RECENT PULL REQUESTS
            </div>
            <RecentList
              items={recent}
              busy={busy}
              onSelect={(item) => {
                setUrl(item.url);
                setWizard(null);
                setPat("");
                void submit(null, item.demo, item.url, item.repo, "");
              }}
            />
          </section>
        )}
        <div className="welcome-features">
          <span>
            <BookOpen size={16} /> Markdown & HTML
          </span>
          <span>
            <GitBranch size={16} /> Mermaid diagrams
          </span>
          <span>
            <MessageSquare size={16} /> Review without switching tools
          </span>
        </div>
      </main>
      <footer>
        LOCAL WORKSPACE · v{__APP_VERSION__}{" "}
        <span>Your notes stay with you.</span>
      </footer>
    </div>
  );
}

function fileKind(path) {
  return /\.mdx?$/i.test(path)
    ? "MD"
    : /\.html?$/i.test(path)
      ? "HTML"
      : "CODE";
}
function FileRow({
  file,
  active,
  reviewed,
  onSelect,
  onReview,
  depth = 0,
  list = false,
}) {
  return (
    <div
      className={"file-row " + (active ? "selected" : "")}
      style={{ paddingLeft: 12 + depth * 14 }}
    >
      <button
        className={"file-check " + (reviewed ? "checked" : "")}
        aria-label={
          (reviewed ? "Mark unreviewed: " : "Mark reviewed: ") + file.path
        }
        onClick={() => onReview(file.path, !reviewed)}
        aria-pressed={reviewed}
      >
        {reviewed ? <Check size={12} /> : null}
      </button>
      <button
        className="file-name"
        title={file.path}
        onClick={() => onSelect(file.path)}
      >
        <span className={"file-type " + fileKind(file.path).toLowerCase()}>
          {fileKind(file.path) === "HTML" ? (
            <Code2 size={15} />
          ) : (
            <FileText size={15} />
          )}
        </span>
        <span>
          {file.path.split("/").at(-1)}
          {list && (
            <small>
              {file.path.slice(0, file.path.lastIndexOf("/")) || "/"}
            </small>
          )}
        </span>
      </button>
      <span className={"change-tag " + file.change} title={file.change}>
        {file.change.includes("add")
          ? "A"
          : file.change.includes("delete")
            ? "D"
            : file.change.includes("rename")
              ? "R"
              : "M"}
      </span>
    </div>
  );
}
function buildTree(files) {
  const root = { folders: {}, files: [] };
  for (const file of files) {
    let node = root;
    const parts = file.path.split("/").filter(Boolean);
    for (const part of parts.slice(0, -1))
      node = node.folders[part] ??= { folders: {}, files: [] };
    node.files.push(file);
  }
  return root;
}
function Tree({
  node,
  prefix = "",
  depth = 0,
  collapsed,
  setCollapsed,
  ...props
}) {
  return (
    <>
      {Object.entries(node.folders)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, child]) => {
          const path = prefix + "/" + name,
            closed = collapsed.includes(path);
          return (
            <div key={path}>
              <button
                className="folder-row"
                style={{ paddingLeft: 12 + depth * 14 }}
                aria-expanded={!closed}
                onClick={() =>
                  setCollapsed(
                    closed
                      ? collapsed.filter((p) => p !== path)
                      : [...collapsed, path],
                  )
                }
              >
                {closed ? (
                  <ChevronRight size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
                <Folder size={15} />
                <span>{name}</span>
              </button>
              {!closed && (
                <Tree
                  node={child}
                  prefix={path}
                  depth={depth + 1}
                  collapsed={collapsed}
                  setCollapsed={setCollapsed}
                  {...props}
                />
              )}
            </div>
          );
        })}
      {node.files.map((file) => (
        <FileRow
          {...props}
          key={file.path}
          file={file}
          depth={depth}
          active={props.selected === file.path}
          reviewed={props.reviewed.includes(file.path)}
        />
      ))}
    </>
  );
}

export function SourceDiff({ file, unified, onQuote }) {
  const rows = useMemo(() => {
    let left = 0,
      right = 0;
    return diffLines(file.before, file.after).flatMap((part) => {
      const lines = part.value.replace(/\n$/, "").split("\n");
      return lines.map((text) => ({
        text,
        type: part.added ? "added" : part.removed ? "removed" : "same",
        left: part.added ? null : ++left,
        right: part.removed ? null : ++right,
      }));
    });
  }, [file]);
  function line(row, side) {
    if (!(side === "before" ? row.left : row.right))
      return <span className="line-number" />;
    return (
      <button
        className="line-number"
        title="Comment on this line"
        onClick={() =>
          onQuote({
            quote: row.text,
            side,
            line: side === "before" ? row.left : row.right,
          })
        }
      >
        {side === "before" ? row.left : row.right}
      </button>
    );
  }
  if (unified)
    return (
      <div className="source-diff unified">
        {rows.map((row, i) => (
          <div className={"diff-line " + row.type} key={i}>
            {line(row, "before")}
            {line(row, "after")}
            <span className="diff-sign">
              {row.type === "added" ? "+" : row.type === "removed" ? "-" : " "}
            </span>
            <code>{row.text || " "}</code>
          </div>
        ))}
      </div>
    );
  // Align deletion/addition groups so corresponding source lines sit opposite one another.
  const aligned = [];
  for (let i = 0; i < rows.length;) {
    if (rows[i].type === "same") {
      aligned.push([rows[i], rows[i]]);
      i++;
      continue;
    }
    const removed = [],
      added = [];
    while (i < rows.length && rows[i].type !== "same") {
      (rows[i].type === "removed" ? removed : added).push(rows[i++]);
    }
    for (let j = 0; j < Math.max(removed.length, added.length); j++)
      aligned.push([removed[j], added[j]]);
  }
  return (
    <div className="source-diff split-source">
      <div className="diff-head">
        <span>ORIGINAL FILE</span>
        <span>FINAL FILE</span>
      </div>
      {aligned.map(([before, after], i) => (
        <div className="split-line" key={i}>
          {[
            [before, "before"],
            [after, "after"],
          ].map(([row, side]) => (
            <div key={side} className={"diff-line " + (row?.type || "empty")}>
              {row ? (
                <>
                  {line(row, side)}
                  <code>{row.text || " "}</code>
                </>
              ) : (
                <span>&nbsp;</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
function download(name, text, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function prFileLink(pr, note) {
  const url = new URL(pr.url);
  url.searchParams.set("_a", "files");
  url.searchParams.set("path", note.path);
  if (note.threadId)
    url.searchParams.set("discussionId", String(note.threadId));
  return url.href;
}
function reviewText(pr, review) {
  return `# Review: ${pr.title}\n\n${pr.url}\nCommit: ${pr.after}\n\nReviewed: ${review.reviewed.length}/${pr.files.length} files\n\n${review.notes
    .map(
      (n) =>
        `## ${n.path}${n.line ? " · line " + n.line : ""}\n\n${
          n.quote
            ? n.quote
                .split("\n")
                .map((l) => "> " + l)
                .join("\n") + "\n\n"
            : ""
        }${n.text}\n\n${n.commit && n.commit !== pr.after ? "Original quote: commit " + n.commit + " · iteration " + n.iteration + "\n\n" : ""}${prFileLink(pr, n)}\n`,
    )
    .join("\n")}`;
}
function ShareDialog({ pr, review, onClose, notify }) {
  const [email, setEmail] = useState("");
  const text = reviewText(pr, review);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal share-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <h2 id="share-title">Share your review</h2>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <p className="muted">
          Quotes, notes, and direct PR links. Your colleague does not need your
          local viewer.
        </p>
        <textarea
          aria-label="Shared review preview"
          className="share-preview"
          value={text}
          readOnly
        />
        <label htmlFor="colleague">Colleague’s Teams email</label>
        <input
          id="colleague"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@example.com"
        />
        <div className="modal-actions">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                notify("Review copied.");
              } catch {
                notify(
                  "Clipboard unavailable. Select the text in the preview.",
                );
              }
            }}
          >
            <Copy size={16} /> Copy
          </button>
          <button
            onClick={() => download("leafdock-review-" + pr.id + ".md", text)}
          >
            <Download size={16} /> Markdown
          </button>
          <button
            onClick={() =>
              download(
                "leafdock-review-" + pr.id + ".json",
                JSON.stringify(
                  { pr: { url: pr.url, commit: pr.after }, ...review },
                  null,
                  2,
                ),
                "application/json",
              )
            }
          >
            <Download size={16} /> JSON
          </button>
        </div>
        <button
          className="primary"
          disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
          onClick={() => {
            const url = new URL("https://teams.microsoft.com/l/chat/0/0");
            url.searchParams.set("users", email);
            url.searchParams.set("message", text);
            window.open(url.href, "_blank", "noopener,noreferrer");
          }}
        >
          <Send size={16} /> Prepare a Teams message
        </button>
        <small>
          Opens a chat draft. You send the message yourself. Copy or export
          longer reviews.
        </small>
      </section>
    </div>
  );
}

export function App() {
  const [mcpOpen, setMcpOpen] = useState(false);
  const [focused, setFocused] = useState(false),
    [fullscreen, setFullscreen] = useState(false),
    [shortcutsOpen, setShortcutsOpen] = useState(false);
  const workspaceRef = useRef(),
    wasFullscreen = useRef(false),
    previousFocus = useRef(false);
  const [recentOpen, setRecentOpen] = useState(false),
    [connectUrl, setConnectUrl] = useState(""),
    [updates, setUpdates] = useState(null),
    [updateError, setUpdateError] = useState(""),
    [reloading, setReloading] = useState(false);
  const [allNotes, setAllNotes] = useState(false);
  const [theme, setTheme] = useLocal("leafdock-theme", "paper"),
    [tree, setTree] = useLocal("leafdock-tree", true),
    [collapsed, setCollapsed] = useLocal("leafdock-collapsed", []);
  const [data, setData] = useState(null),
    [starting, setStarting] = useState(true),
    [selected, setSelected] = useState(""),
    [file, setFile] = useState(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [mode, setMode] = useLocal("leafdock-mode", "preview"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [notesOpen, setNotesOpen] = useState(true),
    [navOpen, setNavOpen] = useState(false),
    [share, setShare] = useState(false),
    [toast, setToast] = useState(""),
    [quote, setQuote] = useState(null),
    [noteText, setNoteText] = useState(""),
    [saving, setSaving] = useState(false),
    [publishing, setPublishing] = useState(""),
    [threads, setThreads] = useState([]),
    [threadError, setThreadError] = useState("");
  const searchRef = useRef(),
    noteRef = useRef(),
    readerRef = useRef(),
    toastTimer = useRef();
  const notify = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  };
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    const update = () => {
      const active = document.fullscreenElement === workspaceRef.current;
      setFullscreen(active);
      if (wasFullscreen.current && !active) setFocused(previousFocus.current);
      wasFullscreen.current = active;
    };
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === workspaceRef.current) {
        await document.exitFullscreen();
        return;
      }
      if (
        !document.fullscreenEnabled ||
        !workspaceRef.current?.requestFullscreen
      ) {
        setFocused(true);
        notify(
          "Fullscreen is unavailable. The document has been expanded across the workspace.",
        );
        return;
      }
      previousFocus.current = focused;
      await workspaceRef.current.requestFullscreen();
      setFocused(true);
      setNavOpen(false);
    } catch {
      notify("The browser did not allow fullscreen. Use expanded preview (F).");
    }
  }
  function toggleFocus() {
    setFocused((value) => !value);
    setNavOpen(false);
  }
  function toggleNotes() {
    if (focused) {
      setFocused(false);
      setNotesOpen(true);
    } else setNotesOpen((value) => !value);
  }
  function focusSearch() {
    setFocused(false);
    if (window.innerWidth <= 700) setNavOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }
  const accept = (d) => {
    setData(d);
    setSelected(d.pr.files[0]?.path || "");
    setQuote(null);
    setNoteText("");
    setError("");
    setFocused(false);
    setUpdates(null);
    setUpdateError("");
    setRecentOpen(false);
    setAllNotes(false);
  };
  useEffect(() => {
    const demo = new URLSearchParams(window.location.search).has("demo");
    (demo
      ? api("/connect", { method: "POST", body: { demo: true } })
      : api("/pr")
    )
      .then(accept)
      .catch(() => {})
      .finally(() => setStarting(false));
    return () => clearTimeout(toastTimer.current);
  }, []);
  useEffect(() => {
    if (!data) return;
    const timer = setInterval(() => {
      api("/pr")
        .then((fresh) =>
          setData((current) =>
            current?.pr.url === fresh.pr.url &&
            fresh.pr.iteration >= current.pr.iteration
              ? fresh
              : current,
          ),
        )
        .catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [data?.pr.url]);
  useEffect(() => {
    if (!data) return;
    let active = true,
      running = false;
    async function check() {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      try {
        const result = await api("/updates");
        if (active) {
          setUpdates(result);
          setUpdateError("");
        }
      } catch (e) {
        if (active) setUpdateError(e.message);
      } finally {
        running = false;
      }
    }
    void check();
    const timer = setInterval(check, 30000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [data?.pr.url, data?.pr.after, data?.pr.before, data?.pr.iteration]);
  useEffect(() => {
    if (!data) return;
    let active = true;
    setThreadError("");
    api("/threads")
      .then((d) => {
        if (active) setThreads(d.value || []);
      })
      .catch((e) => {
        if (active) setThreadError(e.message);
      });
    return () => {
      active = false;
    };
  }, [data?.pr.after, data?.pr.before, data?.pr.url]);
  useEffect(() => {
    if (!data || !selected) return;
    let active = true;
    setLoading(true);
    setFile(null);
    setError("");
    setQuote(null);
    api("/file?path=" + encodeURIComponent(selected))
      .then((f) => {
        if (active) setFile(f);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    readerRef.current?.scrollTo({ top: 0 });
    return () => {
      active = false;
    };
  }, [selected, data?.pr.after, data?.pr.before, data?.pr.url]);
  const pr = data?.pr,
    review = data?.review || { reviewed: [], notes: [] };
  const files = (pr?.files || []).filter(
    (f) =>
      f.path.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "docs" && fileKind(f.path) !== "CODE") ||
        (filter === "unread" && !review.reviewed.includes(f.path))),
  );
  async function updateReview(path, reviewed) {
    try {
      const result = await api("/review", {
        method: "PATCH",
        body: { path, reviewed },
      });
      setData((d) => ({ ...d, review: result }));
    } catch (e) {
      notify(e.message);
    }
  }
  function select(path) {
    if (noteText.trim() && path !== selected) {
      notify(
        "Your draft belongs to the original file. Save or clear it before switching files.",
      );
      return;
    }
    setSelected(path);
    setNavOpen(false);
  }
  useEffect(() => {
    function handle(e) {
      if (e.defaultPrevented || e.isComposing || e.repeat) return;
      const key = e.key.toLowerCase();
      if (e.key === "Escape") {
        if (share || mcpOpen || shortcutsOpen || recentOpen) {
          setShare(false);
          setMcpOpen(false);
          setShortcutsOpen(false);
          setRecentOpen(false);
        } else if (navOpen) setNavOpen(false);
        else if (document.fullscreenElement === workspaceRef.current)
          document.exitFullscreen().catch(() => {});
        else setFocused(false);
        return;
      }
      if (
        !pr ||
        reloading ||
        saving ||
        share ||
        mcpOpen ||
        shortcutsOpen ||
        recentOpen ||
        (e.target instanceof Element && e.target.closest('[role="dialog"]'))
      )
        return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && key === "k") {
        e.preventDefault();
        focusSearch();
        return;
      }
      if (
        e.target instanceof Element &&
        e.target.closest("input,textarea,select,[contenteditable]")
      )
        return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (key === "f") {
        e.preventDefault();
        if (e.shiftKey) void toggleFullscreen();
        else toggleFocus();
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (e.shiftKey) return;
      if (/^[1-5]$/.test(key)) {
        e.preventDefault();
        setMode(DOCUMENT_MODES[Number(key) - 1][0]);
        return;
      }
      if (key === "n") {
        e.preventDefault();
        toggleNotes();
        return;
      }
      if (key === "t") {
        e.preventDefault();
        setTree((value) => !value);
        return;
      }
      if (key === "q") {
        e.preventDefault();
        selectionQuote();
        return;
      }
      const index = files.findIndex((f) => f.path === selected);
      if (key === "j")
        select(files[Math.min(index + 1, files.length - 1)]?.path || selected);
      if (key === "k") select(files[Math.max(index - 1, 0)]?.path || selected);
      if (key === "r" && pr?.files.some((f) => f.path === selected))
        updateReview(selected, !review.reviewed.includes(selected));
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [
    files,
    selected,
    review,
    noteText,
    share,
    mcpOpen,
    shortcutsOpen,
    recentOpen,
    focused,
    navOpen,
    reloading,
    saving,
  ]);
  function captureQuote(value) {
    setQuote({ ...value, path: selected });
    setFocused(false);
    setNotesOpen(true);
    setTimeout(() => noteRef.current?.focus(), 0);
  }
  function selectionQuote() {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text) return notify("Select a passage in the document first.");
    const node = selection.anchorNode?.parentElement?.closest("[data-side]");
    if (!node || !readerRef.current?.contains(node)) return;
    captureQuote({
      quote: text.slice(0, 20000),
      side: node.dataset.side || "after",
    });
    selection.removeAllRanges();
  }
  async function saveNote() {
    setSaving(true);
    try {
      const result = await api("/notes", {
        method: "POST",
        body: {
          path: quote?.path || selected,
          text: noteText,
          quote: quote?.quote || "",
          side: quote?.side || "after",
          ...(quote?.line ? { line: quote.line } : {}),
        },
      });
      setData((d) => ({ ...d, review: result }));
      setQuote(null);
      setNoteText("");
      notify("Note saved locally.");
      return true;
    } catch (e) {
      notify(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  }
  async function reloadPr() {
    if (reloading || saving) return;
    setReloading(true);
    try {
      if (noteText.trim() && !(await saveNote())) return;
      const fresh = await api("/refresh", { method: "POST", body: {} });
      setData(fresh);
      setUpdates(null);
      setUpdateError("");
      setQuote(null);
      if (!fresh.pr.files.some((f) => f.path === selected))
        setSelected(fresh.pr.files[0]?.path || "");
      notify("PR updated. Your original notes have been preserved.");
    } catch (e) {
      notify(e.message);
    } finally {
      setReloading(false);
    }
  }
  async function openRecent(item) {
    if (noteText.trim() && !(await saveNote())) return;
    try {
      accept(
        await api("/connect", {
          method: "POST",
          body: { url: item.url, demo: item.demo, demoRepository: item.repo },
        }),
      );
    } catch (e) {
      if (e.code === "PAT_REQUIRED") {
        setConnectUrl(item.url);
        setRecentOpen(false);
        setData(null);
      } else throw e;
    }
  }
  async function publishNote(note) {
    setPublishing(note.id);
    try {
      const result = await api("/notes/" + note.id + "/publish", {
        method: "POST",
        body: {},
      });
      setData((d) => ({ ...d, review: result }));
      notify("Comment published to Azure DevOps.");
      const existing = await api("/threads");
      setThreads(existing.value || []);
    } catch (e) {
      notify(e.message);
    } finally {
      setPublishing("");
    }
  }
  if (starting)
    return (
      <div className="boot">
        <Brand />
        <Spinner />
      </div>
    );
  if (!data)
    return (
      <Connect
        onConnect={accept}
        theme={theme}
        setTheme={setTheme}
        initialUrl={connectUrl}
      />
    );
  const selectedNotes = allNotes
      ? review.notes
      : review.notes.filter((n) => n.path === selected),
    existingThreads = threads.filter(
      (t) =>
        !t.isDeleted &&
        t.threadContext?.filePath === selected &&
        !review.notes.some((n) => n.threadId === t.id),
    );
  const changed = diffLines(file?.before || "", file?.after || "");
  const added = changed
      .filter((p) => p.added)
      .reduce((n, p) => n + (p.count || 0), 0),
    removed = changed
      .filter((p) => p.removed)
      .reduce((n, p) => n + (p.count || 0), 0);
  const modes = DOCUMENT_MODES;
  return (
    <div
      ref={workspaceRef}
      className={"workspace" + (focused ? " focus-mode" : "")}
    >
      <header className="topbar">
        <IconButton
          icon={Menu}
          label="Show files"
          className="icon-button mobile-menu"
          onClick={() => setNavOpen(!navOpen)}
        />
        <Brand />
        <span className="top-divider" />
        <div className="repo-label">
          {pr.repo}
          <ChevronRight size={13} />
          <span>PR #{pr.id}</span>
        </div>
        <div className="top-actions">
          <IconButton
            icon={History}
            label="Recent pull requests"
            onClick={() => setRecentOpen(true)}
          />
          {pr.demo && (
            <IconButton
              icon={GitBranch}
              label="Simulate a new push in the demo PR"
              onClick={async () => {
                try {
                  await api("/demo/push", { method: "POST", body: {} });
                  setUpdates(await api("/updates"));
                } catch (e) {
                  notify(e.message);
                }
              }}
            />
          )}
          {pr.demo && <span className="badge demo-badge">DEMO</span>}
          <ThemePicker theme={theme} setTheme={setTheme} />
          <button
            className="share-button"
            onClick={() => setMcpOpen(true)}
            title="Connect AI via MCP"
          >
            <Plug size={15} />
            <span>Connect AI</span>
          </button>
          <IconButton
            icon={RefreshCw}
            label="Reload the latest PR version"
            onClick={reloadPr}
            disabled={reloading || saving}
          />
          <button className="share-button" onClick={() => setShare(true)}>
            <Share2 size={15} />
            <span>Share review</span>
          </button>
          <IconButton
            icon={Plus}
            label="Open another pull request"
            onClick={async () => {
              if (noteText.trim() && !(await saveNote())) return;
              setConnectUrl("");
              setData(null);
              setThreads([]);
            }}
          />
        </div>
      </header>
      <div className="workspace-body">
        <aside className={"sidebar " + (navOpen ? "mobile-open" : "")}>
          <div className="sidebar-head">
            <div className="eyebrow">
              PR FILES <span>{pr.files.length}</span>
            </div>
            <div className="view-switch">
              <IconButton
                icon={FolderTree}
                label="Folder tree"
                aria-pressed={tree}
                onClick={() => setTree(true)}
              />
              <IconButton
                icon={List}
                label="File list"
                aria-pressed={!tree}
                onClick={() => setTree(false)}
              />
            </div>
          </div>
          <label className="search">
            <Search size={16} />
            <input
              ref={searchRef}
              placeholder="Find a file…"
              aria-label="Search files"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>⌘ K</kbd>
          </label>
          <div className="file-filters">
            {[
              ["all", "All"],
              ["docs", "Documents"],
              ["unread", "Unreviewed"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={filter === key ? "active" : ""}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="file-list">
            {files.length ? (
              tree ? (
                <Tree
                  node={buildTree(files)}
                  collapsed={search ? [] : collapsed}
                  setCollapsed={setCollapsed}
                  selected={selected}
                  reviewed={review.reviewed}
                  onSelect={select}
                  onReview={updateReview}
                />
              ) : (
                files.map((f) => (
                  <FileRow
                    key={f.path}
                    file={f}
                    list
                    active={selected === f.path}
                    reviewed={review.reviewed.includes(f.path)}
                    onSelect={select}
                    onReview={updateReview}
                  />
                ))
              )
            ) : (
              <p className="empty-small">No matching files.</p>
            )}
          </div>
          <div className="review-progress">
            <div>
              <CheckCircle2 size={16} />
              <strong>Your progress</strong>
              <span>
                {review.reviewed.length}/{pr.files.length}
              </span>
            </div>
            <progress
              value={review.reviewed.length}
              max={pr.files.length || 1}
            />
            <small>
              {review.reviewed.length === pr.files.length
                ? "All files reviewed."
                : "Check off each file after reviewing it."}
            </small>
          </div>
          <div className="sidebar-footer">
            <span className="status-dot" /> Local workspace · v{__APP_VERSION__}{" "}
            <span title="J / K: next / previous file · R: reviewed">J K R</span>
          </div>
        </aside>
        <main className="main-pane">
          <section className="pr-header">
            <div className="pr-meta">
              <span className="badge status-badge">
                <span className="status-dot" />
                {pr.status === "active" ? "OPEN PR" : pr.status.toUpperCase()}
              </span>
              <span>{pr.author}</span>
              <a
                href={pr.url}
                target="_blank"
                rel="noreferrer"
                title="Open in Azure DevOps"
              >
                <ExternalLink size={14} />
              </a>
            </div>
            <h1>{pr.title}</h1>
            <div className="branches">
              <GitBranch size={14} />
              <code>{pr.source}</code>
              <ArrowRight size={12} />
              <code>{pr.target}</code>
              <span>·</span>
              <span>Iteration {pr.iteration}</span>
              <span className="commit-id" title={pr.after}>
                {pr.after.slice(0, 8)}
              </span>
            </div>
          </section>
          <div className="document-toolbar">
            <div className="breadcrumb">
              <FileText size={16} />
              <span>{selected || "No changed files"}</span>
              {file && (
                <span className="diff-stats">
                  <b>+{added}</b>
                  <em>−{removed}</em>
                </span>
              )}
            </div>
            <div className="document-actions">
              {updates?.available && (
                <button
                  className="update-button"
                  aria-label="Load new PR changes"
                  title={
                    "New iteration " +
                    updates.iteration +
                    " · notes will be preserved"
                  }
                  disabled={reloading || saving}
                  onClick={reloadPr}
                >
                  <ArrowDownToLine size={16} />
                  <span>New changes</span>
                  <b>{updates.iteration}</b>
                </button>
              )}
              <IconButton
                icon={ArrowLeft}
                label="Previous file (K)"
                disabled={files.findIndex((f) => f.path === selected) <= 0}
                onClick={() =>
                  select(
                    files[files.findIndex((f) => f.path === selected) - 1]
                      ?.path || selected,
                  )
                }
              />
              <IconButton
                icon={ArrowRight}
                label="Next file (J)"
                disabled={
                  files.findIndex((f) => f.path === selected) >=
                    files.length - 1 || !files.length
                }
                onClick={() =>
                  select(
                    files[files.findIndex((f) => f.path === selected) + 1]
                      ?.path || selected,
                  )
                }
              />
              <IconButton
                icon={Quote}
                label="Quote selected text"
                title="Quote selected text (Q)"
                aria-keyshortcuts="q"
                onClick={selectionQuote}
              />
              {pr.files.some((f) => f.path === selected) && (
                <button
                  className={
                    "reviewed-button " +
                    (review.reviewed.includes(selected) ? "is-reviewed" : "")
                  }
                  onClick={() =>
                    updateReview(selected, !review.reviewed.includes(selected))
                  }
                >
                  <Check size={15} />
                  <span>
                    {review.reviewed.includes(selected)
                      ? "Reviewed"
                      : "Mark reviewed"}
                  </span>
                </button>
              )}
              <IconButton
                icon={notesOpen ? PanelRightClose : PanelRightOpen}
                label={notesOpen ? "Hide notes" : "Show notes"}
                title="Show / hide notes (N)"
                aria-keyshortcuts="n"
                onClick={toggleNotes}
              />
              <IconButton
                icon={focused ? Shrink : Expand}
                label={
                  focused ? "Restore workspace (F)" : "Expand document (F)"
                }
                aria-pressed={focused}
                aria-keyshortcuts="f"
                onClick={toggleFocus}
              />
              <IconButton
                icon={fullscreen ? Minimize : Maximize}
                label={
                  fullscreen
                    ? "Exit fullscreen (Shift+F)"
                    : "Fullscreen (Shift+F)"
                }
                aria-pressed={fullscreen}
                aria-keyshortcuts="Shift+f"
                onClick={toggleFullscreen}
              />
              <IconButton
                icon={Keyboard}
                label="Keyboard shortcuts (?)"
                aria-keyshortcuts="Shift+/"
                onClick={() => setShortcutsOpen(true)}
              />
            </div>
          </div>
          <nav className="mode-tabs" aria-label="File view">
            {modes.map(([id, label]) => (
              <button
                key={id}
                aria-pressed={mode === id}
                className={mode === id ? "active" : ""}
                onClick={() => setMode(id)}
                title={
                  label +
                  " (" +
                  (modes.findIndex(([key]) => key === id) + 1) +
                  ")"
                }
                aria-keyshortcuts={String(
                  modes.findIndex(([key]) => key === id) + 1,
                )}
              >
                {label}
              </button>
            ))}
            <span className="render-label">
              {fileKind(selected) === "MD"
                ? "MARKDOWN + MERMAID"
                : fileKind(selected) === "HTML"
                  ? "HTML PREVIEW"
                  : "TEXT"}
            </span>
          </nav>
          <div className={"reader mode-" + mode} ref={readerRef}>
            {loading ? (
              <div className="reader-message">
                <Spinner />
              </div>
            ) : error ? (
              <div className="reader-message error" role="alert">
                <AlertCircle />
                {error}
              </div>
            ) : file ? (
              <>
                {mode === "preview" ? (
                  <div
                    data-side={
                      file.change.includes("delete") ? "before" : "after"
                    }
                    className="document-wrap"
                  >
                    {file.change.includes("delete") && (
                      <div className="deletion-banner">
                        This file was deleted in the PR. Showing the original
                        content.
                      </div>
                    )}
                    <Document
                      path={selected}
                      content={
                        file.change.includes("delete")
                          ? file.before
                          : file.after
                      }
                      side={file.change.includes("delete") ? "before" : "after"}
                      theme={theme}
                      onNavigate={select}
                      onQuote={captureQuote}
                    />
                  </div>
                ) : mode === "visual" ? (
                  <div className="visual-diff">
                    {["before", "after"].map((side) => (
                      <section key={side} data-side={side}>
                        <div className={"version-label " + side}>
                          <span>{side === "before" ? "BEFORE" : "AFTER"}</span>
                          <code>{pr[side].slice(0, 8)}</code>
                        </div>
                        <div className="document-wrap">
                          {file[side] ? (
                            <Document
                              path={
                                side === "before" ? file.originalPath : selected
                              }
                              content={file[side]}
                              side={side}
                              theme={theme}
                              onNavigate={select}
                              onQuote={captureQuote}
                            />
                          ) : (
                            <p className="empty-small">
                              {side === "before" ? "New file" : "File deleted"}
                            </p>
                          )}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : mode === "source" ? (
                  <div className="source-view" data-side="after">
                    {(file.after || file.before).split("\n").map((line, i) => (
                      <div className="diff-line" key={i}>
                        <button
                          className="line-number"
                          onClick={() =>
                            captureQuote({
                              quote: line,
                              side: file.after ? "after" : "before",
                              line: i + 1,
                            })
                          }
                        >
                          {i + 1}
                        </button>
                        <code>{line || " "}</code>
                      </div>
                    ))}
                  </div>
                ) : (
                  <SourceDiff
                    file={file}
                    unified={mode === "unified"}
                    onQuote={captureQuote}
                  />
                )}
              </>
            ) : (
              <div className="reader-message">Select a file from the list.</div>
            )}
          </div>
          <footer className="reader-footer">
            <span>
              <span className="status-dot" />{" "}
              {pr.demo ? "Demo PR" : "Connected to Azure DevOps"}
            </span>
            <span>
              {updateError ? (
                <span
                  className="update-error"
                  role="status"
                  title={updateError}
                >
                  <AlertCircle size={12} /> Update check failed · reload the PR
                </span>
              ) : (
                <span
                  title={
                    updates?.checkedAt
                      ? "Last checked: " +
                        new Date(updates.checkedAt).toLocaleTimeString("en-US")
                      : ""
                  }
                >
                  <RefreshCw size={12} /> Checking for changes every 30 s
                </span>
              )}
            </span>
          </footer>
        </main>
        {notesOpen && (
          <aside className="notes-pane">
            <div className="notes-heading">
              <MessageSquare size={17} />
              <h2>Notes</h2>
              <span>{selectedNotes.length}</span>
              <IconButton
                icon={X}
                label="Hide notes"
                onClick={() => setNotesOpen(false)}
              />
            </div>
            <div className="notes-content">
              <div className="notes-scope" role="group" aria-label="Note scope">
                <button
                  aria-pressed={!allNotes}
                  onClick={() => setAllNotes(false)}
                >
                  This file
                </button>
                <button
                  aria-pressed={allNotes}
                  onClick={() => setAllNotes(true)}
                >
                  Entire PR ({review.notes.length})
                </button>
              </div>
              <div className="note-composer">
                <div className="eyebrow">YOUR NOTE</div>
                <p className="note-file">
                  {quote?.path || selected}
                  {quote?.line ? " : " + quote.line : ""}
                </p>
                {quote && (
                  <blockquote className="quote-preview">
                    <button
                      aria-label="Clear quote"
                      onClick={() => setQuote(null)}
                    >
                      <X size={13} />
                    </button>
                    {quote.quote}
                  </blockquote>
                )}
                <textarea
                  ref={noteRef}
                  aria-label="Note text"
                  value={noteText}
                  disabled={saving || reloading}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="What deserves a closer look?"
                  rows={4}
                />
                <div className="composer-footer">
                  <span>Saved locally</span>
                  <button
                    className="primary small"
                    disabled={
                      !noteText.trim() || saving || reloading || !selected
                    }
                    onClick={saveNote}
                  >
                    {saving ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <Plus size={14} />
                    )}{" "}
                    Save
                  </button>
                </div>
              </div>
              {selectedNotes.length === 0 && existingThreads.length === 0 && (
                <div className="notes-empty">
                  <Quote size={24} />
                  <h3>A good review starts with a question.</h3>
                  <p>
                    Select text to add a quote, or write a note about the whole
                    file.
                  </p>
                </div>
              )}
              {selectedNotes.map((note) => (
                <article className="note-card" key={note.id}>
                  <div className="note-card-meta">
                    <span>
                      {note.threadId ? "IN DEVOPS" : "LOCAL NOTE"}
                      {note.line ? " · L" + note.line : ""}
                    </span>
                    <IconButton
                      icon={Trash2}
                      label="Delete local note"
                      onClick={async () => {
                        try {
                          const result = await api("/notes/" + note.id, {
                            method: "DELETE",
                            body: {},
                          });
                          setData((d) => ({ ...d, review: result }));
                        } catch (e) {
                          notify(e.message);
                        }
                      }}
                    />
                  </div>
                  {note.commit && note.commit !== pr.after && (
                    <small className="note-version">
                      From an earlier version · {note.commit.slice(0, 8)} ·
                      iteration {note.iteration}
                    </small>
                  )}
                  {allNotes && (
                    <small className="note-version">
                      {note.path}
                      {!pr.files.some((f) => f.path === note.path)
                        ? " · no longer in the changed files"
                        : ""}
                    </small>
                  )}
                  {note.quote && <blockquote>{note.quote}</blockquote>}
                  <p>{note.text}</p>
                  <div className="note-card-actions">
                    {note.threadId ? (
                      <a
                        href={prFileLink(pr, note)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <CheckCircle2 size={13} /> Published{" "}
                        <ExternalLink size={12} />
                      </a>
                    ) : (
                      <button
                        className="text-button"
                        disabled={pr.demo || !!publishing}
                        onClick={() => publishNote(note)}
                      >
                        {publishing === note.id ? (
                          <Loader2 size={13} className="spin" />
                        ) : (
                          <Send size={13} />
                        )}{" "}
                        Publish to DevOps
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {existingThreads.length > 0 && (
                <div className="eyebrow existing-label">DEVOPS DISCUSSIONS</div>
              )}
              {existingThreads.map((t) => (
                <article className="note-card existing" key={t.id}>
                  {t.comments
                    ?.filter((c) => !c.isDeleted)
                    .map((c) => (
                      <div key={c.id}>
                        <strong>{c.author?.displayName}</strong>
                        <p>{c.content}</p>
                      </div>
                    ))}
                  <a
                    href={prFileLink(pr, { path: selected, threadId: t.id })}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open discussion <ExternalLink size={12} />
                  </a>
                </article>
              ))}
              {threadError && (
                <p className="error">
                  Unable to load discussions: {threadError}
                </p>
              )}
            </div>
            <div className="notes-bottom">
              <button onClick={() => setShare(true)}>
                <Share2 size={15} /> Share all notes <ArrowRight size={14} />
              </button>
              <small>Your review, ready for a colleague.</small>
            </div>
          </aside>
        )}
      </div>
      {share && (
        <ShareDialog
          pr={pr}
          review={review}
          onClose={() => setShare(false)}
          notify={notify}
        />
      )}{" "}
      {mcpOpen && (
        <McpDialog
          api={api}
          onClose={() => setMcpOpen(false)}
          notify={notify}
        />
      )}
      {shortcutsOpen && (
        <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />
      )}
      {recentOpen && (
        <RecentDialog
          api={api}
          onClose={() => setRecentOpen(false)}
          onSelect={openRecent}
          demo={pr.demo}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={16} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
if (!window.location.pathname.endsWith("/demo.html"))
  createRoot(document.getElementById("root")).render(<App />);
