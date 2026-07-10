// phoenixnovels source
const SourcePhoenixNovels = {
  name: "phoenixnovels",
  pattern: /(?:www\.)?phoenixnovels\.com\.br\/manga\/[a-zA-Z0-9-]+/,

  // ── Preview config ────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: {
        custom: (doc) => {
          const asuraTitle = doc.querySelector(".asura-title");
          if (asuraTitle) return asuraTitle.textContent.trim();
          
          const h1 = doc.querySelector("#manga-title h1");
          if (!h1) return doc.querySelector("h1")?.textContent.trim();
          const clone = h1.cloneNode(true);
          clone.querySelectorAll("span").forEach(s => s.remove());
          return clone.textContent.trim();
        }
      },
      authorName: {
        custom: (doc) => {
          const items = Array.from(doc.querySelectorAll(".asura-info__item"));
          for (const item of items) {
            const k = item.querySelector(".k")?.textContent.trim();
            if (k === "Autor" || k === "Author") {
              return item.querySelector(".v")?.textContent.trim() || null;
            }
          }
          const oldAuthor = doc.querySelector('.author-content a[href*="novel-author"], .author-content a');
          return oldAuthor ? oldAuthor.textContent.trim() : null;
        }
      },
      coverImage: {
        custom: (doc) => {
          const img = doc.querySelector(".asura-coverwrap img, .summary_image img");
          if (!img) return null;
          return img.src || img.getAttribute("data-src") || img.getAttribute("src") || null;
        }
      },
      description: { selector: ".asura-synopsis | .description-summary .summary__content | .post-content", attr: "" },
      sourceBookCode: {
        custom: (doc, url) => {
          const match = url.match(/manga\/([a-zA-Z0-9-]+)/);
          return match ? match[1] : "";
        }
      }
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "tab",
    readySelector: ".asura-volumes .vol-panel a.ch-item, .wp-manga-chapter a",
    extract: (url) => {
      const asuraVols = Array.from(document.querySelectorAll(".asura-volumes .vol"));
      if (asuraVols.length > 0) {
        const chapters = [];
        let index = 0;
        for (const vol of asuraVols) {
          const volTitle = vol.querySelector(".vol-title")?.textContent.trim() || "";
          const items = Array.from(vol.querySelectorAll("a.ch-item"));
          for (const a of items) {
            const chTitle = a.querySelector(".ch-title")?.textContent.trim() || a.getAttribute("data-title") || "";
            const title = volTitle && chTitle ? `${volTitle} - ${chTitle}` : (volTitle || chTitle || a.textContent.trim());
            chapters.push({
              chapter_number: ++index,
              chapter_title: title.replace(/[\n\t\r]+/g, " ").replace(/\s+/g, " ").trim(),
              chapter_url: a.href,
              type: "normal"
            });
          }
        }
        return chapters;
      }

      const links = Array.from(document.querySelectorAll(".wp-manga-chapter a"));
      links.reverse();
      return links.map((a, index) => {
        return {
          chapter_number: index + 1,
          chapter_title: a.textContent.replace(/[\n\t\r]+/g, " ").replace(/\s+/g, " ").trim(),
          chapter_url: a.href,
          type: "normal"
        };
      });
    }
  },

  // ── Content config ────────────────────────────────────────────────────────
  content: {
    readySelector: ".reader-content-image img[src^='data:image/svg'], .reading-content, .text-left",
    type: "svg_text",
    selector: ".reader-content-image | .reader-content",
    fallbacks: [".reading-content", ".text-left"],
    remove: ["script", "style", "div.padSection", "div#padSection", ".reader-note"]
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url) {
    return parsePreview(html, url, this.preview);
  },
  async fetchChapters(url, progressCb) {
    return parseChapters(url, this.chapters, progressCb);
  }
};
