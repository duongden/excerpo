// fictionpress source
const SourceFictionPress = {
  name: "fictionpress",
  pattern: /(?:www\.)?fictionpress\.com\/s\/\d+\/\d+/,

  // ── Preview config ────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: "div#profile_top b.xcontrast_txt",
      authorName: { selector: "div#profile_top a.xcontrast_txt[href^='/u/']" },
      coverImage: { selector: "div#profile_top img.cimage", attr: "src" },
      sourceBookCode: { urlPattern: /s\/(\d+)/ }
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "tab",
    readySelector: "div#profile_top",
    extract: (url) => {
      const select = document.querySelector("select#chap_select");
      const match = window.location.href.match(/s\/(\d+)\/(\d+)(?:\/(.+))?/);
      if (!match) throw new Error("Không thể trích xuất ID truyện từ URL");
      const novelId = match[1];
      const novelSlug = match[3] ? `/${match[3]}` : "";

      if (!select) {
        const titleEl = document.querySelector("div#profile_top b.xcontrast_txt");
        const title = titleEl ? titleEl.textContent.trim() : "Chương 1";
        return [{
          chapter_number: 1,
          chapter_title: title,
          chapter_url: window.location.href,
          type: "normal"
        }];
      }

      const options = Array.from(select.querySelectorAll("option"));
      return options.map(opt => {
        const num = parseInt(opt.value);
        return {
          chapter_number: num,
          chapter_title: opt.textContent.trim(),
          chapter_url: `https://www.fictionpress.com/s/${novelId}/${num}${novelSlug}`,
          type: "normal"
        };
      });
    }
  },

  // ── Content config ────────────────────────────────────────────────────────
  content: {
    readySelector: "div#storytext",
    type: "paragraphs",
    selector: "div#storytext"
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url) {
    return parsePreview(html, url, this.preview);
  },
  async fetchChapters(url, progressCb) {
    return parseChapters(url, this.chapters, progressCb);
  }
};
