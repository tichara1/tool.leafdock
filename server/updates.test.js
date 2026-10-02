import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "./index.js";
import { Store, reviewKey } from "./store.js";
import { demoPr } from "./demo.js";

test("snapshot migration preserves comments, deleted-file notes and published IDs, but resets changed files", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "leafdock-migrate-"));
  try {
    const store = new Store(dir),
      old = structuredClone(demoPr);
    await store.prepare(old);
    await store.update(reviewKey(old), () => ({
      reviewed: old.files.map((f) => f.path),
      notes: [
        {
          id: "a",
          path: old.files[0].path,
          text: "original",
          quote: "exact quote",
          line: 8,
          threadId: 99,
        },
        { id: "b", path: old.files[2].path, text: "deleted file" },
      ],
    }));
    const next = structuredClone(old);
    next.after = "updated";
    next.iteration++;
    next.files[0].objectId = "changed";
    next.files.pop();
    const review = await store.prepare(next, old);
    assert.deepEqual(review.reviewed, [old.files[1].path]);
    assert.equal(review.notes.length, 2);
    assert.equal(review.notes[0].commit, old.after);
    assert.equal(review.notes[0].iteration, old.iteration);
    assert.equal(review.notes[0].line, 8);
    assert.equal(review.notes[0].quote, "exact quote");
    assert.equal(review.notes[0].threadId, 99);
    assert.equal((await store.read(reviewKey(old))).notes.length, 2);
    await store.prepare(next);
    assert.equal((await store.read(reviewKey(next))).notes.length, 2);
    // Added files often have no originalObjectId in the DevOps response.
    const newer = structuredClone(next);
    newer.after = "another";
    newer.iteration++;
    delete next.files[1].originalObjectId;
    delete newer.files[1].originalObjectId;
    assert.deepEqual((await store.prepare(newer, next)).reviewed, [
      old.files[1].path,
    ]);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("recent PRs are cross-repository, durable and credential-safe; remote polling and reload preserve original publication context", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "leafdock-recent-"));
  const app = createApp({ dataDir: dir, envPat: "", envOrg: "" });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = "http://127.0.0.1:" + server.address().port,
    original = globalThis.fetch;
  let cookie = "",
    iteration = 3,
    azureCalls = 0,
    published;
  const auth = [];
  globalThis.fetch = async (url, options) => {
    if (!String(url).startsWith("https://dev.azure.com/"))
      return original(url, options);
    azureCalls++;
    auth.push(options.headers.Authorization);
    if (url.pathname.endsWith("/threads")) {
      published = JSON.parse(options.body);
      return Response.json({ id: 900 });
    }
    if (url.pathname.endsWith("/iterations"))
      return Response.json({
        value: [
          {
            id: iteration,
            sourceRefCommit: { commitId: "head-" + iteration },
            commonRefCommit: { commitId: "base" },
          },
        ],
      });
    if (url.pathname.endsWith("/changes"))
      return Response.json({
        changeEntries: [
          {
            item: {
              path: "/changed.md",
              objectId: "changed-" + iteration,
              originalObjectId: "base-blob",
            },
            changeType: "edit",
          },
          {
            item: {
              path: "/stable.md",
              objectId: "stable",
              originalObjectId: "base-stable",
            },
            changeType: "edit",
          },
        ],
      });
    return Response.json({ title: "Remote PR", status: "active" });
  };
  t.after(async () => {
    globalThis.fetch = original;
    await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true });
  });
  async function request(route, method = "GET", body) {
    const response = await fetch(base + "/api" + route, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    return response;
  }
  const url = (repo) =>
    "https://dev.azure.com/acme/project/_git/" + repo + "/pullrequest/42";
  const first = await request("/connect", "POST", {
    url: url("docs"),
    pat: "very-private-pat",
  });
  assert.equal(first.status, 200);
  const review = await (
    await request("/notes", "POST", {
      path: "/changed.md",
      text: "Keep me",
      quote: "old text",
      line: 7,
    })
  ).json();
  await request("/review", "PATCH", { path: "/changed.md", reviewed: true });
  await request("/review", "PATCH", { path: "/stable.md", reviewed: true });
  assert.equal((await (await request("/updates")).json()).available, false);
  const cachedCalls = azureCalls;
  await request("/updates");
  assert.equal(azureCalls, cachedCalls);
  iteration = 4;
  [...app.locals.sessions.values()][0].updateCache = null;
  const updates = await (await request("/updates")).json();
  assert.equal(updates.available, true);
  assert.equal((await (await request("/pr")).json()).pr.iteration, 3);
  const fresh = await (await request("/refresh", "POST", {})).json();
  assert.equal(fresh.pr.iteration, 4);
  assert.deepEqual(fresh.review.reviewed, ["/stable.md"]);
  assert.equal(fresh.review.notes[0].id, review.notes[0].id);
  assert.equal(fresh.review.notes[0].commit, "head-3");
  assert.equal((await (await request("/updates")).json()).available, false);
  await request("/notes/" + review.notes[0].id + "/publish", "POST", {});
  assert.equal(
    published.pullRequestThreadContext.iterationContext
      .secondComparingIteration,
    3,
  );
  assert.equal(published.threadContext.rightFileStart.line, 7);
  assert.equal(
    (await request("/connect", "POST", { url: url("runbooks") })).status,
    200,
  );
  const history = await (await request("/recent")).json();
  assert.deepEqual(
    history.items.map((i) => i.repo),
    ["runbooks", "docs"],
  );
  assert.ok(history.items.every((i) => i.canOpen && !("snapshot" in i)));
  assert.ok(
    auth.every(
      (value) =>
        value ===
        "Basic " + Buffer.from(":very-private-pat").toString("base64"),
    ),
  );
  const foreign = await request("/connect", "POST", {
    url: "https://dev.azure.com/other/project/_git/docs/pullrequest/42",
  });
  assert.equal(foreign.status, 401);
  assert.equal((await foreign.json()).code, "PAT_REQUIRED");
  const storedHistory = await new Store(dir).recent();
  assert.equal(storedHistory.length, 2);
  for (const file of await readdir(dir)) {
    const text = await readFile(path.join(dir, file), "utf8");
    assert.ok(!text.includes("very-private-pat"));
  }
  const reopened = await (
    await request("/connect", "POST", { url: url("docs") })
  ).json();
  assert.equal(reopened.review.notes[0].threadId, 900);
});

test("demo push announces a new iteration without changing active content until reload", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "leafdock-demo-update-"));
  const app = createApp({ dataDir: dir, envPat: "", envOrg: "" });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true });
  });
  const base = "http://127.0.0.1:" + server.address().port;
  const response = await fetch(base + "/api/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ demo: true }),
  });
  const cookie = response.headers.get("set-cookie").split(";")[0];
  const request = (route, method = "GET") =>
    fetch(base + "/api" + route, {
      method,
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      ...(method === "POST" ? { body: "{}" } : {}),
    });
  await request("/demo/push", "POST");
  assert.equal((await (await request("/updates")).json()).available, true);
  assert.equal((await (await request("/pr")).json()).pr.after, demoPr.after);
  const fresh = await (await request("/refresh", "POST")).json();
  assert.equal(fresh.pr.iteration, demoPr.iteration + 1);
  const file = await (
    await request("/file?path=%2Fdocs%2Farchitecture.md")
  ).json();
  assert.match(file.after, /Documentation update/);
});
