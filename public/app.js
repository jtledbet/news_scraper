
// Grab the articles as a json
$.getJSON("/articles", function (data) {
  // For each article:
  // for (var i = 0; i < data.length; i++) {
  for (var i = data.length - 1; i > 0; i--) {
    var linkify = ("<a class='articlelink' href=" + data[i].link + ">" + data[i].link + "</a>");
    // console.log("index:", i, "linkify:", linkify);
    console.log(data[i].summary);
    $("#articles").append("<p class='articleitem' data-id='" + data[i]._id + "'>" + data[i].title + "<br><span id='thelink'>" + linkify + "</span></p>");
  }
});

// When you click the Scrape button
$(document).on("click", "#scrape-btn", function () {
  $.ajax({
    method: "GET",
    url: "/scrape",
  }).done(function (data) {
    console.log(data);
    res.render("index");
    window.location = "/articles";
    document.location.reload();
  });
});

// When you click the Clear button
$(document).on("click", "#clear-btn", function () {
  $("#articles").empty();
});

// When you click the Different Sub button
$(document).on("click", "#switch-btn", function () {

  bootbox.prompt("Enter a subreddit to scrape:", function (result) {
    console.log("new sub:", result);

    $.ajax({
      method: "GET",
      url: "/scrape/" + result
    }).done(function (data) {
      console.log(data);
      res.render("index");
      window.location = "/"
      document.location.reload();
    });
  });
});

// Whenever someone clicks a p tag
$(document).on("click", "p", function () {
  // Empty the notes from the note section
  $("#notes").empty();
  // Save the id from the p tag
  var thisId = $(this).attr("data-id");

  // Now make an ajax call for the Article
  $.ajax({
    method: "GET",
    url: "/articles/" + thisId
  })
    // With that done, add the note information to the page
    .then(function (data) {
      console.log(data);
      $("#notes").append("<h2 id='noteheader'> Leave a note! </h3><hr>");
      // The title of the article
      $("#notes").append("<h3 id='notetitle'>" + data.title + "</h3><hr>");
      // An input to enter a new title
      $("#notes").append("<input id='titleinput' name='title' placeholder='Note title...'>");
      // A textarea to add a new note body
      $("#notes").append("<textarea id='bodyinput' name='body' placeholder='Note body...'></textarea>");
      // A button to submit a new note, with the id of the article saved to it
      $("#notes").append("<button class='btn' data-id='" + data._id + "' id='savenote'>Save Note</button>");

      // If there's a note in the article
      if (data.note) {
        // Place the title of the note in the title input
        $("#titleinput").val(data.note.title);
        // Place the body of the note in the body textarea
        $("#bodyinput").val(data.note.body);
      }
    });
});

// When you click the savenote button
$(document).on("click", "#savenote", function () {
  // Grab the id associated with the article from the submit button
  var thisId = $(this).attr("data-id");

  // Run a POST request to change the note, using what's entered in the inputs
  $.ajax({
    method: "POST",
    url: "/articles/" + thisId,
    data: {
      // Value taken from title input
      title: $("#titleinput").val(),
      // Value taken from note textarea
      body: $("#bodyinput").val()
    }
  })
    // With that done
    .then(function (data) {
      // Log the response
      console.log(data);
      // Empty the notes section
      $("#notes").empty();
    });

  // Also, remove the values entered in the input and textarea for note entry
  $("#titleinput").val("");
  $("#bodyinput").val("");
});