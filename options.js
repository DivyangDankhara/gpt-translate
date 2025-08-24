document.getElementById("save").addEventListener("click", async () => {
  const apiKey = document.getElementById("apiKey").value.trim();
  if (!apiKey) { alert("Please enter your API key"); return; }
  const resp = await chrome.runtime.sendMessage({ type: "SET_API_KEY", apiKey });
  if (resp?.ok) alert("Saved!");
});

(async () => {
  chrome.storage.local.get(["openaiApiKey"], (res) => {
    const val = res.openaiApiKey || "";
    if (val) document.getElementById("apiKey").value = "••••••••••••";
  });
})();
