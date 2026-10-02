import React, { useState, useEffect } from "react";
import { X, Copy, CheckCircle2, Plug, Loader2 } from "lucide-react";
const shellQuote = (value) =>
  "'" + String(value).replaceAll("'", "'\\''") + "'";
export function McpDialog({ api, onClose, notify }) {
  const [config, setConfig] = useState(null),
    [client, setClient] = useState("claude"),
    [error, setError] = useState("");
  useEffect(() => {
    api("/mcp-config")
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);
  const url = window.location.origin + "/mcp";
  const snippets = config
    ? {
        claude: `claude mcp add --transport http --scope user leafdock ${shellQuote(url)} \\\n  --header ${shellQuote("Authorization: Bearer " + config.token)}\n\n# Check the connection in a new Claude Code session:\n# /mcp`,
        codex: `# Run in the terminal you will use to start Codex:\nexport LEAFDOCK_MCP_TOKEN=${shellQuote(config.token)}\ncodex mcp add leafdock --url ${shellQuote(url)} --bearer-token-env-var LEAFDOCK_MCP_TOKEN\n\n# Alternative for ~/.codex/config.toml:\n# [mcp_servers.leafdock]\n# url = "${url}"\n# bearer_token_env_var = "LEAFDOCK_MCP_TOKEN"\n\n# Verify: codex mcp list; then start a new Codex session`,
        antigravity: JSON.stringify(
          {
            mcpServers: {
              leafdock: {
                serverUrl: url,
                headers: { Authorization: "Bearer " + config.token },
              },
            },
          },
          null,
          2,
        ),
        generic: JSON.stringify(
          {
            mcpServers: {
              leafdock: {
                type: "http",
                url,
                headers: { Authorization: "Bearer " + config.token },
              },
            },
          },
          null,
          2,
        ),
      }
    : {};
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal mcp-setup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcp-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <h2 id="mcp-title">
            <Plug size={19} /> Connect AI via MCP
          </h2>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="muted">
          AI tools can access open PRs, original and final files, and your
          review. Their notes appear automatically in the viewer.
        </p>
        {error ? (
          <p className="error">{error}</p>
        ) : !config ? (
          <Loader2 className="spin" />
        ) : (
          <>
            <div className="mcp-info">
              <CheckCircle2 size={16} /> Streamable HTTP · {url}
            </div>
            <div className="mcp-tabs">
              {[
                ["claude", "Claude Code"],
                ["codex", "Codex"],
                ["antigravity", "Antigravity"],
                ["generic", "Other client"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={id === client ? "active" : ""}
                  onClick={() => setClient(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="muted">
              {client === "antigravity"
                ? "Antigravity CLI: open the manager in /mcp, or add leafdock to ~/.gemini/config/mcp_config.json (global) or .agents/mcp_config.json (project). In the IDE, use Manage MCP Servers → View raw config."
                : client === "generic"
                  ? "Add this server to your client’s MCP configuration with Streamable HTTP support."
                  : "Copy the commands into your terminal, then open a new client session."}
            </p>
            <pre className="mcp-code">{snippets[client]}</pre>
            <button
              className="primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(snippets[client]);
                  notify("MCP configuration copied.");
                } catch {
                  notify("Select and copy the configuration text.");
                }
              }}
            >
              <Copy size={16} /> Copy configuration
            </button>
            <label className="mcp-settings">
              <input
                type="checkbox"
                checked={config.publish}
                onChange={async (e) => {
                  try {
                    const result = await api("/mcp-config", {
                      method: "PATCH",
                      body: { publish: e.target.checked },
                    });
                    setConfig((c) => ({ ...c, ...result }));
                  } catch (e) {
                    notify(e.message);
                  }
                }}
              />{" "}
              Allow AI to publish comments to DevOps
            </label>
            <p className="mcp-tools">
              Tools: list_open_prs · read_file · get_review · get_threads ·
              set_reviewed · add_note · publish_note
              <br />
              Prompt: review-documentation · Resource: leafdock://help
            </p>
            <small>
              This configuration includes an MCP token granting access to open
              PRs. It never includes your Azure DevOps PAT. The token persists
              in the Docker volume. Publishing is disabled by default.
            </small>
          </>
        )}
      </section>
    </div>
  );
}
