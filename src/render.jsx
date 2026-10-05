import React, {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useId,
} from "react";
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
  Minimize,
  Copy,
  AlertCircle,
  Loader2,
} from "lucide-react";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github.css";
import { highlightLines } from "./highlight.js";

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
const MIN_ZOOM = 0.05,
  MAX_ZOOM = 6,
  ZOOM_STEP = 1.25;
const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
export function Mermaid({ source, theme }) {
  const [svg, setSvg] = useState(""),
    [error, setError] = useState(""),
    // null means "fit": the diagram follows the available space.
    [zoom, setZoom] = useState(null),
    [fit, setFit] = useState(1),
    [size, setSize] = useState(null),
    [fullscreen, setFullscreen] = useState(false),
    [dragging, setDragging] = useState(false),
    ref = useRef(),
    scrollRef = useRef(),
    canvasRef = useRef(),
    anchor = useRef(null),
    drag = useRef(null),
    id = useId().replace(/[^a-z0-9]/gi, "");
  const scale = zoom ?? fit,
    scaleRef = useRef(scale);
  scaleRef.current = scale;
  useEffect(() => {
    let active = true;
    setSvg("");
    setError("");
    setZoom(null);
    setSize(null);
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
  // Zoom is relative to the diagram's natural size, not to the card width.
  useLayoutEffect(() => {
    const element = canvasRef.current?.querySelector("svg");
    if (!element) return;
    const box = element.viewBox?.baseVal,
      rect = element.getBoundingClientRect();
    const width = box?.width || rect.width,
      height = box?.height || rect.height;
    element.removeAttribute("width");
    element.removeAttribute("height");
    element.style.maxWidth = "none";
    if (width > 0 && height > 0) setSize({ width, height });
  }, [svg]);
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || !size) return;
    function update() {
      const style = getComputedStyle(box);
      const width =
        box.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      const height =
        box.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom);
      // Inline diagrams shrink to fit but never blow up; fullscreen fills the screen.
      const next = fullscreen
        ? Math.min(width / size.width, height / size.height)
        : Math.min(1, width / size.width);
      if (next > 0) setFit(clampZoom(next));
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, [size, fullscreen]);
  useEffect(() => {
    const change = () => {
      setFullscreen(document.fullscreenElement === ref.current);
      setZoom(null);
    };
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);
  function zoomTo(next, point) {
    const box = scrollRef.current,
      canvas = canvasRef.current;
    if (box && canvas) {
      const rect = box.getBoundingClientRect();
      const x = point ? point.x - rect.left : box.clientWidth / 2,
        y = point ? point.y - rect.top : box.clientHeight / 2;
      // Keep the diagram point under the cursor (or the centre) in place.
      anchor.current = {
        x: (box.scrollLeft + x - canvas.offsetLeft) / scaleRef.current,
        y: (box.scrollTop + y - canvas.offsetTop) / scaleRef.current,
        viewX: x,
        viewY: y,
      };
    }
    setZoom(clampZoom(next));
  }
  useLayoutEffect(() => {
    const target = anchor.current,
      box = scrollRef.current,
      canvas = canvasRef.current;
    anchor.current = null;
    if (!target || !box || !canvas) return;
    box.scrollLeft = target.x * scale + canvas.offsetLeft - target.viewX;
    box.scrollTop = target.y * scale + canvas.offsetTop - target.viewY;
  }, [scale]);
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    function wheel(e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomTo(scaleRef.current * Math.exp(-e.deltaY * 0.002), {
        x: e.clientX,
        y: e.clientY,
      });
    }
    box.addEventListener("wheel", wheel, { passive: false });
    return () => box.removeEventListener("wheel", wheel);
  }, [svg]);
  function startDrag(e) {
    const box = scrollRef.current;
    if (
      e.button !== 0 ||
      (box.scrollWidth <= box.clientWidth &&
        box.scrollHeight <= box.clientHeight)
    )
      return;
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      left: box.scrollLeft,
      top: box.scrollTop,
    };
    box.setPointerCapture(e.pointerId);
    setDragging(true);
  }
  function moveDrag(e) {
    const start = drag.current;
    if (!start) return;
    scrollRef.current.scrollLeft = start.left - (e.clientX - start.x);
    scrollRef.current.scrollTop = start.top - (e.clientY - start.y);
  }
  function endDrag() {
    drag.current = null;
    setDragging(false);
  }
  function toggleFullscreen() {
    if (document.fullscreenElement === ref.current)
      document.exitFullscreen().catch(() => {});
    else ref.current?.requestFullscreen?.().catch(() => {});
  }
  return (
    <div className="mermaid-card" ref={ref}>
      <div className="mermaid-toolbar">
        <span>MERMAID</span>
        <div>
          <button
            title="Zoom out"
            aria-label="Zoom out"
            disabled={!size || scale <= MIN_ZOOM}
            onClick={() => zoomTo(scale / ZOOM_STEP)}
          >
            <ZoomOut size={15} />
          </button>
          <button
            className="zoom-level"
            title="Fit to view"
            aria-label="Fit diagram to view"
            disabled={!size}
            onClick={() => setZoom(null)}
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            title="Zoom in"
            aria-label="Zoom in"
            disabled={!size || scale >= MAX_ZOOM}
            onClick={() => zoomTo(scale * ZOOM_STEP)}
          >
            <ZoomIn size={15} />
          </button>
          <button
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            aria-label={
              fullscreen ? "Exit fullscreen diagram" : "Fullscreen diagram"
            }
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
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
        <div
          className={
            "diagram-scroll" +
            (dragging ? " dragging" : scale > fit ? " pannable" : "")
          }
          ref={scrollRef}
          title="Ctrl + scroll to zoom · drag to pan"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            className="mermaid-svg"
            ref={canvasRef}
            style={
              size
                ? { width: size.width * scale, height: size.height * scale }
                : undefined
            }
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
function htmlDocument(content, path, side, anchor) {
  const doc = new DOMParser().parseFromString(content, "text/html");
  // Forms, inputs and buttons stay visible: the sandbox has no allow-forms and the
  // CSP sets form-action 'none', so they cannot submit anywhere.
  doc
    .querySelectorAll(
      'script,iframe,object,embed,base,meta[http-equiv],link[rel="import"]',
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
    const href = el.getAttribute("href") || "";
    if (/^(https?:|mailto:)/i.test(href)) {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noreferrer noopener");
      return;
    }
    el.removeAttribute("target");
    if (!href || /^(javascript:|data:|file:|\/\/)/i.test(href)) {
      el.removeAttribute("href");
      return;
    }
    const target = resolveRepo(href, path);
    if (target.path === path) {
      el.setAttribute("data-leafdock-anchor", target.hash.slice(1));
      el.setAttribute("href", target.hash || "#");
    } else {
      el.setAttribute("data-leafdock-path", target.path);
      el.setAttribute("data-leafdock-hash", target.hash.slice(1));
      el.setAttribute("href", "#");
    }
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
  script.textContent = `const button=document.createElement('button');button.textContent='Quote selection';button.setAttribute('aria-label','Quote selected HTML text');button.style.cssText='position:fixed;top:16px;right:16px;z-index:2147483647;border:1px solid #244d36;background:#244d36;color:white;padding:10px 14px;border-radius:6px;cursor:pointer;font:12px system-ui;display:none';document.body.append(button);let quote='';function selection(){quote=window.getSelection().toString().trim();button.style.display=quote?'block':'none';}document.addEventListener('mouseup',selection);document.addEventListener('keyup',selection);button.addEventListener('mousedown',e=>e.preventDefault());button.addEventListener('click',()=>{parent.postMessage({type:'leafdock-html-quote',quote:quote.slice(0,20000)},'*');window.getSelection().removeAllRanges();button.style.display='none';});function reveal(id){let name=id;try{name=decodeURIComponent(id);}catch{}const el=name&&(document.getElementById(name)||document.getElementsByName(name)[0]);if(el)el.scrollIntoView({block:'start'});}document.addEventListener('click',e=>{const a=e.target instanceof Element&&e.target.closest('a[data-leafdock-path],a[data-leafdock-anchor]');if(!a)return;e.preventDefault();if(a.hasAttribute('data-leafdock-path'))parent.postMessage({type:'leafdock-html-navigate',path:a.dataset.leafdockPath,hash:a.dataset.leafdockHash||''},'*');else reveal(a.dataset.leafdockAnchor);});`;
  if (anchor) {
    const target = JSON.stringify(anchor).replace(/</g, "\\u003c");
    script.textContent += `reveal(${target});addEventListener('load',()=>reveal(${target}));`;
  }
  script.textContent += `document.addEventListener('keydown',e=>{if(e.defaultPrevented||e.isComposing||e.repeat||e.target.closest('input,textarea,select,[contenteditable]'))return;const key=e.key.toLowerCase();if(!(['b','f','j','k','n','t','r','q','1','2','3','4','5','escape','?'].includes(key)))return;if((e.ctrlKey||e.metaKey)&&key!=='k'||e.altKey)return;e.preventDefault();if(key==='q'&&!e.ctrlKey&&!e.metaKey){selection();if(quote){parent.postMessage({type:'leafdock-html-quote',quote:quote.slice(0,20000)},'*');return;}}parent.postMessage({type:'leafdock-html-shortcut',key:e.key,ctrlKey:e.ctrlKey,metaKey:e.metaKey,shiftKey:e.shiftKey,altKey:e.altKey},'*');});`;
  doc.body.append(script);
  return "<!doctype html>" + doc.documentElement.outerHTML;
}
function HtmlPreview({ content, path, side, anchor, onNavigate, onQuote }) {
  const frame = useRef();
  const html = React.useMemo(
    () => htmlDocument(content, path, side, anchor?.hash),
    [content, path, side, anchor],
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
        onNavigate?.(data.path, typeof data.hash === "string" ? data.hash : "");
    };
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, [side, onQuote, onNavigate]);
  return (
    <div className="html-preview">
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
// Scoped to one document: the visual diff renders two copies with the same ids.
function revealAnchor(root, hash) {
  let id = hash;
  try {
    id = decodeURIComponent(hash);
  } catch {}
  if (!id || !root) return false;
  const target =
    root.querySelector("#" + CSS.escape("user-content-" + id)) ||
    root.querySelector("#" + CSS.escape(id));
  target?.scrollIntoView({ block: "start" });
  return !!target;
}
export function Document(props) {
  if (/\.html?$/i.test(props.path)) return <HtmlPreview {...props} />;
  if (!/\.mdx?$/i.test(props.path))
    return <PlainSource content={props.content} path={props.path} />;
  return <Markdown {...props} />;
}
function PlainSource({ content, path }) {
  const lines = React.useMemo(
    () => highlightLines(content, path),
    [content, path],
  );
  return lines ? (
    <pre
      className="plain-source"
      dangerouslySetInnerHTML={{ __html: lines.join("\n") }}
    />
  ) : (
    <pre className="plain-source">{content}</pre>
  );
}
function Markdown({ content, path, side, theme, anchor, onNavigate }) {
  const article = useRef();
  useEffect(() => {
    if (anchor?.hash) revealAnchor(article.current, anchor.hash);
  }, [anchor, content]);
  return (
    <article className="markdown" ref={article}>
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
                    if (revealAnchor(article.current, href.slice(1)))
                      e.preventDefault();
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
                        if (!href) return;
                        const target = resolveRepo(href, path);
                        if (target.path === path)
                          revealAnchor(article.current, target.hash.slice(1));
                        else onNavigate(target.path, target.hash.slice(1));
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
