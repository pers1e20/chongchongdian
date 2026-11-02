/* ============================================================
   nav-active.js —— 依 body[data-page] 高亮底部导航（唯一高亮机制）
   ============================================================ */
(function () {
  var page = document.body.dataset.page || "";
  document.querySelectorAll(".tabbar__item").forEach(function (a) {
    if (a.getAttribute("data-nav") === page) a.classList.add("active");
  });
})();