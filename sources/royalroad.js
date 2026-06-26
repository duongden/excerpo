const SourceRoyalRoad = {
  name: "royalroad",
  pattern: /(?:www\.)?royalroad\.com\/fiction\/\d+(?:\/|$)/,

  preview: {
    fields: {
      bookName: {
        custom: (doc) => {
          return doc.querySelector('h1[property="name"]')?.textContent.trim()
            || doc.querySelector('h1')?.textContent.trim()
            || doc.querySelector('title')?.textContent.trim()
            || null;
        }
      },
      authorName: {
        custom: (doc) => {
          return doc.querySelector('a[property="author"]')?.textContent.trim()
            || doc.querySelector('.profile-name a')?.textContent.trim()
            || doc.querySelector('div.row.fic-header h4 span:nth-child(2) a')?.textContent.trim()
            || null;
        }
      },
      coverImage: {
        selector: ".thumbnail.inline-block[data-type=\"cover\"] | .fiction-cover img",
        attr: ["src", "data-src"]
      },
      description: {
        custom: (doc) => {
          return doc.querySelector('.fiction-description')?.textContent.trim()
            || doc.querySelector('.summary')?.textContent.trim()
            || "";
        }
      },
      sourceBookCode: {
        urlPattern: /fiction\/(\d+)/
      }
    }
  },

  chapters: {
    method: "fetch",
    extract: (doc, url) => {
      const rows = Array.from(doc.querySelectorAll('tr.chapter-row'));
      return rows.map((row, index) => {
        const anchor = row.querySelector('a.fr')
          || row.querySelector('a[href*="/chapter/"]')
          || row.querySelector('a');
        let href = anchor?.getAttribute('href') || null;
        if (href && href.startsWith('/')) {
          const origin = new URL(url).origin;
          href = origin + href;
        }
        const title = anchor?.textContent.trim() || `Chapter ${index + 1}`;
        const isVip = !!row.querySelector('.fa-lock, .icon-lock, svg.lock, .lock');
        return {
          chapter_number: index + 1,
          chapter_title: title,
          chapter_url: href,
          type: isVip ? 'vip' : 'normal'
        };
      }).filter(ch => ch.chapter_url);
    }
  },

  content: {
    readySelector: "div.chapter-inner.chapter-content",
    type: "paragraphs",
    selector: "div.chapter-inner.chapter-content",
    remove: ["script", "style", "iframe", ".chapter-ad", ".advertisement", ".adsbygoogle"],
    lineFilter: "^\\s*$"
  },

  parsePreview(html, url) {
    return parsePreview(html, url, this.preview);
  },

  fetchChapters(url, progressCb) {
    return parseChapters(url, this.chapters, progressCb);
  }
};
