var showFavoritesOnly  = false;
var hideReadArticles   = false;
var activeCategory     = "all";
var currentSearchQuery = null;
var PRESET_CATEGORIES  = ["top", "new", "best", "ask", "show"];
var SAVED_TABS_KEY     = "hn_saved_searches";
var READ_KEY           = "hn_read_articles";

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

function getReadSet() {
  return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]"));
}

// Cap the read set so localStorage doesn't bloat forever. Sets preserve
// insertion order, so slice(-MAX) drops the oldest IDs first.
var READ_MAX = 2000;
function persistReadSet(set) {
  var arr = Array.from(set);
  if (arr.length > READ_MAX) arr = arr.slice(-READ_MAX);
  localStorage.setItem(READ_KEY, JSON.stringify(arr));
}

function markRead(id) {
  var set = getReadSet();
  set.add(String(id));
  persistReadSet(set);
}

function unmarkRead(id) {
  var set = getReadSet();
  set.delete(String(id));
  persistReadSet(set);
}

function showLoading(msg) {
  $("#loading-indicator").text(msg || "Loading...").fadeIn(120);
}

function hideLoading() {
  $("#loading-indicator").fadeOut(120);
}

// Escape a string for safe insertion into HTML. Use when building
// .html() strings that include user-controlled data (search queries, etc).
function escapeForLabel(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

// Build article DOM with jQuery — attrs and text() auto-escape, so a title like
// "<img src=x onerror=alert(1)>" stays as literal text instead of becoming HTML.
function renderArticle(article) {
  var isFav  = !!article.favorited;
  var isRead = getReadSet().has(String(article._id));

  var $p = $("<p>")
    .addClass("articleitem")
    .toggleClass("favorited-article", isFav)
    .toggleClass("read-article", isRead)
    .attr("data-id", article._id)
    .attr("data-link", article.link)
    .attr("title", "Click to open article (right-click to toggle read)");

  // Star button
  var $star = $("<span>")
    .addClass("star-btn")
    .toggleClass("favorited", isFav)
    .attr("data-id", article._id)
    .attr("title", "Star this article")
    .attr("role", "button")
    .attr("tabindex", "0")
    .text(isFav ? "★" : "☆");

  // Title (safe: .text() escapes)
  var $title = $("<span>").addClass("article-title").text(article.title);

  // Meta
  var $meta = $("<span>").addClass("meta-group");
  if (article.score) $meta.append($("<span>").addClass("meta").text("▲ " + article.score));
  if (article.by)    $meta.append($("<span>").addClass("meta").text("by " + article.by));
  if (article.time)  $meta.append($("<span>").addClass("meta").text(timeAgo(article.time)));

  // Note button
  var $noteBtn = $("<span>")
    .addClass("note-btn")
    .attr("data-id", article._id)
    .attr("title", "Add or edit a note")
    .attr("role", "button")
    .attr("tabindex", "0")
    .text("📝");

  // Domain link (href is set via .attr() which escapes quotes/ampersands safely)
  var domain = article.link || "";
  try { domain = new URL(article.link).hostname.replace(/^www\./, ""); } catch (e) {}

  var $linkify = $("<a>")
    .addClass("articlelink")
    .attr("href", article.link)
    .attr("target", "_blank")
    .attr("rel", "noopener noreferrer")
    .attr("title", article.link)
    .text(domain);

  var $thelink = $("<span>").addClass("thelink").append($linkify);

  if (article.hnId) {
    var count = article.commentCount != null ? article.commentCount : "?";
    var $comments = $("<a>")
      .addClass("commentlink")
      .attr("href", "https://news.ycombinator.com/item?id=" + encodeURIComponent(article.hnId))
      .attr("target", "_blank")
      .attr("rel", "noopener noreferrer")
      .attr("title", "Open discussion on Hacker News")
      .text("💬 " + count);
    $thelink.append(" ", $comments);
  }

  $p.append($star, " ", $title, " ", $meta, " ", $noteBtn, $("<br>"), $thelink);

  if (hideReadArticles && isRead) $p.hide();

  $("#articles").append($p);
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
    var group = $("<span>").addClass("best-group");
    group.append(
      $("<button>")
        .addClass("btn cat-btn")
        .text(label)
        .attr("title", desc)
        .attr("data-category", "best")
    );
    [["week", "Wk", "Past Week"], ["month", "Mo", "Past Month"], ["year", "Yr", "Past Year"]].forEach(function (p) {
      group.append(
        $("<button>")
          .addClass("btn best-period-btn")
          .text(p[1])
          .attr("title", "Best of " + p[2])
          .attr("data-best-period", p[0])
          .attr("data-best-label", p[2])
      );
    });
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
  showLoading("Fetching top stories from Hacker News...");
  $.ajax({ method: "GET", url: "/scrape" })
    .done(function () {
      setTimeout(function () {
        loadArticles();
        hideLoading();
      }, 1500);
    })
    .fail(function (xhr) {
      hideLoading();
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

// Hide read toggle
$(document).on("click", "#hide-read-btn", function () {
  hideReadArticles = !hideReadArticles;
  $(this).toggleClass("active-nav", hideReadArticles);
  if (hideReadArticles) {
    $("p.articleitem.read-article").fadeOut(200);
  } else {
    $("p.articleitem.read-article").fadeIn(200);
  }
});

// Category button click — clears search, loads feed articles
$(document).on("click", ".cat-btn", function () {
  var cat = $(this).data("category");
  if (!cat) return;
  activeCategory = cat;
  $(".cat-btn").removeClass("active");
  $(this).addClass("active");
  clearSearch();

  if (cat === "all") {
    loadArticles();
    return;
  }

  if (cat === "best") {
    $("#search-label").html(
      "Best: <strong>HN&rsquo;s current top list</strong>" +
      " &nbsp;<span style='color:#666;font-size:12px'>(use Wk / Mo / Yr for time-filtered)</span>" +
      " <a id='clear-search' href='#' title='Return to feed view'>✕ clear</a>"
    );
  }

  showLoading("Fetching " + cat + " stories...");
  $.ajax({ method: "GET", url: "/scrape/" + cat })
    .done(function () {
      setTimeout(function () {
        loadArticles();
        hideLoading();
      }, 1500);
    })
    .fail(function (xhr) {
      hideLoading();
      var msg = (xhr.responseJSON && xhr.responseJSON.error) || "Could not reach the database.";
      bootbox.alert("<strong>Database unavailable</strong><br>" + msg);
    });
});

// Best time-period buttons (Wk / Mo / Yr) — hits Algolia, results not saved to DB
$(document).on("click", ".best-period-btn", function (e) {
  e.preventDefault();
  e.stopPropagation();
  var $btn      = $(this);
  var period    = $btn.data("best-period");
  var fullLabel = $btn.data("best-label") || period;

  clearSearch();
  $(".cat-btn, .saved-cat-btn, .best-period-btn").removeClass("active");
  $(".cat-btn[data-category='best']").addClass("active");
  $btn.addClass("active");

  showLoading("Loading best stories (" + fullLabel + ")...");
  $.ajax({ method: "GET", url: "/best", data: { period: period } })
    .done(function (results) {
      hideLoading();
      $("#articles").empty();
      $("#search-label").html(
        "Best stories: <strong>" + escapeForLabel(fullLabel) + "</strong>" +
        " <a id='clear-search' href='#' title='Return to feed view'>✕ clear</a>"
      );
      if (!results.length) {
        $("#articles").append("<p style='color:#aaa'>No results found.</p>");
        return;
      }
      results.forEach(renderArticle);
    })
    .fail(function () {
      hideLoading();
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

  showLoading("Searching HN for \"" + query + "\"...");
  $.ajax({ method: "GET", url: "/search", data: { query: query, type: activeCategory } })
    .done(function (results) {
      hideLoading();
      $("#articles").empty();
      var alreadySaved = getSavedTabs().includes(query);
      $("#search-label").html(
        "Search results for <strong>\"" + escapeForLabel(query) + "\"</strong>" +
        (activeCategory !== "all" ? " in <strong>" + escapeForLabel(activeCategory) + "</strong>" : "") +
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
      hideLoading();
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

// Article click — open article in new tab + mark as read
$(document).on("click", "p.articleitem", function () {
  var link = $(this).data("link");
  var id   = $(this).data("id");
  if (!link) return;
  markRead(id);
  $(this).addClass("read-article");
  if (hideReadArticles) $(this).fadeOut(200);
  // window.open's 2nd arg is target (e.g. _blank), 3rd is features.
  var newWin = window.open(link, "_blank", "noopener,noreferrer");
  if (newWin) newWin.opener = null;
});

// Right-click on an article — toggle read state (lets you UN-mark-as-read)
// Skip when right-clicking a link, so the browser's native "open in new tab" menu still works.
$(document).on("contextmenu", "p.articleitem", function (e) {
  if ($(e.target).closest("a").length) return;
  e.preventDefault();
  var id = $(this).data("id");
  if ($(this).hasClass("read-article")) {
    unmarkRead(id);
    $(this).removeClass("read-article");
  } else {
    markRead(id);
    $(this).addClass("read-article");
    if (hideReadArticles) $(this).fadeOut(200);
  }
});

// Stop link clicks from bubbling to the article (would otherwise mark-read + open article again)
$(document).on("click", ".articlelink, .commentlink", function (e) {
  e.stopPropagation();
});

// Keyboard activation for span-based buttons (spans with role="button" tabindex="0")
$(document).on("keydown", ".star-btn, .note-btn", function (e) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    $(this).trigger("click");
  }
});

// Note button click — open note modal (does not open the article)
$(document).on("click", ".note-btn", function (e) {
  e.stopPropagation();
  var thisId = $(this).data("id");

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
