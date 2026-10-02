export const demoPr = {
  org: "demo",
  project: "Platform",
  repo: "platform-docs",
  id: 142,
  url: "https://dev.azure.com/demo/Platform/_git/platform-docs/pullrequest/142",
  title: "New platform architecture documentation",
  description: "Updated architecture, operations runbook, and HTML overview.",
  author: "Alex Morgan",
  status: "active",
  source: "docs/platform-v2",
  target: "main",
  iteration: 3,
  before: "demo-before",
  after: "demo-after",
  demo: true,
  files: [
    {
      path: "/docs/architecture.md",
      originalPath: "/docs/architecture.md",
      change: "edit",
      objectId: "demo-architecture-1",
      originalObjectId: "demo-architecture-base",
    },
    {
      path: "/docs/runbook.md",
      originalPath: "/docs/runbook.md",
      change: "add",
      objectId: "demo-runbook-1",
      originalObjectId: "new-file",
    },
    {
      path: "/docs/overview.html",
      originalPath: "/docs/overview.html",
      change: "edit",
      objectId: "demo-overview-1",
      originalObjectId: "demo-overview-base",
    },
  ],
};
const architecture = `# Platform architecture\n\n> Simple data flow. Clear boundaries. Reliable operations.\n\nThis guide describes the **new architecture** of the platform and each service’s responsibilities. Start with the overview below, then continue to the [operations runbook](runbook.md).\n\n## Request flow\n\n\`\`\`mermaid\nflowchart LR\n  A[Client] --> B[API Gateway]\n  B --> C[Identity service]\n  B --> D[Order service]\n  D --> E[(PostgreSQL)]\n  D --> F[Event bus]\n  F --> G[Notifications]\n\`\`\`\n\n## Service responsibilities\n\n| Service | Role | Owner |\n| :--- | :--- | :--- |\n| API Gateway | Routing and rate limiting | Platform |\n| Identity | Identity verification | Security |\n| Orders | Order lifecycle | Commerce |\n| Notifications | Asynchronous notifications | Platform |\n\n## Reliability principles\n\n- [x] Health check for every service\n- [x] Idempotent event processing\n- [ ] Verify the disaster recovery scenario\n\n<div><strong>Operations note:</strong> The retry policy uses exponential backoff.</div>\n\n### Configuration\n\n\`\`\`yaml\nretries:\n  attempts: 3\n  backoff: exponential\n  timeout: 30s\n\`\`\`\n\nSystem availability: $A = \\frac{MTBF}{MTBF + MTTR}$.\n\n## Next steps\n\nRead the [HTML overview](overview.html).\n`;
export const demoFiles = {
  "/docs/architecture.md": {
    after: architecture,
    before: architecture
      .replace("**new architecture**", "architecture")
      .replace(
        "  D --> F[Event bus]\n  F --> G[Notifications]",
        "  D --> G[Notifications]",
      )
      .replace(
        "| Notifications | Asynchronous notifications | Platform |",
        "| Notifications | Synchronous notifications | Commerce |",
      )
      .replace("attempts: 3", "attempts: 1"),
  },
  "/docs/runbook.md": {
    before: "",
    after:
      "# Operations runbook\n\n## Before deployment\n\n- [ ] Check migrations\n- [ ] Verify the backup\n\n```mermaid\nsequenceDiagram\n  participant O as Operator\n  participant P as Platform\n  O->>P: Deploy version\n  P-->>O: Health check OK\n```\n\n## Rollback\n\nOn failure, restore the previous version and verify the metrics.\n",
  },
  "/docs/overview.html": {
    before: "<h1>Platform v1</h1><p>Synchronous processing.</p>",
    after:
      '<!doctype html><html><head><style>body{font:16px/1.7 system-ui;padding:40px;background:#f7f7f5;color:#1a3c2b}h1{font-size:38px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{padding:24px;border:1px solid #d5ddd5;border-radius:8px}small{color:#69786d}</style></head><body><small>PLATFORM / VERSION 2.0</small><h1>Small services. Big possibilities.</h1><p>A fresh overview of services with asynchronous event processing.</p><div class="grid"><div class="card"><h2>Identity</h2><p>Secure authentication.</p></div><div class="card"><h2>Orders</h2><p>Reliable orders.</p></div><div class="card"><h2>Events</h2><p>Asynchronous communication.</p></div></div></body></html>',
  },
};
