import { animate, stagger, type JSAnimation } from "animejs";

let cleanup = () => {};
function initMotion() {
  cleanup();
  const controller = new AbortController();
  const { signal } = controller;
  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = matchMedia(
    "(min-width: 768px) and (hover: hover) and (pointer: fine)"
  );
  const animations: JSAnimation[] = [];
  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (!preference.matches)
          animations.push(
            animate(entry.target, {
              opacity: [0, 1],
              y: [16, 0],
              duration: 550,
              ease: "outQuad",
            })
          );
      }
    },
    { threshold: 0.08 }
  );
  cleanup = () => {
    controller.abort();
    observer.disconnect();
    animations.forEach(animation => animation.revert());
    document
      .querySelectorAll<HTMLElement>("[data-magnetic], [data-tilt]")
      .forEach(element => {
        element.style.removeProperty("transform");
        ["--tilt-x", "--tilt-y", "--mouse-x", "--mouse-y"].forEach(key =>
          element.style.removeProperty(key)
        );
      });
  };
  preference.addEventListener("change", initMotion, { signal });
  pointer.addEventListener("change", initMotion, { signal });
  if (document.querySelector('[data-layout="index"]'))
    sessionStorage.setItem("backUrl", "/");
  if (preference.matches) return;
  const hero = document.querySelectorAll("[data-hero]");
  if (hero.length)
    animations.push(
      animate(hero, {
        opacity: [0, 1],
        y: [12, 0],
        delay: stagger(65, { start: 100 }),
        duration: 550,
        ease: "outQuad",
      })
    );
  document
    .querySelectorAll("[data-reveal]")
    .forEach(element => observer.observe(element));
  if (!pointer.matches) return;
  document
    .querySelectorAll<HTMLElement>("[data-tilt], [data-magnetic]")
    .forEach(element => {
      element.addEventListener(
        "pointermove",
        event => {
          const rect = element.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - 0.5;
          const y = (event.clientY - rect.top) / rect.height - 0.5;
          if (element.hasAttribute("data-magnetic")) {
            element.style.transform = `translate(${x * 8}px, ${y * 8}px)`;
          } else {
            element.style.setProperty(
              "--mouse-x",
              `${event.clientX - rect.left}px`
            );
            element.style.setProperty(
              "--mouse-y",
              `${event.clientY - rect.top}px`
            );
            element.style.setProperty("--tilt-x", `${-y * 3}deg`);
            element.style.setProperty("--tilt-y", `${x * 3}deg`);
          }
        },
        { signal }
      );
      element.addEventListener(
        "pointerleave",
        () => {
          element.style.removeProperty("transform");
          element.style.setProperty("--tilt-x", "0deg");
          element.style.setProperty("--tilt-y", "0deg");
        },
        { signal }
      );
    });
}
document.addEventListener("astro:page-load", initMotion);
document.addEventListener("astro:before-swap", () => cleanup());
