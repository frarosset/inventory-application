exports.get = (req, res) => {
  res.render("index", { title: process.env.TITLE });
};
