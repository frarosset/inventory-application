exports.get = (req, res) => {
  res.render("index", { pageTitle: process.env.TITLE });
};
