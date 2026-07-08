// scripts/foxaholic-content.js
(function() {
  // Tự động bỏ qua trang trung gian nếu phát hiện đường link trỏ đến chương thực tế
  const entry = document.querySelector(".entry-content_wrap, .text-left, .entry-content");
  if (entry) {
    const a = Array.from(entry.querySelectorAll("a")).find(el => {
      const txt = el.textContent.trim();
      return (txt.startsWith("Chapter") || txt.includes("Click here") || txt.includes("chapter")) && el.href && el.href !== window.location.href;
    });
    if (a) {
      console.log("[Excerpo] Phát hiện trang chuyển tiếp. Đang chuyển hướng sang:", a.href);
      window.location.href = a.href;
    }
  }
})();
