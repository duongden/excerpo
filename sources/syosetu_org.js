const SourceSyosetuOrg = {
  name: "syosetu_org",
  maxWorkers: 1,
  downloadDelay: 1000,
  pattern: /syosetu\.org\/novel\/\d+/,

  // ── Preview config ─────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName:       "div#maind span[itemprop='name']",
      authorName:     "div#maind span[itemprop='author'] a",
      coverImage:     { selector: "img.cover", attr: "src" }, // Fallback if there's any cover image
      description:    {
        custom: (doc) => {
          const divs = doc.querySelectorAll("div#maind > div.ss");
          // The second div.ss usually contains the description
          if (divs.length >= 2) {
            const el = divs[1];
            // Remove hr tags inside
            const clone = el.cloneNode(true);
            clone.querySelectorAll("hr").forEach(hr => hr.remove());
            const text = clone.textContent.trim();
            return text.length > 250 ? text.slice(0, 250) + "..." : text;
          }
          return null;
        }
      },
      sourceBookCode: { urlPattern: /novel\/(\d+)/ }
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "tab",
    readySelector: "div#maind div.ss table tr td a",
    extract: async () => {
      // Small delay just to be safe
      await new Promise(r => setTimeout(r, 500));
      const elements = [...document.querySelectorAll("div#maind div.ss table tr td a")];
      return elements.map((el, idx) => {
        return {
          chapter_number: idx + 1,
          chapter_title:  el.textContent.replace(/\s+/g, ' ').trim(),
          chapter_url:    el.href, // in tab, el.href is absolute
          type:           "normal"
        };
      }).filter(c => c.chapter_url && !c.chapter_url.includes('javascript:'));
    },
    extractArgs: () => []
  },

  // ── Content config ─────────────────────────────────────────────────────────
  content: {
    readySelector: "div#honbun",
    type:          "paragraphs",
    selector:      "div#honbun",
    remove:        []
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url)        { return parsePreview(html, url, this.preview);         },
  fetchChapters(url, progressCb) { return parseChapters(url, this.chapters, progressCb); }
};
