const SourceBookQQ = {
  name: "bookqq",
  pattern: /book\.qq\.com\/book-(detail|read|chapter)\/\d+/,

  // ── Preview config ─────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName:       ".book-title",
      authorName:     {
        custom: (doc) => {
          const el = doc.querySelector('.author.gray') || doc.querySelector('.book-meta .author');
          if (!el) return null;
          return el.textContent.replace(/\s*著\s*$/, '').trim() || null;
        }
      },
      coverImage:     { selector: ".book-cover .ypc-book-cover | .book-cover img", attr: ["src", "data-src"] },
      description:    ".book-intro",
      sourceBookCode: { urlPattern: /book-(?:detail|chapter|read)\/(\d+)/ }
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "tab",
    listUrl: (url) => {
      const m = url.match(/(\d+)/);
      return m ? `https://book.qq.com/book-chapter/${m[1]}` : url;
    },
    readySelector: ".book-dir .list .list-a",
    extract: (selector) => {
      const elements = [...document.querySelectorAll(selector)];
      const seenUrls = new Set();
      let chapters = [];
      
      for (const el of elements) {
        const li = el.closest('li.list');
        // Chỉ lấy các thẻ li đang hiển thị (phòng trường hợp web ẩn 1 list đi)
        if (!li || li.offsetParent === null) continue;
        
        const isLocked = li.querySelector('.lock');
        let href = el.getAttribute('href') || '';
        if (href.startsWith('//')) href = 'https:' + href;
        if (!href || href.includes('javascript:') || seenUrls.has(href)) continue;
        
        seenUrls.add(href);
        chapters.push({
          chapter_title:  el.querySelector('.name')?.textContent.trim() || el.textContent.replace(/\s+/g, ' ').trim(),
          chapter_url:    href,
          type:           isLocked ? "vip" : "normal"
        });
      }
      
      // Nếu danh sách bị ngược (chương 1 ở cuối), ta đảo ngược lại cho đúng thứ tự
      if (chapters.length > 1) {
        const firstTitle = chapters[0].chapter_title;
        const lastTitle = chapters[chapters.length - 1].chapter_title;
        // Kiểm tra xem chữ số trong title đầu có lớn hơn title cuối không (tức là đang xếp giảm dần)
        const firstNumMatch = firstTitle.match(/\d+/);
        const lastNumMatch = lastTitle.match(/\d+/);
        if (firstNumMatch && lastNumMatch) {
          if (parseInt(firstNumMatch[0]) > parseInt(lastNumMatch[0])) {
            chapters.reverse();
          }
        }
      }
      
      // Đánh số thứ tự lại từ 1
      return chapters.map((c, i) => {
        c.chapter_number = i + 1;
        return c;
      });
    },
    extractArgs: () => [".book-dir .list .list-a"]
  },

  // ── Content config ─────────────────────────────────────────────────────────
  content: (chapter) => {
    if (chapter && chapter.type === "vip") {
      return {
        readySelector: "#article.chapter-content",
        type:          "ocr",
        selector:      "#article.chapter-content",
        remove:        [".chapter-ad", ".chapter-reward", ".chapter-comment"],
        scriptUrl:     "https://html2canvas.hertzen.com/dist/html2canvas.min.js"
      };
    }
    return {
      readySelector: "#article.chapter-content",
      type:          "paragraphs",
      selector:      "#article.chapter-content",
      remove:        [".chapter-ad", ".chapter-reward", ".chapter-comment"]
    };
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url)        { return parsePreview(html, url, this.preview);         },
  fetchChapters(url, progressCb) { return parseChapters(url, this.chapters, progressCb); }
};
