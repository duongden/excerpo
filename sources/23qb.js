// 23qb source
const Source23qb = {
  name: "23qb",
  // Matches the main book page and chapter URLs for this source
  pattern: /(?:www\.)?23qb\.net\/book\/\d+\/.?.*/,

  // ── Preview config ────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: "h1.page-title",
      authorName: {
        custom: (doc) => {
          const el = doc.querySelector('.novel-info-aux a.tag-link span.novel-tag-icon');
          return el ? el.textContent.replace('作者：', '').trim() : null;
        }
      },
      // Cover image not present in the sample markup; placeholder selector can be added later
      coverImage: { selector: ".novel-info-main img", attr: "src" },
      description: {
        custom: (doc) => {
          const el = doc.querySelector('.novel-info-content span');
          return el ? el.textContent.trim().substring(0, 200) : null;
        }
      },
      sourceBookCode: { urlPattern: /book\/([0-9]+)/ }
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "tab",
    listUrl: (url) => {
      // Convert the book detail URL to the catalog URL
      const m = url.match(/book\/([0-9]+)/);
      return m ? `https://www.23qb.net/book/${m[1]}/catalog` : url;
    },
    readySelector: ".module-row-info",
    extract: (selector) => {
      const elements = [...document.querySelectorAll(selector)];
      const chapters = [];
      const seen = new Set();
      for (const el of elements) {
        // Skip reading progress section
        if (el.closest('#shuqian')) continue;
        const a = el.querySelector('a.module-row-text');
        if (!a) continue;
        let href = a.getAttribute('href') || '';
        if (!href || href.includes('javascript:')) continue;
        // Resolve relative URLs
        href = new URL(href, 'https://www.23qb.net').href;
        if (seen.has(href)) continue;
        seen.add(href);
        const title = a.querySelector('span')?.textContent?.trim() || a.textContent.trim();
        chapters.push({
          chapter_title: title,
          chapter_url: href,
          type: "normal"
        });
      }
      // Assign incremental numbers
      return chapters.map((c, i) => {
        c.chapter_number = i + 1;
        return c;
      });
    },
    extractArgs: () => [".module-row-info"]
  },

  // ── Content config ────────────────────────────────────────────────────────
  content: {
    readySelector: ".article-content",
    type: "paragraphs",
    selector: ".article-content",
    remove: []
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url) { return parsePreview(html, url, this.preview); },
  fetchChapters(url, progressCb) { return parseChapters(url, this.chapters, progressCb); }
};
