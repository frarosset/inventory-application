(() => {
  function dateFormatter() {
    const allDates = document.querySelectorAll(".date");

    allDates.forEach((el) => {
      const date = new Date(el.dataset.date);
      el.textContent = date.toLocaleString(["en-gb"]);
    });
  }

  dateFormatter();
})();
