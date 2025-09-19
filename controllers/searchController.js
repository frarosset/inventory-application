const searchValidator = require("./validation/searchValidator.js");

exports.get = [
  searchValidator,
  (req, res) => {
    const q = req.query.q;

    if (q == null) {
      res.render("search", {
        pageTitle: process.env.TITLE,
      });
    } else {
      res.send("Search page with results for " + q);
    }
  },
];
