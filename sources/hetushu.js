const SourceHetushu = {
  name: "hetushu",
  maxWorkers: 3,
  downloadDelay: 1500,
  pattern: /hetushu\.com\/book\/\d+/,

  // ── Preview config ─────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName:       ".book_info h2",
      authorName:     ".book_info a[href*='/author/']",
      coverImage:     { selector: ".book_info img", attr: "src" },
      description:    ".book_info .intro",
      sourceBookCode: { urlPattern: /book\/(\d+)/ }
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "tab",
    listUrl: (url) => url,
    readySelector: "#dir a",
    extract: (selector) => {
      const elements = [...document.querySelectorAll(selector)];
      return elements.map((el, i) => {
        return {
          chapter_number: i + 1,
          chapter_title:  el.textContent.replace(/\s+/g, ' ').trim(),
          chapter_url:    el.href,
          type:           "normal"
        };
      }).filter(c => c.chapter_url && !c.chapter_url.includes('javascript:'));
    },
    extractArgs: () => ["#dir a"]
  },

  // ── Content config ─────────────────────────────────────────────────────────
  content: {
    readySelector: "#content",
    type:          "hetushu",
    selector:      "#content"
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url)        { return parsePreview(html, url, this.preview);         },
  fetchChapters(url, progressCb) { return parseChapters(url, this.chapters, progressCb); }
};
