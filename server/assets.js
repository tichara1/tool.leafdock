import path from "node:path";
import { AppError } from "./azure.js";
export async function boundedBytes(response, limit) {
  if (Number(response.headers.get("content-length") || 0) > limit) {
    await response.body?.cancel();
    throw new AppError("File exceeds the preview size limit.", 413);
  }
  const reader = response.body.getReader();
  let length = 0;
  const chunks = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw new AppError("File exceeds the preview size limit.", 413);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}
export function rewriteRepoCss(css, assetPath, side) {
  const resolve = (value) => {
    if (/^(https?:|data:|\/\/)/i.test(value)) return value;
    if (/^(javascript:|file:)/i.test(value)) return "";
    const resolved = path.posix.resolve(
      path.posix.dirname(assetPath),
      value.split(/[?#]/)[0],
    );
    return "/api/asset?path=" + encodeURIComponent(resolved) + "&side=" + side;
  };
  return css
    .replace(
      /url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi,
      (_, q, url) => `url("${resolve(url)}")`,
    )
    .replace(
      /@import\s+(['"])([^'"]+)\1/gi,
      (_, q, url) => `@import "${resolve(url)}"`,
    );
}
