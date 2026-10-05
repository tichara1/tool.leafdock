# Leafdock

A quiet place to review Azure DevOps documentation pull requests.

Read Markdown, HTML, and Mermaid diagrams as rendered documents. Compare
versions, check off reviewed files, and collect quoted notes without switching
tools. Leafdock runs locally in Docker and is free to use under the [MIT license](LICENSE).

## Quick start

Build from source (available immediately):

```sh
git clone https://github.com/tichara1/tool.leafdock.git
cd tool.leafdock
cp .env.example .env
# Set AZURE_DEVOPS_PAT (and optionally AZURE_DEVOPS_PR) in .env
docker compose up -d --build
```

You can also pass `AZURE_DEVOPS_PAT` (and `AZURE_DEVOPS_PR`) directly when starting Docker Compose:

```sh
AZURE_DEVOPS_PAT="your_pat_here" docker compose up -d
# Or in Windows PowerShell:
$env:AZURE_DEVOPS_PAT="your_pat_here"; docker compose up -d
```

Open [localhost:3000](http://localhost:3000). Try the app without a token at
[/?demo=1](http://localhost:3000/?demo=1), or explore every feature at
[/demo.html](http://localhost:3000/demo.html).

After the first container release has been published and made public:

```sh
docker run -d --name leafdock \
  -p 127.0.0.1:3000:3000 \
  -e AZURE_DEVOPS_PAT="your_pat_here" \
  -e AZURE_DEVOPS_PR="https://dev.azure.com/organization/project/_git/repository/pullrequest/123" \
  -v leafdock-data:/app/data \
  ghcr.io/tichara1/leafdock:latest
```

Or pass your `.env` file directly to `docker run`:

```sh
docker run -d --name leafdock \
  --env-file .env \
  -p 127.0.0.1:3000:3000 \
  -v leafdock-data:/app/data \
  ghcr.io/tichara1/leafdock:latest
```

Or use `docker compose -f compose.registry.yaml up -d`. To update, run
`docker compose -f compose.registry.yaml pull`, then `up -d` with the same file.
Keep the volume: `down` preserves it, but `down -v` deletes saved reviews.
Use a version tag such as `:1.0.0` instead of `:latest` for a pinned deployment.

Images target `linux/amd64` and `linux/arm64`. The port binds to loopback only.
This is a single-user local tool, not an internet-facing multi-tenant service.

## Azure DevOps connection

Enter a cloud PR URL such as:

```text
https://dev.azure.com/organization/project/_git/repository/pullrequest/123
```

Legacy `organization.visualstudio.com` cloud URLs also work. Azure DevOps Server
is not supported. Without an environment PAT, the app opens your organization's
PAT settings and explains the required fields. DevOps does not document a URL
for prefilling the new-token form. If the popup is blocked, use the wizard link.

- Reading PRs needs `Code: Read`.
- Publishing comments needs `Code: Read & write`.
- Choose a short expiry. PATs remain in server session memory, never browser
  storage or saved reviews. Re-enter a user-supplied token after a server restart.

Optionally copy `.env.example` to `.env` and configure `AZURE_DEVOPS_PAT` and
`AZURE_DEVOPS_ORG`. The organization setting restricts that environment token to
one organization. A different organization requires its own PAT. Never commit
`.env`, credentials, real PR exports, or the data volume.

### Token from the command line

Skip the token form entirely with the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
and Node.js 22:

```sh
az login
npm run token -- --org organization            # PAT (Code: Read & write, 30 days) → .env
npm run token -- --org organization --push     # …and apply it to a running Leafdock
npm run token -- --org organization --entra    # Entra ID token (~1 hour), no PAT created
npm run -s token -- --org organization --print # print only, e.g. AZURE_DEVOPS_PAT=$(…)
```

The script creates the PAT through the
[PAT Lifecycle API](https://learn.microsoft.com/en-us/rest/api/azure/devops/tokens/pats/create?view=azure-devops-rest-7.1)
with the right scope; `--days` changes the lifetime. Organization policies can
block API-created PATs or limit their lifetime; then use `--entra` or the form.
`AZURE_DEVOPS_PAT` also accepts an Entra ID access token (sent as Bearer).

Without `--push`, restart to apply the new `.env` (`docker compose up -d`).
`--push` calls `PUT /api/admin/token` with the MCP bearer token
(`LEAFDOCK_MCP_TOKEN` in the environment or `.env`; copy it from **Connect AI**).
The replacement stays in memory and also updates open sessions that used the
old environment token. Without the script:

```sh
curl -X PUT http://127.0.0.1:3000/api/admin/token \
  -H "Authorization: Bearer $LEAFDOCK_MCP_TOKEN" -H "Content-Type: application/json" \
  -d "{\"token\":\"$(az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798 --query accessToken -o tsv)\",\"organization\":\"organization\"}"
```

## Features

- Folder tree or flat file list, search, document and unreviewed filters.
- Final preview, rendered side-by-side visual diff, split source diff, unified
  diff, and line-numbered source. Expanded workspace and browser fullscreen.
- Compact chrome for maximum preview space: collapsible file sidebar and notes
  (remembered between sessions); HTML previews fill the whole reader.
- Markdown tables, checklists, highlighted code, KaTeX math, safe inline HTML,
  and repository-relative links and images.
- Locally bundled Mermaid 11 with fit-to-view, zoom relative to the natural
  size (buttons or Ctrl/Cmd + scroll), drag to pan, fullscreen, source, and
  syntax errors.
- Isolated HTML previews preserving CSS and relative assets. Repository scripts
  are removed; only the viewer's nonce-protected quote/navigation bridge runs.
  In-page `#anchor` links scroll, and links such as `other.md#section` open the
  file at that section (Markdown too).
- Quoted and line-specific notes, review checkboxes, existing DevOps discussions,
  and explicit publication of individual comments. Re-publishing a saved note
  does not create a duplicate comment.
- Recent history of 30 PRs across repositories, projects, and organizations.
- Update checks every 30 seconds while visible and when returning to the window.
  An update arrow announces a new iteration; the document does not change under
  your cursor. Reload saves a draft and preserves notes, quotes, original line
  context, and publication status. Changed files need review again; unchanged
  files stay checked. “Entire PR” includes notes for files no longer in the diff.
- Teams chat drafts with quotes, comments, and DevOps links; clipboard, Markdown,
  and JSON exports. You select the recipient and send the message yourself.
- Paper, Midnight, and Parchment themes, responsive layout, keyboard shortcuts.
- Authenticated MCP for AI coding tools, sharing notes and progress with the UI.

The showcase includes a second demo repository and a simulated push button.
Its embedded demo session never disconnects a real PR. “Visual diff” means two
rendered documents; source diffs show exact added and removed lines. HTML/MDX
JavaScript does not execute. Preview limits: text 3 MB, assets 10 MB.

## Shortcuts

| Key                | Action                                           |
| ------------------ | ------------------------------------------------ |
| `F` / `Shift+F`    | Expanded preview / fullscreen                    |
| `Esc`              | Close dialog or return to the workspace          |
| `J` / `K`          | Next / previous file                             |
| `1`–`5`            | Preview / visual / split / unified diff / source |
| `N` / `T`          | Toggle notes / tree or list                      |
| `B`                | Show / hide the file sidebar                     |
| `R` / `Q`          | Toggle reviewed / quote selection                |
| `Ctrl/Cmd+K` / `?` | Search / shortcut reference                      |

Shortcuts also work inside HTML previews and are disabled while typing in fields.

## MCP: Claude Code, Codex, Antigravity

Open a PR or demo, click **Connect AI**, select your client, and copy the generated
configuration. The server uses Streamable HTTP at `/mcp`, seven tools, the
`leafdock://help` resource, and a `review-documentation` prompt. Your Azure PAT
is never sent to the AI client.

The separate bearer token persists in the volume. Set `LEAFDOCK_MCP_TOKEN`
(at least 24 characters) to manage it yourself. Keep the generated configuration
private: it grants access to open PRs. MCP publishing is disabled by default;
enable it explicitly in the UI or with `MCP_ALLOW_PUBLISH=true`. Every publish
call also requires `confirmPublish: true`. The UI switch lasts until restart.

Tools: `list_open_prs`, `read_file`, `get_review`, `get_threads`, `set_reviewed`,
`add_note`, `publish_note`. Start with `list_open_prs` to get a `contextId`.
The web UI syncs shared review state every three seconds.

## Development

Use Node.js 22 (see `.nvmrc`) and npm:

```sh
npm ci
npm run dev
# http://127.0.0.1:5173, backend http://127.0.0.1:3000

npm run format:check
npm test
npm run build
npm start
# Or start with PR URL and PAT as parameters:
npm start -- https://dev.azure.com/org/proj/_git/repo/pullrequest/123 [pat]
npm start -- --url https://dev.azure.com/... --pat <pat>

npx playwright install chromium
npm run test:e2e
```

`npm run build` includes all production dependency and font notices. They are
available at `/THIRD_PARTY_NOTICES.txt`; see [THIRD_PARTY.md](THIRD_PARTY.md).
API tests mock Azure DevOps and use a real MCP SDK connection. Browser tests
exercise rendering, review state, security, navigation, and updates. Live
DevOps and Teams delivery still require your own account and PR.

## Releases and public Docker images

[RELEASING.md](RELEASING.md) explains the one-time GitHub/GHCR setup and first
publication. Workflows verify PRs, prepare SemVer release PRs from Conventional
Commits, and publish versioned multi-platform images after release. No registry
passwords or Azure DevOps PATs are required by CI.

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before
opening an issue or contributing. `private: true` in `package.json` only prevents
accidental npm publication; the source and container are intended to be public.

## References

- [Azure DevOps PATs](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate)
- [PR iteration changes](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-iteration-changes/get?view=azure-devops-rest-7.1)
- [PR comment threads](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/create?view=azure-devops-rest-7.1)
- [Teams chat links](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/deep-link-teams)
- [MCP SDK](https://ts.sdk.modelcontextprotocol.io/server)
- [Claude Code MCP](https://code.claude.com/docs/en/mcp)
- [Codex MCP](https://developers.openai.com/codex/mcp)
- [Antigravity MCP](https://antigravity.google/docs/mcp)
