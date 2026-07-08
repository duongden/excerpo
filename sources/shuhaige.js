// shuhaige source
const SourceShuhaige = {
  name: "shuhaige",
  pattern: /(?:m\.)?shuhaige\.net\/(shu_\d+\.html|\d+\/?)/,

  // ── Preview config ────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: { custom: (doc) => {
        return doc.querySelector(".detail .name strong")?.textContent.trim() 
          || doc.querySelector("header h1")?.textContent.trim() 
          || doc.querySelector("title")?.textContent.replace("目录", "").replace("最新章节", "").trim();
      }},
      authorName: { selector: ".detail .author a" },
      coverImage: { selector: ".detail img", attr: "src" },
      sourceBookCode: { custom: (doc, url) => {
        const m = url.match(/shu_(\d+)\.html/) || url.match(/\/(\d+)\/?/);
        return m ? m[1] : null;
      }}
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "custom",
    custom: async (url, progressCallback) => {
      const match = url.match(/shu_(\d+)\.html/) || url.match(/\/(\d+)\/?/);
      if (!match) throw new Error("Không tìm thấy Book ID trong URL");
      const bookId = match[1];

      let pageNum = 1;
      const chapters = [];
      let hasNextPage = true;

      while (hasNextPage) {
        let chapterListUrl = pageNum === 1 
          ? `https://m.shuhaige.net/${bookId}/` 
          : `https://m.shuhaige.net/${bookId}_${pageNum}/`;

        progressCallback(`Đang tải danh sách chương trang ${pageNum}...`);
        const resp = await fetch(chapterListUrl);
        if (!resp.ok) throw new Error(`HTTP Error ${resp.status}`);
        const html = await resp.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const links = doc.querySelectorAll(".read li a");
        if (links.length === 0) {
          break;
        }

        for (const a of links) {
          const href = a.getAttribute("href");
          if (!href) continue;
          chapters.push({
            chapter_number: chapters.length + 1,
            chapter_title: a.textContent.trim(),
            chapter_url: new URL(href, `https://m.shuhaige.net/`).href,
            type: "normal"
          });
        }

        // Kiểm tra phân trang
        const nextLinks = doc.querySelectorAll(".pagelist a");
        let foundNext = false;
        for (const link of nextLinks) {
          if (link.textContent.includes("下一页")) {
            const href = link.getAttribute("href");
            if (href && !href.endsWith(`_${pageNum}/`)) {
              foundNext = true;
              break;
            }
          }
        }

        if (!foundNext) {
          hasNextPage = false;
        } else {
          pageNum++;
        }
      }

      return chapters;
    }
  },

  // ── Content config ────────────────────────────────────────────────────────
  content: {
    readySelector: ".content, #content, .chapter_content",
    type: "paragraphs",
    selector: ".content | #content | .chapter_content",
    remove: ["script", "style"],
    lineFilter: "这章没有结束|无错的章节将持续|喜欢.*请大家收藏|书海阁小说网更新速度全网最快",
    fallbacks: [
      { type: "text", selector: ".content | #content | .chapter_content" }
    ]
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url) {
    return parsePreview(html, url, this.preview);
  },
  async fetchChapters(url, progressCb) {
    return parseChapters(url, this.chapters, progressCb);
  }
};
