import { test, expect } from "@playwright/test";

test("viewer renders Mermaid, switches file tree and diffs, persists notes and exports Teams draft", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?demo=1");
  await expect(
    page.getByRole("heading", { name: "Platform architecture", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".mermaid-svg svg")).toBeVisible();
  await expect(page.locator(".mermaid-svg")).toContainText("API Gateway");
  await expect(page.locator(".katex")).toHaveCount(1);
  await page.screenshot({ path: "test-results/viewer-paper.png" });
  await page.getByRole("button", { name: "File list", exact: true }).click();
  await expect(page.locator(".folder-row")).toHaveCount(0);
  await page.getByRole("button", { name: "Folder tree", exact: true }).click();
  await page.getByRole("button", { name: "docs", exact: true }).click();
  await expect(page.locator(".file-row")).toHaveCount(0);
  await page.getByRole("button", { name: "docs", exact: true }).click();
  const fileCheck = page
    .locator(".file-row")
    .filter({ hasText: "architecture.md" })
    .locator(".file-check");
  const wasReviewed = (await fileCheck.getAttribute("aria-pressed")) === "true";
  await fileCheck.click();
  await expect(fileCheck).toHaveAttribute("aria-pressed", String(!wasReviewed));
  await page.getByRole("button", { name: "Split diff", exact: true }).click();
  await expect(page.locator(".split-source .removed").first()).toBeVisible();
  await page.getByRole("button", { name: "Unified diff", exact: true }).click();
  await expect(page.locator(".unified .added").first()).toBeVisible();
  await page.getByRole("button", { name: "Visual diff", exact: true }).click();
  await expect(page.locator(".visual-diff .mermaid-svg svg")).toHaveCount(2);
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await page.locator(".source-view .line-number").nth(2).click();
  await expect(page.locator(".quote-preview")).toBeVisible();
  const note = "E2E review " + Date.now();
  await page.getByRole("textbox", { name: "Note text" }).fill(note);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.locator(".note-card").filter({ hasText: note }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".note-card").filter({ hasText: note }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Share review", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Shared review preview" }),
  ).toContainText(note);
  await page
    .getByLabel("Colleague’s Teams email")
    .fill("colleague@example.com");
  await expect(
    page.getByRole("button", { name: "Prepare a Teams message" }),
  ).toBeEnabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("leafdock-review-142.md");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Connect AI", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Connect AI via MCP" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Codex", exact: true }).click();
  await expect(page.locator(".mcp-code")).toContainText("bearer-token-env-var");
  await page.getByRole("button", { name: "Antigravity", exact: true }).click();
  await expect(page.locator(".mcp-code")).toContainText("serverUrl");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByLabel("Theme", { exact: true }).selectOption("midnight");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");
  await page
    .getByRole("button", { name: "overview.html", exact: true })
    .click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    page
      .frameLocator('iframe[title="HTML preview after"]')
      .getByRole("heading", { name: "Small services. Big possibilities." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("showcase displays all feature sections and diagrams without PAT", async ({
  page,
}) => {
  await page.goto("/demo.html");
  await expect(
    page.getByRole("heading", { name: "Documentation. Changes. Context." }),
  ).toBeVisible();
  await expect(page.locator(".gallery-section")).toHaveCount(8);
  await expect(page.locator(".diagram-gallery .mermaid-svg svg")).toHaveCount(
    5,
    { timeout: 30000 },
  );
  await expect(page.locator(".diagram-error")).toHaveCount(0);
  await page.getByLabel("Gallery theme").selectOption("parchment");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "parchment");
  await page.screenshot({ path: "test-results/showcase.png", fullPage: true });
});
test("HTML scripts are blocked while selection quote bridge works", async ({
  page,
}) => {
  await page.route(
    "**/api/file?path=%2Fdocs%2Foverview.html",
    async (route) => {
      const r = await route.fetch();
      const json = await r.json();
      json.after +=
        '<script>window.leafdockCompromised=true</script><img src="x" onerror="window.leafdockCompromised=true">';
      await route.fulfill({ response: r, json });
    },
  );
  await page.goto("/?demo=1");
  await page
    .getByRole("button", { name: "overview.html", exact: true })
    .click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const frame = page.frameLocator('iframe[title="HTML preview after"]');
  await expect(
    frame.getByRole("heading", { name: "Small services. Big possibilities." }),
  ).toBeVisible();
  await frame.locator("h1").evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.dispatchEvent(new MouseEvent("mouseup"));
  });
  await frame.getByRole("button", { name: "Quote selected HTML text" }).click();
  await expect(page.locator(".quote-preview")).toContainText(
    "Small services. Big possibilities.",
  );
  const sandbox = await page
    .locator('iframe[title="HTML preview after"]')
    .getAttribute("sandbox");
  expect(sandbox).not.toContain("allow-same-origin");
  expect(
    await frame.locator("body").evaluate(() => window.leafdockCompromised),
  ).toBeUndefined();
});
test("mobile navigation and notes remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?demo=1");
  await expect(page.locator(".notes-pane")).toHaveCount(0);
  await page.getByRole("button", { name: "Show files", exact: true }).click();
  await expect(page.locator(".sidebar.mobile-open")).toBeVisible();
  await page.getByRole("button", { name: "runbook.md", exact: true }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Operations runbook", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/mobile.png" });
});

