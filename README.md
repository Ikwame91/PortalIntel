# Site Scope

Site Scope turns a public webpage into a structured intelligence report for graduate-program research.

## What it does

- Renders pages with Playwright Chromium when available, with a static HTTP fallback.
- Simulates scrolling to expose lazy-loaded content.
- Removes common navigation, footer, header, sidebar, form, script, and style boilerplate before text analysis.
- Resolves relative URLs and categorizes application portals, official documents, faculty/contact pages, financial-aid links, and internal subpages.
- Extracts an admissions dossier with deadlines, GRE and English-testing signals, GPA, recommendation letters, application fees, fee waivers, funding signals, and contacts.
- Supports Quick Scan for the current page and Deep Scan for up to five relevant first-hop subpages.
- Exports the resulting dossier as Markdown or CSV.

## Run locally

```bash
npm install
npx playwright install chromium
npm run dev
```

Open `http://localhost:5173`. The API runs on port 3001 and Vite proxies `/api` requests to it.

The extraction is intentionally deterministic and source-grounded. It does not claim to be an LLM-generated answer. A future LLM adapter can consume the normalized `dossier` and `link_directory` payload without changing the scraping boundary.