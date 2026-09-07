import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const searchPage = await readFile("src/pages/search.astro", "utf8");
const postDetails = await readFile("src/layouts/PostDetails.astro", "utf8");
const layout = await readFile("src/layouts/Layout.astro", "utf8");
const themeScript = await readFile("src/scripts/theme.ts", "utf8");
const mermaidScript = await readFile("src/scripts/mermaid.ts", "utf8");

// Astro now bundles search as a module. It runs before astro:page-load and
// imports Pagefind locally instead of the former classic-script injection
// and window.PagefindUI global. Check the new module boundary,
// then exercise the actual script rather than its old initialization spelling.
const searchScript = searchPage.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(searchScript, "search must use an Astro-processed script");
assert.match(layout, /<ClientRouter\s*\/>/, "Astro owns page-load ordering");
assert.match(
  layout,
  /<script src="\.\.\/scripts\/mermaid\.ts"><\/script>/,
  "the shared layout must load Mermaid on every route"
);
assert.doesNotMatch(
  postDetails,
  /import\(["']mermaid["']\)|renderMermaid|initMermaid/,
  "post details must not register a second Mermaid renderer"
);
assert.match(layout, /const initialColorScheme = "light"/);
assert.match(themeScript, /const initialColorScheme = "light"/);

function execute(source, globals) {
  const code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const events = new Map();
  const context = vm.createContext({
    exports: {},
    ...globals,
    document: {
      ...globals.document,
      addEventListener(name, listener) {
        const listeners = events.get(name) ?? [];
        listeners.push(listener);
        events.set(name, listeners);
      },
    },
  });
  vm.runInContext(code, context);
  return {
    context,
    emit: name => Promise.all((events.get(name) ?? []).map(fn => fn())),
  };
}

function searchHarness({ failImport = false } = {}) {
  const instances = [];
  let container = { textContent: "" };
  const location = new URL("https://example.com/search/?q=Envoy");
  const storage = new Map();
  const app = execute(searchScript, {
    URL,
    URLSearchParams,
    get location() {
      return location;
    },
    // Search only reads location during construction and term processing.
    location,
    history: {
      state: {},
      replaceState(_state, _title, url) {
        location.href = new URL(url).href;
      },
    },
    sessionStorage: { setItem: (key, value) => storage.set(key, value) },
    document: { querySelector: () => container },
    require(name) {
      assert.equal(
        name,
        "@pagefind/default-ui",
        "search must load the bundled Pagefind UI"
      );
      if (failImport) throw new Error("Network unavailable");
      return {
        PagefindUI: class {
          constructor(options) {
            this.options = options;
            this.destroyed = false;
            instances.push(this);
          }
          triggerSearch(query) {
            this.query = query;
          }
          destroy() {
            this.destroyed = true;
          }
        },
      };
    },
  });
  return {
    ...app,
    instances,
    storage,
    get container() {
      return container;
    },
    removeContainer() {
      container = null;
    },
  };
}

// Direct entry and subsequent Astro navigation both initialize a working search.
{
  const app = searchHarness();
  await app.emit("astro:page-load");
  assert.equal(app.instances.length, 1);
  const first = app.instances[0];
  assert.equal(first.query, "Envoy", "query-string searches must be restored");
  first.options.processTerm("Redis");
  assert.equal(app.storage.get("backUrl"), "/search/?q=Redis");
  first.options.processTerm("");
  assert.equal(app.storage.get("backUrl"), "/search/");
  await app.emit("astro:before-swap");
  assert.equal(
    first.destroyed,
    true,
    "navigation must destroy the old Pagefind instance"
  );
  await app.emit("astro:page-load");
  assert.equal(app.instances.length, 2);
  assert.equal(app.instances.filter(instance => !instance.destroyed).length, 1);
}

// Repeated page-load events during the async import may not create duplicate UIs.
{
  const app = searchHarness();
  await Promise.all([app.emit("astro:page-load"), app.emit("astro:page-load")]);
  assert.equal(
    app.instances.length,
    1,
    "only the latest pending initialization may mount"
  );
}
{
  const app = searchHarness();
  const pending = app.emit("astro:page-load");
  await app.emit("astro:before-swap");
  app.removeContainer();
  await pending;
  assert.equal(
    app.instances.length,
    0,
    "a stale import must not mount after navigation"
  );
  await app.emit("astro:page-load");
  assert.equal(
    app.instances.length,
    0,
    "non-search pages must not mount Pagefind"
  );
}
{
  const app = searchHarness({ failImport: true });
  await app.emit("astro:page-load");
  assert.equal(app.container.textContent, "搜索暂时无法加载，请刷新重试。");
}

function mermaidHarness() {
  const source = "graph TD; A-->B";
  const diagram = {
    dataset: {},
    textContent: source,
    processed: true,
    removeAttribute(name) {
      assert.equal(name, "data-processed");
      this.processed = false;
    },
  };
  const observers = [];
  const themes = [];
  let runs = 0;
  let diagrams = [diagram];
  const root = { dataset: { theme: "light" } };
  const app = execute(mermaidScript, {
    document: { documentElement: root, querySelectorAll: () => diagrams },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        observers.push(this);
      }
      observe(target, options) {
        assert.equal(target, root);
        assert.equal(options.attributeFilter[0], "data-theme");
      }
      disconnect() {
        this.disconnected = true;
      }
    },
    require(name) {
      assert.equal(name, "mermaid");
      return {
        default: {
          initialize(options) {
            themes.push(options.theme);
            assert.equal(options.securityLevel, "strict");
          },
          async run({ nodes }) {
            for (const node of nodes) {
              assert.equal(
                node.textContent,
                source,
                "rerenders must restore original Mermaid source"
              );
              assert.equal(
                node.processed,
                false,
                "rerenders must reset processed state"
              );
              node.textContent = "<svg>rendered</svg>";
              node.processed = true;
            }
            runs++;
          },
        },
      };
    },
  });
  return {
    ...app,
    diagram,
    observers,
    themes,
    root,
    get runs() {
      return runs;
    },
    removeDiagrams() {
      diagrams = [];
    },
    flush: () => vm.runInContext("queue", app.context),
  };
}
{
  const app = mermaidHarness();
  await app.emit("astro:page-load");
  await app.flush();
  assert.equal(app.runs, 1);
  assert.equal(app.diagram.dataset.mermaidSource, "graph TD; A-->B");
  app.root.dataset.theme = "dark";
  app.observers[0].callback();
  await app.flush();
  assert.deepEqual(app.themes, ["default", "dark"]);
  await app.emit("astro:before-swap");
  assert.equal(app.observers[0].disconnected, true);
  await app.emit("astro:page-load");
  await app.flush();
  assert.equal(
    app.runs,
    3,
    "return navigation must rerender from saved source"
  );
  await app.emit("astro:before-swap");
  app.removeDiagrams();
  await app.emit("astro:page-load");
  await app.flush();
  assert.equal(app.runs, 3, "pages without diagrams must not invoke Mermaid");
}
{
  const app = mermaidHarness();
  const pending = app.emit("astro:page-load");
  await app.emit("astro:before-swap");
  await pending;
  await app.flush();
  assert.equal(
    app.runs,
    0,
    "stale async Mermaid work must not render after navigation"
  );
}
