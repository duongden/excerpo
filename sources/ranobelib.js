// ranobelib.me source
const SourceRanobeLib = {
  name: "ranobelib",
  pattern: /(?:www\.)?ranobelib\.me\/(ru\/manga\/)?[a-zA-Z0-9_-]+/,

  // ── Preview config ────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: { custom: (doc) => {
        const titleEl = doc.querySelector(".media-name__main, h1.media-name__main, h1, .manga-title");
        return titleEl ? titleEl.textContent.trim() : "";
      }},
      authorName: { custom: (doc) => {
        const authorEl = doc.querySelector("a[href*='/author/'], .media-info-list__item_author a, a[href*='/authors/']");
        return authorEl ? authorEl.textContent.trim() : "";
      }},
      coverImage: { selector: ".media-sidebar__cover img, .manga-cover img, img[src*='/uploads/'], img.media-sidebar__cover", attr: "src" },
      sourceBookCode: { custom: (doc, url) => {
        const parts = url.replace(/\/$/, "").split("/");
        return parts[parts.length - 1];
      }}
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "custom",
    custom: async (url, progressCallback) => {
      progressCallback("Đang mở trang truyện...");
      const tab = await chrome.tabs.create({ url, active: false });

      try {
        // Đợi 2.5 giây cho Cloudflare verify và trang load xong
        await new Promise(r => setTimeout(r, 2500));

        progressCallback("Đang tải danh sách chương...");
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          func: async () => {
            try {
              const cleanUrl = window.location.href.split("?")[0].replace(/\/$/, "");
              const slug = cleanUrl.split("/").pop();
              const apiUrl = `https://api.cdnlibs.org/api/manga/${slug}`;

              // 1. Fetch chapters list
              const resp = await fetch(`${apiUrl}/chapters`);
              if (!resp.ok) throw new Error(`HTTP Error ${resp.status} fetching chapters list`);
              const resJson = await resp.json();
              const chapters = resJson.data || [];

              // 2. Count branches to select the one with most chapters
              const branches = {};
              for (const chap of chapters) {
                if (chap.branches) {
                  for (const br of chap.branches) {
                    const key = br.branch_id;
                    branches[key] = (branches[key] || 0) + 1;
                  }
                }
              }

              let bestBranch = 0;
              let maxCount = -1;
              for (const [key, count] of Object.entries(branches)) {
                if (count > maxCount) {
                  maxCount = count;
                  bestBranch = parseInt(key, 10);
                }
              }

              // 3. Generate chapter URLs
              const tempChapters = [];
              for (const chap of chapters) {
                if (chap.branches && chap.branches.some(b => b.moderation)) {
                  continue;
                }
                const chapNum = chap.number;
                const chapVol = chap.volume;
                const params = new URLSearchParams();
                params.append("volume", chapVol.toString());
                params.append("number", chapNum.toString());
                params.append("branch_id", bestBranch.toString());

                const chapUrl = `${apiUrl}/chapter?${params.toString()}`;
                tempChapters.push({
                  volume: parseFloat(chapVol) || 0,
                  number: parseFloat(chapNum) || 0,
                  chapter_title: chap.name ? `Глава ${chapNum} - ${chap.name}` : `Глава ${chapNum}`,
                  chapter_url: chapUrl
                });
              }

              // Sort in ascending order
              tempChapters.sort((a, b) => {
                if (a.volume !== b.volume) return a.volume - b.volume;
                return a.number - b.number;
              });

              return {
                chapters: tempChapters.map((c, idx) => ({
                  chapter_number: idx + 1,
                  chapter_title: c.chapter_title,
                  chapter_url: c.chapter_url,
                  type: "normal"
                }))
              };
            } catch (err) {
              return { error: err.message };
            }
          }
        });

        if (result && result.error) {
          throw new Error(`Lỗi trong Tab: ${result.error}`);
        }

        const rawChapters = result ? result.chapters : null;
        if (!rawChapters || rawChapters.length === 0) {
          throw new Error("Không lấy được danh sách chương từ API");
        }

        return rawChapters;
      } finally {
        chrome.tabs.remove(tab.id).catch(() => {});
      }
    }
  },

  // ── Content config ────────────────────────────────────────────────────────
  content: {
    readySelector: "body",
    type: "ranobelib",
    selector: "body"
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url) {
    return parsePreview(html, url, this.preview);
  },
  async fetchChapters(url, progressCb) {
    return parseChapters(url, this.chapters, progressCb);
  }
};
