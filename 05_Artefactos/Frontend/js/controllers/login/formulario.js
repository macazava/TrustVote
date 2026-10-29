/* Controller · página de login: troca entre eleitor/equipa e entre "iniciar sessão"/"criar conta" */
document.addEventListener("DOMContentLoaded", () => {
  const authForm = document.querySelector("#auth-form");
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

  let selectedRole = new URLSearchParams(window.location.search).get("area") === "equipa" ? "equipa" : "eleitor";
  let selectedMode = window.location.hash === "#registar" ? "register" : "login";

  // Mostra os campos e textos certos para a combinação escolhida
  function updateForm() {
    const isRegister = selectedMode === "register";
    const isTeam = selectedRole === "equipa";
    const showRegisterFields = isRegister && !isTeam;

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

    if (nameField) nameField.hidden = !showRegisterFields;
    if (confirmField) confirmField.hidden = !showRegisterFields;
    if (termsField) termsField.hidden = !showRegisterFields;

    nameInput.required = showRegisterFields;
    confirmPassword.required = showRegisterFields;
    terms.required = showRegisterFields;

    password.autocomplete = isRegister ? "new-password" : "current-password";
    confirmPassword.autocomplete = "new-password";

    formKicker.textContent = isRegister ? "CRIAÇÃO DE CONTA" : "INÍCIO DE SESSÃO";
    formTitle.textContent = isRegister ? "Criar conta" : isTeam ? "Aceder à área da equipa" : "Aceder à área do eleitor";
    formHelp.textContent = isRegister ? "Preencha os campos para criar a sua conta." : "Introduza as suas credenciais para continuar.";
    submitLabel.textContent = isRegister ? "Criar conta →" : "Iniciar sessão →";
    heading.textContent = isTeam ? "Acesso reservado à equipa." : "Entre para exercer o seu voto.";
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

  // A validação e o envio do formulário estão só em autenticacao.js
  updateForm();
});
