import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const searchPage = await readFile("src/pages/search.astro", "utf8");
const postDetails = await readFile("src/layouts/PostDetails.astro", "utf8");
const layout = await readFile("src/layouts/Layout.astro", "utf8");
const themeScript = await readFile("src/scripts/theme.ts", "utf8");

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
  searchPage,
  /dataset\.pagefindInitializing/,
  "search page should lock while Pagefind initialization is pending"
);

assert.match(
  layout,
  /mermaidSource/,
  "global layout script should keep Mermaid source for repeat renders after client navigation"
);

assert.match(
  layout,
  /removeAttribute\("data-processed"\)/,
  "global layout script should clear Mermaid processed state before rerendering"
);

assert.match(
  layout,
  /document\.addEventListener\("astro:page-load", renderMermaid\)/,
  "global layout script should render Mermaid after Astro client navigation"
);

assert.doesNotMatch(
  postDetails,
  /document\.addEventListener\("astro:page-load", renderMermaid\)/,
  "post layout should not own Mermaid page-load rendering because it is skipped on client navigation"
);

assert.match(
  layout,
  /const initialColorScheme = "light"/,
  "inline theme bootstrap should default to light mode"
);

assert.match(
  themeScript,
  /const initialColorScheme = "light"/,
  "theme script should default to light mode"
);
