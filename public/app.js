var showFavoritesOnly = false;
var PRESET_CATEGORIES = ["top", "new", "best", "ask", "show"];
var LS_KEY = "hn_custom_categories";

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

function getCustomCategories() {
  return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
}

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
  var all = PRESET_CATEGORIES.concat(getCustomCategories());
  all.forEach(addCategoryButton);
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

// Category button click
$(document).on("click", ".cat-btn", function () {
  var cat = $(this).data("category");
  $(".cat-btn").removeClass("active");
  $(this).addClass("active");

  $.ajax({ method: "GET", url: "/scrape/" + cat })
    .done(function () {
      setTimeout(loadArticles, 1500);
    })
    .fail(function (xhr) {
      var msg = (xhr.responseJSON && xhr.responseJSON.error) || "Could not reach the database.";
      bootbox.alert("<strong>Database unavailable</strong><br>" + msg);
    });
});

// Add custom category
$(document).on("click", "#category-submit", function () {
  var val = $("#category-input").val().trim().toLowerCase();
  if (!val) return;

  var custom = getCustomCategories();
  if (!PRESET_CATEGORIES.includes(val) && !custom.includes(val)) {
    custom.push(val);
    localStorage.setItem(LS_KEY, JSON.stringify(custom));
    addCategoryButton(val);
  }
  $("#category-input").val("");
});

$(document).on("keypress", "#category-input", function (e) {
  if (e.which === 13) $("#category-submit").click();
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
    $("#notes").append("<p id='notes-hint'>← Click an article to add a note</p>");
  });

  $("#titleinput").val("");
  $("#bodyinput").val("");
});
