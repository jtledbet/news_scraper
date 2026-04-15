var showFavoritesOnly  = false;
var activeCategory     = "all";
var currentSearchQuery = null;
var PRESET_CATEGORIES  = ["top", "new", "best", "ask", "show"];
var SAVED_TABS_KEY     = "hn_saved_searches";

// Clear legacy custom tab key if present
localStorage.removeItem("hn_custom_categories");

// ─── Utilities ───────────────────────────────────────────────────────────────

function timeAgo(unix) {
  if (!unix) return "";
  var s = Math.floor(Date.now() / 1000 - unix);
  if (s < 60)   return "just now";
  var m = Math.floor(s / 60);
  if (m < 60)   return m + "m ago";
  var h = Math.floor(m / 60);
  if (h < 24)   return h + "h ago";
  var d = Math.floor(h / 24);
  if (d < 30)   return d + "d ago";
  return Math.floor(d / 30) + "mo ago";
}

function getSavedTabs() {
  return JSON.parse(localStorage.getItem(SAVED_TABS_KEY) || "[]");
}

function saveTabs(tabs) {
  localStorage.setItem(SAVED_TABS_KEY, JSON.stringify(tabs));
}

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
  if (article.by)    meta += "<span class='meta'>by " + article.by + "</span> ";
  if (article.time)  meta += "<span class='meta'>" + timeAgo(article.time) + "</span>";

  var domain = article.link;
  try { domain = new URL(article.link).hostname.replace(/^www\./, ""); } catch (e) {}

  var linkify = "<a class='articlelink' href='" + article.link + "' target='_blank' title='" + article.link + "'>" + domain + "</a>";

  var comments = "";
  if (article.hnId) {
    var count = article.commentCount != null ? article.commentCount : "?";
    comments = " <a class='commentlink' href='https://news.ycombinator.com/item?id=" + article.hnId + "' target='_blank' title='Open discussion on Hacker News'>💬 " + count + "</a>";
  }

  var isFav     = article.favorited;
  var starClass = "star-btn" + (isFav ? " favorited" : "");
  var starChar  = isFav ? "★" : "☆";
  var pClass    = "articleitem" + (isFav ? " favorited-article" : "");

  $("#articles").append(
    "<p class='" + pClass + "' data-id='" + article._id + "' title='Click to add or edit a note'>" +
      "<span class='" + starClass + "' data-id='" + article._id + "' title='Star this article'>" + starChar + "</span>" +
      article.title + " " + meta +
      "<br><span class='thelink'>" + linkify + comments + "</span>" +
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

  if (cat === "best") {
    var group = $("<div>").addClass("btn-group best-dropdown");
    var mainBtn = $("<button>")
      .addClass("btn cat-btn")
      .text(label)
      .attr("title", desc)
      .attr("data-category", "best");
    var caretBtn = $("<button>")
      .addClass("btn cat-btn dropdown-toggle")
      .attr("data-toggle", "dropdown")
      .attr("title", "Filter best stories by time period")
      .html("<span class='caret'></span>");
    var menu = $("<ul>").addClass("dropdown-menu");
    [["week", "Past Week"], ["month", "Past Month"], ["year", "Past Year"]].forEach(function (p) {
      menu.append($("<li>").append(
        $("<a>").attr("href", "#").attr("data-best-period", p[0]).text(p[1])
      ));
    });
    group.append(mainBtn).append(caretBtn).append(menu);
    $("#category-buttons").append(group);
    return;
  }

  var btn = $("<button>")
    .addClass("btn cat-btn")
    .text(label)
    .attr("title", desc)
    .attr("data-category", cat);
  $("#category-buttons").append(btn);
}

