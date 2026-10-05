export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function parsePrUrl(input) {
  let u;
  try {
    u = new URL(input);
  } catch {
    throw new AppError("Enter a valid pull request URL.");
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port)
    throw new AppError("The PR must use an HTTPS Azure DevOps cloud URL.");
  let parts;
  try {
    parts = u.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    throw new AppError("Invalid URL encoding.");
  }
  let org, project, repo, id;
  if (u.hostname === "dev.azure.com") org = parts[0];
  else if (/^[a-z0-9-]+\.visualstudio\.com$/i.test(u.hostname)) {
    org = u.hostname.split(".")[0];
  } else
    throw new AppError(
      "Supported hosts: dev.azure.com and *.visualstudio.com.",
    );
  const offset = u.hostname === "dev.azure.com" ? 2 : 1;
  if (
    parts[offset] !== "_git" ||
    parts[offset + 2] !== "pullrequest" ||
    !/^\d+$/.test(parts[offset + 3] || "")
  )
    throw new AppError(
      "Expected URL …/project/_git/repository/pullrequest/123.",
    );
  // Read positions directly, including legacy visualstudio.com URLs.
  if (offset === 2) {
    org = parts[0];
    project = parts[1];
  } else project = parts[0];
  repo = parts[offset + 1];
  id = Number(parts[offset + 3]);
  if (
    !org ||
    !project ||
    !repo ||
    !id ||
    [org, project, repo].some((s) => /[\/\\\x00-\x1f]/.test(s))
  )
    throw new AppError("Invalid pull request URL.");
  return {
    org,
    project,
    repo,
    id,
    url: `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_git/${encodeURIComponent(repo)}/pullrequest/${id}`,
  };
}
export function repoBase(pr) {
  return `https://dev.azure.com/${encodeURIComponent(pr.org)}/${encodeURIComponent(pr.project)}/_apis/git/repositories/${encodeURIComponent(pr.repo)}`;
}
// Entra ID access tokens (e.g. from `az account get-access-token`) are JWTs and
// use Bearer; personal access tokens use Basic with an empty user name.
export function isEntraToken(token) {
  return /^eyJ[\w-]*\.[\w-]+\.[\w-]*$/.test(token);
}
export function authorization(token) {
  return isEntraToken(token)
    ? `Bearer ${token}`
    : `Basic ${Buffer.from(":" + token).toString("base64")}`;
}
export async function azure(pr, token, route, params = {}, options = {}) {
  const url = new URL(repoBase(pr) + route);
  url.search = new URLSearchParams({
    "api-version": "7.1",
    ...params,
  }).toString();
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Authorization: authorization(token),
        Accept: "application/json",
        ...options.headers,
      },
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new AppError(
      "Azure DevOps is unavailable or the request timed out.",
      502,
    );
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new AppError(
        "The token has expired or lacks repository access. Publishing comments requires Code: Read & write.",
        response.status,
      );
    if (response.status === 404)
      throw new AppError("PR or file not found.", 404);
    throw new AppError(`Azure DevOps returned error ${response.status}.`, 502);
  }
  return response;
}
export async function loadPr(pr, token) {
  const meta = await (await azure(pr, token, `/pullRequests/${pr.id}`)).json();
  const iterations = (
    await (await azure(pr, token, `/pullRequests/${pr.id}/iterations`)).json()
  ).value;
  const latest = iterations?.at(-1);
  if (!latest) throw new AppError("No PR iteration is available.", 422);
  const files = [];
  let skip = 0;
  do {
    const page = await (
      await azure(
        pr,
        token,
        `/pullRequests/${pr.id}/iterations/${latest.id}/changes`,
        { $compareTo: "0", $top: "2000", $skip: String(skip) },
      )
    ).json();
    files.push(
      ...page.changeEntries
        .filter((x) => !x.item?.isFolder)
        .map((x) => ({
          path: x.item.path,
          originalPath: x.originalPath || x.item.path,
          change: x.changeType,
          trackingId: x.changeTrackingId,
          objectId: x.item.objectId,
          originalObjectId: x.item.originalObjectId,
        })),
    );
    if (page.nextSkip && page.nextSkip <= skip)
      throw new AppError("Azure DevOps returned invalid pagination.", 502);
    skip = page.nextSkip || 0;
  } while (skip);
  const before =
    latest.commonRefCommit?.commitId || meta.lastMergeTargetCommit?.commitId;
  const after =
    latest.sourceRefCommit?.commitId || meta.lastMergeSourceCommit?.commitId;
  if (!before || !after)
    throw new AppError("Unable to determine commits for comparison.", 422);
  return {
    ...pr,
    title: meta.title,
    description: meta.description || "",
    author: meta.createdBy?.displayName,
    status: meta.status,
    source: meta.sourceRefName?.replace("refs/heads/", ""),
    target: meta.targetRefName?.replace("refs/heads/", ""),
    iteration: latest.id,
    before,
    after,
    files,
  };
}
export async function readItem(
  pr,
  token,
  path,
  side = "after",
  binary = false,
) {
  if (!path.startsWith("/") || path.includes("\0"))
    throw new AppError("Invalid path.");
  return azure(
    pr,
    token,
    "/items",
    {
      path,
      "versionDescriptor.version": pr[side],
      "versionDescriptor.versionType": "commit",
      download: "true",
    },
    { headers: { Accept: binary ? "application/octet-stream" : "text/plain" } },
  );
}
export async function checkPr(pr, token) {
  const meta = await (await azure(pr, token, `/pullRequests/${pr.id}`)).json();
  const iterations = (
    await (await azure(pr, token, `/pullRequests/${pr.id}/iterations`)).json()
  ).value;
  const latest = iterations?.at(-1);
  if (!latest) throw new AppError("No PR iteration is available.", 422);
  const after =
      latest.sourceRefCommit?.commitId || meta.lastMergeSourceCommit?.commitId,
    before =
      latest.commonRefCommit?.commitId || meta.lastMergeTargetCommit?.commitId;
  if (!after || !before)
    throw new AppError("Unable to determine commits for comparison.", 422);
  return {
    after,
    before,
    iteration: latest.id,
    title: meta.title,
    status: meta.status,
  };
}
