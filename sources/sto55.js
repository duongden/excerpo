// sto55 source
const SourceSto55 = {
  name: "sto55",
  pattern: /(?:www\.)?sto55\.com\/book\/\d+\//,

  // ── Preview config ────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: "h1.booktitle",
      coverImage: { selector: ".bookcover img", attr: "src" },
      sourceBookCode: { urlPattern: /book\/(\d+)/ }
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "fetch",
    listUrl: (url) => {
      const match = url.match(/book\/(\d+)/);
      if (!match) return url;
      return `https://sto55.com/book/${match[1]}/ajax_index.html`;
    },
    extract: (doc, url) => {
      const chapters = [];
      const seen = new Set();
      // doc is parsed from ajax response, we look for <dd> <a href="...">
      const links = doc.querySelectorAll("dd a");
      for (const a of links) {
        let href = a.getAttribute("href") || "";
        if (!href) continue;
        href = new URL(href, "https://sto55.com").href;
        if (seen.has(href)) continue;
        seen.add(href);

        chapters.push({
          chapter_title: a.textContent.trim(),
          chapter_url: href,
          type: "normal" // Normal chapter
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
    readySelector: "div.readcotent.bbb.font-normal",
    type: "text",
    selector: "div.readcotent.bbb.font-normal",
    remove: ["script", "div.ADVERTISEMENT", 'div[style*="text-align:center"]'],
    lineFilter: "[Ss𝙎]\\s*[Tt𝙏]\\s*[Oo𝙊]\\s*[5５𝟱]\\s*[5５𝟱]|第一時間更新|獲取最[新快]章節|帶您追逐|請訪問|精彩不容錯過|本章完|友情提示|萌新回歸|^\\(\\)$|首訂.*均訂.*高訂|第\\(\\d+/\\d+\\)頁"
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url) {
    return parsePreview(html, url, this.preview);
  },
  async fetchChapters(url, progressCb) {
    return parseChapters(url, this.chapters, progressCb);
  }
};
