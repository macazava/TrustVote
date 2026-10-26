
document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // 1. MENU DE NAVEGAÇÃO PARA DISPOSITIVOS MÓVEIS
  // ==========================================
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

  // ==========================================
  // 2. NAVEGAÇÃO SUAVE PARA ÂNCORAS
  // ==========================================
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

        history.replaceState(null, "", targetId);
      }
    });
  });

  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);

    if (target) {
      setTimeout(() => {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }

  // ==========================================
  // 3. LOGIN E REGISTO
  // ==========================================
  const authForm = document.querySelector("#auth-form");

  if (authForm) {
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

    let selectedRole =
      new URLSearchParams(window.location.search).get("area") === "equipa"
        ? "equipa"
        : "eleitor";

    let selectedMode =
      window.location.hash === "#registar" ? "register" : "login";

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

      if (nameField) nameField.hidden = !(isRegister && !isTeam);
      if (confirmField) confirmField.hidden = !(isRegister && !isTeam);
      if (termsField) termsField.hidden = !(isRegister && !isTeam);

      nameInput.required = isRegister && !isTeam;
      confirmPassword.required = isRegister && !isTeam;
      terms.required = isRegister && !isTeam;

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

      submitLabel.textContent = isRegister
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
        selectedMode = "login";
        updateForm();
      });
    });

    modeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        selectedMode = button.dataset.mode;
        updateForm();
      });
    });

    document.querySelector(".register-link")?.addEventListener("click", () => {
      selectedMode = "register";
      updateForm();
    });

    authForm.addEventListener("submit", (event) => {
      event.preventDefault();

      message.textContent = "";

      if (!authForm.reportValidity()) return;

      if (selectedMode === "register") {
        if (selectedRole === "equipa") {
          message.textContent =
            "A criação de contas da equipa não está disponível nesta demonstração.";
          return;
        }

        if (password.value !== confirmPassword.value) {
          message.textContent = "As palavras-passe não coincidem.";
          confirmPassword.focus();
          return;
        }

        if (!terms.checked) {
          message.textContent =
            "É necessário aceitar os termos de utilização.";
          terms.focus();
          return;
        }

        message.textContent =
          "O registo real estará disponível após a integração com o backend.";
        return;
      }

      window.location.href =
        selectedRole === "equipa" ? "equipa.html" : "eleitor.html";
    });

    document
      .querySelector('[data-action="recover"]')
      ?.addEventListener("click", () => {
        message.textContent =
          "A recuperação de acesso estará disponível após a integração com o backend.";
      });

    updateForm();
  }

  // ==========================================
  // 4. NAVEGAÇÃO ENTRE PAINÉIS DO ELEITOR/EQUIPA
  // ==========================================
  function activateView(view) {
    const panel = document.querySelector(`[data-panel="${view}"]`);

    if (!panel) return;

    document.querySelectorAll("[data-panel]").forEach((item) => {
      item.classList.toggle("active", item.dataset.panel === view);
    });

    document.querySelectorAll("[data-view]").forEach((button) => {
      const active = button.dataset.view === view;

      button.classList.toggle("active", active);

      button.setAttribute("aria-current", active ? "page" : "false");
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      activateView(button.dataset.view);
    });
  });

  document.querySelectorAll("[data-view-go]").forEach((button) => {
    button.addEventListener("click", () => {
      activateView(button.dataset.viewGo);
    });
  });

  // ==========================================
  // 5. VOTAÇÃO DE DEMONSTRAÇÃO
  // ==========================================
  document
    .querySelector('[data-action="demo-vote"]')
    ?.addEventListener("click", () => {
      const choice = document.querySelector(
        'input[name="candidate"]:checked'
      );

      const message = document.querySelector("#vote-message");

      if (!choice) {
        message.textContent =
          "Selecione uma opção de demonstração antes de rever.";
        return;
      }

      const confirmed = window.confirm(
        `Confirmar a opção de demonstração "${choice.value}"? Nenhum voto real será enviado.`
      );

      if (confirmed) {
        message.textContent =
          `Opção "${choice.value}" selecionada na demonstração. Não foi registado qualquer voto real.`;
      } else {
        message.textContent =
          "Pode alterar a opção e tentar novamente.";
      }
    });

  // ==========================================
  // 6. SONDAGENS DE DEMONSTRAÇÃO
  // ==========================================
  document.querySelector("#poll-form")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const choice = new FormData(form).get("poll");
    const message = form.querySelector(".form-message");

    if (!choice) {
      message.textContent = "Selecione uma opção.";
      return;
    }

    message.textContent =
      `Resposta "${choice}" validada apenas nesta interface. Não foi enviada para um servidor.`;
  });

  // ==========================================
  // 7. FORMULÁRIO DE APOIO
  // ==========================================
  document
    .querySelector("#support-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();

      const form = event.currentTarget;
      const message = form.querySelector(".form-message");

      if (!form.reportValidity()) return;

      message.textContent =
        "Formulário de demonstração: a mensagem não foi enviada. A integração com o backend será necessária para contactar a equipa.";
    });

  // ==========================================
  // 8. PREFERÊNCIAS DE ACESSIBILIDADE
  // ==========================================
  document.querySelector("#large-text")?.addEventListener("change", (event) => {
    document.body.classList.toggle("large-text", event.target.checked);
  });

  document.querySelector("#contrast")?.addEventListener("change", (event) => {
    document.body.classList.toggle("high-contrast", event.target.checked);
  });
});