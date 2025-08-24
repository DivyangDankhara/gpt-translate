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

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

document.addEventListener("DOMContentLoaded", async () => {
  const onboarding = document.getElementById("onboarding");
  const mainControls = document.getElementById("mainControls");
  const openKeys = document.getElementById("openKeys");
  const apiKeyInput = document.getElementById("apiKey");
  const saveKey = document.getElementById("saveKey");
  const savedMsg = document.getElementById("savedMsg");

  const langEl = document.getElementById("lang");
  const modelEl = document.getElementById("model");
  const btnToggle = document.getElementById("toggle");
  const btnApply = document.getElementById("apply");

  const key = await getApiKey();
  if (!key) {
    show(onboarding);
  } else {
    show(mainControls);
  }

  openKeys.addEventListener("click", async () => {
    // Open the OpenAI keys page in a new tab. We cannot read keys automatically.
    chrome.tabs.create({ url: "https://platform.openai.com/api-keys" });
  });

  saveKey.addEventListener("click", async () => {
    const val = apiKeyInput.value.trim();
    if (!val || !/^sk-/.test(val)) { alert("Please paste a valid OpenAI key starting with sk-"); return; }
    const ok = await setApiKey(val);
    if (ok) {
      savedMsg.classList.remove("hidden");
      hide(onboarding);
      show(mainControls);
    } else {
      alert("Failed to save key. Please try again.");
    }
  });

  // Load and wire main controls
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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const s = await getSettings();
    s.autoTranslate = !s.autoTranslate;
    await setSettings(s);
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_TRANSLATE" });
  });

  btnApply?.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "APPLY_TRANSLATE_NOW" });
  });
});
