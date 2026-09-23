# Development

## Requirements

- Node.js 22+
- npm

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Application areas

- `/` — public website
- `/admin` — private back office (authentication follows in issue #5)
- `/client/:token` — client-portal route reserved for the magic-link flow
- `/api/health` — basic service health endpoint

Do not commit secrets. Add new environment keys to `.env.example` with safe placeholder values.

## Icons

The whole site (public pages and back office) uses [Lucide](https://lucide.dev/icons) through `@nuxt/icon`:

```vue
<Icon name="lucide:calendar-days" aria-hidden="true" />
```

- Icons are bundled with the app (`@iconify-json/lucide`); nothing is loaded from the Iconify CDN.
- Icons size with the surrounding text (`1em`) and use `currentColor`, so style them with `font-size` and `color`.
- Decorative icons get `aria-hidden="true"`. Icon-only buttons need an `aria-label` (and usually a `title`).
- For a button or link that leads with an icon, add the global `with-icon` class to space and align it.
- Use `<IconTimes />` for the "×" in dimensions and multipliers (`1080<IconTimes />1920`).
- Don't use Unicode glyphs or emoji (`▶ ✕ ↗ 🗑`) as icons, and don't put arrows in editable site copy: the templates add them.
- Video motion templates (Remotion) can't use `<Icon>`. They draw Lucide icons from `shared/lucide-icons.ts`, which is also the list users pick from in the editor's `icon` template fields. To offer another icon, add it there with its body copied from `@iconify-json/lucide`; a test checks that the bodies match the package.
