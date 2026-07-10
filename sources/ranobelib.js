// ranobelib source
const SourceRanobelib = {
  name: "ranobelib",
  pattern: /(?:www\.)?ranobelib\.me\/(?:[a-z]{2}\/)?book\/[a-zA-Z0-9-]+/,

  // ── Preview config ────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: {
        custom: (doc) => {
          // Tránh lấy tiêu đề generic của website khi đang load
          const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content");
          if (ogTitle && ogTitle !== "RanobeLib" && !ogTitle.toLowerCase().includes("ranobelib")) {
            return ogTitle.trim();
          }
          const h1 = doc.querySelector("h1");
          if (h1) {
            const title = h1.textContent.trim();
            if (title && title !== "RanobeLib" && !title.toLowerCase().includes("ranobelib")) {
              return title;
            }
          }
          return null; // Trả về null để vòng lặp của popup.js tiếp tục chờ đến khi trang render xong
        }
      },
      authorName: {
        custom: (doc) => {
          // Tìm phần tử có nhãn 'Автор' (Tác giả tiếng Nga) hoặc 'Author'
          const items = Array.from(doc.querySelectorAll('.ahz_e, .media-info-list__item'));
          for (const item of items) {
            const label = item.querySelector('.ahz_cy, .media-info-list__item-title')?.textContent.trim();
            if (label === 'Автор' || label === 'Author') {
              const link = item.querySelector('.ahz_bi a, .media-info-list__item-value a');
              if (link) return link.textContent.trim();
            }
          }
          // Dự phòng tìm các link người/tác giả
          const links = Array.from(doc.querySelectorAll("a[href*='/people/'], a[href*='/author/']"));
          const names = links.map(a => a.textContent.trim()).filter(Boolean);
          return names.length > 0 ? names.join(", ") : null;
        }
      },
      coverImage: {
        custom: (doc) => {
          const img = doc.querySelector(".cover__wrap img, #app .cover__wrap > img, img.media-sidebar__cover");
          if (!img) return null;
          return img.src || img.getAttribute("src") || null;
        }
      },
      description: {
        custom: (doc) => {
          const descEl = doc.querySelector(".text-collapse .text-content, .media-summary__text, .media-description__text");
          if (!descEl) return null;
          const paragraphs = Array.from(descEl.querySelectorAll("p, .node-paragraph"));
          if (paragraphs.length > 0) {
            return paragraphs.map(p => p.textContent.trim()).filter(Boolean).join("\n\n");
          }
          return descEl.textContent.trim();
        }
      },
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
