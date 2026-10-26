
document.addEventListener("DOMContentLoaded", () => {
  // Menu de navegação para dispositivos móveis
  const menuToggle = document.querySelector(".menu-toggle");
  const mainNav = document.querySelector(".main-nav");
  const headerActions = document.querySelector(".header-actions");

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("open");

      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute(
        "aria-label",
        isOpen ? "Fechar menu" : "Abrir menu"
      );

      if (headerActions) {
        headerActions.style.display = isOpen ? "flex" : "";
      }
    });

    // Fechar o menu depois de selecionar uma ligação
    mainNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        mainNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Abrir menu");

        if (headerActions) {
          headerActions.style.display = "";
        }
      });
    });

    // Fechar o menu quando se regressa a um ecrã maior
    window.addEventListener("resize", () => {
      if (window.innerWidth > 760) {
        mainNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Abrir menu");

        if (headerActions) {
          headerActions.style.display = "";
        }
      }
    });
  }

  // Navegação suave para secções da mesma página
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href");

      if (!targetId || targetId === "#") return;

      const target = document.querySelector(targetId);

      if (target) {
        event.preventDefault();

        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

        // Atualizar o endereço com o identificador da secção
        history.replaceState(null, "", targetId);
      }
    });
  });

  // Abrir automaticamente a secção indicada no endereço,
  // quando existe um identificador válido na página
  if (window.location.hash) {
    const target = document.querySelector(
      window.location.hash
    );

    if (target) {
      setTimeout(() => {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }
});