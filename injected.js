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

  function getReactFiber(el) {
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    return key ? el[key] : null;
  }

  function readPendingFromReact(submitBtn) {
    let fiber = getReactFiber(submitBtn);
    let markers = null;
    let viewerPendingReview = null;

    for (let i = 0; i < 80 && fiber; i++) {
      const props = fiber.memoizedProps || {};
      if (props.markers) markers = props.markers;
      if (props.viewerPendingReview) viewerPendingReview = props.viewerPendingReview;
      if (props.initData?.markers) markers = props.initData.markers;
      if (props.initData?.viewerPendingReview) {
        viewerPendingReview = props.initData.viewerPendingReview;
      }
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
    const submitBtn = findSubmitReviewButton();
    if (!submitBtn) {
      throw new Error("Submit review button not found");
    }
    const comments = readPendingFromReact(submitBtn);
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
