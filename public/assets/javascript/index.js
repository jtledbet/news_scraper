
$(document).ready(function() {
    $(document).on("click", "scraper-btn", goScrape);
});

function goScrape () {
// Scrape data from one site and place it into the mongodb db
$.get("/scrape", function(req, res) {
    // Make a request for the 'javascript' subreddit
    var scrapeURL = "https://old.reddit.com/r/javascript/";
    request(scrapeURL, function(error, response, body) {
      // Load the html body from request into cheerio
  
      var $ = cheerio.load(body);
      // Get each element with a "title" class
      $(".title").each(function(i, element) {
        // Get text for title and link:
        var title = $(element).children("a").text();
        var link = $(element).children("a").attr("href");
  
        // If this found element had both a title and a link
        if (title && link) {
          // Insert the data in the articles db
          db.articles.insert({
            title: title,
            link: link,
            sourceURL: scrapeURL
          },
          function(err, data) {
            if (err) {
              // Log potential error
              console.log(err);
            }
            else {
              // Otherwise, log the data
              console.log(data);
            }
          });
        }
      });
    });
  
    res.send("scraped! check the db");
  });
}