import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const searchPage = await readFile("src/pages/search.astro", "utf8");
const postDetails = await readFile("src/layouts/PostDetails.astro", "utf8");

assert.match(
  searchPage,
  /initSearch\(\);\s*<\/script>/,
  "search page should initialize immediately in case astro:page-load already fired"
);

assert.match(
  searchPage,
  /<script is:inline data-cfasync="false">[\s\S]*?function initSearch/,
  "search initialization script should opt out of Cloudflare Rocket Loader"
);

assert.match(
  searchPage,
  /\/pagefind\/pagefind-ui\.js/,
  "search page should load the generated Pagefind UI script directly"
);

assert.match(
  postDetails,
  /mermaidSource/,
  "mermaid diagrams should keep their source for repeat renders after client navigation"
);

assert.match(
  postDetails,
  /removeAttribute\("data-processed"\)/,
  "mermaid render should clear processed state before rerendering"
);
