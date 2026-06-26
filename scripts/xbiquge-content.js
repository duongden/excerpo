// scripts/xbiquge-content.js
// Gộp chương nhiều phần (196972.html → 196972_2.html → …) trên xbiquge.info

if (location.pathname.match(/^\/\d+\/\d+\/\d+(?:_\d+)?\.html$/)) {
  const PAGE_RE = /第\s*[（(]\s*(\d+)\s*\/\s*(\d+)\s*[）)]\s*页/;

  function extractLines(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll("script, style").forEach(e => e.remove());
    clone.querySelectorAll("br").forEach(br => br.replaceWith("\n"));
    return clone.textContent.split("\n")
      .map(s => s.trim())
      .filter(s => s.length > 0 && !PAGE_RE.test(s));
  }

  function getPageInfo(el) {
    const m = el.textContent.match(PAGE_RE);
    if (!m) return null;
    return { current: parseInt(m[1], 10), total: parseInt(m[2], 10) };
  }

  function buildPartUrl(prefix, chapId, partNum) {
    if (partNum <= 1) return `${location.origin}${prefix}${chapId}.html`;
    return `${location.origin}${prefix}${chapId}_${partNum}.html`;
  }

  function applyMerged(container, lines) {
    container.innerHTML = lines.join("<br><br>");
    container.setAttribute("data-merged", "true");
  }

  async function mergeChapter(container) {
    const pageInfo = getPageInfo(container);

    if (!pageInfo || pageInfo.total <= 1) {
      applyMerged(container, extractLines(container));
      return;
    }

    const pathMatch = location.pathname.match(/^(\/\d+\/\d+\/)(\d+)(?:_\d+)?\.html$/);
    if (!pathMatch) {
      applyMerged(container, extractLines(container));
      return;
    }

    const [, prefix, chapId] = pathMatch;
    const allLines = extractLines(container);

    for (let part = 2; part <= pageInfo.total; part++) {
      try {
        const resp = await fetch(buildPartUrl(prefix, chapId, part));
        if (!resp.ok) continue;
        const doc = new DOMParser().parseFromString(await resp.text(), "text/html");
        const art = doc.querySelector("article.font_max");
        if (art) allLines.push(...extractLines(art));
      } catch { /* bỏ qua part lỗi, giữ phần đã có */ }
    }

    applyMerged(container, allLines);
  }

  function start() {
    const container = document.querySelector("article.font_max");
    if (!container) return;

    if (container.getAttribute("data-merged") === "true") return;

    const text = container.textContent.replace(/\s+/g, "");
    if (text.length < 30) {
      if (start.retries >= 30) {
        applyMerged(container, extractLines(container));
        return;
      }
      start.retries = (start.retries || 0) + 1;
      setTimeout(start, 200);
      return;
    }

    mergeChapter(container).catch(() => {
      applyMerged(container, extractLines(container));
    });
  }

  start.retries = 0;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
}
