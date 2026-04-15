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
mongoose.connect(MONGODB_URI);


// Routes
app.get("/", function (req, res) {
  res.render("index");
});

// Fetch top HN stories (default)
app.get("/scrape", function (req, res) {
  goFetch("top");
  res.json({ message: "Fetching top Hacker News stories — refresh in a moment." });
});

// Fetch a specific HN category: top, new, best, ask, show
app.get("/scrape/:type", function (req, res) {
  var type = req.params.type;
  var valid = ["top", "new", "best", "ask", "show"];
  if (!valid.includes(type)) {
    return res.status(400).json({ error: "Invalid type. Use: top, new, best, ask, show" });
  }
  goFetch(type);
  res.json({ message: "Fetching " + type + " Hacker News stories — refresh in a moment." });
});


// Route for getting all Articles from the db
app.get("/articles", function (req, res) {
  // Grab every document in the Articles collection
  db.Article.find({})
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
          title: story.title,
          link: story.url,
          score: story.score,
          by: story.by
        }).catch(function (err) {
          if (err.code !== 11000) console.error("DB error:", err.message);
        });
      });
    })
    .catch(function (err) {
      console.error("HN API error:", err.message);
    });
}