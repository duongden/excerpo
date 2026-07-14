// novelgo source
const SourceNovelgo = {
  name: "novelgo",
  pattern: /(?:www\.)?novelgo\.id\/novel\/[a-zA-Z0-9-]+/,

  // ── Preview config ────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: { selector: "h2.novel-title | meta[property='og:title']", attr: "" },
      authorName: { selector: "div.noveils-current-author a", attr: "" },
      coverImage: {
        custom: (doc, url) => {
          const thumbnail = doc.querySelector(".novel-thumbnail");
          if (thumbnail) {
            const bgAttr = thumbnail.getAttribute("data-bg") || thumbnail.getAttribute("style") || "";
            const match = bgAttr.match(/url\(['"]?([^'"]+?)['"]?\)/);
            let cleaned = match ? match[1] : "";
            if (cleaned.startsWith("//")) cleaned = "https:" + cleaned;
            return cleaned || null;
          }
          const img = doc.querySelector("meta[property='og:image']");
          return img ? img.getAttribute("content") : null;
        }
      },
      description: {
        custom: (doc) => {
          const el = doc.querySelector(".novel-synopsis, .novel-description, .summary-text") || doc.querySelector('meta[property="og:description"]') || doc.querySelector('meta[name="description"]');
          if (!el) return null;
          const text = el.tagName === 'META' ? el.getAttribute("content") : el.textContent.trim();
          return text && text.length > 200 ? text.slice(0, 200) + "…" : text;
        }
      },
      sourceBookCode: {
        custom: (doc, url) => {
          const match = url.match(/\/novel\/([a-zA-Z0-9-]+)/);
          return match ? match[1] : "";
        }
      }
    }
  },

  chapters: {
    method: "tab",
    readySelector: "h2.novel-title",
    extract: async (url) => {
      const match = url.match(/\/novel\/([a-zA-Z0-9-]+)/);
      if (!match) return [];
      const slug = match[1];
      try {
        const res = await fetch(`/wp-json/noveils/v1/chapters?paged=1&perpage=10000&category=${slug}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        let num = 1;
        return data.map((chapter) => {
          return {
            chapter_number: num++,
            chapter_title: chapter.post_title || `Chapter ${num - 1}`,
            chapter_url: chapter.permalink,
            type: "normal"
          };
        });
      } catch (e) {
        console.error("Lỗi fetch JSON chapters từ tab:", e);
        const links = Array.from(document.querySelectorAll("ul.chapters li a, .novel-chapters ul li a, ul.chapter-list li a"));
        return links.map((a, idx) => ({
          chapter_number: idx + 1,
          chapter_title: a.textContent.trim(),
          chapter_url: a.href,
          type: "normal"
        }));
      }
    }
  },

  // ── Content config ────────────────────────────────────────────────────────
  content: {
    readySelector: "#chapter-post-content p",
    type: "paragraphs",
    selector: "#chapter-post-content",
    remove: ["script", "style", ".code-block"]
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url) {
    return parsePreview(html, url, this.preview);
  },
  async fetchChapters(url, progressCb) {
    return parseChapters(url, this.chapters, progressCb);
  }
};
