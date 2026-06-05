# Repository Guidelines

## Project Structure & Module Organization

This is an Astro personal blog. Route files live in `src/pages`, shared UI lives in `src/components`, layouts live in `src/layouts`, and global styling is in `src/styles`. Blog posts are Markdown or MDX files under `src/data/blog`; gallery entries use dated folders under `src/data/galleries/<date>/` with an `index.md` plus media assets. Utility functions are in `src/utils`, site-level settings are in `src/config.ts` and `src/constants.ts`, and static public assets belong in `public`.

## Build, Test, and Development Commands

Use Bun for local commands because this repository includes `bun.lock`.

- `bun install`: install dependencies.
- `bun run dev`: start the Astro development server.
- `bun run build`: run `astro check`, build the site, then generate Pagefind search data in `dist`.
- `bun run preview`: serve the built site locally.
- `bun run lint`: run ESLint for TypeScript, JavaScript, and Astro files.
- `bun run format:check`: verify Prettier formatting.
- `bun run format`: apply Prettier formatting.

## Coding Style & Naming Conventions

Use 2-space indentation, semicolons, double quotes, LF line endings, and an 80-column Prettier target. Astro files are formatted with `prettier-plugin-astro`; Tailwind classes are sorted by `prettier-plugin-tailwindcss`. Avoid `console` calls because ESLint treats them as errors. Name Astro components in PascalCase, utilities in descriptive camelCase, and content folders by date where that is already the project pattern.

## Content Guidelines

Blog frontmatter must satisfy `src/content.config.ts`: include `title`, `pubDatetime`, `description`, and `tags`; use `draft: false` when ready to publish. Gallery entries require `title`, `description`, and `pubDatetime`, and may include `coverImage` and `tags`. Keep post filenames readable and stable because they affect generated routes.

## Testing Guidelines

There is no separate unit test suite in this repository. Treat `bun run build` as the primary regression check because it validates Astro types, content schemas, production output, and search indexing. Run `bun run lint` and `bun run format:check` before submitting changes.

## Commit & Pull Request Guidelines

Recent commits use short Conventional Commit-style prefixes such as `feat:` and `fix:`; keep that style and write the subject in English or Chinese as appropriate for the change. For pull requests, include a concise description, note any content or route changes, link related issues when available, and add screenshots for visible UI changes.
