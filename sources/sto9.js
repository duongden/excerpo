// sto9 source
const SourceSto9 = {
  name: "sto9",
  pattern: /(?:www\.)?sto9\.com\/book\/\d+\.html/,

  // ── Preview config ────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: "div.booknav2 h1 a",
      authorName: "div.booknav2 p a[title]",
      coverImage: { selector: ".bookimg2 img", attr: "src" },
      sourceBookCode: { urlPattern: /book\/(\d+)\.html/ }
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "fetch",
    listUrl: (url) => {
      const match = url.match(/book\/(\d+)\.html/);
      if (!match) return url;
      return `https://sto9.com/ajax_novels/chapterlist/${match[1]}.html`;
    },
    extract: (doc, url) => {
      const chapters = [];
      const seen = new Set();
      const links = doc.querySelectorAll("li a");
      for (const a of links) {
        let href = a.getAttribute("href") || "";
        if (!href) continue;
        href = new URL(href, "https://sto9.com").href;
        if (seen.has(href)) continue;
        seen.add(href);

        chapters.push({
          chapter_title: a.textContent.trim(),
          chapter_url: href,
          type: "normal"
        });
      }
      return chapters.map((c, i) => {
        c.chapter_number = i + 1;
        return c;
      });
    }
  },

  // ── Content config ────────────────────────────────────────────────────────
  content: {
    readySelector: "div.txtnav",
    type: "text",
    selector: "div.txtnav",
    remove: ["h1", "div.txtright", "div.txtad", "div.txtcenter", "script"],
    lineFilter: "[Ss]\\s*[Tt]\\s*[Oo]\\s*9|實時更新|最新最快的章節更新|為您帶來最新章節|想獲取本書最新更新|本章節來源於|獲取最[新快]章節|請訪問|本章完|還有更新耶|感謝.{1,20}的打賞|有關主角穿越的設定|覺醒記憶，非傳統魂穿|主角設定是修道界|^第\\d+章"
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url) {
    return parsePreview(html, url, this.preview);
  },
  async fetchChapters(url, progressCb) {
    return parseChapters(url, this.chapters, progressCb);
  }
};
