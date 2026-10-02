import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";
const json = (file) => JSON.parse(readFileSync(file, "utf8"));
const yml = (file) => parse(readFileSync(file, "utf8"));
test("version and package metadata are consistent", () => {
  const pkg = json("package.json"),
    lock = json("package-lock.json");
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.version, lock.version);
  assert.equal(pkg.name, lock.packages[""].name);
  assert.equal(pkg.version, lock.packages[""].version);
  const versioning = json("release-please-config.json");
  assert.equal(versioning.packages["."]["release-type"], "node");
  assert.equal(versioning.packages["."]["include-component-in-tag"], false);
  assert.match(readFileSync("LICENSE", "utf8"), /MIT License/);
});
test("fork PR checks are read-only and publication depends on successful checks", () => {
  const checks = yml(".github/workflows/checks.yml"),
    release = yml(".github/workflows/release.yml");
  assert.equal(checks.permissions.contents, "read");
  assert.ok("pull_request" in checks.on);
  assert.equal(release.jobs.publish.permissions.packages, "write");
  assert.deepEqual(release.jobs.publish.needs, ["checks", "version"]);
  assert.match(release.jobs.publish.if, /needs\.checks\.result == 'success'/);
  assert.match(release.jobs.publish.if, /release_created/);
  for (const workflow of [checks, release])
    for (const job of Object.values(workflow.jobs))
      for (const step of job.steps || []) {
        if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/);
      }
  const build = release.jobs.publish.steps.find((s) =>
    s.uses?.startsWith("docker/build-push-action@"),
  );
  assert.equal(build.with.platforms, "linux/amd64,linux/arm64");
  assert.equal(build.with.provenance, true);
  assert.equal(build.with.sbom, true);
});
test("both deployment configurations bind to loopback and use persistent data", () => {
  for (const file of ["compose.yaml", "compose.registry.yaml"]) {
    const config = yml(file),
      service = config.services.leafdock;
    assert.ok(service.ports[0].startsWith("127.0.0.1:"));
    assert.deepEqual(service.volumes, ["leafdock-data:/app/data"]);
  }
});
test("application source, built-in demo and tests have no untranslated Czech strings", () => {
  const pattern =
    /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]|\b(Konfigurace|SOUBORY V PR|Iterace)\b/;
  for (const dir of ["src", "server", "tests"])
    for (const file of readdirSync(dir)) {
      if (/\.(jsx?|css)$/.test(file))
        assert.ok(
          !pattern.test(readFileSync(dir + "/" + file, "utf8")),
          dir + "/" + file + " contains untranslated text",
        );
    }
  assert.match(readFileSync("index.html", "utf8"), /lang="en"/);
  assert.match(readFileSync("demo.html", "utf8"), /lang="en"/);
});
