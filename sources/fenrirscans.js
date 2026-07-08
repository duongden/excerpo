// fenrirscans source
const SourceFenrirScans = {
  name: "fenrirscans",
  pattern: /(?:www\.)?fenrirscans\.com\/(series|novel|manga)\/[a-zA-Z0-9-]+/,

  // ── Preview config ────────────────────────────────────────────────────────
  preview: {
    fields: {
      bookName: "h1",
      authorName: "a[href*='/authors/']",
      coverImage: { selector: "img.wp-post-image", attr: "src" },
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

        progressCallback("Đang lấy ID truyện từ trang...");
        const [{ result: initData }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          func: () => {
            try {
              const html = document.documentElement.outerHTML;
              const idMatch = html.match(/postid-(\d+)/) || html.match(/"novel_id"\s*:\s*(\d+)/) || html.match(/data-id="(\d+)"/) || html.match(/post-id="(\d+)"/) || html.match(/data-post-id="(\d+)"/);
              const novelId = idMatch ? idMatch[1] : null;
              return { novelId };
            } catch (err) {
              return { error: err.message };
            }
          }
        });

        if (!initData || !initData.novelId) {
          throw new Error("Không tìm thấy Novel/Post ID trên trang (có thể do bị chặn bởi Cloudflare)");
        }

        const { novelId } = initData;

        progressCallback("Đang tải danh sách chương...");
        const [{ result: response }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          args: [novelId],
          func: async (novelId) => {
            try {
              const postAjax = window.jQuery 
                ? (url, body) => new Promise((resolve, reject) => {
                    window.jQuery.post(url, body)
                      .done((res) => resolve(res))
                      .fail((xhr) => reject(new Error(`jQuery POST failed with status ${xhr.status}`)));
                  })
                : async (url, body) => {
                    const params = new URLSearchParams();
                    for (const key in body) {
                      params.append(key, body[key].toString());
                    }
                    const resp = await fetch(url, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        "X-Requested-With": "XMLHttpRequest",
                        "Accept": "*/*"
                      },
                      body: params.toString()
                    });
                    if (!resp.ok) throw new Error(`Fetch failed with status ${resp.status}`);
                    return await resp.json();
                  };

              // 1. Ưu tiên kiểm tra các biến global đặc thù của theme chứa nonce tải chương
              let nonce = window.ts_chapters?.nonce 
                || window.ts_settings?.nonce
                || window.ts_chapters_nonce 
                || window.ts_nonce;

              // Nếu không tìm thấy trong các biến đặc thù, mới kích hoạt cơ chế quét và thử nghiệm
              if (!nonce) {
                const candidates = new Set();
                if (window.ts_ac_settings?.nonce) candidates.add(window.ts_ac_settings.nonce);
                if (window.ts_ac_settings?.security) candidates.add(window.ts_ac_settings.security);
                if (window.wp_manga_nonce) candidates.add(window.wp_manga_nonce);
                if (window.manga_args?.nonce) candidates.add(window.manga_args.nonce);

                const html = document.documentElement.outerHTML;
                const regexes = [
                  /"nonce"\s*:\s*"([a-f0-9]{10})"/gi,
                  /nonce\s*=\s*'([a-f0-9]{10})'/gi,
                  /nonce\s*=\s*"([a-f0-9]{10})"/gi,
                  /"security"\s*:\s*"([a-f0-9]{10})"/gi,
                  /security\s*=\s*'([a-f0-9]{10})'/gi,
                  /security\s*=\s*"([a-f0-9]{10})"/gi
                ];
                for (const rx of regexes) {
                  const matches = [...html.matchAll(rx)];
                  for (const m of matches) {
                    candidates.add(m[1]);
                  }
                }
                const nonces = Array.from(candidates);

                let workingNonce = null;
                let lastStatus = "";
                for (const n of nonces) {
                  try {
                    const testBody = {
                      action: "load_all_chapters",
                      novel_id: novelId,
                      page: 1,
                      per_page: 5,
                      sort_order: "latest",
                      nonce: n
                    };
                    const res = await postAjax("https://fenrirscans.com/wp-admin/admin-ajax.php", testBody);
                    let parsed = res;
                    if (typeof parsed === "string") parsed = JSON.parse(parsed);
                    if (parsed.success) {
                      workingNonce = n;
                      break;
                    }
                  } catch (e) {
                    lastStatus += `[Nonce ${n}: ${e.message}] `;
                  }
                }

                if (workingNonce === null) {
                  try {
                    const testBody = {
                      action: "load_all_chapters",
                      novel_id: novelId,
                      page: 1,
                      per_page: 5,
                      sort_order: "latest"
                    };
                    const res = await postAjax("https://fenrirscans.com/wp-admin/admin-ajax.php", testBody);
                    let parsed = res;
                    if (typeof parsed === "string") parsed = JSON.parse(parsed);
                    if (parsed.success) {
                      workingNonce = "";
                    }
                  } catch (e) {
                    lastStatus += `[Không nonce: ${e.message}]`;
                  }
                }

                if (workingNonce === null) {
                  return { error: `Không tìm thấy nonce hoạt động. Đã thử: [${nonces.join(", ")}]. Chi tiết: ${lastStatus}` };
                }
                nonce = workingNonce;
              }

              // 2. Tiến hành cào với nonce đã xác định thành công
              let pageNum = 1;
              let hasMore = true;
              const tempChapters = [];
              const seenUrls = new Set();

              while (hasMore) {
                const body = {
                  action: "load_all_chapters",
                  novel_id: novelId,
                  page: pageNum,
                  per_page: 50,
                  sort_order: "latest"
                };
                if (nonce) body.nonce = nonce;

                const result = await postAjax("https://fenrirscans.com/wp-admin/admin-ajax.php", body);
                let json = result;
                if (typeof json === "string") {
                  json = JSON.parse(json);
                }

                if (!json.success || !json.data) {
                   break;
                }

                let addedThisPage = 0;
                const items = json.data.all_chapters || [];
                if (items.length > 0) {
                  for (const item of items) {
                    const chapUrl = item.url;
                    if (chapUrl && !seenUrls.has(chapUrl)) {
                      seenUrls.add(chapUrl);
                      tempChapters.push({
                        chapter_number: 0,
                        chapter_title: `BLM ${item.number} - ${item.title}`,
                        chapter_url: chapUrl,
                        type: "normal"
                      });
                      addedThisPage++;
                    }
                  }
                } else if (json.data.chapters) {
                  const doc = new DOMParser().parseFromString(json.data.chapters, "text/html");
                  const links = Array.from(doc.querySelectorAll(".chapter-title-link, a"));
                  for (const a of links) {
                    if (a.href && !seenUrls.has(a.href)) {
                      seenUrls.add(a.href);
                      const span = a.closest(".chapter-item")?.querySelector(".chapter-number");
                      const chapterNum = span ? span.textContent.trim() : "";
                      const mainTitle = a.textContent.trim();
                      const title = chapterNum ? `${chapterNum} - ${mainTitle}` : mainTitle;
                      tempChapters.push({
                        chapter_number: 0,
                        chapter_title: title,
                        chapter_url: a.href,
                        type: "normal"
                      });
                      addedThisPage++;
                    }
                  }
                }

                if (addedThisPage === 0) {
                  hasMore = false;
                } else {
                  pageNum++;
                  await new Promise(r => setTimeout(r, 300));
                }
              }
              return { chapters: tempChapters };
            } catch (err) {
              return { error: err.message };
            }
          }
        });

        if (response && response.error) {
          throw new Error(`Lỗi trong Tab: ${response.error}`);
        }

        const rawChapters = response ? response.chapters : null;
        if (!rawChapters || rawChapters.length === 0) {
          throw new Error("Không lấy được danh sách chương qua API");
        }

        rawChapters.reverse();
        rawChapters.forEach((ch, idx) => {
          ch.chapter_number = idx + 1;
        });

        return rawChapters;
      } finally {
        chrome.tabs.remove(tab.id).catch(() => {});
      }
    }
  },

  // ── Content config ────────────────────────────────────────────────────────
  content: {
    readySelector: "div#readerarea, div#content, #content",
    type: "paragraphs",
    selector: "div#readerarea | div#content | #content",
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
