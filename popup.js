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

document.addEventListener("DOMContentLoaded", async () => {
  const langEl = document.getElementById("lang");
  const modelEl = document.getElementById("model");
  const btnToggle = document.getElementById("toggle");
  const btnApply = document.getElementById("apply");

  const settings = await getSettings();
  if (settings?.targetLang) langEl.value = settings.targetLang;
  if (settings?.model) modelEl.value = settings.model;

  langEl.addEventListener("change", async () => {
    const s = await getSettings();
    s.targetLang = langEl.value;
    await setSettings(s);
  });
  modelEl.addEventListener("change", async () => {
    const s = await getSettings();
    s.model = modelEl.value.trim() || "gpt-4o-mini";
    await setSettings(s);
  });

  btnToggle.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const s = await getSettings();
    s.autoTranslate = !s.autoTranslate;
    await setSettings(s);
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_TRANSLATE" });
  });

  btnApply.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "APPLY_TRANSLATE_NOW" });
  });
});
