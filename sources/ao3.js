const SourceAo3 = {
  name: 'ao3',
  pattern: /(?:www\.)?archiveofourown\.org\/works\/\d+/,

  preview: {
    fields: {
      bookName: { selector: 'h2.title.heading' },
      authorName: { selector: 'h3.byline.heading a[rel="author"]' },
      description: { selector: 'div.summary.module blockquote, div.summary.module' },
      sourceBookCode: { urlPattern: /works\/(\d+)/ }
    }
  },

  chapters: {
    method: 'fetch',
    listUrl: (url) => {
      // navigate page is relative path
      return url.replace(/(\/works\/\d+).*/, '$1/navigate');
    },
    fetchOptions: null,
    extract: (doc, url) => {
      const items = Array.from(doc.querySelectorAll('ol.chapter.index.group li a'));
      return items.map((a, idx) => {
        const href = a.getAttribute('href');
        const text = a.textContent.trim();
        // text like "1. just the tip"
        const m = text.match(/^\s*(?:([0-9]+)[\.\)\s:-]+)?\s*(.*)$/);
        const chapter_number = m && m[1] ? Number(m[1]) : idx + 1;
        const chapter_title = m && m[2] ? m[2].trim() : text;
        const chapter_url = href ? new URL(href, url).href : null;
        return { chapter_number, chapter_title, chapter_url, type: 'normal' };
      }).filter(ch => ch.chapter_url);
    }
  },

  content: {
    readySelector: 'div.userstuff.module',
    type: 'paragraphs',
    selector: 'div.userstuff.module',
    remove: ['script', 'style', 'iframe'],
    lineFilter: '^\\s*$'
  },

  parsePreview(html, url) {
    return parsePreview(html, url, this.preview);
  },

  fetchChapters(url, progressCb) {
    return parseChapters(url, this.chapters, progressCb);
  }
};
