# Website Documentation Import — Architecture & Setup

Import online documentation from whitelisted sites into the AI Tutor platform.  
A **Cloudflare Worker** acts as a CORS proxy, and the **React frontend** handles crawling, Markdown conversion, and upload.

---

## Architecture

```
Mentor → Paste URL → React Frontend → Cloudflare Worker (CORS Proxy)
                                           ↓
                                    Target Documentation Website
                                           ↓
                                        HTML Response
                                           ↓
                            React Frontend (DOMParser → Readability → Turndown)
                                           ↓
                                   Markdown (merged)
                                           ↓
                              POST /api/materials/import
                                           ↓
                            Backend (chunking + embedding)
```

---

## Folder Structure

```
ai-tutor-frontend/
├── worker/                                    # Cloudflare Worker project
│   ├── package.json
│   ├── wrangler.toml
│   └── src/
│       └── index.js                           # CORS proxy handler
│
├── src/
│   ├── config/
│   │   └── env.js                             # VITE_CORS_PROXY_URL config
│   │
│   ├── services/websiteImport/
│   │   ├── proxyApi.js                        # fetchViaProxy() — calls worker
│   │   ├── crawler.js                         # Domain-specific crawler classes
│   │   ├── markdown.js                        # HTML → Markdown conversion
│   │   ├── extractor.js                       # Single-page extraction
│   │   └── upload.js                          # POST /api/materials/import
│   │
│   ├── hooks/
│   │   ├── useCrawler.js                      # Full import workflow hook
│   │   └── useDocumentationCrawler.js         # Backward-compat re-export
│   │
│   └── components/importWebsite/
│       ├── ImportWebsiteModal.jsx              # Main import dialog
│       ├── DocumentationTree.jsx              # Checkable tree with search
│       └── ProgressDialog.jsx                 # Step-by-step progress
│
├── .env.local                                 # VITE_CORS_PROXY_URL=...
└── package.json
```

---

## Crawler Class Hierarchy

```
WebsiteCrawler (base)
├── OracleCrawler           → docs.oracle.com
├── MDNCrawler              → developer.mozilla.org
├── MicrosoftLearnCrawler   → learn.microsoft.com
├── SpringCrawler           → spring.io / docs.spring.io
├── PythonDocsCrawler       → docs.python.org
├── KubernetesCrawler       → kubernetes.io
├── GitBookCrawler          → GitBook-based sites
└── GenericCrawler          → fallback for any whitelisted domain
```

Each crawler overrides:
- `getTocContainers(doc)` — domain-specific TOC/nav selectors
- `isInScope(candidate, startUrl)` — scope filtering rules
- `getPages(doc, startUrl, scopePrefix)` — TOC extraction logic

---

## Installation

### 1. Frontend (existing project)

The frontend already has the required dependencies (`@mozilla/readability`, `turndown`, `markdown-it`, `antd`).

No new packages need to be installed.

### 2. Cloudflare Worker

```bash
cd ai-tutor-frontend/worker
npm install
```

---

## Development

### Run the Worker locally

```bash
cd ai-tutor-frontend/worker
npm run dev
# → Listening on http://localhost:8787
```

### Test the Worker

```bash
# Health check
curl http://localhost:8787/

# Proxy request
curl "http://localhost:8787/proxy?url=https://docs.oracle.com/javase/specs/jvms/se8/html/index.html"

# Blocked domain (should return 403)
curl "http://localhost:8787/proxy?url=https://evil.com"
```

### Run the Frontend

```bash
cd ai-tutor-frontend
npm run dev
```

Make sure `.env.local` contains:

```env
VITE_CORS_PROXY_URL=http://localhost:8787
```

---

## Deployment

### Deploy Worker to Cloudflare

1. Set your `account_id` in `worker/wrangler.toml`
2. Run:

```bash
cd ai-tutor-frontend/worker
npm run deploy
```

3. Update `.env.local` (or your production env):

```env
VITE_CORS_PROXY_URL=https://docs-cors-proxy.<your-subdomain>.workers.dev
```

---

## Whitelisted Domains

The worker only allows requests to these domains:

| Domain | Documentation Type |
|---|---|
| `docs.oracle.com` | Java specs (JVM, JLS, etc.) |
| `developer.mozilla.org` | MDN Web Docs |
| `learn.microsoft.com` | Microsoft Learn |
| `spring.io` / `docs.spring.io` | Spring Framework |
| `docs.python.org` | Python official docs |
| `kubernetes.io` | Kubernetes documentation |

### Adding a new domain

1. **Worker**: Add the hostname to `ALLOWED_HOSTS` in `worker/src/index.js`
2. **Frontend**: Optionally create a new crawler class in `src/services/websiteImport/crawler.js` and register it in `CRAWLER_MAP`

---

## Upload API

The frontend uploads merged Markdown to:

```
POST /api/materials/import

Content-Type: application/json

{
  "courseId": "string",
  "title": "string",
  "sourceUrl": "string",
  "markdown": "string"
}
```

The backend is responsible for:
- Text chunking
- Embedding generation
- Storage

---

## Workflow Summary

1. **Mentor** pastes a documentation URL
2. **Analyze** — Frontend calls Worker → Worker fetches index page → Returns HTML → Frontend parses TOC → Displays tree
3. **Select chapters** — Mentor checks/unchecks pages, uses search/expand/collapse
4. **Import Selected** — For each selected page:
   - Fetch via proxy
   - Extract content (Readability)
   - Convert to Markdown (Turndown)
5. **Merge** all pages into one Markdown document
6. **Upload** to `POST /api/materials/import`
