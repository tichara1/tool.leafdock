import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Only production dependencies are distributed. No local absolute paths,
// credentials, or environment values appear in the generated document.
const directories = execFileSync(
  "npm",
  ["ls", "--omit=dev", "--all", "--parseable"],
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .slice(1);
const entries = new Map();
for (const directory of directories) {
  const pkg = JSON.parse(
    await readFile(path.join(directory, "package.json"), "utf8"),
  );
  const id = pkg.name + "@" + pkg.version;
  if (entries.has(id)) continue;
  let license =
    typeof pkg.license === "object" ? pkg.license.type : pkg.license;
  const files = (await readdir(directory, { withFileTypes: true })).filter(
    (entry) =>
      entry.isFile() &&
      /^(licen[cs]e|copying|notice)([._-]|$)/i.test(entry.name),
  );
  const notices = await Promise.all(
    files.map(
      async (file) =>
        file.name +
        "\n" +
        (await readFile(path.join(directory, file.name), "utf8")),
    ),
  );
  if (!notices.length) {
    const readme = (await readdir(directory)).find((name) =>
      /^readme\.md$/i.test(name),
    );
    if (readme) {
      const text = await readFile(path.join(directory, readme), "utf8");
      const start = text.search(/^## License\s*$/im);
      if (
        start >= 0 &&
        text.slice(start).includes("Permission is hereby granted")
      )
        notices.push(text.slice(start));
    }
    if (["rehype-katex", "remark-math"].includes(pkg.name))
      notices.push(await readFile("licenses/remark-math-MIT.txt", "utf8"));
  }
  // khroma omits license metadata but includes the complete MIT license.
  if (
    !license &&
    notices.some((text) => text.includes("The MIT License (MIT)"))
  )
    license = "MIT";
  if (!license || !notices.length)
    throw new Error("Review the missing license information for " + id);
  entries.set(id, `${id}\nLicense: ${license}\n${notices.join("\n\n")}`);
}
await mkdir("public", { recursive: true });
await writeFile(
  "public/THIRD_PARTY_NOTICES.txt",
  "Third-party software and font notices\n\nThe application license does not replace the following licenses.\nDOMPurify is used under the Apache-2.0 option of its dual license.\n\n" +
    [...entries]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, entry]) => entry)
      .join("\n\n" + "=".repeat(72) + "\n\n") +
    "\n",
);
console.log(
  "Included full notices for " + entries.size + " production packages.",
);
