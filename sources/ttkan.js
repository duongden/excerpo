// ttkan source
const SourceTtkan = {
  name: "ttkan",
  pattern: /(?:www\.)?ttkan\.co\/novel\/chapters\/[a-zA-Z0-9-]+/,

  // ── Preview config ────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: "div.novel_info h1",
      authorName: { custom: (doc) => {
          const a = doc.querySelector('.novel_info a[href*="/novel/search"]');
          return a ? a.textContent.trim() : null;
      }},
      coverImage: { selector: ".novel_info amp-img img", attr: "src" },
      sourceBookCode: { urlPattern: /novel\/chapters\/([a-zA-Z0-9-]+)/ }
    }
  },

  // ── Chapters config ────────────────────────────────────────────────────────
  chapters: {
    method: "custom",
    custom: async (url, progressCallback) => {
      progressCallback(`Đang lấy danh sách chương từ API...`);
      const match = url.match(/novel\/chapters\/([a-zA-Z0-9-]+)/);
      if (!match) throw new Error("Không tìm thấy ID truyện trong URL");
      const novelId = match[1];

      const apiUrl = `https://www.ttkan.co/api/nq/amp_novel_chapters?language=tw&novel_id=${novelId}`;
      const resp = await fetch(apiUrl);
      if (!resp.ok) throw new Error(`HTTP Error ${resp.status}`);
      const data = await resp.json();

      if (!data || !data.items || !Array.isArray(data.items)) {
        throw new Error("Dữ liệu API trả về không hợp lệ");
      }

      const chapters = [];
      data.items.forEach((item, index) => {
        chapters.push({
          chapter_number: index + 1,
          chapter_title: item.chapter_name,
          chapter_url: `https://www.wa01.com/novel/pagea/${novelId}_${item.chapter_id}.html`,
          type: "normal"
        });
      });

      return chapters;
    }
  },

  // ── Content config ────────────────────────────────────────────────────────
  content: {
    readySelector: "div.content",
    type: "paragraphs",
    selector: "div.content",
    remove: ["a.anchor_bookmark", "center", "div#div_content_end", "div.div_feedback", "div.social_share_frame", "script", "amp-img", "amp-social-share"],
    lineFilter: "本章完|^\\(PS[：:]|哈哈.{0,10}[要投票]|納蘭嫣然|^第\\d+章"
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  parsePreview(html, url) {
    return parsePreview(html, url, this.preview);
  },
  async fetchChapters(url, progressCb) {
    return parseChapters(url, this.chapters, progressCb);
  }
};
