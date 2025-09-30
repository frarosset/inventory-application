(() => {
  const tabs = document.querySelectorAll("table.responsive");

  const checkResponsiveTables = () => {
    tabs.forEach((tab) => {
      tab.classList.remove("shrink");

      if (tab.scrollWidth > tab.clientWidth) {
        // console.log("Horizontal overflow detected");
        tab.classList.add("shrink");
      } else {
        // console.log("No horizontal overflow");
      }

      // console.log(tab.scrollWidth, tab.clientWidth);
    });
  };

  const observer = new ResizeObserver(checkResponsiveTables);

  observer.observe(document.body, {
    box: "border-box",
  });

  checkResponsiveTables();
})();
