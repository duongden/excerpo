const Source69shumi = {
  name: "69shumi",
  maxWorkers: 1,
  downloadDelay: 2000,
  pattern: /69shumi\.net\/book\/\d+/,

  // ── Preview config ─────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName:       "h1.bookTitle",
      authorName:     "p.booktag",
      coverImage:     { selector: ".col-sm-2 img", attr: "src" },
      description:    {
        custom: (doc) => {
          const el = doc.querySelector("p#bookIntro");
          if (!el) return null;
          const text = el.textContent.trim();
          return text.length > 250 ? text.slice(0, 250) + "..." : text;
        }
      },
      sourceBookCode: { urlPattern: /book\/(\d+)/ }
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "fetch",
    extract: (doc, url) => {
      // Chỉ lấy các thẻ <a> nằm trong #newlist
      const elements = [...doc.querySelectorAll("#newlist dd a")];
      return elements.map((el, idx) => {
        return {
          chapter_number: idx + 1,
          chapter_title:  el.textContent.replace(/\s+/g, ' ').trim(),
          chapter_url:    el.getAttribute("href") ? new URL(el.getAttribute("href"), url).href : null,
          type:           "normal"
        };
      }).filter(c => c.chapter_url && !c.chapter_url.includes('javascript:'));
    }
  },

  // ── Content config ─────────────────────────────────────────────────────────
  content: {
    readySelector: "div#booktxt",
    type:          "paragraphs",
    selector:      "div#booktxt",
    remove:        []
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url)        { return parsePreview(html, url, this.preview);         },
  fetchChapters(url, progressCb) { return parseChapters(url, this.chapters, progressCb); }
};
