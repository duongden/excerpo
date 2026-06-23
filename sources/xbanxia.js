const SourceXbanxia = {
  name: "xbanxia",
  maxWorkers: 1,
  downloadDelay: 2000,
  pattern: /xbanxia\.cc\/books\/\d+\.html/,

  // ── Preview config ─────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName:       "div.book-describe h1",
      authorName:     "div.book-describe p a",
      coverImage:     { selector: "div.book-img img", attr: "src" },
      description:    {
        custom: (doc) => {
          const el = doc.querySelector("div.describe-html");
          if (!el) return null;
          // clone the element to modify it without affecting the DOM
          const clone = el.cloneNode(true);
          // Only extract text from the paragraphs
          const ps = Array.from(clone.querySelectorAll("p"));
          const text = ps.map(p => p.textContent.trim()).filter(Boolean).join(" ");
          return text.length > 250 ? text.slice(0, 250) + "..." : text;
        }
      },
      sourceBookCode: { urlPattern: /books\/(\d+)\.html/ }
    }
  },

  chapters: {
    method: "fetch",
    extract: (doc, url) => {
      const elements = [...doc.querySelectorAll(".book-list ul li a")];
      return elements.map((el, idx) => {
        return {
          chapter_number: idx + 1,
          chapter_title:  el.textContent.replace(/\s+/g, ' ').trim(),
          chapter_url:    el.getAttribute("href") ? new URL(el.getAttribute("href"), url).href : null,
          type:           "normal"
        };
      }).filter(c => c.chapter_url);
    }
  },

  // ── Content config ─────────────────────────────────────────────────────────
  content: {
    readySelector: "div#nr1",
    type:          "text",
    selector:      "div#nr1",
    remove:        ["span", "script", ".bb-ad-slot"]
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url)        { return parsePreview(html, url, this.preview);         },
  fetchChapters(url, progressCb) { return parseChapters(url, this.chapters, progressCb); }
};
