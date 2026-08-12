// Runs in the page (MAIN) world so React fiber state is visible.
(() => {
  if (window.__ghReviewCopyInjected) return;
  window.__ghReviewCopyInjected = true;

  const SOURCE = "gh-review-copy";

  function findSubmitReviewButton() {
    return [...document.querySelectorAll("button")].find(
      (b) =>
        /Submit review/i.test(b.textContent || "") &&
        String(b.className).includes("ReviewMenuButton")
    );
  }

  function findReviewDialog() {
    return [...document.querySelectorAll('[role="dialog"]')].find((dialog) =>
      /Finish your review/i.test(dialog.textContent || "")
    );
  }

  function getReactFiber(el) {
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    return key ? el[key] : null;
  }

  function isDomNode(value) {
    return typeof Node !== "undefined" && value instanceof Node;
  }

  // Dialog comment objects have body/databaseId but not path:line. Path/line and
  // the numeric thread id live on the parent thread (positioning / subject / id).
  function withThreadContext(entry, thread) {
    if (!entry || typeof entry !== "object") return entry;
    const pos = thread?.positioning || thread?.subject || null;
    const threadId =
      entry.threadId != null
        ? String(entry.threadId)
        : thread?.id != null
          ? String(thread.id)
          : null;
    const path = entry.path || thread?.path || pos?.path || null;
    const line = entry.endLine ?? entry.line ?? pos?.endLine ?? pos?.line ?? null;
    const startLine = entry.startLine ?? pos?.startLine ?? null;
    return { ...entry, threadId, path, line, endLine: line, startLine };
  }

  function considerPendingComment(candidate, byKey) {
    if (!candidate || typeof candidate !== "object") return;

    const body =
      typeof candidate.body === "string" ? candidate.body.replace(/\s+$/g, "") : "";
    if (!body) return;

    const databaseId = candidate.databaseId ?? null;
    let threadId =
      candidate.threadId != null ? String(candidate.threadId) : null;
    // Comment node ids are PRRC_*; those are not positioning thread ids.
    if (threadId && threadId.startsWith("PRRC_")) threadId = null;
    if (databaseId == null && !threadId) return;

    const path = candidate.path ? cleanPath(candidate.path) : null;
    const line = candidate.endLine ?? candidate.line ?? null;
    const startLine = candidate.startLine ?? null;

    let existing = null;
    for (const comment of byKey.values()) {
      if (
        (databaseId != null && comment.databaseId === databaseId) ||
        (threadId && comment.threadId === threadId)
      ) {
        existing = comment;
        break;
      }
    }

    if (existing) {
      const weakThreadId =
        existing.threadId == null ||
        (existing.databaseId != null &&
          existing.threadId === String(existing.databaseId));
      if (threadId && weakThreadId) existing.threadId = threadId;
      if (existing.databaseId == null && databaseId != null) {
        existing.databaseId = databaseId;
      }
      if (!existing.path && path) existing.path = path;
      if (existing.line == null && line != null) existing.line = line;
      if (existing.startLine == null && startLine != null) {
        existing.startLine = startLine;
      }
      return;
    }

    const key = databaseId != null ? `d:${databaseId}` : `t:${threadId}`;
    byKey.set(key, {
      threadId: threadId || String(databaseId),
      databaseId,
      body,
      path,
      line,
      startLine,
    });
  }

  function harvestPendingFromValue(value, byKey, depth, seen) {
    if (!value || typeof value !== "object" || depth > 6) return;
    if (isDomNode(value) || seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value.commentsData?.comments)) {
      for (const entry of value.commentsData.comments) {
        considerPendingComment(withThreadContext(entry, value), byKey);
      }
    }
    if (Array.isArray(value.comments)) {
      const threadLike = value.positioning || value.subject || value.commentsData;
      for (const entry of value.comments) {
        if (!(entry?.body && entry?.databaseId)) continue;
        considerPendingComment(
          threadLike ? withThreadContext(entry, value) : entry,
          byKey
        );
      }
    }
    if (Array.isArray(value.viewerPendingReview?.comments)) {
      for (const entry of value.viewerPendingReview.comments) {
        considerPendingComment(entry, byKey);
      }
    }
    if (value.markers?.threads && typeof value.markers.threads === "object") {
      for (const [threadId, thread] of Object.entries(value.markers.threads)) {
        const nested = thread?.commentsData?.comments;
        if (!Array.isArray(nested)) continue;
        for (const entry of nested) {
          considerPendingComment(
            withThreadContext(
              entry.threadId != null ? entry : { ...entry, threadId },
              thread
            ),
            byKey
          );
        }
      }
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        harvestPendingFromValue(entry, byKey, depth + 1, seen);
      }
      return;
    }

    for (const key of Object.keys(value)) {
      if (
        key === "stateNode" ||
        key === "ref" ||
        key === "_owner" ||
        key === "children"
      ) {
        continue;
      }
      try {
        harvestPendingFromValue(value[key], byKey, depth + 1, seen);
      } catch {
        // Ignore getter / revoked-proxy failures in fiber graphs.
      }
    }
  }

  // Primary source: pending comments live in the Finish-your-review dialog
  // tree on first open, before Submit-button ancestors are hydrated.
  function readPendingFromDialog() {
    const dialog = findReviewDialog();
    if (!dialog) return [];
    const root = getReactFiber(dialog);
    if (!root) return [];

    const byKey = new Map();
    const seenFiber = new Set();
    const queue = [root];

    while (queue.length) {
      const fiber = queue.shift();
      if (!fiber || seenFiber.has(fiber)) continue;
      seenFiber.add(fiber);

      harvestPendingFromValue(fiber.memoizedProps, byKey, 0, new Set());
      harvestPendingFromValue(fiber.memoizedState, byKey, 0, new Set());

      if (fiber.child) queue.push(fiber.child);
      if (fiber.sibling) queue.push(fiber.sibling);
    }

    return [...byKey.values()].filter((c) => c.threadId);
  }

  function readPendingFromReact(submitBtn) {
    let fiber = getReactFiber(submitBtn);
    let markers = null;
    let viewerPendingReview = null;

    // Closest fiber wins; prefer live props over stale initData.
    for (let i = 0; i < 80 && fiber; i++) {
      const props = fiber.memoizedProps || {};
      if (!markers) {
        markers = props.markers || props.initData?.markers || null;
      }
      if (!viewerPendingReview) {
        viewerPendingReview =
          props.viewerPendingReview ||
          props.initData?.viewerPendingReview ||
          null;
      }
      if (markers && viewerPendingReview) break;
      fiber = fiber.return;
    }

    if (!viewerPendingReview?.comments?.length) {
      return [];
    }
    if (!markers?.threads) {
      throw new Error("Pending review markers not found in page state");
    }

    const comments = [];
    for (const entry of viewerPendingReview.comments) {
      const threadId = String(entry.threadId);
      const thread = markers.threads[threadId];
      const comment = thread?.commentsData?.comments?.[0];
      if (!comment) continue;
      comments.push({
        threadId,
        databaseId: comment.databaseId,
        body: (comment.body || "").replace(/\s+$/g, ""),
        path: null,
        line: null,
        startLine: null,
      });
    }
    return comments;
  }

  function cleanPath(path) {
    return (path || "").replace(/[\u200e\u200f]/g, "").trim();
  }

  function applyPositioning(comments, threads) {
    for (const comment of comments) {
      const pos = threads[comment.threadId];
      if (!pos) continue;
      comment.path = cleanPath(pos.path) || comment.path;
      comment.line = pos.endLine ?? pos.line ?? null;
      comment.startLine = pos.startLine ?? null;
    }
  }

  function fallbackPathFromDom(comment) {
    if (comment.path) return;
    const id = comment.databaseId;
    if (!id) return;
    const root =
      document.getElementById(`r${id}`) ||
      document
        .querySelector(`a[href="#r${id}"]`)
        ?.closest("[class*='ReviewThread'], tr, div");
    if (!root) return;

    let el = root;
    for (let i = 0; i < 30 && el; i++) {
      for (const attr of ["data-path", "data-file-path", "data-tagsearch-path"]) {
        const v = cleanPath(el.getAttribute?.(attr));
        if (v) {
          comment.path = v;
          return;
        }
      }
      const headerLink = el.querySelector?.(
        "[data-file-path], [data-path], [data-tagsearch-path], [class*='DiffFileHeader'] a, [class*='file-name'] a"
      );
      const fromAttr =
        cleanPath(headerLink?.getAttribute("data-file-path")) ||
        cleanPath(headerLink?.getAttribute("data-path")) ||
        cleanPath(headerLink?.getAttribute("data-tagsearch-path")) ||
        cleanPath(headerLink?.getAttribute("title")) ||
        cleanPath(headerLink?.textContent);
      if (fromAttr && fromAttr.includes("/")) {
        comment.path = fromAttr;
        return;
      }
      el = el.parentElement;
    }
  }

  async function fetchPositioning(route, threadIds) {
    if (!threadIds.length) return {};
    const url = `/${route.owner}/${route.repo}/pull/${route.number}/page_data/thread_preview_positioning?thread_ids=${encodeURIComponent(threadIds.join(","))}`;
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    if (!res.ok) {
      throw new Error(`Positioning fetch failed (${res.status})`);
    }
    const data = await res.json();
    return data.threads || {};
  }

  async function collectComments(route) {
    let comments = readPendingFromDialog();
    if (!comments.length) {
      const submitBtn = findSubmitReviewButton();
      if (!submitBtn) {
        throw new Error("Submit review button not found");
      }
      comments = readPendingFromReact(submitBtn);
    }
    if (!comments.length) return comments;

    const threads = await fetchPositioning(
      route,
      comments.map((c) => c.threadId)
    );
    applyPositioning(comments, threads);
    for (const comment of comments) fallbackPathFromDom(comment);
    return comments;
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== SOURCE || data.type !== "request") return;

    try {
      const comments = await collectComments(data.route);
      window.postMessage(
        {
          source: SOURCE,
          type: "response",
          requestId: data.requestId,
          comments,
        },
        "*"
      );
    } catch (err) {
      window.postMessage(
        {
          source: SOURCE,
          type: "response",
          requestId: data.requestId,
          error: String(err?.message || err),
        },
        "*"
      );
    }
  });

  // Notify the content script when GitHub soft-navigates (page-world history).
  function notifyNav() {
    window.postMessage({ source: SOURCE, type: "nav" }, "*");
  }
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args) {
    const ret = origPush.apply(this, args);
    notifyNav();
    return ret;
  };
  history.replaceState = function (...args) {
    const ret = origReplace.apply(this, args);
    notifyNav();
    return ret;
  };
  window.addEventListener("popstate", notifyNav);
  document.addEventListener("turbo:load", notifyNav);
  document.addEventListener("turbo:render", notifyNav);
  document.addEventListener("turbo:frame-load", notifyNav);
})();
