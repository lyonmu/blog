import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const component = await readFile("src/components/DailyQuote.astro", "utf8");
const script = component.match(/<script>([\s\S]*?)<\/script>/)[1];
const code = ts.transpileModule(script, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness(fetch) {
  const events = new Map();
  const timers = new Map();
  const elements = Array.from({ length: 2 }, () => {
    const content = { textContent: "事情有时不是你想的那样" };
    const origin = {
      textContent: "",
      hidden: true,
      classList: {
        toggle(_name, hidden) {
          origin.hidden = hidden;
        },
      },
    };
    return {
      content,
      origin,
      querySelector: selector =>
        selector === ".quote-content" ? content : origin,
    };
  });
  vm.runInNewContext(code, {
    fetch,
    AbortController,
    document: {
      querySelectorAll: () => elements,
      addEventListener: (name, handler) => events.set(name, handler),
    },
    window: {
      setTimeout: callback => {
        const id = timers.size + 1;
        timers.set(id, callback);
        return id;
      },
      clearTimeout: id => timers.delete(id),
    },
  });
  return { events, timers, elements };
}

test("one request updates both quotes and their attribution", async () => {
  let requests = 0;
  const app = harness(async () => {
    requests++;
    return {
      ok: true,
      json: async () => ({
        hitokoto: "新的随机语句",
        from: "来源",
        from_who: "作者",
      }),
    };
  });
  assert.equal(requests, 0);
  await app.events.get("astro:page-load")();
  assert.equal(requests, 1);
  for (const element of app.elements) {
    assert.equal(element.content.textContent, "新的随机语句");
    assert.equal(element.origin.textContent, " —— 来源 · 作者");
    assert.equal(element.origin.hidden, false);
  }
  assert.equal(app.timers.size, 0);
});

test("HTTP errors and invalid payloads preserve readable fallback", async () => {
  for (const response of [
    { ok: false, status: 503 },
    { ok: true, json: async () => null },
    { ok: true, json: async () => ({ hitokoto: "   " }) },
  ]) {
    const app = harness(async () => response);
    await app.events.get("astro:page-load")();
    assert.equal(app.elements[0].content.textContent, "事情有时不是你想的那样");
    assert.equal(app.elements[0].origin.hidden, true);
    assert.equal(app.timers.size, 0);
  }
});

test("navigation aborts requests and prevents stale response updates", async () => {
  let resolve;
  let signal;
  const app = harness((_url, options) => {
    signal = options.signal;
    return new Promise(done => {
      resolve = done;
    });
  });
  const pending = app.events.get("astro:page-load")();
  app.events.get("astro:before-swap")();
  assert.equal(signal.aborted, true);
  resolve({ ok: true, json: async () => ({ hitokoto: "旧页面响应" }) });
  await pending;
  assert.equal(app.elements[0].content.textContent, "事情有时不是你想的那样");
  assert.equal(app.timers.size, 0);
});

test("timeout aborts a stalled service request", async () => {
  let signal;
  const app = harness((_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(new Error("Aborted")))
    );
  });
  const pending = app.events.get("astro:page-load")();
  [...app.timers.values()][0]();
  await pending;
  assert.equal(signal.aborted, true);
  assert.equal(app.elements[0].content.textContent, "事情有时不是你想的那样");
  assert.equal(app.timers.size, 0);
});
