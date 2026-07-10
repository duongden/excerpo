// centralnovel source
const SourceCentralNovel = {
  name: "centralnovel",
  pattern: /(?:www\.)?centralnovel\.com\/series\/[a-zA-Z0-9-]+/,

  // ── Preview config ────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: { selector: ".infox h1.entry-title", attr: "" },
      authorName: {
        custom: (doc) => {
          const authorLink = doc.querySelector(".spe a[href*='/writer/']");
          if (authorLink) return authorLink.textContent.trim();
          const spans = Array.from(doc.querySelectorAll(".spe span"));
          for (const span of spans) {
            if (span.textContent.includes("Autor:")) {
              return span.textContent.replace("Autor:", "").trim();
            }
          }
          return null;
        }
      },
      coverImage: { selector: ".bigcontent .thumb img, .thumbook .thumb img", attr: "src" },
      description: { selector: ".info-content .desc, .desc", attr: "" },
      sourceBookCode: {
        custom: (doc, url) => {
          const match = url.match(/series\/([a-zA-Z0-9-]+)/);
          return match ? match[1] : "";
        }
      }
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "tab",
    readySelector: ".bixbox.bxcl.epcheck .eplister ul li a",
    extract: (url) => {
      const items = Array.from(document.querySelectorAll(".bixbox.bxcl.epcheck .eplister ul li"));
      items.reverse();
      return items.map((li, index) => {
        const a = li.querySelector("a");
        if (!a) return null;
        const eplNum = li.querySelector(".epl-num")?.textContent.trim() || "";
        const eplTitle = li.querySelector(".epl-title")?.textContent.trim() || "";
        const title = eplNum && eplTitle ? `${eplNum} - ${eplTitle}` : (eplNum || eplTitle || a.textContent.trim());
        return {
          chapter_number: index + 1,
          chapter_title: title.replace(/[\n\t\r]+/g, " ").replace(/\s+/g, " ").trim(),
          chapter_url: a.href,
          type: "normal"
        };
      }).filter(Boolean);
    }
  },

  // ── Content config ────────────────────────────────────────────────────────
  content: {
    readySelector: "#leitor-serie-body, .epcontent.entry-content",
    type: "paragraphs",
    selector: "#leitor-serie-body | .epcontent.entry-content",
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
