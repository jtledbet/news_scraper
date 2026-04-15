var showFavoritesOnly = false;
var activeCategory    = "all";
var PRESET_CATEGORIES = ["top", "new", "best", "ask", "show"];

// Clear any leftover custom tabs from localStorage
localStorage.removeItem("hn_custom_categories");

// ─── Articles ────────────────────────────────────────────────────────────────

function loadArticles() {
  var url = "/articles?t=" + Date.now() + (showFavoritesOnly ? "&favorites=true" : "");
  $.getJSON(url, function (data) {
    $("#articles").empty();
    for (var i = data.length - 1; i >= 0; i--) {
      renderArticle(data[i]);
    }
  });
}

function renderArticle(article) {
  var meta = "";
  if (article.score) meta += "<span class='meta'>▲ " + article.score + "</span> ";
  if (article.by)    meta += "<span class='meta'>by " + article.by + "</span>";

  var domain = article.link;
  try { domain = new URL(article.link).hostname.replace(/^www\./, ""); } catch (e) {}

  var linkify   = "<a class='articlelink' href='" + article.link + "' target='_blank' title='" + article.link + "'>" + domain + "</a>";
  var isFav     = article.favorited;
  var starClass = "star-btn" + (isFav ? " favorited" : "");
  var starChar  = isFav ? "★" : "☆";
  var pClass    = "articleitem" + (isFav ? " favorited-article" : "");

  $("#articles").append(
    "<p class='" + pClass + "' data-id='" + article._id + "' title='Click to add or edit a note for this article'>" +
      "<span class='" + starClass + "' data-id='" + article._id + "' title='Star this article'>" + starChar + "</span>" +
      article.title + " " + meta +
      "<br><span class='thelink'>" + linkify + "</span>" +
    "</p>"
  );
}

// ─── Categories ───────────────────────────────────────────────────────────────

function addCategoryButton(cat) {
  var label = cat.charAt(0).toUpperCase() + cat.slice(1);
  var desc   = {
    top:  "Top stories on Hacker News right now",
    new:  "The newest submissions to Hacker News",
    best: "Highest-rated stories of all time",
    ask:  "Ask HN — questions posed to the community",
    show: "Show HN — projects people are sharing"
  }[cat] || "Fetch '" + cat + "' stories from Hacker News";

  var btn = $("<button>")
    .addClass("btn cat-btn")
    .text(label)
    .attr("title", desc)
    .attr("data-category", cat);
  $("#category-buttons").append(btn);
}

function initCategories() {
  var allBtn = $("<button>")
    .addClass("btn cat-btn active")
    .text("All")
    .attr("title", "Show all fetched stories")
    .attr("data-category", "all");
  $("#category-buttons").append(allBtn);

  PRESET_CATEGORIES.forEach(addCategoryButton);
}

// ─── Init ────────────────────────────────────────────────────────────────────

loadArticles();
initCategories();

// ─── Event handlers ───────────────────────────────────────────────────────────

// Populate button
$(document).on("click", "#scrape-btn", function () {
  $.ajax({ method: "GET", url: "/scrape" })
    .done(function () {
      setTimeout(loadArticles, 1500);
    })
    .fail(function (xhr) {
      var msg = (xhr.responseJSON && xhr.responseJSON.error) || "Could not reach the database.";
      bootbox.alert("<strong>Database unavailable</strong><br>" + msg);
    });
});

// Clear button
$(document).on("click", "#clear-btn", function () {
  $("#articles").empty();
});

// Favorites filter toggle
$(document).on("click", "#favorites-btn", function () {
  showFavoritesOnly = !showFavoritesOnly;
  $(this).toggleClass("active-nav", showFavoritesOnly);
  loadArticles();
});

// Category button click — clears search, loads feed articles
$(document).on("click", ".cat-btn", function () {
  var cat = $(this).data("category");
  activeCategory = cat;
  $(".cat-btn").removeClass("active");
  $(this).addClass("active");
  clearSearch();

  if (cat === "all") {
    loadArticles();
    return;
  }

  $.ajax({ method: "GET", url: "/scrape/" + cat })
    .done(function () {
      setTimeout(loadArticles, 1500);
    })
    .fail(function (xhr) {
      var msg = (xhr.responseJSON && xhr.responseJSON.error) || "Could not reach the database.";
      bootbox.alert("<strong>Database unavailable</strong><br>" + msg);
    });
});

// Search
function clearSearch() {
  $("#search-input").val("");
  $("#search-label").empty();
}

function runSearch() {
  var query = $("#search-input").val().trim();
  if (!query) return;

  $.ajax({ method: "GET", url: "/search", data: { query: query, type: activeCategory } })
    .done(function (results) {
      $("#articles").empty();
      $("#search-label").html(
        "Search results for <strong>\"" + query + "\"</strong>" +
        (activeCategory !== "all" ? " in <strong>" + activeCategory + "</strong>" : "") +
        " <a id='clear-search' href='#' title='Return to feed view'>✕ clear</a>"
      );
      if (!results.length) {
        $("#articles").append("<p style='color:#aaa'>No results found.</p>");
        return;
      }
      results.forEach(renderArticle);
    })
    .fail(function () {
      bootbox.alert("Search failed. Try again.");
    });
}

$(document).on("click", "#search-submit", runSearch);
$(document).on("keypress", "#search-input", function (e) {
  if (e.which === 13) runSearch();
});
$(document).on("click", "#clear-search", function (e) {
  e.preventDefault();
  clearSearch();
  loadArticles();
});



// Star button — toggle favorite
$(document).on("click", ".star-btn", function (e) {
  e.stopPropagation();
  var id   = $(this).data("id");
  var star = $(this);

  $.ajax({ method: "PUT", url: "/articles/" + id + "/favorite" })
    .then(function (data) {
      star.toggleClass("favorited", data.favorited);
      star.text(data.favorited ? "★" : "☆");
      star.closest("p").toggleClass("favorited-article", data.favorited);
      if (showFavoritesOnly && !data.favorited) {
        star.closest("p").remove();
      }
    });
});

// Article click — open notes panel
$(document).on("click", "p.articleitem", function () {
  $("p.articleitem").removeClass("selected-article");
  $(this).addClass("selected-article");
  $("#notes").empty();
  var thisId = $(this).attr("data-id");

  $.ajax({ method: "GET", url: "/articles/" + thisId })
    .then(function (data) {
      $("#notes").append("<h2 id='noteheader'>Leave a note!</h2><hr>");
      $("#notes").append("<h3 id='notetitle'>" + data.title + "</h3><hr>");
      $("#notes").append("<input id='titleinput' name='title' placeholder='Note title...'>");
      $("#notes").append("<textarea id='bodyinput' name='body' placeholder='Note body...'></textarea>");
      $("#notes").append("<button class='btn' data-id='" + data._id + "' id='savenote' title='Save this note to the database'>Save Note</button>");

      if (data.note) {
        $("#titleinput").val(data.note.title);
        $("#bodyinput").val(data.note.body);
      }
    });
});

// Save note
$(document).on("click", "#savenote", function () {
  var thisId = $(this).attr("data-id");

  $.ajax({
    method: "POST",
    url: "/articles/" + thisId,
    data: {
      title: $("#titleinput").val(),
      body:  $("#bodyinput").val()
    }
  }).then(function () {
    $("#notes").empty();
  });

  $("#titleinput").val("");
  $("#bodyinput").val("");
});
