const WORKER_COUNT = 10;
const workerPool = [];
const taskQueue = [];
let poolInitialized = false;
let initPromise = null;

async function createSingleWorker(index) {
  console.log(`[Offscreen] Khởi tạo Tesseract Worker #${index}...`);
  const worker = await window.Tesseract.createWorker('chi_sim', 1, {
    workerPath: chrome.runtime.getURL('tesseract/worker.min.js'),
    langPath: chrome.runtime.getURL('tesseract'),
    corePath: chrome.runtime.getURL('tesseract/tesseract-core.wasm.js'),
    workerBlobURL: false,
    gzip: false,
    cacheMethod: 'none',
    logger: m => {
      if (m.progress > 0 && m.progress < 1) {
        // Quiet details to avoid spamming the console
        // console.log(`[OCR Worker #${index}] ${m.status}: ${Math.round(m.progress * 100)}%`);
      }
    }
  });
  console.log(`[Offscreen] Tesseract Worker #${index} sẵn sàng!`);
  return worker;
}

async function initPool() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log(`[Offscreen] Bắt đầu khởi tạo pool gồm ${WORKER_COUNT} workers...`);
    const promises = [];
    for (let i = 0; i < WORKER_COUNT; i++) {
      promises.push((async () => {
        try {
          const w = await createSingleWorker(i);
          workerPool.push({ id: i, worker: w, busy: false });
        } catch (err) {
          console.error(`[Offscreen] Lỗi khởi tạo worker #${i}:`, err);
        }
      })());
    }
    await Promise.all(promises);
    poolInitialized = true;
    console.log(`[Offscreen] Khởi tạo pool hoàn tất. Số worker hoạt động: ${workerPool.length}`);
  })();

  return initPromise;
}

// Khởi động pool ngay khi Offscreen Document được tạo ra (pre-warm)
initPool().catch(e => console.error("[Offscreen] Pre-warm pool lỗi:", e));

function processQueue() {
  if (taskQueue.length === 0) return;

  const idleWorkerInfo = workerPool.find(w => !w.busy);
  if (!idleWorkerInfo) return; // Không có worker nào rảnh

  const task = taskQueue.shift();
  idleWorkerInfo.busy = true;

  (async () => {
    try {
      const ret = await idleWorkerInfo.worker.recognize(task.dataUrl);
      task.resolve({ success: true, text: ret.data.text || "" });
    } catch (err) {
      console.error(`[Offscreen LỖI ở Worker #${idleWorkerInfo.id}]`, err);
      // Recreate worker if crashed
      try {
        await idleWorkerInfo.worker.terminate();
      } catch (e) { }
      try {
        idleWorkerInfo.worker = await createSingleWorker(idleWorkerInfo.id);
      } catch (recreateErr) {
        console.error(`[Offscreen] Không thể khởi tạo lại Worker #${idleWorkerInfo.id}:`, recreateErr);
      }
      task.reject(err);
    } finally {
      idleWorkerInfo.busy = false;
      processQueue(); // Tiếp tục xử lý hàng đợi
    }
  })();
}

async function scheduleOCR(dataUrl) {
  await initPool();
  return new Promise((resolve, reject) => {
    taskQueue.push({ dataUrl, resolve, reject });
    processQueue();
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'run_ocr') {
    scheduleOCR(request.dataUrl)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message, stack: err.stack }));
    return true; // Báo Chrome rằng sendResponse sẽ được gọi bất đồng bộ
  }
});
