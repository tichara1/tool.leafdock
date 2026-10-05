import express from "express";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  AppError,
  parsePrUrl,
  loadPr,
  readItem,
  azure,
  checkPr,
  isEntraToken,
} from "./azure.js";
import { Store, reviewKey } from "./store.js";
import { demoPr, demoFiles } from "./demo.js";
import { installMcp } from "./mcp.js";
import { boundedBytes, rewriteRepoCss } from "./assets.js";

export const USAGE = `Usage: npm start -- [options] [pr_url] [pat]

Options:
  --url <url>, -u       Azure DevOps Pull Request URL
  --pat <token>, -p     Azure DevOps Personal Access Token (or Entra token)
  --org <name>, -o      Azure DevOps organization restriction
  --port <number>       Port to listen on (default: 3000)
  -h, --help            Show help

Examples:
  npm start -- https://dev.azure.com/org/proj/_git/repo/pullrequest/123 my-pat
  npm start -- my-pat
  npm start -- --url https://dev.azure.com/... --pat my-pat
`;

export function isPrUrl(str) {
  if (typeof str !== "string") return false;
  const s = str.trim();
  return (
    /^https?:\/\//i.test(s) ||
    s.includes("dev.azure.com") ||
    s.includes(".visualstudio.com") ||
    s.includes("pullrequest")
  );
}

export function cleanToken(str) {
  if (typeof str !== "string") return "";
  let s = str.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

export function parseCliArgs(args = process.argv.slice(2)) {
  let url = "";
  let pat = "";
  let org = "";
  let port;
  let help = false;
  const positionals = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help" || arg === "help") {
      help = true;
    } else if (
      arg.startsWith("--url=") ||
      arg.startsWith("--pr=") ||
      arg.startsWith("url=") ||
      arg.startsWith("pr=")
    ) {
      url = arg.split("=").slice(1).join("=");
    } else if (arg === "--url" || arg === "-u" || arg === "--pr") {
      url = args[++i] || "";
    } else if (
      arg.startsWith("--pat=") ||
      arg.startsWith("--token=") ||
      arg.startsWith("pat=") ||
      arg.startsWith("token=")
    ) {
      pat = arg.split("=").slice(1).join("=");
    } else if (
      arg === "--pat" ||
      arg === "-p" ||
      arg === "-pat" ||
      arg === "--token" ||
      arg === "-t"
    ) {
      pat = args[++i] || "";
    } else if (arg.startsWith("--org=") || arg.startsWith("org=")) {
      org = arg.split("=").slice(1).join("=");
    } else if (arg === "--org" || arg === "-o") {
      org = args[++i] || "";
    } else if (arg.startsWith("--port=") || arg.startsWith("port=")) {
      port = Number(arg.split("=")[1]);
    } else if (arg === "--port") {
      port = Number(args[++i]);
    } else if (!arg.startsWith("-")) {
      positionals.push(arg);
    }
  }

  for (const pos of positionals) {
    if (isPrUrl(pos)) {
      if (!url) url = pos;
    } else {
      if (!pat) pat = pos;
      else if (!url) url = pos;
    }
  }

  return {
    url: cleanToken(url),
    pat: cleanToken(pat),
    org: cleanToken(org),
    port: Number.isInteger(port) && port > 0 ? port : undefined,
    help,
  };
}

export function loadEnv(envPath = ".env") {
  if (typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(envPath);
    } catch (e) {
      if (e?.code !== "ENOENT") throw e;
    }
  }
}

