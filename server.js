var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");

// Our scraping tools
// Axios is a promised-based http library, similar to jQuery's Ajax method
// It works on the client and on the server
var axios = require("axios");
var cheerio = require("cheerio");

// Require all models
var db = require("./models");

const PORT = process.env.PORT || 3030;

// Initialize Express
var app = express();

// Set Handlebars.
var exphbs = require("express-handlebars");
// Configure handlebars
app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

// Use morgan logger for logging requests
app.use(logger("dev"));
// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded());

app.use(bodyParser.json());
// Use express.static to serve the public folder as a static directory
app.use(express.static("public"));

// By default mongoose uses callbacks for async queries, we're setting it to use promises (.then syntax) instead
// Connect to the Mongo DB
mongoose.Promise = Promise;
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/news_scraper";
mongoose.connect(MONGODB_URI);


// Routes
app.get("/", function (req, res) {
  res.render("index");
});

// Scrape data from one site and place it into the mongodb db
app.get("/scrape", function (req, res) {
  // Make a request for the 'javascript' subreddit
  var scrapeURL = "https://old.reddit.com/r/javascript";

  goScrape(scrapeURL);

  console.log("scraped /r/javascript! \ncheck the db...");
});

// Scrape data from a different site and place it into the mongodb db
app.get("/scrape/:sub", function (req, res) {
  var sub = req.params.sub;
  // Make a request for the variable subreddit
  if (!sub) sub = "javascript"
  var scrapeURL = "https://old.reddit.com/r/" + sub;
  
  goScrape(scrapeURL);

  console.log("scraped " + sub + "! " + "check the db...");
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


// Start the server
app.listen(PORT, function () {
  console.log("App running on port " + PORT + "!");
});

// module.exports = goScrape;

function goScrape(scrapeURL) {
  axios.get(scrapeURL).then(function (response) {

    // Load the html body from request into cheerio
    var $ = cheerio.load(response.data);

    // Get each element with a "title" class
    $(".title").each(function (i, element) {
      // Save an empty result object
      var result = {};
      // Get text for title and link:

      var title = $(element).children("a").text();
      var link = $(element).children("a").attr("href");
      var summary = $(element).children("p").text();

      result.title = title;
      result.link = link;
      result.summary = summary;
      
      // Create a new Article using the `result` object built from scraping
      db.Article.create(result)
        .then(function (dbArticle) {
          // View the added result in the console
          console.log(dbArticle);
        })
        .catch(function (err) {
          // If an error occurred, log it
          console.log(err);
        });
    });
  });
}