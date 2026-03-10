(() => {
  try {
    const value = window.localStorage.getItem("goksorry-theme");
    const root = document.documentElement;

    if (value === "light" || value === "dark") {
      root.setAttribute("data-theme", value);
      return;
    }

    root.removeAttribute("data-theme");
  } catch {
    document.documentElement.removeAttribute("data-theme");
  }
})();
