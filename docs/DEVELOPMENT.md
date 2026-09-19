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
