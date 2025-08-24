import { chunkArray, isVisible, getPageLang } from "./translator.js";

function toast(msg, type="info") {
  try {
    const hostId = "gpt-translate-toast-host";
    let host = document.getElementById(hostId);
    if (!host) {
      host = document.createElement("div");
      host.id = hostId;
      Object.assign(host.style, {
        position: "fixed",
        zIndex: 2147483647,
        right: "12px",
        bottom: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        maxWidth: "320px",
        fontFamily: "system-ui, sans-serif"
      });
      document.documentElement.appendChild(host);
    }
    const el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
      background: type === "error" ? "#fee2e2" : type === "success" ? "#dcfce7" : "#e5e7eb",
      color: "#111827",
      border: "1px solid " + (type === "error" ? "#ef4444" : type === "success" ? "#22c55e" : "#9ca3af"),
      borderRadius: "8px",
      padding: "10px 12px",
      boxShadow: "0 2px 10px rgba(0,0,0,.08)",
      fontSize: "12px"
    });
    host.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  } catch {}
}


const STATE = {
  enabled: true,
  translating: false,
  targetLang: "English"
};

async function loadSettings() {
  const resp = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  if (resp && resp.settings) {
    STATE.enabled = !!resp.settings.autoTranslate;
    STATE.targetLang = resp.settings.targetLang || "English";
  }
}

function getTextNodes(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) {
    if (isVisible(n) && !n.__gt_done) nodes.push(n);
  }
  return nodes;
}

function markDone(node) { node.__gt_done = true; }

async function translatePage() {
  if (!STATE.enabled || STATE.translating) return;
  STATE.translating = true;

  try {
    const pageLang = getPageLang();
    if (pageLang && STATE.targetLang && pageLang.includes(STATE.targetLang.toLowerCase())) {
      STATE.translating = false;
      return;
    }

    const nodes = getTextNodes();
    const items = [];
    let idCounter = 0;
    for (const node of nodes) {
      const text = node.nodeValue.trim();
      if (text.length > 0) items.push({ id: ++idCounter, node, text });
    }

    if (!items.length) { STATE.translating = false; return; }

    const chunks = chunkArray(items, 20);
    for (const chunk of chunks) {
      const payload = chunk.map(x => ({ id: x.id, text: x.text }));
      const resp = await chrome.runtime.sendMessage({ type: "TRANSLATE_BATCH", payload });
      if (!resp?.ok) { toast("GPT Translate: " + (resp?.error || "Translation failed"), "error"); throw new Error(resp?.error || "Translation failed"); }
      const map = new Map(resp.data.map(r => [r.id, r.translated]));
      let changed = 0;
      for (const item of chunk) {
        const t = map.get(item.id) ?? item.text;
        if (t && item.node.nodeValue !== t) { item.node.nodeValue = t; changed++; }
        markDone(item.node);
      }
    }
      if (changed > 0) toast(`GPT Translate: translated ${changed} snippet(s)`, "success");
  } catch (e) {
    console.warn("[GPT Translate] Error:", e);
    toast("GPT Translate error: " + (e?.message || e), "error");
  } finally {
    STATE.translating = false;
  }
}

function setupMutationObserver() {
  const obs = new MutationObserver(() => {
    clearTimeout(window.__gt_timer);
    window.__gt_timer = setTimeout(() => {
      if (STATE.enabled) translatePage();
    }, 350);
  });
  obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
}

async function init() {
  await loadSettings();
  setupMutationObserver();
  if (STATE.enabled) translatePage();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "TOGGLE_TRANSLATE") {
    STATE.enabled = !STATE.enabled;
    if (STATE.enabled) translatePage();
    sendResponse({ enabled: STATE.enabled });
  }
  if (msg?.type === "APPLY_TRANSLATE_NOW") {
    translatePage().then(() => sendResponse({ ok: true }));
  }
  return true;
});

init();
