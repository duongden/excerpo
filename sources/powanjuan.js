// powanjuan source
const SourcePowanjuan = {
  name: "powanjuan",
  pattern: /(?:www\.)?powanjuan\.cc\/[a-zA-Z0-9_-]+/,

  // ── Preview config ────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: { custom: (doc) => doc.querySelector(".desc h1")?.textContent.split("(")[0].trim() || null },
      authorName: { custom: (doc) => doc.querySelector(".descTip span")?.textContent.replace("作者：", "").trim() || null },
      coverImage: { selector: ".desc img, .book img", attr: "src" },
      sourceBookCode: { custom: (doc, url) => {
        const parts = url.replace(/\/$/, "").split("/");
        return parts[parts.length - 1];
      }}
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "tab",
    readySelector: ".catalog ul.clearfix li a",
    extract: (url) => {
      const links = Array.from(document.querySelectorAll(".catalog ul.clearfix li a"));
      return links.map((a, index) => {
        return {
          chapter_number: index + 1,
          chapter_title: a.textContent.trim(),
          chapter_url: a.href,
          type: "normal"
        };
      });
    }
  },

  // ── Content config ────────────────────────────────────────────────────────
  content: {
    readySelector: "#mycontent",
    type: "paragraphs",
    selector: "#mycontent",
    remove: ["script", "style"]
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url) {
    return parsePreview(html, url, this.preview);
  },
  async fetchChapters(url, progressCb) {
    return parseChapters(url, this.chapters, progressCb);
  }
};