test("expanded preview, fullscreen and keyboard shortcuts preserve reading and ignore typing and dialogs", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".mermaid-svg svg")).toBeVisible();
  await page.locator(".reader").evaluate((el) => (el.scrollTop = 220));
  const scroll = await page.locator(".reader").evaluate((el) => el.scrollTop);
  await page
    .getByRole("button", { name: "Expand document (F)", exact: true })
    .click();
  await expect(page.locator(".workspace")).toHaveClass(/focus-mode/);
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".notes-pane")).toBeHidden();
  expect(await page.locator(".reader").evaluate((el) => el.scrollTop)).toBe(
    scroll,
  );
  const dimensions = await page.locator(".reader").boundingBox();
  expect(dimensions.width).toBeGreaterThan(1400);
  await page.keyboard.press("Escape");
  await expect(page.locator(".workspace")).not.toHaveClass(/focus-mode/);
  await page
    .getByRole("textbox", { name: "Note text", exact: true })
    .fill("f j k r 12345 ?");
  await page.keyboard.press("f");
  await expect(page.locator(".workspace")).not.toHaveClass(/focus-mode/);
  await page.getByRole("textbox", { name: "Note text", exact: true }).fill("");
  await page.locator(".breadcrumb").click();
  await page.keyboard.press("f");
  await expect(page.locator(".workspace")).toHaveClass(/focus-mode/);
  await page.keyboard.press("5");
  await expect(page.locator(".source-view")).toBeVisible();
  await page.keyboard.press("1");
  await expect(page.locator(".document-wrap")).toBeVisible();
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog")).toContainText("Keyboard shortcuts");
  await page.keyboard.press("f");
  await expect(page.locator(".workspace")).toHaveClass(/focus-mode/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Fullscreen (Shift+F)", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  await expect(page.locator(".workspace")).toHaveClass(/focus-mode/);
  await page
    .getByRole("button", {
      name: "Exit fullscreen (Shift+F)",
      exact: true,
    })
    .click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(false);
  await expect(page.locator(".workspace")).not.toHaveClass(/focus-mode/);
  await page.keyboard.press("Shift+f");
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.locator(".workspace")).not.toHaveClass(/focus-mode/);
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByPlaceholder("Find a file…")).toBeFocused();
});

