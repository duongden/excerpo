// chireads source
const SourceChireads = {
  name: "chireads",
  pattern: /(?:www\.)?chireads\.com\/category\/.+/,

  // ── Preview config ────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: {
        custom: (doc) => {
          const titleEl = doc.querySelector(".inform-title");
          if (!titleEl) return null;
          return titleEl.textContent.split("|")[0].trim();
        }
      },
      authorName: {
        custom: (doc) => {
          const authorEl = doc.querySelector("h6.font-color-black3");
          if (!authorEl) return null;
          const text = authorEl.textContent.replace("Auteur :", "").trim();
          const parts = text.split(/Babelcheck|Statut/i);
          return parts[0].replace(/[\s\xa0]+/g, " ").trim();
        }
      },
      coverImage: {
        custom: (doc, url) => {
          const img = doc.querySelector(".inform-product img");
          if (!img) return null;
          let src = img.getAttribute("src") || "";
          if (src.startsWith("//")) src = "https:" + src;
          else if (src.startsWith("/")) src = "https://chireads.com" + src;
          return src || null;
        }
      },
      description: {
        custom: (doc) => {
          const el = doc.querySelector(".inform-txt-show.font-color-black6");
          if (!el) return null;
          const text = el.textContent?.trim() || "";
          return text.length > 200 ? text.slice(0, 200) + "…" : text;
        }
      },
      sourceBookCode: {
        custom: (doc, url) => {
          const match = url.match(/\/category\/(.+)$/);
          if (match) {
            return match[1].replace(/\/$/, "");
          }
          return "";
        }
      }
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "fetch",
    listUrl: (url) => url,
    extract: (doc, listUrl) => {
      const links = Array.from(doc.querySelectorAll(".conteiner .wid .chapitre a"));
      let num = 1;
      return links.map((a) => {
        let link = a.getAttribute("href") || "";
        if (link.startsWith("/")) link = "https://chireads.com" + link;
        return {
          chapter_number: num++,
          chapter_title: a.textContent.replace(/[\s\xa0]+/g, " ").trim(),
          chapter_url: link,
          type: "normal"
        };
      });
    }
  },

  // ── Content config ────────────────────────────────────────────────────────
  content: {
    readySelector: "#content.font-color-black3.article-font p, #content.article-font p",
    type: "paragraphs",
    selector: "#content.font-color-black3.article-font | #content.article-font",
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
