module.exports = (num) => {
  return `${(Math.round(num * 100) / 100).toFixed(2)} ${process.env.CURRENCY}`;
};
