// foxaholic source
const SourceFoxaholic = {
  name: "foxaholic",
  pattern: /(?:www\.|18\.|global\.)?foxaholic\.com\/(novel|manga)\/[a-zA-Z0-9-]+/,

  // ── Preview config ────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: { custom: (doc) => doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || doc.querySelector("h1")?.textContent.trim() },
      authorName: {
        custom: (doc) => {
          const authors = Array.from(doc.querySelectorAll('.author-content a[href*="novel-author"], .author-content a')).map(a => a.textContent.trim()).filter(Boolean);
          return authors.length > 0 ? authors.join(", ") : null;
        }
      },
      coverImage: { selector: ".summary_image a img", attr: ["data-src", "src"] },
      sourceBookCode: { urlPattern: /(?:novel|manga)\/([a-zA-Z0-9-]+)/ }
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "tab",
    readySelector: ".wp-manga-chapter a",
    extract: (url) => {
      const links = Array.from(document.querySelectorAll(".wp-manga-chapter a"));
      links.reverse();
      return links.map((a, index) => {
        const li = a.closest("li");
        const isVip = (li && (li.classList.contains("premium") || li.classList.contains("premium-block"))) || !!a.querySelector("i.fa-lock");
        return {
          chapter_number: index + 1,
          chapter_title: a.textContent.replace(/[\n\t\r]+/g, " ").replace(/\s+/g, " ").trim(),
          chapter_url: a.href,
          type: isVip ? "vip" : "normal"
        };
      });
    }
  },

  // ── Content config ────────────────────────────────────────────────────────
  content: {
    readySelector: ".entry-content_wrap, .entry-content",
    type: "paragraphs",
    selector: ".entry-content_wrap, .entry-content",
    remove: ["script", "style", ".sharedaddy", ".wpcnt", ".jp-relatedposts"]
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url) {
    return parsePreview(html, url, this.preview);
  },
  async fetchChapters(url, progressCb) {
    return parseChapters(url, this.chapters, progressCb);
  }
};
