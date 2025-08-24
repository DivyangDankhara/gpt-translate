import { DEFAULT_MODEL } from "./translator.js";

const DEFAULT_SETTINGS = {
  targetLang: "English",
  model: DEFAULT_MODEL,
  autoTranslate: true
};

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["openaiApiKey", "settings"], (res) => {
      resolve({
        apiKey: res.openaiApiKey || "",
        settings: { ...DEFAULT_SETTINGS, ...(res.settings || {}) }
      });
    });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === "GET_SETTINGS") {
      sendResponse(await getSettings());
      return;
    }

    if (msg.type === "SET_API_KEY") {
      await chrome.storage.local.set({ openaiApiKey: msg.apiKey });
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "SET_SETTINGS") {
      await chrome.storage.local.set({ settings: msg.settings });
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "TRANSLATE_BATCH") {
      const { apiKey, settings } = await getSettings();
      if (!apiKey) {
        sendResponse({ ok: false, error: "Missing OpenAI API key" });
        return;
      }
      try {
        const out = await translateBatch(apiKey, settings.model, settings.targetLang, msg.payload);
        sendResponse({ ok: true, data: out });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
      return;
    }
  })();
  return true;
});

async function translateBatch(apiKey, model, targetLang, batchItems) {
  const system = [
    "You are a professional translator.",
    `Translate ALL provided strings into ${targetLang}.`,
    "Preserve meaning, tone, and punctuation.",
    "Do NOT translate code snippets, file extensions, URLs, brand/product names, or HTML tags.",
    "Return ONLY valid JSON with shape: { \"translations\": [{\"id\": string, \"translated\": string}, ...] }."
  ].join(" ");

  const user = { strings: batchItems.map(x => ({ id: String(x.id), text: x.text })) };

  const body = {
    model,
    input: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user) }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "BatchTranslations",
        schema: {
          type: "object",
          properties: {
            translations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  translated: { type: "string" }
                },
                required: ["id", "translated"]
              }
            }
          },
          required: ["translations"]
        }
      }
    }
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);

  const json = await res.json();
  const outputText = json?.output?.[0]?.content?.[0]?.text || "";
  const parsed = JSON.parse(outputText);
  const map = new Map(parsed.translations?.map(x => [String(x.id), x.translated]) || []);
  return batchItems.map(x => ({ id: x.id, translated: map.get(String(x.id)) ?? x.text }));
}
