# news_scraper — Copilot Instructions

## Overview

**HN Reader** — A full-stack Hacker News article browser that fetches stories from HN Firebase API, stores them in MongoDB, and provides search (via Algolia), favorites, reading tracker, and per-article notes. Deployed to Railway.

**Live:** https://newsscraper-production-7c8c.up.railway.app/

## Quick Start

```bash
npm install
cp .env.example .env    # Set MONGODB_URI and PORT if needed
npm start               # http://localhost:3030
npm run watch           # nodemon auto-restart on save (dev)
```

No tests or linting defined.

## Architecture

### All Routes in One File
- `server.js` — Express app + all route handlers (no separate router files)
- Single entry point makes logic easy to trace

### Data Model
```
models/
  ├── article.js        (Mongoose schema)
  ├── note.js           (Mongoose schema)
  └── index.js          (exports { Article, Note })
```

**Article schema:** `title`, `link` (unique index), `score`, `by`, `time`, `commentCount`, `hnId`, `favorited` (Boolean), `note` (ref to Note)

**Note schema:** `title`, `body`

### Data Sources (Two APIs)
1. **HN Firebase API** (`https://hacker-news.firebaseio.com/v0`)
   - Fetches article IDs from: `/topstories`, `/newstories`, `/beststories`, `/askstories`, `/showstories`
   - Fetches article details from: `/item/<id>`
   - Results **are persisted** to MongoDB via `goFetch(type)`

2. **Algolia HN Search API** (`https://hn.algolia.com/api/v1`)
   - Powers full-text search (`/search` route) — results NOT persisted
   - Powers time-filtered Best stories (`/best?period=week|month|year`) — results NOT persisted
   - Used for live query results, not DB ops

**Key convention:** Only direct HN Firebase scrapes are saved to DB; Algolia results are ephemeral.

### Frontend (`public/app.js`)

**Key state variables:**
- `showFavoritesOnly` — filter toggle
- `hideReadArticles` — filter toggle
- `activeCategory` — current tab (Top/New/Best/Ask/Show)
- `currentSearchQuery` — active search term

**Client-side storage:**
- `localStorage['hn_read_articles']` — array of read article IDs (capped at 2000)
- `localStorage['hn_saved_searches']` — array of saved search tabs

**Event handling:** jQuery delegated event handlers on `document` for all interactivity (tabs, search, favorites, reading tracker, notes modal).

### Key Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Render main page |
| GET | `/scrape` | Fetch top stories → save to DB |
| GET | `/scrape/:type` | Fetch by type: `top`, `new`, `best`, `ask`, `show` |
| GET | `/best?period=` | Time-filtered best via Algolia (`week`, `month`, `year`) — NOT saved |
| GET | `/search?query=&type=` | Full-text search via Algolia — NOT saved |
| GET | `/articles` | All saved articles (`?favorites=true` to filter) |
| GET | `/articles/:id` | Single article with note populated |
| POST | `/articles/:id` | Save/update a note on an article |
| PUT | `/articles/:id/favorite` | Toggle favorited status |

## Environment Variables

| Variable | Default | Notes |
|----------|---------|-------|
| `MONGODB_URI` | `mongodb://localhost/news_scraper` | MongoDB connection string |
| `PORT` | `3030` | HTTP port |
| `NODE_ENV` | — | Set to `production` for deployed instance |

**Local dev:** Defaults work if MongoDB is running on localhost. Create `.env` only if you need custom values.

**Railway deployment:** `MONGODB_URI` is set to the internal Railway MongoDB URL by the platform.

## Features & Behavior

### Tabs
Click **Top**, **New**, **Best**, **Ask**, **Show** to fetch and display articles from each HN feed.

### Best Time-Period Filter
On the Best tab, **Best ▾** dropdown filters to Past Week/Month/Year via Algolia (live query, not saved).

### Search
Type in the **Search** box → queries Algolia full-text index (not saved to DB). Results filtered by active category.

### Saved Search Tabs
Click **+ Save as tab** to pin a search query as a persistent tab (stored in localStorage).

### Favorites
Click **★ Favorites** in nav to show only starred articles. Click star icon on article to toggle favorited status (updates DB).

### Reading Tracker
- **Click** an article → opens in new tab + dims it (marked as read in localStorage)
- **Right-click** an article → toggles read state (useful if you click by accident)
- **Hide Read** button → filters out read articles from view

### Per-Article Notes
Hover an article → click 📝 icon → modal opens. Enter title + body → saves to MongoDB (creates/updates Note, linked to Article).

## Database

### Mongoose Schemas
- Schemas use Mongoose defaults (no explicit indexing except `link` uniqueness on Article)
- No explicit validation errors — relies on Mongoose schema type coercion

### Connection
- Defined implicitly via `mongoose.connect(process.env.MONGODB_URI)`
- Error handling: If MongoDB is unreachable, scrape/write routes return 503 with error message; read-only routes still work

## Common Tasks

### Add a new HN feed type
1. Update `server.js` `/scrape/:type` route to handle new type (e.g., `jobs`)
2. Add new tab button in `views/index.handlebars`
3. Update `public/app.js` to handle new category in state + rendering logic

### Change localStorage limits
- `hn_read_articles` capped at 2000 IDs — update cap in `public/app.js` if needed
- `hn_saved_searches` has no cap by default

### Modify Article/Note schema
1. Update `models/article.js` or `models/note.js`
2. Update route handlers in `server.js` that use those fields
3. Update `views/index.handlebars` to display new fields (if UI-visible)
4. Update `public/app.js` if new client-side rendering needed

### Debug Algolia vs. DB queries
- Algolia calls: check route handlers that call `axios.get('https://hn.algolia.com/...')`
- DB calls: check Mongoose operations (`.find()`, `.findById()`, etc.) in route handlers

## Deployment (Railway)

1. Create Railway project with MongoDB plugin
2. Connect GitHub repo, set `MONGODB_URI` to internal Railway MongoDB URL
3. Railway auto-runs `npm install` + `npm start`
4. App scales gracefully (503 on DB failure, reads still work if only writes fail)
