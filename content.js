import { chunkArray, isVisible, getPageLang } from "./translator.js";

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

    const chunks = chunkArray(items, 60);
    for (const chunk of chunks) {
      const payload = chunk.map(x => ({ id: x.id, text: x.text }));
      const resp = await chrome.runtime.sendMessage({ type: "TRANSLATE_BATCH", payload });
      if (!resp?.ok) throw new Error(resp?.error || "Translation failed");
      const map = new Map(resp.data.map(r => [r.id, r.translated]));
      for (const item of chunk) {
        const t = map.get(item.id) ?? item.text;
        if (t && item.node.nodeValue !== t) item.node.nodeValue = t;
        markDone(item.node);
      }
    }
  } catch (e) {
    console.warn("[GPT Translate] Error:", e);
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
