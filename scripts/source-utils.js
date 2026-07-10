// scripts/source-utils.js
// 3 generic engine + tab helpers + storage/render utils

// ─── 1. Preview Engine ────────────────────────────────────────────────────────
//
// Field definition types:
//   "selector | selector2"         — textContent, fallback chain
//   { selector: "a | b", attr }    — attribute (attr = string or string[])
//   { urlPattern: /regex/ }        — capture group 1 from URL
//   { custom: (doc, url) => val }  — arbitrary logic

function _resolveField(doc, url, def) {
  if (typeof def === 'string') {
    for (const sel of def.split('|').map(s => s.trim())) {
      const val = doc.querySelector(sel)?.textContent.trim();
      if (val) return val;
    }
    return null;
  }
  if (def.urlPattern) return url.match(def.urlPattern)?.[1] ?? null;
  if (def.custom)     return def.custom(doc, url) ?? null;
  if (def.selector) {
    const attrs = def.attr
      ? (Array.isArray(def.attr) ? def.attr : [def.attr])
      : null;
    for (const sel of def.selector.split('|').map(s => s.trim())) {
      const el = doc.querySelector(sel);
      if (!el) continue;
      if (attrs) {
        for (const a of attrs) {
          const v = el.getAttribute(a) ?? (a === 'src' ? el.src : null);
          if (v) return v;
        }
        continue;
      }
      return el.textContent.trim() || null;
    }
    return null;
  }
  return null;
}

/**
 * Generic preview parser.
 * @param {string} html
 * @param {string} url
 * @param {{ fields?: object, custom?: Function }} config
 * @returns {object}
 */
function parsePreview(html, url, config) {
  if (config.custom) return config.custom(html, url);
  const doc    = new DOMParser().parseFromString(html, 'text/html');
  const result = { url };
  for (const [field, def] of Object.entries(config.fields ?? {})) {
    result[field] = _resolveField(doc, url, def);
  }
  return result;
}

// ─── 2. Chapter Engine ────────────────────────────────────────────────────────
//
// chapters config shape:
//   method: "tab" | "fetch" | "custom"
//
//   method "tab":
//     listUrl(url)      → string  (url of chapter list page, default: same url)
//     readySelector     → string | fn(url)→string
//     extract           → function (injected into tab, MUST be serializable)
//     extractArgs(url)  → any[]   (args passed to extract, default: [url])
//
//   method "fetch":
//     listUrl(url)      → string
//     fetchOptions      → RequestInit (optional)
//     extract(doc, url) → chapter[]
//
//   method "custom":
//     custom(url, progressCallback) → Promise<chapter[]>

/**
 * Generic chapter list fetcher.
 * @param {string}   url
 * @param {object}   config
 * @param {Function} progressCallback
 */
async function parseChapters(url, config, progressCallback) {
  if (config.method === 'custom') {
    return config.custom(url, progressCallback);
  }

  const listUrl = config.listUrl ? config.listUrl(url) : url;
  progressCallback(`Đang lấy danh sách chương: ${listUrl}`);

  if (config.method === 'fetch') {
    const resp = await fetch(listUrl, config.fetchOptions ?? {});
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const doc  = new DOMParser().parseFromString(html, 'text/html');
    return config.extract(doc, url);
  }

  if (config.method === 'tab') {
    const readySelector = typeof config.readySelector === 'function'
      ? config.readySelector(url)
      : config.readySelector;
    const args = config.extractArgs ? config.extractArgs(url) : [url];
    return await openTabAndScrape(listUrl, readySelector, config.extract, args);
  }

  throw new Error(`parseChapters: unknown method "${config.method}"`);
}

// ─── 3. Content Engine ────────────────────────────────────────────────────────
//
// content config shape:
//   readySelector  string   — background polls this selector before extracting
//   type           string   — "paragraphs" | "text" | "spans" | "ocr"
//   selector       string   — CSS selector for container (or all spans)
//   scriptUrl      string?  — (ocr) URL of html2canvas
//   fallbacks      Array?   — [{ type, selector }, ...] tried in order if main fails

/**
 * Generic content extractor — injects logic into an already-open tab.
 * Returns { paragraphs, needOCR?, dataUrl?, debug? }
 * @param {number} tabId
 * @param {object} contentConfig
 */