function addSavedTabButton(query) {
  var btn = $("<span>").addClass("saved-tab");
  var label = $("<button>")
    .addClass("btn cat-btn saved-cat-btn")
    .text("🔍 " + query)
    .attr("title", "Saved search: " + query)
    .attr("data-search", query);
  var remove = $("<span>")
    .addClass("saved-tab-remove")
    .attr("title", "Remove this saved tab")
    .attr("data-search", query)
    .text("×");
  btn.append(label).append(remove);
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

  getSavedTabs().forEach(addSavedTabButton);
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

// Best stories — time-filtered dropdown
$(document).on("click", "[data-best-period]", function (e) {
  e.preventDefault();
  var period = $(this).data("best-period");
  var label  = $(this).text();
  $(".cat-btn, .saved-cat-btn").removeClass("active");
  $(".cat-btn[data-category='best']").addClass("active");
  clearSearch();

  $.ajax({ method: "GET", url: "/best", data: { period: period } })
    .done(function (results) {
      $("#articles").empty();
      $("#search-label").html(
        "Best stories: <strong>" + label + "</strong>" +
        " <a id='clear-search' href='#' title='Return to feed view'>✕ clear</a>"
      );
      if (!results.length) {
        $("#articles").append("<p style='color:#aaa'>No results found.</p>");
        return;
      }
      results.forEach(renderArticle);
    })
    .fail(function () {
      bootbox.alert("Could not fetch best stories. Try again.");
    });
});

// Search
function clearSearch() {
  currentSearchQuery = null;
  $("#search-input").val("");
  $("#search-label").empty();
  $("#save-tab-btn").hide();
  $(".saved-cat-btn, .cat-btn").removeClass("active");
  $(".cat-btn[data-category='" + activeCategory + "']").addClass("active");
}

function runSearch(query) {
  query = query || $("#search-input").val().trim();
  if (!query) return;
  currentSearchQuery = query;

  $.ajax({ method: "GET", url: "/search", data: { query: query, type: activeCategory } })
    .done(function (results) {
      $("#articles").empty();
      var alreadySaved = getSavedTabs().includes(query);
      $("#search-label").html(
        "Search results for <strong>\"" + query + "\"</strong>" +
        (activeCategory !== "all" ? " in <strong>" + activeCategory + "</strong>" : "") +
        " <a id='clear-search' href='#' title='Return to feed view'>✕ clear</a>"
      );
      $("#save-tab-btn").toggle(!alreadySaved);
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

$(document).on("click", "#search-submit", function () { runSearch(); });
$(document).on("keypress", "#search-input", function (e) {
  if (e.which === 13) runSearch();
});
$(document).on("click", "#clear-search", function (e) {
  e.preventDefault();
  clearSearch();
  loadArticles();
});

// Save current search as a tab
$(document).on("click", "#save-tab-btn", function () {
  if (!currentSearchQuery) return;
  var tabs = getSavedTabs();
  if (!tabs.includes(currentSearchQuery)) {
    tabs.push(currentSearchQuery);
    saveTabs(tabs);
    addSavedTabButton(currentSearchQuery);
  }
  $("#save-tab-btn").hide();
});

// Saved tab click — run that search
$(document).on("click", ".saved-cat-btn", function () {
  var query = $(this).data("search");
  $(".cat-btn, .saved-cat-btn").removeClass("active");
  $(this).addClass("active");
  $("#search-input").val(query);
  runSearch(query);
});

// Remove saved tab
$(document).on("click", ".saved-tab-remove", function (e) {
  e.stopPropagation();
  var query = $(this).data("search");
  var tabs  = getSavedTabs().filter(function (t) { return t !== query; });
  saveTabs(tabs);
  $(this).closest(".saved-tab").remove();
  if (currentSearchQuery === query) {
    clearSearch();
    loadArticles();
  }
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

// Article click — open note modal
$(document).on("click", "p.articleitem", function () {
  $("p.articleitem").removeClass("selected-article");
  $(this).addClass("selected-article");

  var thisId = $(this).attr("data-id");

  $.ajax({ method: "GET", url: "/articles/" + thisId })
    .then(function (data) {
      $("#modal-article-title").text(data.title);
      $("#savenote").attr("data-id", data._id);
      $("#titleinput").val(data.note ? data.note.title : "");
      $("#bodyinput").val(data.note ? data.note.body : "");
      $("#note-modal").modal("show");
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
    $("#note-modal").modal("hide");
    $("#titleinput").val("");
    $("#bodyinput").val("");
  });
});
