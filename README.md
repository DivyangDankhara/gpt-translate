# GPT Translate

A Chrome/Edge MV3 extension that auto-translates webpages using the OpenAI API.

## Features
- Auto-translate visible text on any page
- Toggle on/off via popup or **Ctrl+Shift+Y**
- MutationObserver handles dynamically-loaded content
- Skips inputs, code/pre blocks, iframes, etc.
- Keeps your API key private in the background worker

## Quick start
1. Go to **chrome://extensions** → enable **Developer mode** → **Load unpacked** and select this folder.
2. Open the extension **Options** and paste your **OpenAI API key**.
3. Visit a non-English page → it translates automatically.

## Development notes
- Files of interest: `manifest.json`, `background.js`, `content.js`, `translator.js`, `popup.html/js`, `options.html/js`.
- Default model: `gpt-4o-mini`. Change in `translator.js` or via popup.
- No build step needed. To package a ZIP: `zip -r gpt-translate.zip . -x "*.git*"`

## License
MIT — see [LICENSE](LICENSE).
