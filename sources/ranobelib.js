// ranobelib source
const SourceRanobelib = {
  name: "ranobelib",
  pattern: /(?:www\.)?ranobelib\.me\/(?:[a-z]{2}\/)?book\/[a-zA-Z0-9-]+/,

  // ── Preview config ────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: { custom: (doc) => doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || doc.querySelector("h1")?.textContent.trim() || "Ranobelib Book" },
      authorName: {
        custom: (doc) => {
          const links = Array.from(doc.querySelectorAll("a[href*='/people/']"));
          return links.map(a => a.textContent.trim()).filter(Boolean).join(", ") || null;
        }
      },
      coverImage: { selector: ".cover__wrap img, #app .cover__wrap > img", attr: "src" },
      sourceBookCode: {
        custom: (doc, url) => {
          const match = url.match(/book\/([a-zA-Z0-9-]+)/);
          return match ? match[1] : "";
        }
      }
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "custom",
    custom: async (url, progressCallback) => {
      progressCallback("Đang mở trang truyện...");
      const tab = await chrome.tabs.create({ url, active: false });
      
      try {
        await new Promise(r => setTimeout(r, 2000));
        
        const match = url.match(/ranobelib\.me\/(?:([a-z]{2})\/)?book\/([a-zA-Z0-9-]+)/);
        if (!match) throw new Error("URL truyện không hợp lệ");
        const locale = match[1] || "ru";
        const bookCode = match[2];
        
        progressCallback("Đang tải danh sách chương từ API...");
        const [{ result: response }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          args: [bookCode, locale],
          func: async (bookCode, locale) => {
            try {
              const resp = await fetch(`https://api.cdnlibs.org/api/manga/${bookCode}/chapters`, {
                headers: {
                  "site-id": "3",
                  "Accept": "application/json",
                  "Content-Type": "application/json"
                }
              });
              if (!resp.ok) {
                return { error: `Fetch API failed with status ${resp.status}` };
              }
              const json = await resp.json();
              if (!json || !json.data) {
                return { error: "Dữ liệu JSON không hợp lệ" };
              }
              
              const chaps = json.data.map((item, index) => {
                const name = item.name ? ` - ${item.name}` : "";
                const title = `Volume ${item.volume} Chapter ${item.number}${name}`;
                const chapterUrl = `https://ranobelib.me/${locale}/${bookCode}/read/v${item.volume}/c${item.number}`;
                return {
                  chapter_number: index + 1,
                  chapter_title: title,
                  chapter_url: chapterUrl,
                  type: "normal"
                };
              });
              
              return { chapters: chaps };
            } catch (err) {
              return { error: err.message };
            }
          }
        });
        
        if (response && response.error) {
          throw new Error(response.error);
        }
        
        const rawChapters = response ? response.chapters : null;
        if (!rawChapters || rawChapters.length === 0) {
          throw new Error("Không lấy được danh sách chương qua API");
        }
        
        return rawChapters;
      } finally {
        chrome.tabs.remove(tab.id).catch(() => {});
      }
    }
  },

  // ── Content config ────────────────────────────────────────────────────────
  content: {
    readySelector: "main.pb_m, div.text-content, main[data-reader-content]",
    type: "paragraphs",
    selector: "main.pb_m | div.text-content | main[data-reader-content]",
    remove: ["script", "style"]
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url) {
    return parsePreview(html, url, this.preview);
  },
  async fetchChapters(url, progressCb) {
    return this.chapters.custom(url, progressCb);
  }
};
