# GH Review Copy

Chromium extension (Chrome / Brave / Edge) that copies your **pending** GitHub PR review comments to the clipboard so you can paste them straight into an agent.

The goal is a low-friction loop: leave inline comments on a PR, copy them in one click, hand them to an agent to fix.

## What you get

Opens the **Finish your review** modal on a PR’s Files / Changes page, then click **Copy comments**. Clipboard output looks like:

```
I reviewed your code and have the following comments. Please address them.

path/to/file.ts:42 Do this instead
path/to/other.ts:10-12 Rename this
```

- Pending review comments only (not published review threads)
- One line per comment: `path:line` (or `path:start-end` when GitHub has a range)
- Multi-line comment bodies are flattened to a single line
- Order matches GitHub’s pending list
- Optional prefix is configurable (empty is fine)

## Install

1. Clone this repo (or download it).
2. Open `chrome://extensions` or `brave://extensions`.
3. Enable **Developer mode**.
4. **Load unpacked** → select this folder.

## Use

1. On a PR, add pending review comments as usual.
2. Click **Finish your review** (you do not need to submit).
3. In the modal footer, click **Copy comments** (left of Cancel).
4. Paste into your agent chat.

Works on `/files` and `/changes` (and soft-navigated PR pages).

## Demo PR

This is for the screenshot

## Options

Extension options → set the clipboard **prefix** (synced via `chrome.storage.sync`). Default:

```
I reviewed your code and have the following comments. Please address them.
```

## Privacy

Runs only on `github.com`. Uses your existing browser session to read pending review data from the page — no personal access token, and it does not open comment modals just to copy.

Full policy: [PRIVACY.md](./PRIVACY.md)  
Chrome Web Store privacy-policy URL (after push): `https://github.com/jcger/gh-review-copy/blob/main/PRIVACY.md`

## License

[MIT](./LICENSE)
