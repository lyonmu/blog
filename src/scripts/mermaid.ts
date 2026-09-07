export {};
let cleanup = () => {};
let queue = Promise.resolve();
function initMermaid() {
  cleanup();
  const diagrams = [
    ...document.querySelectorAll<HTMLElement>("#article .mermaid"),
  ];
  if (!diagrams.length) return;
  let active = true;
  for (const diagram of diagrams)
    diagram.dataset.mermaidSource ??= diagram.textContent ?? "";
  const render = () => {
    queue = queue
      .then(async () => {
        if (!active) return;
        const { default: mermaid } = await import("mermaid");
        if (!active) return;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme:
            document.documentElement.dataset.theme === "dark"
              ? "dark"
              : "default",
        });
        for (const diagram of diagrams) {
          diagram.textContent = diagram.dataset.mermaidSource ?? "";
          diagram.removeAttribute("data-processed");
        }
        try {
          await mermaid.run({ nodes: diagrams, suppressErrors: true });
        } catch {
          for (const diagram of diagrams)
            diagram.textContent = diagram.dataset.mermaidSource ?? "";
        }
      })
      .catch(() => {
        /* Keep the source readable if the optional renderer cannot load. */
      });
  };
  const observer = new MutationObserver(render);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  cleanup = () => {
    active = false;
    observer.disconnect();
  };
  render();
}
document.addEventListener("astro:page-load", initMermaid);
document.addEventListener("astro:before-swap", () => cleanup());
