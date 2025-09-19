exports.get = [
  (req, res) => {
    const q = req.query.q;

    if (q == null) {
      res.send("Search page with input only");
    } else {
      res.send("Search page with results for " + q);
    }
  },
];
