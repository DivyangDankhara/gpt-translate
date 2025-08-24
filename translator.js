export const DEFAULT_MODEL = "gpt-4o-mini"; 

export function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function isVisible(node) {
  if (!node || !node.parentElement) return false;
  const el = node.parentElement;
  const style = window.getComputedStyle(el);
  if (style && (style.visibility === "hidden" || style.display === "none")) return false;
  const badTags = new Set(["SCRIPT","STYLE","NOSCRIPT","CODE","PRE","TEXTAREA","INPUT","SELECT","OPTION","IFRAME"]);
  if (badTags.has(el.tagName)) return false;
  const text = node.nodeValue?.trim();
  if (!text || text.length < 2) return false;
  return true;
}

export function getPageLang() {
  const lang = document.documentElement?.lang || document.querySelector("meta[name='language']")?.content || "";
  return (lang || "").toLowerCase();
}
