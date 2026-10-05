import hljs from "highlight.js/lib/common";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import powershell from "highlight.js/lib/languages/powershell";

hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("powershell", powershell);

const EXTENSIONS = {
  mdx: "markdown",
  htm: "xml",
  html: "xml",
  svg: "xml",
  xaml: "xml",
  csproj: "xml",
  props: "xml",
  targets: "xml",
  config: "xml",
  resx: "xml",
  psm1: "powershell",
  psd1: "powershell",
};
// Highlighting very large files would freeze the tab; they stay plain.
const MAX_LENGTH = 400000;

export function languageFor(path = "") {
  const name = path.split("/").at(-1).toLowerCase();
  if (name === "dockerfile" || name.startsWith("dockerfile."))
    return "dockerfile";
  const extension = name.includes(".") ? name.split(".").at(-1) : "";
  const language = EXTENSIONS[extension] || extension;
  return language && hljs.getLanguage(language) ? language : null;
}

// Highlights the whole text (so multi-line comments and strings stay correct) and
// splits the HTML into lines, closing and reopening spans at every line break.
export function highlightLines(text, path) {
  const language = languageFor(path);
  if (!text || !language || text.length > MAX_LENGTH) return null;
  const html = hljs.highlight(text, { language, ignoreIllegals: true }).value;
  const lines = [],
    open = [];
  for (const line of html.split("\n")) {
    const start = open.join("");
    for (const [tag] of line.matchAll(/<span[^>]*>|<\/span>/g))
      if (tag === "</span>") open.pop();
      else open.push(tag);
    lines.push(start + line + "</span>".repeat(open.length));
  }
  return lines;
}
