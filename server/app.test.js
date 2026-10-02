import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { createApp } from "./index.js";
import { parsePrUrl, loadPr, readItem } from "./azure.js";
import { Store, reviewKey } from "./store.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

test("URL parser accepts cloud forms and rejects credential/SSRF inputs", () => {
  assert.equal(
    parsePrUrl(
      "https://dev.azure.com/acme/My%20Project/_git/docs/pullrequest/42?_a=files",
    ).project,
    "My Project",
  );
  assert.equal(
    parsePrUrl("https://acme.visualstudio.com/Project/_git/docs/pullrequest/42")
      .org,
    "acme",
  );
  for (const url of [
    "http://dev.azure.com/acme/p/_git/r/pullrequest/1",
    "https://evil.test/acme/p/_git/r/pullrequest/1",
    "https://dev.azure.com.evil.test/acme/p/_git/r/pullrequest/1",
    "https://user:pass@dev.azure.com/acme/p/_git/r/pullrequest/1",
    "https://dev.azure.com/acme/p/_git/r/pullrequest/nope",
    "https://dev.azure.com/acme/p/_git/r/pullrequest/1%zz",
  ])
    assert.throws(() => parsePrUrl(url));
});
test("Store serializes concurrent writes and separates commit progress", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "leafdock-store-"));
  try {
    const store = new Store(dir);
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        store.update("review", (current) => ({
          ...current,
          reviewed: [...current.reviewed, String(i)],
        })),
      ),
    );
    assert.equal((await store.read("review")).reviewed.length, 12);
    assert.notEqual(
      reviewKey({ org: "o", project: "p", repo: "r", id: 1, after: "a" }),
      reviewKey({ org: "o", project: "p", repo: "r", id: 1, after: "b" }),
    );
  } finally {
    await rm(dir, { recursive: true });
  }
});
test("file downloads use documented Accept headers and pinned commit without invalid format override", async () => {
  const original = globalThis.fetch,
    requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return new Response("content");
  };
  try {
    const pr = {
      org: "o",
      project: "p",
      repo: "r",
      after: "head",
      before: "base",
    };
    await readItem(pr, "token", "/docs/a.md", "before");
    await readItem(pr, "token", "/image.png", "after", true);
    assert.equal(requests[0].options.headers.Accept, "text/plain");
    assert.equal(
      requests[1].options.headers.Accept,
      "application/octet-stream",
    );
    assert.equal(
      requests[0].url.searchParams.get("versionDescriptor.version"),
      "base",
    );
    assert.ok(requests.every((r) => !r.url.searchParams.has("$format")));
  } finally {
    globalThis.fetch = original;
  }
});
test("Azure pagination and merge-base snapshot use correct API parameters", async () => {
  const original = globalThis.fetch,
    urls = [];
  globalThis.fetch = async (url, options) => {
    urls.push(url);
    assert.equal(options.redirect, "error");
    const route = url.pathname;
    if (route.endsWith("/iterations"))
      return Response.json({
        value: [
          {
            id: 2,
            sourceRefCommit: { commitId: "head" },
            commonRefCommit: { commitId: "base" },
          },
        ],
      });
    if (route.endsWith("/changes"))
      return Response.json(
        url.searchParams.get("$skip") === "0"
          ? {
              changeEntries: [{ item: { path: "/a.md" }, changeType: "edit" }],
              nextSkip: 1,
            }
          : {
              changeEntries: [{ item: { path: "/b.md" }, changeType: "add" }],
              nextSkip: 0,
            },
      );
    return Response.json({
      title: "PR",
      sourceRefName: "refs/heads/docs",
      targetRefName: "refs/heads/main",
      createdBy: { displayName: "A" },
      status: "active",
    });
  };
  try {
    const pr = await loadPr(
      parsePrUrl("https://dev.azure.com/o/p/_git/r/pullrequest/1"),
      "test-pat",
    );
    assert.equal(pr.files.length, 2);
    assert.equal(pr.before, "base");
    assert.equal(pr.after, "head");
    assert.ok(
      urls
        .filter((u) => u.pathname.endsWith("/changes"))
        .every((u) => u.searchParams.get("$compareTo") === "0"),
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("web + authenticated MCP share notes and progress; secrets and writes are protected", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "leafdock-api-")),
    app = createApp({ dataDir: dir, envPat: "", envOrg: "" });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = "http://127.0.0.1:" + server.address().port;
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true });
  });
  const request = (route, method = "GET", body, cookie = "", headers = {}) =>
    fetch(base + route, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  assert.equal((await request("/api/pr")).status, 401);
  assert.equal((await request("/mcp", "POST", {})).status, 401);
  assert.equal(
    (
      await request("/api/connect", "POST", { demo: true }, "", {
        Origin: "https://evil.test",
      })
    ).status,
    403,
  );
  const badHost = await new Promise((resolve) => {
    http.get(base + "/api/health", { headers: { Host: "evil.test" } }, (r) => {
      r.resume();
      resolve(r.statusCode);
    });
  });
  assert.equal(badHost, 403);
  const response = await request("/api/connect", "POST", { demo: true });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie").split(";")[0];
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  const data = await response.json();
  assert.equal(data.pr.files.length, 3);
  assert.ok(!("token" in data));
  const file = await (
    await request(
      "/api/file?path=%2Fdocs%2Farchitecture.md",
      "GET",
      undefined,
      cookie,
    )
  ).json();
  assert.match(file.after, /mermaid/);
  const review = await (
    await request(
      "/api/notes",
      "POST",
      {
        path: "/docs/architecture.md",
        text: "Check retries",
        quote: "attempts: 3",
        line: 55,
      },
      cookie,
    )
  ).json();
  assert.equal(review.notes.length, 1);
  const config = await (
    await request("/api/mcp-config", "GET", undefined, cookie)
  ).json();
  const client = new Client({ name: "leafdock-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(base + "/mcp"), {
    requestInit: { headers: { Authorization: "Bearer " + config.token } },
  });
  await client.connect(transport);
  t.after(() => client.close());
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 7);
  const contexts = JSON.parse(
    (await client.callTool({ name: "list_open_prs", arguments: {} })).content[0]
      .text,
  );
  assert.equal(contexts.length, 1);
  const contextId = contexts[0].contextId;
  const note = await client.callTool({
    name: "add_note",
    arguments: {
      contextId,
      path: "/docs/architecture.md",
      text: "MCP finding",
      quote: "API Gateway",
    },
  });
  assert.ok(!note.isError);
  const checked = await client.callTool({
    name: "set_reviewed",
    arguments: { contextId, path: "/docs/architecture.md", reviewed: true },
  });
  assert.ok(!checked.isError);
  const shared = await (
    await request("/api/pr", "GET", undefined, cookie)
  ).json();
  assert.equal(shared.review.notes.length, 2);
  assert.deepEqual(shared.review.reviewed, ["/docs/architecture.md"]);
  const read = await client.callTool({
    name: "read_file",
    arguments: { contextId, path: "/docs/overview.html" },
  });
  assert.match(read.content[0].text, /doctype/i);
  const denied = await client.callTool({
    name: "publish_note",
    arguments: { contextId, noteId: review.notes[0].id, confirmPublish: true },
  });
  assert.equal(denied.isError, true);
  assert.match(denied.content[0].text, /disabled/);
  assert.equal(
    (
      await request(
        "/api/notes/" + review.notes[0].id + "/publish",
        "POST",
        {},
        cookie,
      )
    ).status,
    400,
  );
  await client.close();
  const isolated = await request(
    "/api/connect",
    "POST",
    { demo: true },
    cookie,
    { "X-Leafdock-Demo": "1" },
  );
  assert.match(isolated.headers.get("set-cookie"), /leafdock_demo_session=/);
  assert.equal(
    (await request("/api/pr", "GET", undefined, cookie)).status,
    200,
  );
});
test("publishing uses merge-base iteration and is idempotent", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "leafdock-publish-")),
    app = createApp({ dataDir: dir, envPat: "", envOrg: "" });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = "http://127.0.0.1:" + server.address().port;
  const original = globalThis.fetch;
  let payload,
    calls = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://dev.azure.com/")) {
      calls++;
      payload = JSON.parse(options.body);
      return Response.json({ id: 99 });
    }
    return original(url, options);
  };
  t.after(async () => {
    globalThis.fetch = original;
    await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true });
  });
  const response = await fetch(base + "/api/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ demo: true }),
  });
  const cookie = response.headers.get("set-cookie").split(";")[0];
  const s = [...app.locals.sessions.values()][0];
  s.pr.demo = false;
  s.token = "secret";
  const request = (route, body) =>
    fetch(base + route, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    });
  const review = await (
    await request("/api/notes", {
      path: "/docs/architecture.md",
      text: "Please verify",
      quote: "attempts: 3",
      side: "after",
      line: 8,
    })
  ).json();
  const route = "/api/notes/" + review.notes[0].id + "/publish";
  assert.equal((await request(route, {})).status, 200);
  assert.equal((await request(route, {})).status, 200);
  assert.equal(calls, 1);
  assert.equal(
    payload.pullRequestThreadContext.iterationContext.firstComparingIteration,
    3,
  );
  assert.equal(
    payload.pullRequestThreadContext.iterationContext.secondComparingIteration,
    3,
  );
  assert.equal(payload.threadContext.rightFileStart.line, 8);
  assert.match(payload.comments[0].content, /> attempts: 3/);
});
