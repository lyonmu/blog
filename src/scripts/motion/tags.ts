import { animate, stagger, type JSAnimation } from "animejs";

let cleanup = () => {};
function initTags() {
  cleanup();
  const field = document.querySelector<HTMLElement>("[data-tag-field]");
  if (!field) return;
  const nodes = [
    ...field.querySelectorAll<HTMLAnchorElement>("[data-tag-node]"),
  ];
  const dots = nodes.map(node => node.querySelector<HTMLElement>(".tag-dot")!);
  const name = document.querySelector<HTMLElement>("[data-tag-name]");
  const count = document.querySelector<HTMLElement>("[data-tag-count]");
  const replay = document.querySelector<HTMLButtonElement>("[data-tag-wave]");
  const controller = new AbortController();
  const { signal } = controller;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let animation: JSAnimation | undefined;
  let visible = false;
  const wave = (from: number | "center" = "center") => {
    animation?.revert();
    if (reduced.matches || !dots.length || document.hidden || !visible) return;
    const matrix = field.querySelector<HTMLElement>(".tag-matrix")!;
    const columns =
      getComputedStyle(matrix).gridTemplateColumns.split(" ").length;
    animation = animate(dots, {
      scale: [
        { to: 1.65, duration: 300 },
        { to: 1, duration: 650 },
      ],
      opacity: [
        { to: 1, duration: 300 },
        { to: 0.65, duration: 650 },
      ],
      delay: stagger(65, {
        grid: [columns, Math.ceil(dots.length / columns)],
        from,
      }),
      ease: "inOutQuad",
    });
  };
  nodes.forEach((node, index) => {
    const select = () => {
      if (name) name.textContent = node.dataset.name ?? "";
      if (count)
        count.textContent = `${node.dataset.count} 篇文章 · 点击阅读 ↗`;
      wave(index);
    };
    node.addEventListener(
      "pointerenter",
      event => {
        if (event.pointerType !== "touch") select();
      },
      { signal }
    );
    node.addEventListener("focus", select, { signal });
  });
  const observer = new IntersectionObserver(
    entries => {
      visible = entries[0]?.isIntersecting ?? false;
      if (visible) wave();
      else animation?.revert();
    },
    { threshold: 0.15 }
  );
  observer.observe(field);
  const preference = () => {
    if (replay) replay.hidden = reduced.matches || !nodes.length;
    if (reduced.matches) animation?.revert();
  };
  preference();
  reduced.addEventListener("change", preference, { signal });
  replay?.addEventListener("click", () => wave(), { signal });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) animation?.pause();
      else if (visible && !reduced.matches) animation?.resume();
    },
    { signal }
  );
  cleanup = () => {
    controller.abort();
    observer.disconnect();
    animation?.revert();
  };
}
document.addEventListener("astro:page-load", initTags);
document.addEventListener("astro:before-swap", () => cleanup());
