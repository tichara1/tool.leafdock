import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  ArrowUpRight,
  Check,
  FolderTree,
  GitBranch,
  MessageSquare,
  Plug,
  Share2,
  Palette,
  Shield,
  Quote,
  CheckCircle2,
} from "lucide-react";
import { Document, Mermaid } from "./render.jsx";
import { SourceDiff } from "./main.jsx";
import { demoFiles } from "../server/demo.js";
import "./demo.css";

const catalog = [
  ["reader", "01", "Workspace"],
  ["markdown", "02", "Markdown & math"],
  ["diagrams", "03", "Mermaid diagrams"],
  ["html", "04", "HTML documents"],
  ["diff", "05", "Changes in context"],
  ["review", "06", "Review & collaboration"],
  ["mcp", "07", "Connect AI via MCP"],
  ["skins", "08", "Themes & customization"],
];
const diagrams = [
  [
    "Request flow",
    "flowchart LR\n A[Client] --> B[Gateway]\n B --> C[Identity]\n B --> D[Orders]\n D --> E[(Database)]",
  ],
  [
    "Sequence diagram",
    "sequenceDiagram\n participant U as Reviewer\n participant P as Leafdock\n participant A as Azure DevOps\n U->>P: Open PR\n P->>A: Load changes\n A-->>P: Files and commits\n U->>P: Save a note",
  ],
  [
    "Lifecycle",
    "stateDiagram-v2\n [*] --> Draft\n Draft --> InReview\n InReview --> Approved\n InReview --> ChangesRequested\n ChangesRequested --> InReview\n Approved --> [*]",
  ],
  [
    "Data model",
    "erDiagram\n PULL_REQUEST ||--o{ FILE : changes\n FILE ||--o{ NOTE : contains\n NOTE {\n string quote\n string comment\n int line\n }",
  ],
  [
    "Review plan",
    "gantt\n title Platform documentation\n dateFormat YYYY-MM-DD\n section Review\n Architecture :done, a1, 2026-09-28, 1d\n Operations runbook :active, a2, after a1, 1d\n Publication :a3, after a2, 1d",
  ],
];
function Gallery() {
  const [theme, setTheme] = useState("paper"),
    [unified, setUnified] = useState(false),
    [note, setNote] = useState("Is the event bus ready for repeated delivery?"),
    [reviewed, setReviewed] = useState(false),
    [status, setStatus] = useState("");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <div className="showcase">
      <header className="showcase-nav">
        <a href="#" className="brand">
          <span className="brand-mark">
            <BookOpen size={20} />
          </span>
          <strong>leafdock.</strong>
        </a>
        <span className="badge">DESIGN & FEATURE SHOWCASE</span>
        <select
          aria-label="Gallery theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        >
          <option value="paper">Paper</option>
          <option value="midnight">Midnight</option>
          <option value="parchment">Parchment</option>
        </select>
        <a className="gallery-app-link" href="/">
          Open app <ArrowUpRight size={16} />
        </a>
      </header>
      <main>
        <section className="showcase-hero">
          <div className="eyebrow">
            <span className="status-dot" /> EVERYTHING IN ONE PLACE
          </div>
          <h1>
            Documentation.
            <br />
            <span>Changes. Context.</span>
          </h1>
          <p>
            Leafdock brings a fresh perspective to documentation reviews in
            Azure DevOps.
            <br />
            Explore the current design and try every feature here.
          </p>
          <div className="gallery-facts">
            <span>
              <CheckCircle2 size={15} /> No PAT needed
            </span>
            <span>
              <Palette size={15} /> 3 themes
            </span>
            <span>
              <Plug size={15} /> MCP ready
            </span>
            <span>
              <Shield size={15} /> Local Docker
            </span>
          </div>
        </section>
        <nav className="gallery-index">
          {catalog.map(([id, n, title]) => (
            <a key={id} href={"#" + id}>
              <span>{n}</span>
              {title}
              <ArrowUpRight size={14} />
            </a>
          ))}
        </nav>
        <section id="reader" className="gallery-section">
          <SectionHead
            number="01"
            title="A place for your review."
            text="A working viewer with a sample PR. Expand the document with F, enter fullscreen with Shift+F, and show shortcuts with ?. Try the second repository in recent PRs. Use the branch icon to simulate a push, then reload with the update arrow while keeping your notes. The demo has its own session and never disconnects your real PR."
          />
          <div className="live-frame">
            <iframe
              title="Interactive Leafdock viewer demo"
              src="/?demo=1"
              allowFullScreen
            />
          </div>
          <a
            href="/?demo=1"
            target="_blank"
            rel="noreferrer"
            className="text-button"
          >
            Open the full demo <ArrowUpRight size={14} />
          </a>
        </section>
        <section id="markdown" className="gallery-section">
          <SectionHead
            number="02"
            title="Files worth reading."
            text="The same renderer as the app. Markdown, tables, checklists, inline HTML, math, and syntax highlighting."
          />
          <div className="gallery-document">
            <Document
              path="/docs/architecture.md"
              content={demoFiles["/docs/architecture.md"].after}
              side="after"
              theme={theme}
              onNavigate={() =>
                setStatus("Try relative links in the interactive viewer above.")
              }
            />
          </div>
        </section>
        <section id="diagrams" className="gallery-section">
          <SectionHead
            number="03"
            title="Ideas take shape."
            text="Mermaid is bundled locally. Zoom diagrams, open them fullscreen, and inspect their source."
          />
          <div className="diagram-gallery">
            {diagrams.map(([title, source]) => (
              <div className="diagram-example" key={title}>
                <h3>{title}</h3>
                <Mermaid source={source} theme={theme} />
              </div>
            ))}
          </div>
        </section>
        <section id="html" className="gallery-section">
          <SectionHead
            number="04"
            title="HTML with its own style."
            text="HTML documents render in an isolated frame. Their CSS is preserved; repository scripts never run."
          />
          <div className="gallery-document html-example">
            <Document
              path="/docs/overview.html"
              content={demoFiles["/docs/overview.html"].after}
              side="after"
              theme={theme}
              onNavigate={() => {}}
            />
          </div>
        </section>
        <section id="diff" className="gallery-section">
          <SectionHead
            number="05"
            title="Every change in context."
            text="Click a line number to quote it. The viewer also offers rendered visual diffs and final-file previews."
          />
          <div className="gallery-diff-controls">
            <button
              className={!unified ? "active" : ""}
              onClick={() => setUnified(false)}
            >
              Split diff
            </button>
            <button
              className={unified ? "active" : ""}
              onClick={() => setUnified(true)}
            >
              Unified diff
            </button>
          </div>
          <div className="gallery-diff">
            <SourceDiff
              file={demoFiles["/docs/architecture.md"]}
              unified={unified}
              onQuote={(q) =>
                setStatus("Line quote " + q.line + ": " + q.quote)
              }
            />
          </div>
        </section>
        <section id="review" className="gallery-section">
          <SectionHead
            number="06"
            title="From insight to collaboration."
            text="Notes and review progress are saved per PR and commit. Exports include quotes, comments, and DevOps links."
          />
          <div className="review-gallery">
            <div className="review-example">
              <div className="eyebrow">
                <Quote size={15} /> QUOTE + YOUR NOTE
              </div>
              <blockquote>
                Notifications · Asynchronous notifications · Platform
              </blockquote>
              <textarea
                aria-label="Sample note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                className="primary"
                onClick={() => setStatus("Sample note: " + note)}
              >
                <MessageSquare size={15} /> Try a note
              </button>
            </div>
            <div className="review-example">
              <div className="eyebrow">
                <FolderTree size={15} /> REVIEW PROGRESS
              </div>
              <button
                className={"gallery-check " + (reviewed ? "checked" : "")}
                onClick={() => setReviewed(!reviewed)}
              >
                <span className={"file-check " + (reviewed ? "checked" : "")}>
                  {reviewed && <Check size={12} />}
                </span>{" "}
                architecture.md{" "}
                <span>{reviewed ? "Reviewed" : "Awaiting review"}</span>
              </button>
              <progress value={reviewed ? 1 : 0} max={1} />
              <p className="muted">
                Switch between a tree and list, search files, and filter files
                awaiting review.
              </p>
              <div className="gallery-share-item">
                <Share2 size={19} />
                <div>
                  <h3>Prepare for Teams</h3>
                  <p>
                    A message draft for a colleague. You decide when to send it.
                  </p>
                </div>
              </div>
              <div className="gallery-share-item">
                <GitBranch size={19} />
                <div>
                  <h3>Publish to DevOps</h3>
                  <p>
                    Comment on a file or a specific line. Publish each note
                    individually.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="mcp" className="gallery-section">
          <SectionHead
            number="07"
            title="Connect your favorite AI tool."
            text="MCP over Streamable HTTP. Click Connect AI in the viewer above and copy your client configuration."
          />
          <div className="mcp-client-grid">
            {["Claude Code", "Codex", "Antigravity"].map((client) => (
              <div key={client}>
                <Plug size={23} />
                <h3>{client}</h3>
                <p>
                  Ready-to-copy configuration
                  <br />
                  Shared review in real time
                </p>
              </div>
            ))}
          </div>
          <div className="tool-catalog">
            {[
              "list_open_prs",
              "read_file",
              "get_review",
              "get_threads",
              "set_reviewed",
              "add_note",
              "publish_note",
            ].map((tool) => (
              <code key={tool}>{tool}</code>
            ))}
          </div>
          <p className="gallery-footnote">
            AI gets a separate MCP token. Your PAT stays on the server. MCP
            publishing is disabled by default.
          </p>
        </section>
        <section id="skins" className="gallery-section">
          <SectionHead
            number="08"
            title="Different mood. Same focus."
            text="Themes transform the whole workspace. Click to try one; the main app remembers your choice."
          />
          <div className="skin-gallery">
            {[
              ["paper", "Paper", "#f7f8f5", "#244d36"],
              ["midnight", "Midnight", "#151c19", "#b2d4b6"],
              ["parchment", "Parchment", "#f5efe3", "#6b582d"],
            ].map(([id, title, bg, fg]) => (
              <button
                key={id}
                onClick={() => setTheme(id)}
                className={theme === id ? "active" : ""}
              >
                <div style={{ background: bg, color: fg }}>
                  <BookOpen size={22} />
                  <span>Platform architecture</span>
                  <div className="skin-lines">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <strong>{title}</strong>
                {theme === id && <Check size={15} />}
              </button>
            ))}
          </div>
        </section>
        <footer className="showcase-footer">
          <div className="brand">
            <BookOpen size={20} />
            <strong>leafdock.</strong>
          </div>
          <span>Real components. Live design. Your local workspace.</span>
          <a href="/">
            Start reviewing <ArrowUpRight size={16} />
          </a>
        </footer>
      </main>
      {status && (
        <div className="toast" role="status">
          {status}
          <button
            onClick={() => setStatus("")}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
function SectionHead({ number, title, text }) {
  return (
    <div className="gallery-heading">
      <div className="eyebrow">{number} / LEAFDOCK WORKSPACE</div>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<Gallery />);
