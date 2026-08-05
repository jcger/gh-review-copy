# Privacy Policy

**GH Review Copy** (“the Extension”)

Last updated: 5 August 2026

## Overview

GH Review Copy helps you copy your own pending GitHub pull request review comments to the clipboard so you can paste them elsewhere (for example, into an AI agent).

This policy describes what data the Extension accesses and how it is used.

## Data the Extension accesses

When you click **Copy comments** on a GitHub pull request page, the Extension may read:

- Your pending (unpublished) review comment text
- Related file paths and line numbers for those comments
- The current repository owner, name, and pull request number needed to look that information up on github.com

It also stores a user-configurable clipboard **prefix** string (optional) via Chrome’s sync storage.

## How data is used

- Pending comment content and locations are formatted locally and written to your **clipboard**.
- The prefix is stored locally (and synced by Chrome if you use Chrome sync) only to prepend that text when copying.
- The Extension does **not** send your review comments, paths, or prefix to any server operated by the Extension author.
- The Extension does **not** use analytics, advertising, or tracking SDKs.

Network requests made by the Extension go only to **github.com**, using your existing browser session, to read pending-review positioning data needed to build `path:line` lines. Those requests are same-origin GitHub requests in your session; they are not uploads to a third-party service.

## Data sharing

The Extension author does not collect, sell, or share your data.

Anything you paste from the clipboard (for example into an agent or another app) is outside this Extension and governed by that other product’s policies.

## Permissions

- **storage** — save your clipboard prefix preference.
- **Host access to `https://github.com/*`** — run on GitHub pull request pages, insert the copy control, and read pending review data in your signed-in session.

## Children’s privacy

The Extension is not directed at children and is not intended for use by children under 13.

## Changes

If this policy changes, the updated version will be posted in this repository (`PRIVACY.md`). The “Last updated” date at the top will be revised.

## Contact

Questions about this policy: open an issue at [https://github.com/jcger/gh-review-copy](https://github.com/jcger/gh-review-copy) or contact the maintainer via GitHub (@jcger).
