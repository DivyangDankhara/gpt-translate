async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["settings"], (res) => resolve(res.settings || {}));
  });
}
async function setSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ settings }, () => resolve());
  });
}
async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["openaiApiKey"], (res) => resolve(res.openaiApiKey || ""));
  });
}
async function setApiKey(key) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "SET_API_KEY", apiKey: key }, (resp) => resolve(resp?.ok));
  });
}
function show(el) { el?.classList.remove("hidden"); }
function hide(el) { el?.classList.add("hidden"); }

function isHttpLike(url) {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}
function isRestricted(url) {
  return (
    url.startsWith("chrome://") ||
    url.startsWith("edge://")   ||
    url.startsWith("about:")    ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge-extension://") ||
    url.startsWith("moz-extension://")
  );
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Try to inject our content scripts if they aren't there yet (e.g., old tab)
async function ensureContentScripts(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["translator.js", "content.js"]
    });
  } catch (e) {
    // Ignore; on most pages this will succeed. It will fail on restricted pages.
  }
}

// Safe sendMessage that injects if needed and retries once
async function sendToContent(tabId, payload) {
  try {
    return await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, payload, (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(resp);
        }
      });
    });
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function sendWithAutoInject(tabId, payload) {
  let resp = await sendToContent(tabId, payload);
  if (resp && resp.ok !== undefined) return resp;

  // If receiving end doesn't exist, try injecting and retrying once
  if (resp?.error && /Receiving end does not exist/i.test(resp.error)) {
    await ensureContentScripts(tabId);
    resp = await sendToContent(tabId, payload);
  }
  return resp;
}

document.addEventListener("DOMContentLoaded", async () => {
  const onboarding = document.getElementById("onboarding");
  const mainControls = document.getElementById("mainControls");
  const openKeys = document.getElementById("openKeys");
  const apiKeyInput = document.getElementById("apiKey");
  const saveKey = document.getElementById("saveKey");
  const savedMsg = document.getElementById("savedMsg");
  const runDiag1 = document.getElementById("runDiag1");
  const diagMsg1 = document.getElementById("diagMsg1");

  const langEl = document.getElementById("lang");
  const modelEl = document.getElementById("model");
  const btnToggle = document.getElementById("toggle");
  const btnApply = document.getElementById("apply");
  const runDiag2 = document.getElementById("runDiag2");
  const diagMsg2 = document.getElementById("diagMsg2");

  const key = await getApiKey();
  if (!key) show(onboarding); else show(mainControls);

  openKeys?.addEventListener("click", () => chrome.tabs.create({ url: "https://platform.openai.com/api-keys" }));

  saveKey?.addEventListener("click", async () => {
    const val = apiKeyInput.value.trim();
    if (!val || !/^sk-/.test(val)) { alert("Please paste a valid OpenAI key starting with sk-"); return; }
    const ok = await setApiKey(val);
    if (ok) {
      savedMsg?.classList.remove("hidden");
      hide(onboarding);
      show(mainControls);
    } else {
      alert("Failed to save key. Please try again.");
    }
  });

  async function runDiagnostics(targetEl) {
    targetEl.textContent = "";
    hide(targetEl);
    const resp = await new Promise((resolve) => chrome.runtime.sendMessage({ type: "DIAGNOSTIC_PING" }, resolve));
    if (!resp?.ok) {
      targetEl.textContent = "API check failed: " + (resp?.error || "Unknown error");
      targetEl.classList.remove("success");
      targetEl.classList.add("error");
      show(targetEl);
    } else {
      targetEl.textContent = "API check passed.";
      targetEl.classList.remove("error");
      targetEl.classList.add("success");
      show(targetEl);
    }
  }
  runDiag1?.addEventListener("click", () => runDiagnostics(diagMsg1));
  runDiag2?.addEventListener("click", () => runDiagnostics(diagMsg2));

  const settings = await getSettings();
  if (settings?.targetLang) langEl.value = settings.targetLang;
  if (settings?.model) modelEl.value = settings.model;

  langEl?.addEventListener("change", async () => {
    const s = await getSettings();
    s.targetLang = langEl.value;
    await setSettings(s);
  });
  modelEl?.addEventListener("change", async () => {
    const s = await getSettings();
    s.model = modelEl.value.trim() || "gpt-4o-mini";
    await setSettings(s);
  });

  btnToggle?.addEventListener("click", async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return alert("No active tab found.");
    if (!tab.url || isRestricted(tab.url) || !isHttpLike(tab.url)) {
      return alert("Translation can only run on regular web pages (http/https).");
    }
    const resp = await sendWithAutoInject(tab.id, { type: "TOGGLE_TRANSLATE" });
    if (resp?.error) alert("Could not toggle: " + resp.error);
  });

  btnApply?.addEventListener("click", async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return alert("No active tab found.");
    if (!tab.url || isRestricted(tab.url) || !isHttpLike(tab.url)) {
      return alert("Translate now can only run on regular web pages (http/https).");
    }
    const resp = await sendWithAutoInject(tab.id, { type: "APPLY_TRANSLATE_NOW" });
    if (resp?.error) alert("Could not translate: " + resp.error);
  });
});
