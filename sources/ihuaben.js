const SourceIhuaben = {
  name: "ihuaben",
  maxWorkers: 2,
  downloadDelay: 1000,
  pattern: /ihuaben\.com\/(book|list)\/\d+/,

  // ── Preview config ─────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: ".biginfo h1.text-danger",
      authorName: {
        custom: (doc) => {
          const authorEl = doc.querySelector('.infodetail .HuabenListUL a.text-muted[href*="//user.ihuaben.com/"]');
          return authorEl ? authorEl.textContent.trim() : null;
        }
      },
      coverImage: {
        custom: (doc, url) => {
          const img = doc.querySelector("#pc_bookinfo .cover img, .biginfo .cover img");
          if (!img) return null;
          let src = img.getAttribute("src") || img.getAttribute("data-src") || "";
          if (src.startsWith("//")) src = "https:" + src;
          return src || null;
        }
      },
      description: {
        custom: (doc) => {
          const descEl = doc.querySelector(".aboutbook");
          if (!descEl) return null;
          let text = descEl.textContent.trim();
          if (text.startsWith("简介：")) text = text.substring(3).trim();
          return text;
        }
      },
      sourceBookCode: {
        custom: (doc, url) => {
          const match = url.match(/\/(?:book|list)\/(\d+)\.html/);
          return match ? match[1] : "";
        }
      }
    },
    format: (data) => {
      return data;
    }
  },

  // ── Chapter list config ────────────────────────────────────────────────────
  chapters: {
    method: "fetch",
    listUrl: (url) => {
      const match = url.match(/\/(?:book|list)\/(\d+)\.html/);
      if (match) {
        return `https://www.ihuaben.com/list/${match[1]}.html`;
      }
      return url;
    },
    extract: (doc, listUrl) => {
      const items = [...doc.querySelectorAll(".hb-volume-body .chapter-row.hb-chapter-item")];
      let num = 1;
      return items.map((item) => {
        const a = item.querySelector(".col-title a[href]");
        if (!a) return null;
        
        let link = a.getAttribute("href");
        if (link && link.startsWith("//")) link = "https:" + link;
        
        return {
          chapter_number: num++,
          chapter_title: a.getAttribute("title") || a.textContent.trim(),
          chapter_url: link,
          type: "normal"
        };
      }).filter(Boolean);
    }
  },

  // ── Content config ─────────────────────────────────────────────────────────
  content: {
    readySelector: "#contentsource .discription p.dp",
    type: "paragraphs",
    selector: "#contentsource .discription",
    remove: ["i.num"]
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url) {
    return parsePreview(html, url, this.preview);
  },
  async fetchChapters(url, progressCb) {
    return parseChapters(url, this.chapters, progressCb);
  }
};
