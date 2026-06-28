const SourcePo18 = {
  name: "po18",
  pattern: /po18\.tw\/books\/\d+/,

  // ── Preview config ─────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName:       ".book_name",
      authorName:     ".book_author",
      coverImage:     { selector: ".book_cover img", attr: "src" },
      description:    ".B_I_content",
      sourceBookCode: { urlPattern: /books\/(\d+)/ }
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "fetch",
    listUrl: (url) => url.replace(/\/articles\/?$/, '') + '/articles',
    extract: (doc, url) => {
      const items = [...doc.querySelectorAll(".c_l")];
      const result = [];
      let n = 1;
      for (const item of items) {
        const titleEl = item.querySelector(".l_chaptname");
        if (!titleEl) continue;
        const a = titleEl.querySelector("a");
        const title = titleEl.textContent.trim();
        const btn = item.querySelector(".l_btn a");
        const isVip = btn && btn.classList.contains("btn_L_red");
        
        let fullUrl = null;
        if (a && a.getAttribute("href")) {
          const href = a.getAttribute("href");
          fullUrl = href.startsWith("http") ? href : `https://www.po18.tw${href}`;
        }
        
        if (fullUrl || isVip) {
           result.push({
             chapter_number: n++,
             chapter_title: title,
             chapter_url: fullUrl || "",
             type: isVip ? "vip" : "normal"
           });
        }
      }
      return result;
    }
  },

  // ── Content config ─────────────────────────────────────────────────────────
  content: {
    readySelector: ".read-txt h1",
    type:          "paragraphs",
    selector:      ".read-txt",
    remove:        ["blockquote.copyright", "h1"]
  },

  // ── Public API (thin wrappers — for backward compat với popup.js) ──────────
  parsePreview(html, url)          { return parsePreview(html, url, this.preview);           },
  fetchChapters(url, progressCb)   { return parseChapters(url, this.chapters, progressCb);   },
};
