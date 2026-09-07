export {};
let cleanup = () => {};
function initArticle() {
  cleanup();
  const article = document.querySelector<HTMLElement>("#article");
  if (!article) return;
  const controller = new AbortController();
  const { signal } = controller;
  let frame = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const headings = [...article.querySelectorAll<HTMLElement>("h2[id], h3[id]")];
  const links = [
    ...document.querySelectorAll<HTMLAnchorElement>("[data-toc-link]"),
  ];
  const progress = document.querySelector<HTMLElement>(
    "[data-reading-progress]"
  );
  const update = () => {
    frame = 0;
    const rect = article.getBoundingClientRect();
    const value = Math.max(
      0,
      Math.min(1, -rect.top / Math.max(1, rect.height - innerHeight))
    );
    if (progress) progress.style.transform = `scaleX(${value})`;
    let current = headings[0]?.id;
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top > 150) break;
      current = heading.id;
    }
    for (const link of links) {
      if (decodeURIComponent(link.hash.slice(1)) === current)
        link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener("scroll", schedule, { passive: true, signal });
  window.addEventListener("resize", schedule, { passive: true, signal });
  const resize = new ResizeObserver(schedule);
  resize.observe(article);
  update();
  for (const heading of article.querySelectorAll(
    "h2[id], h3[id], h4[id], h5[id], h6[id]"
  )) {
    if (heading.querySelector(".heading-link")) continue;
    const link = document.createElement("a");
    link.className = "heading-link";
    link.href = `#${heading.id}`;
    link.textContent = "#";
    link.ariaLabel = `链接到 ${heading.textContent}`;
    heading.append(link);
  }
  for (const block of article.querySelectorAll<HTMLElement>(
    "pre:not(.mermaid)"
  )) {
    block.querySelector(".copy-code")?.remove();
    const button = document.createElement("button");
    button.className = "copy-code";
    button.textContent = "复制";
    button.ariaLabel = "复制代码";
    block.tabIndex = 0;
    block.append(button);
    button.addEventListener(
      "click",
      async () => {
        try {
          await navigator.clipboard.writeText(
            block.querySelector("code")?.textContent ?? ""
          );
          if (signal.aborted) return;
          button.textContent = "已复制";
        } catch {
          button.textContent = "复制失败，请手动选择";
        }
        if (signal.aborted) return;
        const timer = setTimeout(() => {
          button.textContent = "复制";
          timers.delete(timer);
        }, 1600);
        timers.add(timer);
      },
      { signal }
    );
  }
  const dialog = document.createElement("dialog");
  dialog.className = "image-zoom";
  dialog.ariaLabel = "查看文章图片";
  const close = document.createElement("button");
  close.textContent = "关闭 ×";
  close.ariaLabel = "关闭图片";
  const preview = document.createElement("img");
  dialog.append(close, preview);
  document.body.append(dialog);
  close.addEventListener("click", () => dialog.close(), { signal });
  dialog.addEventListener(
    "click",
    event => {
      if (event.target === dialog) dialog.close();
    },
    { signal }
  );
  const zoomButtons: HTMLButtonElement[] = [];
  for (const img of article.querySelectorAll<HTMLImageElement>("img")) {
    if (img.closest("a")) continue;
    const button = document.createElement("button");
    button.className = "image-zoom-trigger";
    button.ariaLabel = `放大图片：${img.alt || "文章插图"}`;
    img.before(button);
    button.append(img);
    zoomButtons.push(button);
    button.addEventListener(
      "click",
      () => {
        preview.src = img.currentSrc || img.src;
        preview.alt = img.alt;
        dialog.showModal();
      },
      { signal }
    );
  }
  cleanup = () => {
    controller.abort();
    cancelAnimationFrame(frame);
    resize.disconnect();
    timers.forEach(timer => clearTimeout(timer));
    dialog.close();
    dialog.remove();
    zoomButtons.forEach(button => button.replaceWith(...button.childNodes));
  };
}
document.addEventListener("astro:page-load", initArticle);
document.addEventListener("astro:before-swap", () => cleanup());
