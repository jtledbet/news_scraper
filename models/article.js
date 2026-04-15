
var mongoose = require("mongoose");
var Schema = mongoose.Schema;
var ArticleSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  link: {
    type: String,
    required: true,
    unique: true
  },
  score: {
    type: Number
  },
  by: {
    type: String
  },
  time: {
    type: Number
  },
  commentCount: {
    type: Number
  },
  hnId: {
    type: String
  },
  favorited: {
    type: Boolean,
    default: false
  },
  note: {
    type: Schema.Types.ObjectId,
    ref: "Note"
  }
});

var Article = mongoose.model("Article", ArticleSchema);

module.exports = Article;
