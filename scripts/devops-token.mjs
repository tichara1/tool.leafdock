// Creates an Azure DevOps token for Leafdock from an Azure CLI sign-in (`az login`),
// so nobody has to pick scopes in the DevOps token form.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const DEVOPS_RESOURCE = "499b84ac-1321-427f-aa17-267ca6975798";
const PAT_SCOPE = "vso.code_write";
const USAGE = `Usage: npm run token -- [options]

Creates a Code (Read & write) PAT through the Azure DevOps PAT Lifecycle API,
using your Azure CLI sign-in. Run "az login" first.

  --org <name>     Azure DevOps organization (default: AZURE_DEVOPS_ORG)
  --days <n>       PAT lifetime in days (default: 30)
  --entra          Use a short-lived Entra ID access token (about 1 hour)
                   instead of creating a PAT. No PAT is stored in DevOps.
  --push [url]     Send the token to a running Leafdock without a restart
                   (default url: http://127.0.0.1:$LEAFDOCK_PORT or :3000).
                   Needs LEAFDOCK_MCP_TOKEN in the environment or .env
                   (copy it from "Connect AI" in the app).
  --print          Print only the token to stdout and do not touch .env.
  --env <file>     File to update (default: .env).
  -h, --help       Show this help.`;

export function updateEnvFile(text, values) {
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text ? text.split(/\r?\n/) : [];
  if (lines.at(-1) === "") lines.pop();
  for (const [key, value] of Object.entries(values)) {
    const index = lines.findIndex((line) => line.startsWith(key + "="));
    if (index >= 0) lines[index] = key + "=" + value;
    else lines.push(key + "=" + value);
  }
  return lines.join(newline) + newline;
}

export function readEnvValue(text, key) {
  const line = text
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(key + "="));
  return line?.slice(key.length + 1).trim() || "";
}

function az(args) {
  // az is a .cmd script on Windows, which only runs through a shell. All
  // arguments are fixed constants, so the joined command line is safe.
  const result =
    process.platform === "win32"
      ? spawnSync("az " + args.join(" "), { encoding: "utf8", shell: true })
      : spawnSync("az", args, { encoding: "utf8" });
  if (result.error?.code === "ENOENT" || result.status === 9009)
    throw new Error(
      "Azure CLI (az) was not found. Install it, then run: az login",
    );
  if (result.status !== 0)
    throw new Error(
      (result.stderr || "").trim() || "Azure CLI failed. Run: az login",
    );
  return result.stdout;
}

export function entraToken() {
  const result = JSON.parse(
    az([
      "account",
      "get-access-token",
      "--resource",
      DEVOPS_RESOURCE,
      "--output",
      "json",
    ]),
  );
  return { token: result.accessToken, expires: result.expiresOn };
}

export async function createPat({ organization, days, accessToken }) {
  const validTo = new Date(Date.now() + days * 86400000).toISOString();
  const response = await fetch(
    `https://vssps.dev.azure.com/${encodeURIComponent(organization)}/_apis/tokens/pats?api-version=7.1-preview.1`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        displayName: "Leafdock local PR review " + validTo.slice(0, 10),
        scope: PAT_SCOPE,
        validTo,
        allOrgs: false,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.patTokenError !== "none" || !result.patToken)
    throw new Error(
      `Azure DevOps refused to create the PAT (${result.patTokenError || result.message || response.status}). ` +
        "Your organization may restrict PAT creation or lifetime; try a shorter --days, or --entra.",
    );
  return { token: result.patToken.token, expires: result.patToken.validTo };
}

async function push(url, mcpToken, token, organization) {
  const response = await fetch(new URL("/api/admin/token", url), {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + mcpToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, organization }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(
      `Leafdock at ${url} rejected the token (${response.status}). Check LEAFDOCK_MCP_TOKEN.`,
    );
}

async function main() {
  const { values } = parseArgs({
    options: {
      org: { type: "string" },
      days: { type: "string", default: "30" },
      entra: { type: "boolean", default: false },
      push: { type: "string" },
      print: { type: "boolean", default: false },
      env: { type: "string", default: ".env" },
      help: { type: "boolean", short: "h", default: false },
    },
    args: process.argv
      .slice(2)
      // Allow a bare "--push" without a URL.
      .flatMap((arg, i, all) =>
        arg === "--push" && (!all[i + 1] || all[i + 1].startsWith("--"))
          ? ["--push", ""]
          : [arg],
      ),
  });
  if (values.help) return console.log(USAGE);
  const envText = existsSync(values.env)
    ? readFileSync(values.env, "utf8")
    : "";
  const organization =
    values.org ||
    process.env.AZURE_DEVOPS_ORG ||
    readEnvValue(envText, "AZURE_DEVOPS_ORG");
  if (!organization)
    throw new Error("Specify --org <organization> or set AZURE_DEVOPS_ORG.");
  const days = Number(values.days);
  if (!Number.isInteger(days) || days < 1 || days > 365)
    throw new Error("--days must be a whole number between 1 and 365.");

  const entra = entraToken();
  const result = values.entra
    ? entra
    : await createPat({ organization, days, accessToken: entra.token });
  const log = values.print ? console.error : console.log;
  log(
    (values.entra ? "Entra ID token" : "PAT (Code: Read & write)") +
      ` for ${organization}, valid until ${result.expires}.`,
  );

  if (values.print) process.stdout.write(result.token + "\n");
  else {
    writeFileSync(
      values.env,
      updateEnvFile(envText, {
        AZURE_DEVOPS_PAT: result.token,
        AZURE_DEVOPS_ORG: organization,
      }),
      { mode: 0o600 },
    );
    log(`Saved to ${values.env}.`);
  }
  if (values.push !== undefined) {
    const port =
      process.env.LEAFDOCK_PORT || readEnvValue(envText, "LEAFDOCK_PORT");
    const url = values.push || "http://127.0.0.1:" + (port || "3000");
    const mcpToken =
      process.env.LEAFDOCK_MCP_TOKEN ||
      readEnvValue(envText, "LEAFDOCK_MCP_TOKEN");
    if (!mcpToken)
      throw new Error(
        "--push needs LEAFDOCK_MCP_TOKEN (environment or .env). Copy it from Connect AI in the app.",
      );
    await push(url, mcpToken, result.token, organization);
    log(`Leafdock at ${url} now uses the new token.`);
  } else if (!values.print)
    log(
      "Restart Leafdock to apply it (docker compose up -d), or rerun with --push.",
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error("Error: " + error.message);
    process.exit(1);
  });
