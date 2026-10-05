import { test } from "node:test";
import assert from "node:assert/strict";
import { readEnvValue, updateEnvFile } from "./devops-token.mjs";

test("token script updates existing .env keys and keeps other settings", () => {
  const result = updateEnvFile(
    "AZURE_DEVOPS_PAT=old\r\nLEAFDOCK_PORT=3100\r\n",
    { AZURE_DEVOPS_PAT: "new", AZURE_DEVOPS_ORG: "acme" },
  );
  assert.equal(
    result,
    "AZURE_DEVOPS_PAT=new\r\nLEAFDOCK_PORT=3100\r\nAZURE_DEVOPS_ORG=acme\r\n",
  );
});
test("token script creates a missing .env and reads values back", () => {
  const result = updateEnvFile("", { AZURE_DEVOPS_PAT: "secret" });
  assert.equal(result, "AZURE_DEVOPS_PAT=secret\n");
  assert.equal(readEnvValue(result, "AZURE_DEVOPS_PAT"), "secret");
  assert.equal(readEnvValue(result, "LEAFDOCK_MCP_TOKEN"), "");
});
