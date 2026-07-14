// wbnovel source
const SourceWbnovel = {
  name: "wbnovel",
  pattern: /(?:www\.)?wbnovel\.com\/nv\/[a-zA-Z0-9-]+/,

  // ── Preview config ────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: { custom: (doc) => doc.querySelector('.rate-title')?.textContent?.trim() || doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || doc.querySelector("h1")?.textContent?.trim() },
      authorName: {
        custom: (doc) => {
          const authors = Array.from(doc.querySelectorAll('.author-content a')).map(a => a.textContent?.trim()).filter(Boolean);
          return authors.length > 0 ? authors.join(", ") : null;
        }
      },
      coverImage: {
        custom: (doc, url) => {
          const img = doc.querySelector(".summary_image img");
          if (!img) return null;
          let src = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("srcset") || "";
          if (src.startsWith("//")) src = "https:" + src;
          return src || null;
        }
      },
      description: {
        custom: (doc) => {
          const el = doc.querySelector(".summary__content, .post-content") || doc.querySelector('meta[property="og:description"]') || doc.querySelector('meta[name="description"]');
          if (!el) return null;
          const text = el.tagName === 'META' ? el.getAttribute("content") : el.textContent?.trim();
          return text && text.length > 200 ? text.slice(0, 200) + "…" : text;
        }
      },
      sourceBookCode: { urlPattern: /\/nv\/([a-zA-Z0-9-]+)/ }
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "tab",
    readySelector: ".wp-manga-chapter a",
    extract: (url) => {
      // Nhấp vào nút Show more nếu nó hiển thị để tải đầy đủ danh sách chương
      const readMoreBtn = document.querySelector(".chapter-readmore");
      if (readMoreBtn && readMoreBtn.offsetHeight > 0) {
        readMoreBtn.click();
      }
      const links = Array.from(document.querySelectorAll(".wp-manga-chapter a"));
      links.reverse();
      return links.map((a, index) => {
        const li = a.closest("li");
        const isVip = (li && (li.classList.contains("premium") || li.classList.contains("premium-block"))) || !!a.querySelector("i.fa-lock");
        return {
          chapter_number: index + 1,
          chapter_title: a.textContent.replace(/[\n\t\r]+/g, " ").replace(/\s+/g, " ").trim(),
          chapter_url: a.href,
          type: isVip ? "vip" : "normal"
        };
      });
    }
  },

  // ── Content config ────────────────────────────────────────────────────────
  content: {
    readySelector: "div.text-left p",
    type: "paragraphs",
    selector: "div.text-left",
    remove: ["script", "style", "h3", ".code-block"]
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url) {
    return parsePreview(html, url, this.preview);
  },
  async fetchChapters(url, progressCb) {
    return parseChapters(url, this.chapters, progressCb);
  }
};
