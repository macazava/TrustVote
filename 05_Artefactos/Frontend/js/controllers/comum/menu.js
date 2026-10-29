/* Controller · menu "☰" no telemóvel e deslocação suave até às âncoras (#secção) */
document.addEventListener("DOMContentLoaded", () => {
  // ===== Menu de navegação nos dispositivos móveis =====
  const menuToggle = document.querySelector(".menu-toggle");
  const mainNav = document.querySelector(".main-nav");
  const headerActions = document.querySelector(".header-actions");

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("open");

      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");

      if (headerActions) {
        headerActions.style.display = isOpen ? "flex" : "";
      }
    });

    const close = () => {
      mainNav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Abrir menu");

      if (headerActions) {
        headerActions.style.display = "";
      }
    };

    mainNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));

    window.addEventListener("resize", () => {
      if (window.innerWidth > 760) close();
    });
  }

  // ===== Navegação suave para âncoras =====
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href");

      if (!targetId || targetId === "#") return;

      const target = document.querySelector(targetId);

      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", targetId);
      }
    });
  });

  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);

    if (target) {
      setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }
});