test("recent PRs switch repositories and update arrow reload keeps saved and unsaved comments", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".mermaid-svg svg")).toBeVisible();
  const note = "Reload keeps me " + Date.now(),
    draft = "Unfinished " + Date.now();
  await page
    .getByRole("textbox", { name: "Note text", exact: true })
    .fill(note);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.locator(".note-card").filter({ hasText: note }),
  ).toBeVisible();
  const check = page
    .locator(".file-row")
    .filter({ hasText: "architecture.md" })
    .locator(".file-check");
  if ((await check.getAttribute("aria-pressed")) !== "true")
    await check.click();
  await page
    .getByRole("textbox", { name: "Note text", exact: true })
    .fill(draft);
  await page
    .getByRole("button", {
      name: "Simulate a new push in the demo PR",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Load new PR changes", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Documentation update", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: "test-results/new-changes.png" });
  await page
    .getByRole("button", { name: "Load new PR changes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Documentation update", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".note-card").filter({ hasText: note }),
  ).toContainText("From an earlier version");
  await expect(
    page.locator(".note-card").filter({ hasText: draft }),
  ).toBeVisible();
  await expect(check).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Load new PR changes", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Recent pull requests", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("platform-docs");
  await page
    .getByRole("button", {
      name: "Open a second sample repository",
      exact: true,
    })
    .click();
  await expect(page.locator(".repo-label")).toContainText("operations-docs");
  await page
    .getByRole("button", { name: "Recent pull requests", exact: true })
    .click();
  await expect(page.locator(".recent-list")).toContainText("operations-docs");
  await expect(page.locator(".recent-list")).toContainText("platform-docs");
  await page
    .locator(".recent-item")
    .filter({ hasText: "platform-docs" })
    .click();
  await expect(page.locator(".repo-label")).toContainText("platform-docs");
  await expect(
    page.locator(".note-card").filter({ hasText: note }),
  ).toBeVisible();
});

test("HTML iframe forwards keyboard shortcuts without enabling document scripts", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  await page
    .getByRole("button", { name: "overview.html", exact: true })
    .click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const frame = page.frameLocator('iframe[title="HTML preview after"]');
  await frame.locator("h1").click();
  await page.keyboard.press("f");
  await expect(page.locator(".workspace")).toHaveClass(/focus-mode/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".workspace")).not.toHaveClass(/focus-mode/);
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog")).toContainText("Keyboard shortcuts");
  await page.keyboard.press("Escape");
  await frame.locator("h1").click();
  await page.keyboard.press("5");
  await expect(page.locator(".source-view")).toBeVisible();
});

test("background poll detects a remote push without replacing the document", async ({
  page,
}) => {
  await page.clock.install();
  const initialCheck = page.waitForResponse("**/api/updates");
  await page.goto("/?demo=1");
  await initialCheck;
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".mermaid-svg svg")).toBeVisible();
  const push = await page.request.post("/api/demo/push", {
    headers: { "X-Leafdock-Demo": "1" },
    data: {},
  });
  expect(push.ok()).toBe(true);
  await expect(
    page.getByRole("button", { name: "Load new PR changes", exact: true }),
  ).toHaveCount(0);
  await page.clock.fastForward(31000);
  await expect(
    page.getByRole("button", { name: "Load new PR changes", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Documentation update", exact: true }),
  ).toHaveCount(0);
});

