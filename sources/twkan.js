// twkan source
const SourceTwkan = {
  name: "twkan",
  pattern: /(?:www\.)?twkan\.com\/book\/\d+\.html/,

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
      return `https://twkan.com/ajax_novels/chapterlist/${match[1]}.html`;
    },
    extract: (doc, url) => {
      const chapters = [];
      const seen = new Set();
      const links = doc.querySelectorAll("li a");
      for (const a of links) {
        let href = a.getAttribute("href") || "";
        if (!href) continue;
        href = new URL(href, "https://twkan.com").href;
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
    readySelector: "div#txtcontent0",
    type: "text",
    selector: "div#txtcontent0",
    remove: ["div.txtad", "div.txtcenter", "script"],
    lineFilter: "[Tt]\\s*[Ww]\\s*[Kk]\\s*[Aa]\\s*[Nn]|台灣小說網|臺灣小[說説]網|追台灣小說|看台灣小說|找台灣好書|全網首發|提供給你無錯章節|超便捷|超方便|超給力|觀看最快的章節更新"
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url) {
    return parsePreview(html, url, this.preview);
  },
  async fetchChapters(url, progressCb) {
    return parseChapters(url, this.chapters, progressCb);
  }
};
