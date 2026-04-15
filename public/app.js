
// Grab the articles as a json and render them on the page
$.getJSON("/articles", function (data) {
  for (var i = data.length - 1; i > 0; i--) {
    var article = data[i];
    var meta = "";
    if (article.score) meta += "<span class='meta'>▲ " + article.score + "</span> ";
    if (article.by)    meta += "<span class='meta'>by " + article.by + "</span>";
    var domain = new URL(article.link).hostname.replace(/^www\./, "");
    var linkify = "<a class='articlelink' href='" + article.link + "' target='_blank' title='" + article.link + "'>" + domain + "</a>";
    $("#articles").append(
      "<p class='articleitem' data-id='" + article._id + "'>" +
        article.title + " " + meta +
        "<br><span class='thelink'>" + linkify + "</span>" +
      "</p>"
    );
  }
});

// When you click the Scrape button
$(document).on("click", "#scrape-btn", function () {
  $.ajax({
    method: "GET",
    url: "/scrape",
  }).done(function () {
    window.location.reload();
  });
});

// When you click the Clear button
$(document).on("click", "#clear-btn", function () {
  $("#articles").empty();
});

// When you click the Different Sub button
$(document).on("click", "#switch-btn", function () {
  bootbox.prompt("Enter a category (top, new, best, ask, show):", function (result) {
    if (result) {
      $.ajax({
        method: "GET",
        url: "/scrape/" + result
      }).done(function () {
        window.location = "/";
      });
    }
  });
});

// Whenever someone clicks a p tag
$(document).on("click", "p", function () {
  // Clear the note section
  $("#notes").empty();
  $("#notes-hint").remove();
  // Save the id from the p tag
  var thisId = $(this).attr("data-id");

  // Now make an ajax call for the Article
  $.ajax({
    method: "GET",
    url: "/articles/" + thisId
  })
    // With that done, add the note information to the page
    .then(function (data) {
      $("#notes").append("<h2 id='noteheader'> Leave a note! </h2><hr>");
      // The title of the article
      $("#notes").append("<h3 id='notetitle'>" + data.title + "</h3><hr>");
      // An input to enter a new title
      $("#notes").append("<input id='titleinput' name='title' placeholder='Note title...'>");
      // A textarea to add a new note body
      $("#notes").append("<textarea id='bodyinput' name='body' placeholder='Note body...'></textarea>");
      // A button to submit a new note, with the id of the article saved to it
      $("#notes").append("<button class='btn' data-id='" + data._id + "' id='savenote'>Save Note</button>");

      // If there's a note in the article, pre-populate the inputs
      if (data.note) {
        $("#titleinput").val(data.note.title);
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
      title: $("#titleinput").val(),
      body: $("#bodyinput").val()
    }
  })
    .then(function () {
      $("#notes").empty();
      $("#notes").append("<p id='notes-hint'>← Click an article to add a note</p>");
    });

  // Also clear the inputs
  $("#titleinput").val("");
  $("#bodyinput").val("");
});