test("HTML links scroll to anchors, open other files at their section and keep form controls", async ({
  page,
}) => {
  await page.route(
    "**/api/file?path=%2Fdocs%2Foverview.html",
    async (route) => {
      const r = await route.fetch();
      const json = await r.json();
      json.after =
        '<a id="toc" href="#target">Jump</a> <a id="deep" href="architecture.md#next-steps">Next steps</a>' +
        '<p><button id="tab">Tab A</button><input id="check" type="checkbox" checked></p>' +
        '<div style="height:2500px"></div><h2 id="target">Target</h2>';
      await route.fulfill({ response: r, json });
    },
  );
  await page.goto("/?demo=1");
  await page
    .getByRole("button", { name: "overview.html", exact: true })
    .click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const frame = page.frameLocator('iframe[title="HTML preview after"]');
  await expect(frame.locator("#tab")).toBeVisible();
  await expect(frame.locator("#check")).toBeVisible();
  await frame.locator("#toc").click();
  await expect
    .poll(() => frame.locator("body").evaluate(() => window.scrollY))
    .toBeGreaterThan(1000);
  await expect(page.locator(".breadcrumb")).toContainText(
    "/docs/overview.html",
  );
  await frame.locator("#deep").click();
  await expect(page.locator(".breadcrumb")).toContainText(
    "/docs/architecture.md",
  );
  await expect
    .poll(() => page.locator(".reader").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(300);
});

test("Mermaid zoom is relative to the natural size and can be reset to fit", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  await page.getByRole("button", { name: "runbook.md", exact: true }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const canvas = page.locator(".mermaid-svg");
  await expect(canvas.locator("svg")).toBeVisible();
  const zoom = page.locator(".zoom-level");
  await expect(zoom).toHaveText("100%");
  const fitted = await canvas.boundingBox();
  const card = await page.locator(".diagram-scroll").boundingBox();
  expect(fitted.width).toBeLessThan(card.width);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(zoom).toHaveText("125%");
  const zoomed = await canvas.boundingBox();
  expect(zoomed.width / fitted.width).toBeCloseTo(1.25, 1);
  const scroll = page.locator(".diagram-scroll");
  const box = await scroll.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  await expect(zoom).not.toHaveText("125%");
  await page
    .getByRole("button", { name: "Fit diagram to view", exact: true })
    .click();
  await expect(zoom).toHaveText("100%");
});

test("file sidebar collapses with B and the button to give the preview more room", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  const reader = page.locator(".reader");
  const width = (await reader.boundingBox()).width;
  await page.locator(".breadcrumb").click();
  await page.keyboard.press("b");
  await expect(page.locator(".sidebar")).toBeHidden();
  expect((await reader.boundingBox()).width).toBeGreaterThan(width + 200);
  await page.reload();
  await expect(page.locator(".sidebar")).toBeHidden();
  await page
    .getByRole("button", { name: "Show files (B)", exact: true })
    .click();
  await expect(page.locator(".sidebar")).toBeVisible();
});

test("clicking anywhere on a file row opens the file, the checkbox only marks it reviewed", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  await expect(page.locator(".topbar .pr-header h1")).toHaveText(
    "New platform architecture documentation",
  );
  const row = page.locator(".file-row").filter({ hasText: "runbook.md" });
  const box = await row.boundingBox();
  await page.mouse.click(box.x + box.width - 6, box.y + box.height / 2);
  await expect(page.locator(".breadcrumb")).toContainText("/docs/runbook.md");
  const check = page
    .locator(".file-row")
    .filter({ hasText: "overview.html" })
    .locator(".file-check");
  const reviewed = (await check.getAttribute("aria-pressed")) === "true";
  await check.click();
  await expect(check).toHaveAttribute("aria-pressed", String(!reviewed));
  await expect(page.locator(".breadcrumb")).toContainText("/docs/runbook.md");
});

test("file list colours change types and source views are syntax highlighted", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  await expect(
    page.locator(".file-row.change-add").filter({ hasText: "runbook.md" }),
  ).toBeVisible();
  await expect(
    page.locator(".file-row.change-edit").filter({ hasText: "overview.html" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(page.locator(".source-view .hljs-section").first()).toHaveText(
    "# Platform architecture",
  );
  await page.getByRole("button", { name: "Split diff", exact: true }).click();
  await expect(
    page.locator(".split-source .hljs-section").first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "overview.html", exact: true })
    .click();
  await page.getByRole("button", { name: "Unified diff", exact: true }).click();
  await expect(page.locator(".unified .hljs-tag").first()).toBeVisible();
});
