document.addEventListener("DOMContentLoaded", () => {
  const btnMenuConfig = document.getElementById("btnMenuConfig");
  const panelConfig = document.getElementById("panelConfig");

  if (!btnMenuConfig || !panelConfig) {
    console.warn("menuConfig.js: No se encontró btnMenuConfig o panelConfig");
    return;
  }

  btnMenuConfig.addEventListener("click", (event) => {
    event.stopPropagation();
    panelConfig.classList.toggle("oculto");
  });

  panelConfig.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    panelConfig.classList.add("oculto");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      panelConfig.classList.add("oculto");
    }
  });
});