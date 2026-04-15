# HN Reader

**Live:** https://newsscraper-production-7c8c.up.railway.app/

A full-stack Node/Express app that pulls stories from [Hacker News](https://news.ycombinator.com), stores them in MongoDB, and lets you search, curate, and annotate articles.

---

## Features

- **Category tabs** — fetch Top, New, Best, Ask HN, or Show HN stories from the HN Firebase API
- **Best stories by time** — dropdown on the Best tab filters by Past Week / Month / Year via Algolia
- **Full-text search** — searches HN via Algolia, scoped to the active tab; results are not saved to the DB
- **Saved search tabs** — pin any search as a persistent tab (stored in localStorage)
- **Favorites** — star any article; filter to starred-only with one click
- **Reading tracker** — clicking an article opens it in a new tab and dims it as read; right-click toggles read state; "Hide Read" removes read articles from view
- **Per-article notes** — hover any article and click the 📝 icon to open a modal and save a personal note (title + body) to MongoDB
- **Deduplication** — unique index on `link`; re-scraping the same feed won't create duplicate entries
- **Graceful DB failure** — if MongoDB is unreachable, scrape/write endpoints return a 503 with a clear error; read-only routes still work

---

## Tech Stack

| Layer | Tools |
|-------|-------|
| Backend | Node.js, Express |
| Database | MongoDB + Mongoose |
| Data sources | [HN Firebase API](https://github.com/HackerNews/API) (feed articles), [Algolia HN Search API](https://hn.algolia.com/api) (search + Best-by-period) |
| Templating | Handlebars (`express-handlebars`) |
| Frontend | jQuery, Bootstrap 3, Bootbox |

No Reddit scraping, no Cheerio — all data comes from official APIs.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v14+
- A running MongoDB instance — local (`mongod`) or hosted (Railway, Atlas, etc.)

---

## Installation

```bash
git clone https://github.com/jtledbet/news_scraper.git
cd news_scraper
npm install
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGODB_URI` | `mongodb://localhost/news_scraper` | MongoDB connection string |
| `PORT` | `3030` | HTTP port |

Create a `.env` file in the project root:

```
MONGODB_URI=mongodb://localhost/news_scraper
PORT=3030
```

For Railway/hosted MongoDB, paste the full connection string as `MONGODB_URI`.

---

## Running

```bash
npm start        # node server.js → http://localhost:3030
npm run watch    # nodemon server.js (auto-restart on save)
```

---

## Usage

1. Open `http://localhost:3030`
2. Click **Populate!** to fetch the latest Top stories from HN and save them to your DB
3. Use the category tabs (**Top / New / Best / Ask / Show**) to fetch different feeds
4. Use the **Best ▾** dropdown to filter best stories by time period (Algolia — no DB write)
5. Use the **Search** box to search HN full-text (results are live from Algolia, not saved)
6. Click **+ Save as tab** to pin a search query as a persistent tab
7. **Click any article** to open it in a new tab — it dims to show it's been read
8. **Right-click any article** to toggle its read state (useful if you click by accident)
9. **Hover an article** and click 📝 to write a personal note, saved to MongoDB
10. Click **★ Favorites** in the nav to filter to starred articles only
11. Click **Hide Read** in the nav to hide articles you've already opened

---

## Project Structure

```
server.js                  — Express app, all routes, HN fetch logic
models/
  article.js               — Mongoose schema: title, link, score, by, time,
                             commentCount, hnId, favorited, note (ref)
  note.js                  — Mongoose schema: title, body
  index.js                 — Exports { Article, Note }
views/
  index.handlebars         — Main page template
  layouts/main.handlebars  — Layout wrapper (Bootstrap CSS, global head)
public/
  app.js                   — All client-side logic: rendering, AJAX, state,
                             category tabs, search, favorites, read tracker
  assets/css/style.css     — Dark gradient theme, article interactions
```

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Render main page |
| GET | `/scrape` | Fetch top HN stories → save to DB |
| GET | `/scrape/:type` | Fetch a feed by type: `top`, `new`, `best`, `ask`, `show` |
| GET | `/best?period=` | Time-filtered best stories via Algolia (`week`, `month`, `year`) |
| GET | `/search?query=&type=` | Full-text HN search via Algolia (not saved to DB) |
| GET | `/articles` | Return all saved articles (`?favorites=true` to filter) |
| GET | `/articles/:id` | Return one article with its note populated |
| POST | `/articles/:id` | Save or update a note on an article |
| PUT | `/articles/:id/favorite` | Toggle favorited status |

---

## License

ISC
