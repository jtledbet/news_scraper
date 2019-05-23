var router = require("express").Router();

// This route renders the homepage
router.get("/", function(req, res) {
  res.render("home");
});

module.exports = router;