async function parseContentInTab(tabId, contentConfig) {
  const {
    type      = 'paragraphs',
    selector  = 'body',
    fallbacks = [],
    scriptUrl = null,
    remove    = [],
    lineFilter = null,
  } = contentConfig;

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world:  "MAIN",
    args:   [selector, type, scriptUrl, JSON.stringify(fallbacks), JSON.stringify(remove), lineFilter],
    func: async (selector, type, scriptUrl, fallbacksJson, removeJson, lineFilterPattern) => {
      const fallbacks = JSON.parse(fallbacksJson);
      const removeArr = JSON.parse(removeJson);
      const lineFilterRe = lineFilterPattern ? new RegExp(lineFilterPattern) : null;
      const filterLine = (s) => s.length > 0 && (!lineFilterRe || !lineFilterRe.test(s));
      const debug = [`url: ${location.href}`, `type: ${type}`, `selector: ${selector}`];

      // ── Extract helpers ──────────────────────────────────────────────────
      async function extract(sel, t) {

        if (t === 'spans') {
          // Every matched element is its own paragraph
          const spans = document.querySelectorAll(sel);
          debug.push(`[spans] found ${spans.length} elements`);
          if (!spans.length) return null;
          const lines = [];
          spans.forEach(span => {
            const clone = span.cloneNode(true);
            clone.querySelectorAll("br").forEach(br => br.replaceWith("\n"));
            clone.textContent.split("\n")
              .map(s => s.trim()).filter(s => s.length > 0)
              .forEach(l => lines.push(l));
          });
          return { paragraphs: lines };
        }

        const container = document.querySelector(sel);
        debug.push(`[${t}] container: ${!!container}`);
        if (!container) return null;

        const toRemove = ["script", "style", "iframe", ...removeArr].join(",");

        if (t === 'paragraphs') {
          const clone = container.cloneNode(true);
          if (toRemove) clone.querySelectorAll(toRemove).forEach(e => e.remove());
          const ps = [...clone.querySelectorAll("p")]
            .map(p => p.textContent.trim()).filter(Boolean);
          debug.push(`[paragraphs] found ${ps.length} <p>`);
          return { paragraphs: ps };
        }

        if (t === 'text') {
          const clone = container.cloneNode(true);
          const textRemove = [toRemove, "div"].filter(Boolean).join(",");
          if (textRemove) clone.querySelectorAll(textRemove).forEach(e => e.remove());
          clone.querySelectorAll("br").forEach(br => br.replaceWith("\n"));
          const lines = clone.textContent.split("\n").map(s => s.trim()).filter(filterLine);
          debug.push(`[text] found ${lines.length} lines`);
          return { paragraphs: lines };
        }

        if (t === 'hetushu') {
          const divs = Array.from(container.children).filter(el => el.tagName === 'DIV');
          debug.push(`[hetushu] found ${divs.length} direct divs`);
          if (!divs.length) return null;

          // Lọc các div chứa chữ và không bị ẩn
          const visibleDivs = divs.filter(d => {
            const display = window.getComputedStyle(d).display;
            return d.textContent.trim().length > 0 && display !== 'none';
          });

          // Sắp xếp các div theo tọa độ hiển thị thực tế trên màn hình (đầu tiên là chiều dọc y, sau đó là x nếu xấp xỉ bằng nhau)
          visibleDivs.sort((a, b) => {
            const rectA = a.getBoundingClientRect();
            const rectB = b.getBoundingClientRect();
            if (Math.abs(rectA.top - rectB.top) > 5) {
              return rectA.top - rectB.top;
            }
            return rectA.left - rectB.left;
          });

          const paragraphs = visibleDivs.map(d => d.textContent.trim()).filter(Boolean);
          debug.push(`[hetushu] sorted and extracted ${paragraphs.length} paragraphs`);
          return { paragraphs };
        }

        if (t === 'custom') {
          const idMatch = location.href.match(/id=(\d+)/);
          if (!idMatch) {
            debug.push("Không thể lấy ID chương từ URL: " + location.href);
            return null;
          }
          const id = idMatch[1];
          try {
            debug.push(`Fetching custom API: https://www.pixiv.net/ajax/novel/${id}`);
            const res = await fetch(`https://www.pixiv.net/ajax/novel/${id}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data && data.body && data.body.content) {
              const ps = data.body.content.split('\n').map(p => p.trim()).filter(Boolean);
              debug.push(`Custom API fetch success, extracted ${ps.length} paragraphs`);
              return { paragraphs: ps };
            } else {
              throw new Error("Không có nội dung body.content trong phản hồi API");
            }
          } catch (err) {
            debug.push(`Lỗi tải API Custom: ${err.message}`);
            return null;
          }
        }

        if (t === 'ranobelib') {
          try {
            const rawText = document.body.textContent || '';
            const data = JSON.parse(rawText);
            if (data && data.data && data.data.content) {
              const content = data.data.content;
              let ps = [];
              if (content.content) {
                // Nested JSON paragraphs structure
                const parseParagraphs = (node) => {
                  let results = [];
                  if (node && typeof node === 'object') {
                    if (node.type === 'paragraph' && node.content) {
                      const text = node.content.map(c => c.text || '').join('');
                      if (text.trim()) results.push(text.trim());
                    } else if (Array.isArray(node)) {
                      for (const item of node) {
                        results = results.concat(parseParagraphs(item));
                      }
                    } else {
                      for (const val of Object.values(node)) {
                        results = results.concat(parseParagraphs(val));
                      }
                    }
                  }
                  return results;
                };
                ps = parseParagraphs(content);
              } else if (typeof content === 'string') {
                // HTML content
                const tempDoc = new DOMParser().parseFromString(content, 'text/html');
                ps = Array.from(tempDoc.querySelectorAll('p')).map(p => p.textContent.trim()).filter(Boolean);
                if (ps.length === 0) {
                  ps = content.split('\n').map(p => p.trim()).filter(Boolean);
                }
              }
              debug.push(`RanobeLib parse success, extracted ${ps.length} paragraphs`);
              return { paragraphs: ps };
            } else {
              throw new Error("Không có nội dung data.content trong body text");
            }
          } catch (err) {
            debug.push(`Lỗi parse RanobeLib JSON: ${err.message}`);
            return null;
          }
        }

        if (t === 'ocr') {
          const logs = [];
          const loadScript = (src) => new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) return resolve();
            const s    = document.createElement('script');
            s.src      = src;
            s.onload   = resolve;
            s.onerror  = () => reject(new Error("Failed to load: " + src));
            document.head.appendChild(s);
          });
          const withTimeout = (promise, ms, label) => {
            let tid;
            const tp = new Promise((_, rej) => {
              tid = setTimeout(() => rej(new Error(`[Timeout ${ms}ms] ${label}`)), ms);
            });
            return Promise.race([promise, tp]).finally(() => clearTimeout(tid));
          };
          try {
            logs.push("1. Tải html2canvas...");
            await withTimeout(loadScript(scriptUrl), 10000, "Load html2canvas");
            logs.push("2. Chờ font chữ render xong...");
            await document.fonts.ready;
            await new Promise(r => setTimeout(r, 500));
            logs.push("-> Fonts sẵn sàng!");
            
            // Xóa phần review rác và quảng cáo trước khi đưa vào ocr
            if (removeArr && removeArr.length) {
              const toRemove = removeArr.join(",");
              logs.push(`-> Xóa rác với selector: ${toRemove}`);
              container.querySelectorAll(toRemove).forEach(e => e.remove());
            }

            // Chọn các phần tử p làm dòng/đoạn
            let ps = Array.from(container.querySelectorAll("p")).filter(p => p.textContent.trim().length > 0);
            if (ps.length === 0) {
              // Fallback 1: Lấy các div lá chứa text
              ps = Array.from(container.querySelectorAll("div")).filter(d => !d.querySelector("p, div") && d.textContent.trim().length > 0);
            }
            if (ps.length === 0) {
              // Fallback 2: Lấy toàn bộ container
              ps = [container];
            }

            logs.push(`-> Tìm thấy ${ps.length} phần tử để OCR.`);

            // Hàm đệ quy xóa khoảng trắng (space và full-width space) trong text nodes để tránh Tesseract ảo giác
            function removeSpaces(node) {
              if (node.nodeType === 3) { // Text node
                node.nodeValue = node.nodeValue.replace(/[ \u3000\t\n]/g, '');
              } else {
                node.childNodes.forEach(removeSpaces);
              }
            }

            // Chuẩn hóa giao diện từng đoạn để Tesseract nhận dạng tốt nhất
            ps.forEach(el => {
              removeSpaces(el);
              el.style.lineHeight = '1.5';
              el.style.padding = '15px'; // Tạo viền trắng dày xung quanh chữ
              el.style.marginBottom = '40px'; // Cô lập hoàn toàn với đoạn dưới
              el.style.marginTop = '0';
              el.style.backgroundColor = '#ffffff';
              el.style.color = '#000000';
              el.style.borderRadius = '0';
              el.style.border = 'none';
            });

            // Thay vì render từng thẻ p (làm treo trình duyệt do html2canvas parse DOM nhiều lần),
            // ta chụp toàn bộ container 1 lần duy nhất, sau đó cắt ảnh dựa trên tọa độ.
            logs.push("3. Chụp ảnh toàn bộ nội dung container...");
            const scale = 2;
            const bigCanvas = await withTimeout(
              html2canvas(container, {
                scale: scale, useCORS: true, allowTaint: true,
                logging: false, backgroundColor: '#ffffff',
              }),
              30000, "html2canvas render container"
            );

            logs.push("4. Tiến hành cắt ảnh theo từng phần tử...");
            const dataUrls = [];
            const containerRect = container.getBoundingClientRect();

            for (let i = 0; i < ps.length; i++) {
              const p = ps[i];
              const rect = p.getBoundingClientRect();

              // Tính toán tọa độ tương đối so với container
              const x = (rect.left - containerRect.left) * scale;
              const y = (rect.top - containerRect.top) * scale;
              const width = rect.width * scale;
              const height = rect.height * scale;

              if (width <= 0 || height <= 0) continue;

              const pCanvas = document.createElement("canvas");
              pCanvas.width = width;
              pCanvas.height = height;
              const ctx = pCanvas.getContext("2d");
              
              // Fill nền trắng trước khi vẽ
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, width, height);
              // Copy mảng ảnh tương ứng từ bigCanvas sang
              ctx.drawImage(bigCanvas, x, y, width, height, 0, 0, width, height);
              
              dataUrls.push(pCanvas.toDataURL('image/png'));
            }

            logs.push(`-> Đã chụp và cắt xong ${dataUrls.length} ảnh phần tử.`);
            debug.push(...logs);
            return { paragraphs: [], dataUrls, logs, needOCR: true };
          } catch (err) {
            logs.push(`LỖI: ${err.message}`);
            debug.push(...logs);
            return { paragraphs: [`[LỖI] ${err.message}`], dataUrl: null, logs };
          }
        }

        return null;
      }

      // ── Try main selector(s) ─────────────────────────────────────────────
      let res = null;
      for (const sel of selector.split('|').map(s => s.trim())) {
        try {
          res = await extract(sel, type);
          if (res) { res.debug = debug; return res; }
        } catch (e) {
          debug.push(`[Lỗi] extract '${sel}': ${e.message}`);
        }
      }

      // ── Try fallbacks ────────────────────────────────────────────────────
      for (const fb of fallbacks) {
        debug.push(`fallback → type:${fb.type} sel:${fb.selector}`);
        for (const sel of fb.selector.split('|').map(s => s.trim())) {
          try {
            res = await extract(sel, fb.type);
            if (res) { res.debug = debug; return res; }
          } catch (e) {
             debug.push(`[Lỗi fallback] extract '${sel}': ${e.message}`);
          }
        }
      }

      debug.push("Không tìm thấy nội dung");
      return { paragraphs: [], debug };
    }
  });

  return result;
}

// ─── Tab helpers ──────────────────────────────────────────────────────────────

/**
 * Chờ selector xuất hiện trong tab, đồng thời bắt window.alert.
 */
async function waitForContentInTab(tabId, selector, maxRetries = 120, interval = 500) {
  for (let i = 0; i < maxRetries; i++) {
    try {
        const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        world:  "MAIN",
        args:   [selector],
        func: (sel) => {
          if (!window._silentAlertMsgInit) {
            window._silentAlertMsg     = null;
            window.alert               = (msg) => { window._silentAlertMsg = msg; };
            window._silentAlertMsgInit = true;
          }
          const validSel = sel.split('|').join(',');
          return { ok: !!document.querySelector(validSel), alertMsg: window._silentAlertMsg };
        }
      });
      if (result.alertMsg) return { ok: false, alertMsg: result.alertMsg };
      if (result.ok)       return { ok: true,  alertMsg: null };
    } catch { /* tab chưa load */ }
    await new Promise(r => setTimeout(r, interval));
  }
  return { ok: false, alertMsg: null };
}

/**
 * Mở tab → chờ readySelector → inject scrapeFunc(…args) → đóng tab → trả kết quả.
 */
async function openTabAndScrape(url, readySelector, scrapeFunc, scrapeArgs = [], pollCount = 20) {
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    for (let i = 0; i < pollCount; i++) {
      try {
        const [{ result: n }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world:  "MAIN",
          args:   [readySelector],
          func:   (sel) => document.querySelectorAll(sel.split('|').join(',')).length
        });
        if (n > 0) break;
      } catch { /* tab chưa load */ }
      await new Promise(r => setTimeout(r, 500));
    }
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world:  "MAIN",
      args:   scrapeArgs,
      func:   scrapeFunc
    });
    return result;
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

async function saveState(url, preview, chapters) {
  await chrome.storage.local.set({
    lastState: { url, preview, chapters, timestamp: Date.now() }
  });
}

async function clearState() {
  await chrome.storage.local.remove("lastState");
}

// ─── Rendering helpers ────────────────────────────────────────────────────────

function renderProgressBar(pct) {
  return `
    <div style="height:6px;background:#e0e0e0;border-radius:3px;overflow:hidden;margin-top:4px;">
      <div style="height:100%;width:${pct}%;background:#1a73e8;transition:width 0.3s;border-radius:3px;"></div>
    </div>`;
}
