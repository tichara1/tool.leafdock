import React, { useEffect, useState, useRef, useId } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import DOMPurify from "dompurify";
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Copy,
  AlertCircle,
  Loader2,
} from "lucide-react";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github.css";

let mermaidPromise;
let renderQueue = Promise.resolve();
function loadMermaid() {
  return (mermaidPromise ??= import("mermaid").then((m) => m.default));
}
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes.code || []),
      ["className", /^language-./, "math-inline", "math-display"],
    ],
    div: [
      ...(defaultSchema.attributes.div || []),
      ["className", "math", "math-display"],
    ],
  },
};
function resolveRepo(value, path) {
  const current = new URL("https://repository.local" + path);
  const target = new URL(value, current);
  return { path: decodeURIComponent(target.pathname), hash: target.hash };
}
function assetUrl(value, path, side) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (/^(data:|javascript:|vbscript:|file:|\/\/)/i.test(value)) return "";
  try {
    const resolved = resolveRepo(value, path);
    return (
      "/api/asset?path=" + encodeURIComponent(resolved.path) + "&side=" + side
    );
  } catch {
    return "";
  }
}
export function Mermaid({ source, theme }) {
  const [svg, setSvg] = useState(""),
    [error, setError] = useState(""),
    [zoom, setZoom] = useState(1),
    ref = useRef(),
    id = useId().replace(/[^a-z0-9]/gi, "");
  useEffect(() => {
    let active = true;
    setSvg("");
    setError("");
    setZoom(1);
    renderQueue = renderQueue
      .catch(() => {})
      .then(async () => {
        const mermaid = await loadMermaid();
        if (!active) return;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: theme === "midnight" ? "dark" : "neutral",
          suppressErrorRendering: true,
          fontFamily: "system-ui",
          maxTextSize: 100000,
          htmlLabels: false,
          flowchart: { htmlLabels: false },
        });
        try {
          const result = await mermaid.render(
            "mermaid-" + id + "-" + Math.random().toString(36).slice(2),
            source,
          );
          if (active)
            setSvg(
              DOMPurify.sanitize(result.svg, {
                USE_PROFILES: { svg: true, svgFilters: true },
                ADD_TAGS: ["foreignObject"],
                ADD_ATTR: ["dominant-baseline"],
              }),
            );
        } catch (e) {
          if (active)
            setError(
              e.message?.split("\n").slice(0, 4).join("\n") ||
                "Unable to render the diagram.",
            );
        }
      });
    return () => {
      active = false;
    };
  }, [source, theme, id]);
  return (
    <div className="mermaid-card" ref={ref}>
      <div className="mermaid-toolbar">
        <span>MERMAID</span>
        <div>
          <button
            title="Zoom out"
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
          >
            <ZoomOut size={15} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            title="Zoom in"
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
          >
            <ZoomIn size={15} />
          </button>
          <button
            title="Fullscreen"
            aria-label="Fullscreen diagram"
            onClick={() => ref.current?.requestFullscreen?.()}
          >
            <Maximize size={15} />
          </button>
        </div>
      </div>
      {error ? (
        <div className="diagram-error">
          <AlertCircle size={18} />
          <p>{error}</p>
          <pre>{source}</pre>
        </div>
      ) : svg ? (
        <div className="diagram-scroll">
          <div
            className="mermaid-svg"
            style={{ width: zoom * 100 + "%", minWidth: zoom * 100 + "%" }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      ) : (
        <div className="diagram-loading">
          <Loader2 className="spin" size={18} /> Rendering diagram…
        </div>
      )}
      <details>
        <summary>Diagram source</summary>
        <pre>{source}</pre>
      </details>
    </div>
  );
}
function CodeBlock({ children, ...props }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef();
  return (
    <div className="code-block">
      <button
        aria-label="Copy code"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(ref.current.innerText);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {}
        }}
      >
        <Copy size={14} />
        {copied ? "Copied" : "Copy"}
      </button>
      <pre ref={ref} {...props}>
        {children}
      </pre>
    </div>
  );
}
function htmlDocument(content, path, side) {
  const doc = new DOMParser().parseFromString(content, "text/html");
  doc
    .querySelectorAll(
      'script,iframe,object,embed,base,form,input,button,meta[http-equiv],link[rel="import"]',
    )
    .forEach((el) => el.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes])
      if (
        /^on/i.test(attr.name) ||
        ["srcdoc", "action", "formaction"].includes(attr.name)
      )
        el.removeAttribute(attr.name);
  });
  doc.querySelectorAll("[src]").forEach((el) => {
    el.setAttribute("src", assetUrl(el.getAttribute("src"), path, side));
    el.removeAttribute("srcset");
  });
  doc.querySelectorAll("link[href]").forEach((el) => {
    if (el.getAttribute("rel") === "stylesheet")
      el.setAttribute("href", assetUrl(el.getAttribute("href"), path, side));
    else el.remove();
  });
  doc.querySelectorAll("a").forEach((el) => {
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noreferrer noopener");
    const href = el.getAttribute("href") || "";
    if (
      !/^(https?:|mailto:)/i.test(href) &&
      href &&
      !/^(javascript:|data:|file:|\/\/)/i.test(href)
    ) {
      el.setAttribute("data-leafdock-path", resolveRepo(href, path).path);
      el.setAttribute("href", "#");
    } else if (!/^(https?:|mailto:)/i.test(href)) el.removeAttribute("href");
  });
  const rewriteCss = (text) =>
    text
      .replace(
        /url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g,
        (_, q, url) => `url("${assetUrl(url, path, side)}")`,
      )
      .replace(/@import\s+(?:url\([^)]*\)|['"][^'"]*['"])[^;]*;/gi, "");
  doc.querySelectorAll("style").forEach((el) => {
    el.textContent = rewriteCss(el.textContent);
  });
  doc
    .querySelectorAll("[style]")
    .forEach((el) =>
      el.setAttribute("style", rewriteCss(el.getAttribute("style"))),
    );
  const meta = doc.createElement("meta");
  const nonce = crypto.randomUUID().replaceAll("-", "");
  meta.httpEquiv = "Content-Security-Policy";
  meta.content = `default-src 'none'; img-src http: https:; style-src http: https: 'unsafe-inline'; font-src http: https:; script-src 'nonce-${nonce}'; connect-src 'none'; form-action 'none'; base-uri 'none'`;
  doc.head.prepend(meta);
  const style = doc.createElement("style");
  style.textContent =
    "html{color-scheme:light}body{margin:0;padding:24px;font:16px/1.7 system-ui}img{max-width:100%}pre{overflow:auto}";
  doc.head.prepend(style);
  const script = doc.createElement("script");
  script.setAttribute("nonce", nonce);
  script.textContent = `const button=document.createElement('button');button.textContent='Quote selection';button.setAttribute('aria-label','Quote selected HTML text');button.style.cssText='position:fixed;top:16px;right:16px;z-index:2147483647;border:1px solid #244d36;background:#244d36;color:white;padding:10px 14px;border-radius:6px;cursor:pointer;font:12px system-ui;display:none';document.body.append(button);let quote='';function selection(){quote=window.getSelection().toString().trim();button.style.display=quote?'block':'none';}document.addEventListener('mouseup',selection);document.addEventListener('keyup',selection);button.addEventListener('mousedown',e=>e.preventDefault());button.addEventListener('click',()=>{parent.postMessage({type:'leafdock-html-quote',quote:quote.slice(0,20000)},'*');window.getSelection().removeAllRanges();button.style.display='none';});document.addEventListener('click',e=>{const a=e.target.closest('a[data-leafdock-path]');if(a){e.preventDefault();parent.postMessage({type:'leafdock-html-navigate',path:a.dataset.leafdockPath},'*');}});`;
  script.textContent += `document.addEventListener('keydown',e=>{if(e.defaultPrevented||e.isComposing||e.repeat||e.target.closest('input,textarea,select,[contenteditable]'))return;const key=e.key.toLowerCase();if(!(['f','j','k','n','t','r','q','1','2','3','4','5','escape','?'].includes(key)))return;if((e.ctrlKey||e.metaKey)&&key!=='k'||e.altKey)return;e.preventDefault();if(key==='q'&&!e.ctrlKey&&!e.metaKey){selection();if(quote){parent.postMessage({type:'leafdock-html-quote',quote:quote.slice(0,20000)},'*');return;}}parent.postMessage({type:'leafdock-html-shortcut',key:e.key,ctrlKey:e.ctrlKey,metaKey:e.metaKey,shiftKey:e.shiftKey,altKey:e.altKey},'*');});`;
  doc.body.append(script);
  return "<!doctype html>" + doc.documentElement.outerHTML;
}
function HtmlPreview({ content, path, side, onNavigate, onQuote }) {
  const frame = useRef();
  const html = React.useMemo(
    () => htmlDocument(content, path, side),
    [content, path, side],
  );
  useEffect(() => {
    const handle = (event) => {
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data;
      if (
        data?.type === "leafdock-html-shortcut" &&
        typeof data.key === "string"
      )
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: data.key,
            ctrlKey: !!data.ctrlKey,
            metaKey: !!data.metaKey,
            shiftKey: !!data.shiftKey,
            altKey: !!data.altKey,
          }),
        );
      if (
        data?.type === "leafdock-html-quote" &&
        typeof data.quote === "string"
      )
        onQuote?.({ quote: data.quote.slice(0, 20000), side });
      if (
        data?.type === "leafdock-html-navigate" &&
        typeof data.path === "string" &&
        data.path.startsWith("/")
      )
        onNavigate?.(data.path);
    };
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, [side, onQuote, onNavigate]);
  return (
    <div className="html-preview">
      <p className="html-note">
        HTML preview · original styles · isolated rendering. Select text and
        click “Quote selection”. Document scripts do not run.
      </p>
      <iframe
        ref={frame}
        title={"HTML preview " + side}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        srcDoc={html}
      />
    </div>
  );
}
export function Document({ content, path, side, theme, onNavigate, onQuote }) {
  if (/\.html?$/i.test(path))
    return (
      <HtmlPreview
        content={content}
        path={path}
        side={side}
        onNavigate={onNavigate}
        onQuote={onQuote}
      />
    );
  if (!/\.mdx?$/i.test(path))
    return <pre className="plain-source">{content}</pre>;
  return (
    <article className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeRaw,
          rehypeSlug,
          [rehypeSanitize, schema],
          rehypeKatex,
          [rehypeHighlight, { detect: false, ignoreMissing: true }],
        ]}
        components={{
          pre: ({ children, node, ...props }) => {
            const child = React.Children.toArray(children)[0];
            if (child?.props?.className?.includes("language-mermaid"))
              return (
                <Mermaid
                  source={String(child.props.children).replace(/\n$/, "")}
                  theme={theme}
                />
              );
            return <CodeBlock {...props}>{children}</CodeBlock>;
          },
          img: ({ src, node, ...props }) => (
            <img
              {...props}
              src={assetUrl(src, path, side)}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ),
          a: ({ href, children, node, ...props }) => {
            if (href?.startsWith("#"))
              return (
                <a
                  href={href}
                  {...props}
                  onClick={(e) => {
                    const id = decodeURIComponent(href.slice(1));
                    const target =
                      document.getElementById("user-content-" + id) ||
                      document.getElementById(id);
                    if (target) {
                      e.preventDefault();
                      target.scrollIntoView({ block: "start" });
                    }
                  }}
                >
                  {children}
                </a>
              );
            const external = /^(https?:|mailto:)/i.test(href || "");
            return (
              <a
                {...props}
                href={external ? href : "#"}
                target={external ? "_blank" : undefined}
                rel={external ? "noreferrer noopener" : undefined}
                onClick={
                  external
                    ? undefined
                    : (e) => {
                        e.preventDefault();
                        if (href) {
                          const target = resolveRepo(href, path);
                          onNavigate(target.path);
                        }
                      }
                }
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
