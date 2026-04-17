require("dotenv").config();
var express = require("express");
var logger = require("morgan");
var mongoose = require("mongoose");

// Axios for HTTP requests
var axios = require("axios");

// Require all models
var db = require("./models");

const PORT = process.env.PORT || 3030;

// Initialize Express
var app = express();

// Set Handlebars.
var exphbs = require("express-handlebars");
// Configure handlebars
app.engine("handlebars", exphbs.engine({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

// Middleware
app.use(logger("dev"));
app.use(express.urlencoded({ extended: false }));  // Express 4.16+ has body-parser built in
app.use(express.json());
app.use(express.static("public"));

// Helpers
function validObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function serverError(res, context, err) {
  console.error(context + ":", err && err.message ? err.message : err);
  res.status(500).json({ error: "Server error. Try again." });
}

// By default mongoose uses callbacks for async queries, we're setting it to use promises (.then syntax) instead
mongoose.Promise = Promise;
// Connect to the Mongo DB (heroku-compatible)
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/news_scraper";
var dbConnected = false;

mongoose.connect(MONGODB_URI)
  .then(function () {
    dbConnected = true;
  })
  .catch(function (err) {
    console.error("MongoDB connection failed:", err.message);
    console.error("Set MONGODB_URI in .env or start a local MongoDB instance on port 27017.");
  });

mongoose.connection.on("disconnected", function () {
  dbConnected = false;
  console.error("MongoDB disconnected. Check your MONGODB_URI or local MongoDB service.");
});

mongoose.connection.on("reconnected", function () {
  dbConnected = true;
});

// Routes
app.get("/", function (req, res) {
  res.render("index");
});

var DB_DOWN_MSG = "Database unavailable. Set MONGODB_URI in .env or start a local MongoDB instance.";

// Fetch top HN stories (default)
app.get("/scrape", function (req, res) {
  if (!dbConnected) return res.status(503).json({ error: DB_DOWN_MSG });
  goFetch("top");
  res.json({ message: "Fetching top Hacker News stories — refresh in a moment." });
});

// Fetch a specific HN category: top, new, best, ask, show
app.get("/scrape/:type", function (req, res) {
  if (!dbConnected) return res.status(503).json({ error: DB_DOWN_MSG });
  var type = req.params.type;
  var valid = ["top", "new", "best", "ask", "show"];
  if (!valid.includes(type)) {
    return res.status(400).json({ error: "Invalid type. Use: top, new, best, ask, show" });
  }
  goFetch(type);
  res.json({ message: "Fetching " + type + " Hacker News stories — refresh in a moment." });
});


// Search HN via Algolia — results are not saved to DB
var ALGOLIA_TAG_MAP = {
  all:  "story",
  top:  "front_page",
  new:  "story",
  best: "story",
  ask:  "ask_hn",
  show: "show_hn"
};

// Best stories filtered by time period via Algolia
app.get("/best", function (req, res) {
  var period = req.query.period || "alltime";
  var now    = Math.floor(Date.now() / 1000);
  var since  = { week: now - 604800, month: now - 2592000, year: now - 31536000 }[period];

  if (!since) return res.status(400).json({ error: "Invalid period. Use: week, month, year" });

  axios.get("https://hn.algolia.com/api/v1/search", {
    params: { tags: "story", numericFilters: "points>50,created_at_i>" + since, hitsPerPage: 50 }
  })
  .then(function (response) {
    var results = response.data.hits
      .filter(function (h) { return h.url && h.title; })
      .sort(function (a, b) { return (b.points || 0) - (a.points || 0); })
      .slice(0, 30)
      .map(function (h) {
        return {
          _id:          h.objectID,
          title:        h.title,
          link:         h.url,
          score:        h.points,
          by:           h.author,
          time:         h.created_at_i,
          commentCount: h.num_comments,
          hnId:         h.objectID,
          ephemeral:    true
        };
      });
    res.json(results);
  })
  .catch(function (err) {
    console.error("Best/Algolia error:", err.message);
    res.status(500).json({ error: "Failed to fetch best stories." });
  });
});

app.get("/search", function (req, res) {
  var query = (req.query.query || "").trim();
  var type  = req.query.type || "all";
  if (!query) return res.status(400).json({ error: "No search query provided." });

  var tag      = ALGOLIA_TAG_MAP[type] || "story";
  var endpoint = type === "new"
    ? "https://hn.algolia.com/api/v1/search_by_date"
    : "https://hn.algolia.com/api/v1/search";

  axios.get(endpoint, {
    params: { query: query, tags: tag, hitsPerPage: 30 }
  })
  .then(function (response) {
    var results = response.data.hits
      .filter(function (h) { return h.url && h.title; })
      .map(function (h) {
        return {
          _id:          h.objectID,
          title:        h.title,
          link:         h.url,
          score:        h.points,
          by:           h.author,
          time:         h.created_at_i,
          commentCount: h.num_comments,
          hnId:         h.objectID,
          ephemeral:    true
        };
      });
    res.json(results);
  })
  .catch(function (err) {
    console.error("Algolia search error:", err.message);
    res.status(500).json({ error: "Search failed." });
  });
});

// Toggle an Article's favorited status
app.put("/articles/:id/favorite", function (req, res) {
  if (!validObjectId(req.params.id)) return res.status(400).json({ error: "Invalid article ID." });

  db.Article.findOne({ _id: req.params.id })
    .then(function (article) {
      if (!article) return res.status(404).json({ error: "Article not found." });
      return db.Article.findOneAndUpdate(
        { _id: req.params.id },
        { favorited: !article.favorited },
        { new: true }
      ).then(function (dbArticle) { res.json(dbArticle); });
    })
    .catch(function (err) { serverError(res, "favorite toggle", err); });
});

// Get all Articles (pass ?favorites=true to filter)
app.get("/articles", function (req, res) {
  var query = req.query.favorites === "true" ? { favorited: true } : {};
  db.Article.find(query)
    .then(function (dbArticle) { res.json(dbArticle); })
    .catch(function (err) { serverError(res, "articles list", err); });
});

// Get one Article populated with its Note
app.get("/articles/:id", function (req, res) {
  if (!validObjectId(req.params.id)) return res.status(400).json({ error: "Invalid article ID." });

  db.Article.findOne({ _id: req.params.id })
    .populate("note")
    .then(function (dbArticle) {
      if (!dbArticle) return res.status(404).json({ error: "Article not found." });
      res.json(dbArticle);
    })
    .catch(function (err) { serverError(res, "article fetch", err); });
});

// Save or update an Article's associated Note
app.post("/articles/:id", function (req, res) {
  if (!validObjectId(req.params.id)) return res.status(400).json({ error: "Invalid article ID." });

  var noteBody = {
    title: (req.body.title || "").toString().slice(0, 500),
    body:  (req.body.body  || "").toString().slice(0, 10000)
  };

  db.Note.create(noteBody)
    .then(function (dbNote) {
      return db.Article.findOneAndUpdate(
        { _id: req.params.id },
        { note: dbNote._id },
        { new: true }
      );
    })
    .then(function (dbArticle) {
      if (!dbArticle) return res.status(404).json({ error: "Article not found." });
      res.json(dbArticle);
    })
    .catch(function (err) { serverError(res, "note save", err); });
});

// 404 for unmatched routes (swallow silently on the client, redirect to home)
app.use(function (req, res) {
  if (req.accepts("html")) return res.redirect("/");
  res.status(404).json({ error: "Not found." });
});

// Start the server
app.listen(PORT, function () {
  console.log("App running on port " + PORT + "!");
});

var HN_BASE = "https://hacker-news.firebaseio.com/v0";

function goFetch(type) {
  axios.get(HN_BASE + "/" + type + "stories.json")
    .then(function (response) {
      // Grab the top 30 story IDs
      var ids = response.data.slice(0, 30);
      return Promise.all(ids.map(function (id) {
        return axios.get(HN_BASE + "/item/" + id + ".json");
      }));
    })
    .then(function (responses) {
      responses.forEach(function (response) {
        var story = response.data;
        // Skip stories without a URL (Ask HN, polls, etc.)
        if (!story || !story.title || !story.url) return;

        db.Article.create({
          title:        story.title,
          link:         story.url,
          score:        story.score,
          by:           story.by,
          time:         story.time,
          commentCount: story.descendants,
          hnId:         String(story.id)
        }).catch(function (err) {
          if (err.code !== 11000) console.error("DB error:", err.message);
        });
      });
    })
    .catch(function (err) {
      console.error("HN API error:", err.message);
    });
}