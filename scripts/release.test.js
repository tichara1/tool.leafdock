import { test } from "node:test";
import assert from "node:assert/strict";
import { releaseMetadata } from "./release-metadata.mjs";
const input = {
  tag: "v1.2.3",
  version: "1.2.3",
  name: "leafdock",
  repository: "Example/Tool.Leafdock",
};
test("stable releases publish version, minor, major and latest tags", () => {
  const result = releaseMetadata(input);
  assert.equal(result.image, "ghcr.io/example/leafdock");
  assert.deepEqual(
    result.tags,
    ["1.2.3", "1.2", "1", "latest"].map((t) => result.image + ":" + t),
  );
});
test("prereleases cannot replace stable aliases", () => {
  const result = releaseMetadata({
    ...input,
    tag: "v2.0.0-rc.1",
    version: "2.0.0-rc.1",
  });
  assert.deepEqual(result.tags, ["ghcr.io/example/leafdock:2.0.0-rc.1"]);
});
test("backports cannot downgrade latest or the major alias", () => {
  const result = releaseMetadata({
    ...input,
    allTags: ["v1.4.0", "v2.0.0", "v2.1.0-rc.1"],
  });
  assert.deepEqual(result.tags, [
    "ghcr.io/example/leafdock:1.2.3",
    "ghcr.io/example/leafdock:1.2",
  ]);
});
test("a mismatched or injected tag is rejected before registry login", () => {
  for (const tag of ["v1.0.0", "1.2.3", "v1.2.3\nlatest", "v1.2.3;whoami"])
    assert.throws(() => releaseMetadata({ ...input, tag }));
  assert.throws(() => releaseMetadata({ ...input, repository: "../secret" }));
});
