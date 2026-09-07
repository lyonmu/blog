import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile("src/scripts/motion/tags.ts", "utf8");
const events = new Map();
const animations = [];
const origins = [];
const observers = [];
const reduced = {
  matches: false,
  addEventListener(_event, callback) {
    this.change = callback;
  },
};
const nodes = Array.from({ length: 7 }, (_, index) => ({
  dataset: { name: `tag-${index}`, count: String(index + 1) },
  querySelector: () => ({}),
  addEventListener(event, callback) {
    this[event] = callback;
  },
}));
const name = {};
const count = {};
const replay = {
  addEventListener(_event, callback) {
    this.click = callback;
  },
};
const field = { querySelectorAll: () => nodes, querySelector: () => ({}) };
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText,
  {
    exports: {},
    AbortController,
    require: () => ({
      stagger(_delay, options) {
        origins.push(options);
        return 0;
      },
      animate() {
        const animation = {
          revert() {
            this.reverted = true;
          },
          pause() {},
          resume() {},
        };
        animations.push(animation);
        return animation;
      },
    }),
    getComputedStyle: () => ({ gridTemplateColumns: "50px 50px 50px 50px" }),
    matchMedia: () => reduced,
    IntersectionObserver: class {
      constructor(callback) {
        this.callback = callback;
        observers.push(this);
      }
      observe() {}
      disconnect() {
        this.disconnected = true;
      }
    },
    document: {
      hidden: false,
      querySelector: selector =>
        ({
          "[data-tag-field]": field,
          "[data-tag-name]": name,
          "[data-tag-count]": count,
          "[data-tag-wave]": replay,
        })[selector],
      addEventListener: (event, callback) => events.set(event, callback),
    },
  }
);
events.get("astro:page-load")();
const observer = observers[0];
observer.callback([{ isIntersecting: true }]);
assert.equal(origins[0].from, "center");
assert.equal(origins[0].grid.join(","), "4,2");
nodes[2].focus();
assert.equal(name.textContent, "tag-2");
assert.equal(count.textContent, "3 篇文章 · 点击阅读 ↗");
assert.equal(origins[1].from, 2);
assert.equal(animations[0].reverted, true);
reduced.matches = true;
reduced.change();
assert.equal(replay.hidden, true);
nodes[3].focus();
assert.equal(
  animations.length,
  2,
  "reduced motion must suppress new animations"
);
assert.equal(
  name.textContent,
  "tag-3",
  "labels must still update with reduced motion"
);
events.get("astro:before-swap")();
assert.equal(observer.disconnected, true);
assert.equal(animations[1].reverted, true);
