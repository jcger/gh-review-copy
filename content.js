(() => {
  const DEFAULT_PREFIX =
    "I reviewed your code and have the following comments. Please address them.";
  const BUTTON_ID = "gh-review-copy-btn";
  const SOURCE = "gh-review-copy";
  const STATE_MS = 1600;

  const OCTICON =
    'data-component="Octicon" aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block" overflow="visible" style="vertical-align:text-bottom"';

  const ICONS = {
    copy: `<svg ${OCTICON} class="octicon octicon-comment-discussion"><path d="M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 10.25 10H7.061l-2.574 2.573A1.458 1.458 0 0 1 2 11.543V10h-.25A1.75 1.75 0 0 1 0 8.25v-5.5C0 1.784.784 1 1.75 1ZM1.5 2.75v5.5c0 .138.112.25.25.25h1a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h3.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm13 2a.25.25 0 0 0-.25-.25h-.5a.75.75 0 0 1 0-1.5h.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 14.25 12H14v1.543a1.458 1.458 0 0 1-2.487 1.03L9.22 12.28a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l2.22 2.22v-2.19a.75.75 0 0 1 .75-.75h1a.25.25 0 0 0 .25-.25Z"/></svg>`,
    check: `<svg ${OCTICON} class="octicon octicon-check"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>`,
    alert: `<svg ${OCTICON} class="octicon octicon-alert"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>`,
    sync: `<svg ${OCTICON} class="octicon octicon-sync gh-review-copy-spin"><path d="M8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.018 1.018A.749.749 0 0 1 4.28 6.75H.755a.75.75 0 0 1-.75-.75V2.213a.75.75 0 0 1 1.28-.53l1.028 1.027A6.985 6.985 0 0 1 8 1a7 7 0 0 1 7 7 .75.75 0 0 1-1.5 0A5.5 5.5 0 0 0 8 2.5ZM1.75 8A.75.75 0 0 1 2.5 8a5.5 5.5 0 0 0 9.631 3.631l-1.018-1.018a.749.749 0 0 1 .607-1.265h3.525a.75.75 0 0 1 .75.75v3.525a.75.75 0 0 1-1.28.53l-1.028-1.027A6.985 6.985 0 0 1 8 15a7 7 0 0 1-7-7 .75.75 0 0 1 .75-.75Z"/></svg>`,
  };

  function ensureStyles() {
    let style = document.getElementById("gh-review-copy-styles");
    if (!style) {
      style = document.createElement("style");
      style.id = "gh-review-copy-styles";
      document.documentElement.appendChild(style);
    }
    style.textContent = `
      @keyframes gh-review-copy-spin {
        to { transform: rotate(360deg); }
      }
      #${BUTTON_ID} .gh-review-copy-spin {
        animation: gh-review-copy-spin 0.7s linear infinite;
        transform-origin: center;
      }
      #${BUTTON_ID}[data-state="check"] {
        color: var(--fgColor-success, var(--color-success-fg, #1a7f37)) !important;
      }
      #${BUTTON_ID}[data-state="alert"] {
        color: var(--fgColor-danger, var(--color-danger-fg, #cf222e)) !important;
      }
      #${BUTTON_ID} {
        flex: 0 0 auto;
      }
    `;
  }

  let busy = false;
  let stateTimer = null;
  let ensureTimer = null;
  let injectPromise = null;

  function isPrFilesPage() {
    return /\/pull\/\d+\/(files|changes)(?:$|[/?#])/.test(location.pathname);
  }

  function parsePrRoute() {
    const m = location.pathname.match(
      /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/(files|changes)/
    );
    if (!m) return null;
    return { owner: m[1], repo: m[2], number: m[3] };
  }

  function findReviewDialog() {
    return [...document.querySelectorAll('[role="dialog"]')].find((dialog) =>
      /Finish your review/i.test(dialog.textContent || "")
    );
  }

  function findCancelButton(dialog) {
    return [...dialog.querySelectorAll("button")].find(
      (b) => (b.textContent || "").trim() === "Cancel"
    );
  }

  function ensureInjected() {
    if (injectPromise) return injectPromise;
    injectPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("injected.js");
      script.dataset.ghReviewCopy = "1";
      script.addEventListener("load", () => {
        script.remove();
        setTimeout(resolve, 0);
      });
      script.addEventListener("error", () => {
        injectPromise = null;
        reject(new Error("Failed to inject page script"));
      });
      (document.head || document.documentElement).appendChild(script);
    });
    return injectPromise;
  }

  async function requestComments(route) {
    await ensureInjected();
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("Timed out reading pending comments"));
      }, 15000);

      function onMessage(event) {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.source !== SOURCE || data.type !== "response") return;
        if (data.requestId !== requestId) return;
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        if (data.error) reject(new Error(data.error));
        else resolve(data.comments || []);
      }

      window.addEventListener("message", onMessage);
      window.postMessage(
        { source: SOURCE, type: "request", requestId, route },
        "*"
      );
    });
  }

  function formatLocation(comment) {
    const path = comment.path || "UNKNOWN";
    const { startLine, line } = comment;
    if (startLine != null && line != null && startLine !== line) {
      return `${path}:${startLine}-${line}`;
    }
    if (line != null) return `${path}:${line}`;
    return `${path}:?`;
  }

  function formatClipboard(prefix, comments) {
    const lines = comments.map((c) => {
      const body = String(c.body || "").replace(/\s+/g, " ").trim();
      return `${formatLocation(c)} ${body}`.trimEnd();
    });
    const body = lines.join("\n");
    if (!prefix) return body;
    return body ? `${prefix}\n\n${body}` : prefix;
  }

  async function getPrefix() {
    try {
      const { prefix } = await chrome.storage.sync.get({ prefix: DEFAULT_PREFIX });
      return prefix ?? DEFAULT_PREFIX;
    } catch {
      return DEFAULT_PREFIX;
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      if (!ok) throw new Error("Clipboard write failed");
    }
  }

  function buttonContent(state, label) {
    const icon = ICONS[state] || ICONS.copy;
    return `<span data-component="buttonContent" data-align="center" class="prc-Button-ButtonContent-Iohp5"><span data-component="leadingVisual" class="prc-Button-Visual-YNt2F prc-Button-VisualWrap-E4cnq">${icon}</span><span data-component="text" class="prc-Button-Label-FWkx3">${label}</span></span>`;
  }

  function setButtonState(btn, state, tooltip) {
    clearTimeout(stateTimer);
    const labels = {
      copy: "Copy comments",
      sync: "Copying…",
      check: tooltip.startsWith("Copied") ? tooltip : "Copied",
      alert: tooltip,
    };
    const label = labels[state] || "Copy comments";
    btn.dataset.state = state;
    btn.setAttribute("aria-label", tooltip);
    btn.title = tooltip;
    btn.setAttribute("data-loading", state === "sync" ? "true" : "false");
    btn.innerHTML = buttonContent(state, label);

    if (state === "copy" || state === "sync") return;

    stateTimer = setTimeout(() => {
      btn.dataset.state = "copy";
      btn.setAttribute("data-loading", "false");
      btn.setAttribute("aria-label", "Copy comments");
      btn.title = "Copy comments";
      btn.innerHTML = buttonContent("copy", "Copy comments");
    }, STATE_MS);
  }

  async function onCopyClick(btn) {
    if (busy) return;
    busy = true;
    setButtonState(btn, "sync", "Copying…");
    try {
      const route = parsePrRoute();
      if (!route) throw new Error("Not on a PR files page");

      const comments = await requestComments(route);
      if (!comments.length) {
        setButtonState(btn, "alert", "Nothing to copy");
        return;
      }

      const prefix = await getPrefix();
      await copyText(formatClipboard(prefix, comments));
      setButtonState(btn, "check", `Copied ${comments.length}`);
    } catch (err) {
      console.warn("[GH Review Copy]", err);
      setButtonState(btn, "alert", "Copy failed");
    } finally {
      busy = false;
    }
  }

  function createButton() {
    ensureStyles();
    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.type = "button";
    btn.dataset.state = "copy";
    btn.setAttribute("data-component", "Button");
    btn.setAttribute("data-loading", "false");
    btn.setAttribute("data-size", "medium");
    btn.setAttribute("data-variant", "default");
    btn.className = "prc-Button-ButtonBase-9n-Xk";
    btn.setAttribute("aria-label", "Copy comments");
    btn.title = "Copy comments";
    btn.innerHTML = buttonContent("copy", "Copy comments");

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onCopyClick(btn);
    });
    return btn;
  }

  function injectButton() {
    // Remove any leftover toolbar / fixed-host placements from older versions.
    document.getElementById("gh-review-copy-host")?.remove();

    if (!isPrFilesPage()) {
      document.getElementById(BUTTON_ID)?.remove();
      return;
    }

    ensureStyles();
    ensureInjected();

    const dialog = findReviewDialog();
    if (!dialog) {
      document.getElementById(BUTTON_ID)?.remove();
      return;
    }

    const cancelBtn = findCancelButton(dialog);
    if (!cancelBtn?.parentElement) return;

    let btn = document.getElementById(BUTTON_ID);
    if (!btn) {
      btn = createButton();
      cancelBtn.parentElement.insertBefore(btn, cancelBtn);
      return;
    }

    if (btn.nextElementSibling !== cancelBtn) {
      cancelBtn.parentElement.insertBefore(btn, cancelBtn);
    }

    btn.style.left = "";
    btn.style.top = "";
    btn.style.position = "";
  }

  function scheduleEnsure() {
    clearTimeout(ensureTimer);
    ensureTimer = setTimeout(injectButton, 100);
  }

  if (/\/pull\/\d+/.test(location.pathname)) {
    ensureInjected().catch(() => {});
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== SOURCE || data.type !== "nav") return;
    scheduleEnsure();
  });

  const observer = new MutationObserver(scheduleEnsure);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("turbo:load", scheduleEnsure);
  document.addEventListener("turbo:render", scheduleEnsure);
  document.addEventListener("turbo:frame-load", scheduleEnsure);
  document.addEventListener("pjax:end", scheduleEnsure);

  injectButton();
})();