export function createApp({
  dataDir = process.env.DATA_DIR || "data",
  envPat = cleanToken(
    process.env.AZURE_DEVOPS_PAT ||
      process.env.AZURE_PAT ||
      process.env.AZURE_DEVOPS_TOKEN ||
      process.env.PAT ||
      "",
  ),
  envOrg = cleanToken(
    process.env.AZURE_DEVOPS_ORG || process.env.AZURE_ORG || "",
  ),
  initialPrUrl = cleanToken(
    process.env.AZURE_DEVOPS_PR ||
      process.env.AZURE_DEVOPS_PR_URL ||
      process.env.PR_URL ||
      process.env.PR ||
      "",
  ),
} = {}) {
  envPat = cleanToken(envPat);
  envOrg = cleanToken(envOrg);
  initialPrUrl = cleanToken(initialPrUrl);
  const app = express(),
    sessions = new Map(),
    store = new Store(dataDir);
  let defaultSession = null;
  let defaultSessionPromise = null;

  async function ensureDefaultSession() {
    if (defaultSession) return defaultSession;
    if (!initialPrUrl) return null;
    if (!defaultSessionPromise) {
      defaultSessionPromise = (async () => {
        const pr = parsePrUrl(initialPrUrl);
        const token =
          envPat && (!envOrg || pr.org.toLowerCase() === envOrg.toLowerCase())
            ? envPat
            : "";
        if (!token) return null;
        const loaded = await loadPr(pr, token);
        const review = await store.prepare(loaded);
        const credentials = { [pr.org.toLowerCase()]: token };
        const id = randomUUID();
        const s = {
          pr: loaded,
          token,
          touched: Date.now(),
          credentials,
        };
        sessions.set(id, s);
        defaultSession = s;
        return s;
      })();
    }
    try {
      return await defaultSessionPromise;
    } catch (err) {
      defaultSessionPromise = null;
      throw err;
    }
  }
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const host = req.hostname;
    const allowed = [
      "localhost",
      "127.0.0.1",
      "[::1]",
      ...(process.env.LEAFDOCK_ALLOWED_HOSTS || "").split(",").filter(Boolean),
    ];
    if (!allowed.includes(host))
      return res.status(403).json({ error: "Host not allowed" });
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    if (!["GET", "HEAD"].includes(req.method)) {
      const origin = req.get("origin");
      if (origin && new URL(origin).host !== req.get("host"))
        return res
          .status(403)
          .json({ error: "The request must originate from the viewer." });
      if (!req.is("application/json"))
        return res
          .status(415)
          .json({ error: "Content-Type application/json is required." });
    }
    req.cookieName =
      req.get("x-leafdock-demo") === "1"
        ? "leafdock_demo_session"
        : "leafdock_session";
    const id = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(req.cookieName + "="))
      ?.slice(req.cookieName.length + 1);
    req.sessionId = id;
    req.session = sessions.get(id);
    if (req.session) req.session.touched = Date.now();
    next();
  });
  const timer = setInterval(() => {
    for (const [id, s] of sessions)
      if (Date.now() - s.touched > 8 * 3600000) sessions.delete(id);
  }, 60000);
  timer.unref();
  function session(req) {
    if (!req.session)
      throw new AppError("Your session has expired. Reopen the PR.", 401);
    return req.session;
  }
  async function readySession(req) {
    const s = session(req);
    if (s.refreshPromise) await s.refreshPromise;
    return s;
  }
  const demoScope = (req) =>
    req.get("x-leafdock-demo") === "1" || !!req.session?.pr.demo;
  app.get("/api/recent", async (req, res) => {
    const items = await store.recent(demoScope(req));
    res.json({
      items: items.map(({ snapshot, ...item }) => ({
        ...item,
        canOpen:
          item.demo ||
          !!(
            envPat &&
            (!envOrg || envOrg.toLowerCase() === item.org.toLowerCase())
          ) ||
          !!req.session?.credentials?.[item.org.toLowerCase()],
      })),
    });
  });
  app.get("/api/health", (_, res) =>
    res.json({
      ok: true,
      version: JSON.parse(
        readFileSync(new URL("../package.json", import.meta.url), "utf8"),
      ).version,
    }),
  );
  app.get("/api/config", (_, res) =>
    res.json({
      hasPat: !!envPat,
      organization: envOrg,
      ...(initialPrUrl ? { initialPrUrl } : {}),
    }),
  );
  app.post("/api/pat-link", (req, res) => {
    const pr = parsePrUrl(req.body.url);
    res.json({
      url: `https://dev.azure.com/${encodeURIComponent(pr.org)}/_usersSettings/tokens`,
      name: "Leafdock local PR review",
      scope: "Code: Read & write",
      organization: pr.org,
    });
  });
  app.post("/api/connect", async (req, res) => {
    const pr = req.body.demo
      ? structuredClone(demoPr)
      : parsePrUrl(req.body.url);
    if (pr.demo && req.body.demoRepository === "operations-docs") {
      pr.repo = "operations-docs";
      pr.title = "Platform operations documentation";
      pr.url = pr.url.replace("/platform-docs/", "/operations-docs/");
    }
    if (
      !pr.demo &&
      envPat &&
      envOrg &&
      pr.org.toLowerCase() !== envOrg.toLowerCase() &&
      !req.body.pat &&
      !req.session?.credentials?.[pr.org.toLowerCase()]
    )
      throw Object.assign(
        new AppError(
          "For organization " + pr.org + " provide your own PAT.",
          401,
        ),
        { code: "PAT_REQUIRED" },
      );
    const credentials = { ...req.session?.credentials };
    const token =
      req.body.pat ||
      credentials[pr.org.toLowerCase()] ||
      (envPat && (!envOrg || pr.org.toLowerCase() === envOrg.toLowerCase())
        ? envPat
        : "");
    if (!pr.demo && (!token || typeof token !== "string"))
      throw Object.assign(
        new AppError("Enter a PAT or set AZURE_DEVOPS_PAT.", 401),
        { code: "PAT_REQUIRED" },
      );
    let loaded;
    try {
      loaded = pr.demo ? structuredClone(pr) : await loadPr(pr, token);
    } catch (error) {
      if ([401, 403].includes(error.status)) error.code = "PAT_REQUIRED";
      throw error;
    }
    const review = await store.prepare(loaded);
    if (!pr.demo) credentials[pr.org.toLowerCase()] = token;
    const id = randomUUID();
    sessions.set(id, {
      pr: loaded,
      token: pr.demo ? "" : token,
      touched: Date.now(),
      credentials,
    });
    const old = req.sessionId;
    if (old) sessions.delete(old);
    res.cookie(req.cookieName, id, {
      httpOnly: true,
      sameSite: "strict",
      secure: req.secure,
      maxAge: 8 * 3600000,
      path: "/",
    });
    res.json({ pr: loaded, review });
  });
  app.get("/api/pr", async (req, res) => {
    if (!req.session && initialPrUrl) {
      const def = await ensureDefaultSession().catch(() => null);
      if (def) {
        req.session = def;
        const id = [...sessions.entries()].find(([, s]) => s === def)?.[0];
        if (id) {
          req.sessionId = id;
          res.cookie(req.cookieName, id, {
            httpOnly: true,
            sameSite: "strict",
            secure: req.secure,
            maxAge: 8 * 3600000,
            path: "/",
          });
        }
      }
    }
    const { pr } = await readySession(req);
    res.json({ pr, review: await store.read(reviewKey(pr)) });
  });
  app.post("/api/refresh", async (req, res) => {
    const s = session(req);
    if (!s.refreshPromise)
      s.refreshPromise = (async () => {
        const previous = s.pr;
        const next = previous.demo
          ? s.demoLatest || previous
          : await loadPr(previous, s.token);
        const review = await store.prepare(next, previous);
        s.pr = next;
        s.updateCache = null;
        return { pr: next, review };
      })();
    try {
      res.json(await s.refreshPromise);
    } finally {
      s.refreshPromise = null;
    }
  });
  app.get("/api/updates", async (req, res) => {
    const s = await readySession(req);
    if (!s.updateCache || Date.now() - s.updateCache.checkedAt > 25000) {
      if (!s.checkPromise)
        s.checkPromise = (async () => {
          const latest = s.pr.demo
            ? s.demoLatest || s.pr
            : await checkPr(s.pr, s.token);
          return {
            after: latest.after,
            before: latest.before,
            iteration: latest.iteration,
            status: latest.status,
            checkedAt: Date.now(),
          };
        })();
      try {
        s.updateCache = await s.checkPromise;
      } finally {
        s.checkPromise = null;
      }
    }
    res.json({
      ...s.updateCache,
      available:
        s.updateCache.after !== s.pr.after ||
        s.updateCache.before !== s.pr.before ||
        s.updateCache.iteration !== s.pr.iteration,
    });
  });
  app.post("/api/demo/push", async (req, res) => {
    const s = await readySession(req);
    if (!s.pr.demo)
      throw new AppError("This action is only available in the demo.", 403);
    const latest = structuredClone(s.demoLatest || s.pr);
    latest.iteration++;
    latest.after = "demo-update-" + latest.iteration;
    latest.files.find((f) => f.path === "/docs/architecture.md").objectId =
      latest.after;
    s.demoLatest = latest;
    s.updateCache = null;
    res.json({ ok: true });
  });
  app.post("/api/logout", (req, res) => {
    const id = req.sessionId;
    sessions.delete(id);
    res.clearCookie(req.cookieName);
    res.json({ ok: true });
  });
  app.get("/api/file", async (req, res) => {
    const { pr, token } = await readySession(req),
      filePath = String(req.query.path || "");
    const file = pr.files.find((x) => x.path === filePath) || {
      path: filePath,
      originalPath: filePath,
      change: "unchanged",
    };
    if (!filePath.startsWith("/")) throw new AppError("Invalid path.");
    if (pr.demo) {
      if (!demoFiles[filePath]) throw new AppError("File not found.", 404);
      const contents = { ...demoFiles[filePath] };
      if (
        pr.after.startsWith("demo-update-") &&
        filePath === "/docs/architecture.md"
      )
        contents.after +=
          "\n\n## Documentation update\n\nNew push · iteration " +
          pr.iteration +
          "\n";
      return res.json({ ...file, ...contents });
    }
    const read = async (side) => {
      if (
        (side === "before" && file.change.includes("add")) ||
        (side === "after" && file.change.includes("delete"))
      )
        return "";
      const r = await readItem(
        pr,
        token,
        side === "before" ? file.originalPath : file.path,
        side,
      );
      const length = Number(r.headers.get("content-length") || 0);
      if (length > 3 * 1024 * 1024)
        throw new AppError("File exceeds the 3 MB preview limit.", 413);
      const text = (await boundedBytes(r, 3 * 1024 * 1024)).toString("utf8");
      if (Buffer.byteLength(text) > 3 * 1024 * 1024)
        throw new AppError("File exceeds the 3 MB preview limit.", 413);
      if (text.includes("\0"))
        throw new AppError("Binary file: preview unavailable.", 415);
      return text;
    };
    const [before, after] = await Promise.all([read("before"), read("after")]);
    res.json({ ...file, before, after });
  });
  app.get("/api/asset", async (req, res) => {
    const { pr, token } = session(req),
      assetPath = String(req.query.path || "");
    const mime = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".css": "text/css",
      ".woff2": "font/woff2",
      ".woff": "font/woff",
      ".ttf": "font/ttf",
      ".ico": "image/x-icon",
    }[path.extname(assetPath).toLowerCase()];
    if (!mime) throw new AppError("This asset type is not supported.", 415);
    if (pr.demo) throw new AppError("Asset not found.", 404);
    const r = await readItem(
      pr,
      token,
      assetPath,
      req.query.side === "before" ? "before" : "after",
      true,
    );
    let bytes = await boundedBytes(r, 10 * 1024 * 1024);
    if (bytes.length > 10 * 1024 * 1024)
      throw new AppError("Asset exceeds the 10 MB limit.", 413);
    if (mime === "text/css")
      bytes = Buffer.from(
        rewriteRepoCss(
          bytes.toString("utf8"),
          assetPath,
          req.query.side === "before" ? "before" : "after",
        ),
      );
    res.set(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    );
    res.type(mime).send(bytes);
  });
  app.patch("/api/review", async (req, res) => {
    const { pr } = await readySession(req);
    const { path: filePath, reviewed } = req.body;
    if (
      !pr.files.some((f) => f.path === filePath) ||
      typeof reviewed !== "boolean"
    )
      throw new AppError("Invalid file.");
    res.json(
      await store.update(reviewKey(pr), (current) => ({
        ...current,
        reviewed: reviewed
          ? [...new Set([...current.reviewed, filePath])]
          : current.reviewed.filter((p) => p !== filePath),
      })),
    );
  });
  app.post("/api/notes", async (req, res) => {
    const { pr } = await readySession(req);
    const { path: filePath, text, quote = "", side = "after", line } = req.body;
    if (
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 20000 ||
      typeof quote !== "string" ||
      quote.length > 20000 ||
      typeof filePath !== "string" ||
      !filePath.startsWith("/") ||
      !["before", "after"].includes(side) ||
      (line !== undefined && (!Number.isInteger(line) || line < 1))
    )
      throw new AppError("Invalid note.");
    const note = {
      id: randomUUID(),
      path: filePath,
      text: text.trim(),
      quote,
      side,
      line,
      createdAt: new Date().toISOString(),
      commit: pr.after,
      baseCommit: pr.before,
      iteration: pr.iteration,
      originalPath:
        pr.files.find((f) => f.path === filePath)?.originalPath || filePath,
      trackingId: pr.files.find((f) => f.path === filePath)?.trackingId,
    };
    res.json(
      await store.update(reviewKey(pr), (current) => ({
        ...current,
        notes: [...current.notes, note],
      })),
    );
  });
  app.delete("/api/notes/:id", async (req, res) => {
    const { pr } = await readySession(req);
    res.json(
      await store.update(reviewKey(pr), (current) => ({
        ...current,
        notes: current.notes.filter((n) => n.id !== req.params.id),
      })),
    );
  });
  app.post("/api/notes/:id/publish", async (req, res) => {
    const { pr, token } = await readySession(req);
    if (pr.demo) throw new AppError("The demo never sends comments to DevOps.");
    const result = await store.update(reviewKey(pr), async (current) => {
      const note = current.notes.find((n) => n.id === req.params.id);
      if (!note) throw new AppError("Note not found.", 404);
      if (note.threadId) return current;
      let content = `${
        note.quote
          ? note.quote
              .split("\n")
              .map((l) => "> " + l)
              .join("\n") + "\n\n"
          : ""
      }${note.text}`;
      const original =
        note.originalPath ||
        pr.files.find((f) => f.path === note.path)?.originalPath ||
        note.path;
      const context = {
        filePath: note.side === "before" ? original : note.path,
      };
      if (note.line) {
        const prefix = note.side === "before" ? "left" : "right";
        context[prefix + "FileStart"] = { line: note.line, offset: 1 };
        context[prefix + "FileEnd"] = { line: note.line, offset: 1 };
      }
      const thread = await (
        await azure(
          pr,
          token,
          `/pullRequests/${pr.id}/threads`,
          {},
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              comments: [{ parentCommentId: 0, content, commentType: 1 }],
              status: 1,
              threadContext: context,
              pullRequestThreadContext: {
                iterationContext: {
                  firstComparingIteration: note.iteration || pr.iteration,
                  secondComparingIteration: note.iteration || pr.iteration,
                },
                ...(note.trackingId ||
                pr.files.find((f) => f.path === note.path)?.trackingId
                  ? {
                      changeTrackingId:
                        note.trackingId ||
                        pr.files.find((f) => f.path === note.path).trackingId,
                    }
                  : {}),
              },
            }),
          },
        )
      ).json();
      return {
        ...current,
        notes: current.notes.map((n) =>
          n.id === note.id
            ? {
                ...n,
                threadId: thread.id,
                publishedAt: new Date().toISOString(),
              }
            : n,
        ),
      };
    });
    res.json(result);
  });
  app.get("/api/threads", async (req, res) => {
    const { pr, token } = session(req);
    res.json(
      pr.demo
        ? { value: [] }
        : await (
            await azure(pr, token, `/pullRequests/${pr.id}/threads`)
          ).json(),
    );
  });
  const mcp = installMcp(app, { sessions, dataDir });
  // Replaces the environment token without a restart (scripts/devops-token.mjs --push).
  // Guarded by the MCP bearer token; the token is kept in memory only.
  app.put("/api/admin/token", (req, res) => {
    if (!mcp.authorized(req))
      return res.status(401).json({ error: "MCP token required" });
    const { token, organization = envOrg } = req.body || {};
    if (
      typeof token !== "string" ||
      !token.trim() ||
      typeof organization !== "string"
    )
      throw new AppError("Provide a token and an optional organization.");
    const previous = envPat;
    envPat = token.trim();
    envOrg = organization.trim();
    // Open sessions that used the old environment token switch to the new one.
    if (previous)
      for (const s of sessions.values()) {
        if (s.token === previous) s.token = envPat;
        for (const [org, value] of Object.entries(s.credentials || {}))
          if (value === previous) s.credentials[org] = envPat;
      }
    if (!defaultSession) defaultSessionPromise = null;
    res.json({
      organization: envOrg,
      type: isEntraToken(envPat) ? "entra" : "pat",
    });
  });
  app.use(express.static(path.resolve("dist")));
  app.get("/{*path}", (_, res) =>
    res.sendFile(path.resolve("dist/index.html")),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.status || 500).json({
      error: error.status
        ? error.message
        : "Internal application error. Please try again.",
      ...(error.code ? { code: error.code } : {}),
    });
  });
  app.locals.sessions = sessions;
  app.locals.ensureDefaultSession = ensureDefaultSession;
  return app;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  loadEnv();
  const cli = parseCliArgs();
  if (cli.help) {
    console.log(USAGE);
    process.exit(0);
  }
  const port =
    cli.port ||
    Number(process.env.LEAFDOCK_PORT) ||
    Number(process.env.PORT) ||
    3000;
  const envPat =
    cli.pat ||
    cleanToken(
      process.env.AZURE_DEVOPS_PAT ||
        process.env.AZURE_PAT ||
        process.env.AZURE_DEVOPS_TOKEN ||
        process.env.PAT ||
        "",
    );
  const envOrg =
    cli.org ||
    cleanToken(process.env.AZURE_DEVOPS_ORG || process.env.AZURE_ORG || "");
  const initialPrUrl =
    cli.url ||
    cleanToken(
      process.env.AZURE_DEVOPS_PR ||
        process.env.AZURE_DEVOPS_PR_URL ||
        process.env.PR_URL ||
        process.env.PR ||
        "",
    );

  const app = createApp({ envPat, envOrg, initialPrUrl });
  app.listen(port, "0.0.0.0", () => {
    console.log("Leafdock running at http://localhost:" + port);
    console.log(
      "PAT configured: " +
        (envPat
          ? "Yes (" + (cli.pat ? "CLI argument" : "environment") + ")"
          : "No (token wizard will prompt when opening a PR)"),
    );
    if (initialPrUrl) {
      console.log("Initial PR: " + initialPrUrl);
      app.locals.ensureDefaultSession?.().catch((err) => {
        console.warn("Could not preload PR: " + err.message);
      });
    }
  });
}
