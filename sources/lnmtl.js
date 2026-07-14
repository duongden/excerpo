// lnmtl source
const SourceLnmtl = {
  name: "lnmtl",
  pattern: /(?:www\.)?lnmtl\.com\/(novel|manga)\/[a-zA-Z0-9-]+/,

  // ── Preview config ────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: { custom: (doc) => doc.querySelector('.novel-name')?.textContent?.trim() || doc.querySelector('.post-title h1')?.textContent?.trim() || doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || doc.querySelector("h1")?.textContent?.trim() },
      authorName: {
        custom: (doc) => {
          // LNMTL usually has author links or a dt/dd pair
          const authors = Array.from(doc.querySelectorAll('.author-content a, .post-content_item.mg_author div.summary-content a'))
            .map(a => a.textContent?.trim())
            .filter(Boolean);
          if (authors.length > 0) return authors.join(", ");

          const dt = Array.from(doc.querySelectorAll('dt'))
            .find(el => /author/i.test(el.textContent));
          if (dt && dt.nextElementSibling) {
            return dt.nextElementSibling.textContent.trim() || null;
          }

          return null;
        }
      },
      coverImage: {
        custom: (doc, url) => {
          const img = doc.querySelector("img.media-object, .summary_image img");
          if (!img) return null;
          let src = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || "";
          if (src.startsWith("//")) src = "https:" + src;
          return src || null;
        }
      },
      description: {
        custom: (doc) => {
          const el = doc.querySelector(".description, .summary__content, .synopsis");
          let text = el?.textContent?.replace(/Description from Novelupdates/i, "").trim() || "";
          if (!text) {
            text = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || "";
          }
          return text.length > 200 ? text.slice(0, 200) + "…" : (text || null);
        }
      },
      sourceBookCode: { urlPattern: /(?:novel|manga)\/([a-zA-Z0-9-]+)/ }
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "tab",
    readySelector: "script",
    extract: async (url) => {
      if (!window.lnmtl || !window.lnmtl.volumes) {
        return [];
      }
      
      const volumes = window.lnmtl.volumes;
      let allChapters = [];
      let index = 1;
      
      for (const vol of volumes) {
        let page = 1;
        let lastPage = 1;
        
        do {
           try {
             const resp = await fetch(`/chapter?page=${page}&volumeId=${vol.id}`);
             const json = await resp.json();
             
             if (json && json.data) {
                lastPage = json.last_page || 1;
                for (const ch of json.data) {
                   allChapters.push({
                     chapter_number: index++,
                     chapter_title: (vol.title ? vol.title + " - " : "") + (ch.title || `Chapter ${ch.number}`),
                     chapter_url: ch.site_url || `https://lnmtl.com/chapter/${ch.slug}`,
                     type: "normal"
                   });
                }
             } else {
                break;
             }
             page++;
           } catch(e) {
             console.error(e);
             break;
           }
        } while(page <= lastPage);
      }
      
      return allChapters;
    }
  },

  // ── Content config ────────────────────────────────────────────────────────
  content: {
    readySelector: ".chapter-body sentence",
    type: "spans",
    selector: ".chapter-body sentence.original",
    remove: ["script", "style"]
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url) {
    return parsePreview(html, url, this.preview);
  },
  async fetchChapters(url, progressCb) {
    return parseChapters(url, this.chapters, progressCb);
  }
};
