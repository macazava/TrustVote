
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

document.addEventListener("DOMContentLoaded", () => {
  const authForm = document.querySelector("#auth-form");

  // Executar apenas na página de login
  if (!authForm) return;

  const roleButtons = document.querySelectorAll("[data-role]");
  const modeButtons = document.querySelectorAll("[data-mode]");

  const nameField = document.querySelector("#name-field");
  const confirmField = document.querySelector("#confirm-field");
  const termsField = document.querySelector("#terms-field");

  const heading = document.querySelector("#auth-heading");
  const description = document.querySelector("#auth-description");
  const formKicker = document.querySelector("#form-kicker");
  const formTitle = document.querySelector("#form-title");
  const formHelp = document.querySelector("#form-help");
  const submitLabel = document.querySelector("#submit-label");
  const message = authForm.querySelector(".form-message");

  const password = authForm.elements.password;
  const confirmPassword = authForm.elements.confirm;
  const nameInput = authForm.elements.name;
  const terms = authForm.elements.terms;

  let selectedRole = "eleitor";
  let selectedMode = "login";

  function updateForm() {
    const isRegister = selectedMode === "register";
    const isTeam = selectedRole === "equipa";

    roleButtons.forEach((button) => {
      const active = button.dataset.role === selectedRole;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    modeButtons.forEach((button) => {
      const active = button.dataset.mode === selectedMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    nameField.hidden = !isRegister;
    confirmField.hidden = !isRegister;
    termsField.hidden = !isRegister;

    nameInput.required = isRegister;
    confirmPassword.required = isRegister;
    terms.required = isRegister;

    password.autocomplete = isRegister
      ? "new-password"
      : "current-password";

    confirmPassword.autocomplete = "new-password";

    formKicker.textContent = isRegister
      ? "CRIAÇÃO DE CONTA"
      : "INÍCIO DE SESSÃO";

    formTitle.textContent = isRegister
      ? "Criar conta"
      : isTeam
        ? "Aceder à área da equipa"
        : "Aceder à área do eleitor";

    formHelp.textContent = isRegister
      ? "Preencha os campos para criar a sua conta."
      : "Introduza as suas credenciais para continuar.";

    submitLabel.innerHTML = isRegister
      ? "Criar conta →"
      : "Iniciar sessão →";

    heading.textContent = isTeam
      ? "Acesso reservado à equipa."
      : "Entre para exercer o seu voto.";

    description.textContent = isTeam
      ? "Aceda à área reservada da equipa do TrustVote."
      : "Inicie sessão para consultar a sua área reservada.";

    message.textContent = "";
  }

  roleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedRole = button.dataset.role;
      updateForm();
    });
  });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedMode = button.dataset.mode;
      updateForm();
    });
  });

  authForm.addEventListener("submit", (event) => {
    event.preventDefault();

    message.textContent = "";

    if (!authForm.reportValidity()) return;

    if (
      selectedMode === "register" &&
      password.value !== confirmPassword.value
    ) {
      message.textContent =
        "As palavras-passe não coincidem.";
      confirmPassword.focus();
      return;
    }

    if (selectedMode === "register" && !terms.checked) {
      message.textContent =
        "É necessário aceitar os termos de utilização.";
      terms.focus();
      return;
    }

    message.textContent =
      "Formulário validado. A ligação à API será integrada posteriormente.";
  });

  const recoverButton = document.querySelector(
    '[data-action="recover"]'
  );

  if (recoverButton) {
    recoverButton.addEventListener("click", () => {
      message.textContent =
        "A recuperação de acesso será disponibilizada após a integração com o backend.";
    });
  }

  updateForm();
});