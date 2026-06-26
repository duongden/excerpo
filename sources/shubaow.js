// shubaow source
const SourceShubaow = {
    name: "shubaow",
    // Matches the main book page and chapter URLs for this source
    pattern: /(?:www\.)?shubaow\.org\/(?:book\d+\.html|book\d+\/\d+\.html)/,

    // ── Preview config ────────────────────────────────────────────────────────
    preview: {
        // The page is ready when the main detail container is present
        readySelector: ".detail-box",
        fields: {
            bookName: "div.info h1",
            authorName: {
                custom: (doc) => {
                    // The author is in the first <p> inside .info .top .fix
                    const el = doc.querySelector('.info .fix p');
                    if (!el) return null;
                    return el.textContent.replace(/作者[:：]\s*/, '').trim();
                }
            },
            coverImage: { selector: ".imgbox img", attr: "src" },
            description: {
                custom: (doc) => {
                    const el = doc.querySelector('.desc') || doc.querySelector('.xdesc');
                    if (!el) return null;
                    const text = el.textContent.trim();
                    return text.length > 200 ? text.slice(0, 200) + "…" : text;
                }
            },
            sourceBookCode: { urlPattern: /book(\d+)/ }
        }
    },

    // ── Chapters config ────────────────────────────────────────────────────────
    chapters: {
        method: "tab",
        // The list page is the same URL as the main page; chapters are already in the page.
        listUrl: (url) => url,
        readySelector: "#section-list",
        extract: (selector) => {
            const lis = document.querySelectorAll(`${selector} li a`);
            const chapters = [];
            const seen = new Set();
            for (const a of lis) {
                let href = a.getAttribute('href') || '';
                if (!href) continue;
                // Resolve relative URL to absolute
                href = new URL(href, 'https://www.shubaow.org').href;
                if (seen.has(href)) continue;
                seen.add(href);
                const title = a.textContent.trim();
                chapters.push({
                    chapter_title: title,
                    chapter_url: href,
                    type: "normal"
                });
            }
            // Assign incremental numbers
            return chapters.map((c, i) => {
                c.chapter_number = i + 1;
                return c;
            });
        },
        extractArgs: () => ["#section-list"]
    },

    // ── Content config ────────────────────────────────────────────────────────
    content: {
        readySelector: ".content",
        type: "text",
        selector: ".content",
        remove: []
    },

    // ── Public API ─────────────────────────────────────────────────────────────
    parsePreview(html, url) { return parsePreview(html, url, this.preview); },
    fetchChapters(url, progressCb) { return parseChapters(url, this.chapters, progressCb); }
};
