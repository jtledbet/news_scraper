require("dotenv").config();
var express = require("express");
var bodyParser = require("body-parser");
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

// Use morgan logger for logging requests
app.use(logger("dev"));
// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({ extended: false }));

app.use(bodyParser.json());
// Use express.static to serve the public folder as a static directory
app.use(express.static("public"));

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
          hnId:         h.objectID
        };
      });
    res.json(results);
  })
  .catch(function (err) {
    console.error("Algolia search error:", err.message);
    res.status(500).json({ error: "Search failed." });
  });
});

// Route for toggling an Article's favorited status
app.put("/articles/:id/favorite", function (req, res) {
  db.Article.findOne({ _id: req.params.id })
    .then(function (article) {
      return db.Article.findOneAndUpdate(
        { _id: req.params.id },
        { favorited: !article.favorited },
        { new: true }
      );
    })
    .then(function (dbArticle) {
      res.json(dbArticle);
    })
    .catch(function (err) {
      res.json(err);
    });
});

// Route for getting all Articles from the db (pass ?favorites=true to filter)
app.get("/articles", function (req, res) {
  var query = req.query.favorites === "true" ? { favorited: true } : {};
  db.Article.find(query)
    .then(function (dbArticle) {
      // If we were able to successfully find Articles, send them back to the client
      res.json(dbArticle);
    })
    .catch(function (err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function (req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article.findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate("note")
    .then(function (dbArticle) {
      // If we were able to successfully find an Article with the given id, send it back to the client
      res.json(dbArticle);
    })
    .catch(function (err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function (req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note.create(req.body)
    .then(function (dbNote) {
      // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
    })
    .then(function (dbArticle) {
      // If we were able to successfully update an Article, send it back to the client
      res.json(dbArticle);
    })
    .catch(function (err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Universal mismatch redirect
app.all('*', function(req, res) {
  res.redirect("/");
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