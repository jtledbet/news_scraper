# HN Reader

A full-stack Node/Express app that pulls stories from the [Hacker News API](https://github.com/HackerNews/API), stores them in MongoDB, and lets you attach personal notes to any article.

---

## Features

- Scrape any public subreddit (defaults to r/natureisfuckinglit)
- Stores article titles and links in MongoDB — no duplicates saved
- Click any article to open a note panel
- Add and save a personal note (title + body) to any article

---

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** MongoDB + Mongoose
- **Scraping:** Axios, Cheerio
- **Templating:** Handlebars
- **Frontend:** jQuery, Bootstrap 3, Bootbox

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v14+)
- A running [MongoDB](https://www.mongodb.com/) instance (local or hosted)

---

## Installation

```bash
git clone https://github.com/jtledbet/news_scraper.git
cd news_scraper
npm install
```

---

## Environment Variables

The app connects to MongoDB using the `MONGODB_URI` environment variable. If not set, it falls back to `mongodb://localhost/news_scraper`.

Create a `.env` file in the project root if needed:

```
MONGODB_URI=mongodb://localhost/news_scraper
```

The app also respects a `PORT` variable (defaults to `3030`).

---

## Usage

```bash
npm start        # node server.js  →  http://localhost:3030
npm run watch    # nodemon server.js (auto-restart on changes)
```

Once running:

1. Open `http://localhost:3030`
2. Click **Scrape!** to pull the latest posts from r/natureisfuckinglit
3. Click **Scrape a Different Sub** to scrape any subreddit by name
4. Click any article title to open the notes panel on the right
5. Type a note title and body, then click **Save Note**

---

## Project Structure

```
server.js                  — Express app, all routes, scraping logic
models/
  article.js               — Mongoose schema (title, link, note ref)
  note.js                  — Mongoose schema (title, body)
  index.js                 — Exports { Article, Note }
views/
  index.handlebars         — Main page template
  layouts/main.handlebars  — Layout wrapper
public/
  app.js                   — Client-side jQuery (AJAX, DOM updates)
  assets/css/style.css
```

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Render main page |
| GET | `/scrape` | Scrape r/natureisfuckinglit |
| GET | `/scrape/:sub` | Scrape any subreddit |
| GET | `/articles` | Return all saved articles as JSON |
| GET | `/articles/:id` | Return one article with its note |
| POST | `/articles/:id` | Save/update a note on an article |

---

## License

ISC
