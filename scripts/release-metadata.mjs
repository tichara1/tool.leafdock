import { readFileSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const versionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*))?$/;
const compare = (a, b) => {
  const av = a.split(".").map(Number),
    bv = b.split(".").map(Number);
  return av[0] - bv[0] || av[1] - bv[1] || av[2] - bv[2];
};
export function releaseMetadata({
  tag,
  version,
  name,
  repository,
  allTags = [],
}) {
  if (
    !tag?.startsWith("v") ||
    !versionPattern.test(tag.slice(1)) ||
    tag.slice(1) !== version
  )
    throw new Error(
      "Release tag must be v" + version + " and match package.json.",
    );
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9_.-]+$/.test(repository || ""))
    throw new Error("Invalid repository name.");
  if (!/^[a-z0-9][a-z0-9_.-]*$/.test(name || ""))
    throw new Error("Invalid image name.");
  const image =
    "ghcr.io/" + repository.split("/")[0].toLowerCase() + "/" + name;
  const tags = [image + ":" + version];
  if (!version.includes("-")) {
    const stable = [
      version,
      ...allTags
        .filter(
          (t) =>
            t.startsWith("v") &&
            versionPattern.test(t.slice(1)) &&
            !t.includes("-"),
        )
        .map((t) => t.slice(1)),
    ];
    const [major, minor] = version.split(".");
    const highest = (versions) => versions.sort(compare).at(-1) === version;
    if (highest(stable.filter((v) => v.startsWith(major + "." + minor + "."))))
      tags.push(image + ":" + major + "." + minor);
    if (
      major !== "0" &&
      highest(stable.filter((v) => v.startsWith(major + ".")))
    )
      tags.push(image + ":" + major);
    if (highest(stable)) tags.push(image + ":latest");
  }
  return { image, version, tags };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const allTags = execFileSync("git", ["tag", "--list"], { encoding: "utf8" })
    .trim()
    .split("\n");
  const metadata = releaseMetadata({
    tag: process.env.RELEASE_TAG,
    version: pkg.version,
    name: pkg.name,
    repository: process.env.GITHUB_REPOSITORY,
    allTags,
  });
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `image=${metadata.image}\nversion=${metadata.version}\ntags<<RELEASE_TAGS\n${metadata.tags.join("\n")}\nRELEASE_TAGS\n`,
    );
  console.log(JSON.stringify(metadata, null, 2));
}
