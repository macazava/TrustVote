/* Controller · página de login: troca entre eleitor/equipa e entre "iniciar sessão"/"criar conta" */
document.addEventListener("DOMContentLoaded", () => {
  const authForm = document.querySelector("#auth-form");
  if (!authForm) return;

  const roleButtons = document.querySelectorAll("[data-role]");
  const modeButtons = document.querySelectorAll("[data-mode]");

  const nameField = document.querySelector("#name-field");
  const numberField = document.querySelector("#number-field");
  const courseField = document.querySelector("#course-field");
  const confirmField = document.querySelector("#confirm-field");
  const termsField = document.querySelector("#terms-field");

  const heading = document.querySelector("#auth-heading");
  const description = document.querySelector("#auth-description");
  const formTitle = document.querySelector("#form-title");
  const formHelp = document.querySelector("#form-help");
  const submitLabel = document.querySelector("#submit-label");
  const message = authForm.querySelector(".form-message");

  const password = authForm.elements.password;
  const confirmPassword = authForm.elements.confirm;
  const nameInput = authForm.elements.name;
  const numberInput = authForm.elements.numero;
  const courseInput = authForm.elements.curso;
  const terms = authForm.elements.terms;

  let selectedRole = new URLSearchParams(window.location.search).get("area") === "equipa" ? "equipa" : "eleitor";

  // Garantias do painel da marca: as do eleitor estão no HTML; as da equipa trocam-nas quando a área é a equipa
  const assurances = [...document.querySelectorAll("[data-assurances] > div")];
  const voterAssurances = assurances.map((item) => ({
    icon: item.querySelector("use")?.getAttribute("href"),
    title: item.querySelector("b")?.textContent,
    text: item.querySelector("small")?.textContent,
  }));
  const teamAssurances = [
    { icon: "#i-shield-check", title: "Acesso reservado", text: "Só as contas de administrador entram na área da equipa." },
    { icon: "#i-clipboard-list", title: "Tudo fica registado", text: "Cada ação da equipa entra no registo de auditoria encadeado." },
    { icon: "#i-lock", title: "Votos sempre anónimos", text: "A equipa vê totais e participação, nunca quem votou em quem." },
  ];

  function showAssurances(list) {
    assurances.forEach((item, i) => {
      const a = list[i];
      if (!a) return;
      item.querySelector("use")?.setAttribute("href", a.icon);
      item.querySelector("b").textContent = a.title;
      item.querySelector("small").textContent = a.text;
    });
  }
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
    if (numberField) numberField.hidden = !showRegisterFields;
    if (courseField) courseField.hidden = !showRegisterFields;
    if (confirmField) confirmField.hidden = !showRegisterFields;
    if (termsField) termsField.hidden = !showRegisterFields;

    nameInput.required = showRegisterFields;
    numberInput.required = showRegisterFields;
    courseInput.required = showRegisterFields;
    confirmPassword.required = showRegisterFields;
    terms.required = showRegisterFields;

    password.autocomplete = isRegister ? "new-password" : "current-password";
    confirmPassword.autocomplete = "new-password";

    formTitle.textContent = isRegister ? "Criar conta" : "Iniciar sessão";
    formHelp.textContent = isRegister ? "Preencha os campos para criar a sua conta." : "Introduza as suas credenciais para continuar.";
    submitLabel.innerHTML = `${isRegister ? "Criar conta" : "Iniciar sessão"} ${window.TrustVote.icon("arrow-right")}`;
    heading.textContent = isTeam ? "Área da Equipa" : "Área do Eleitor";
    description.textContent = isTeam
      ? "Inicie sessão para gerir eleições, candidatos e eleitores, acompanhar a votação e publicar os resultados."
      : "Inicie sessão para consultar a sua área reservada.";
    showAssurances(isTeam ? teamAssurances : voterAssurances);

    message.textContent = "";

    // Guarda o modo no endereço (#registar): ao abrir os termos e voltar atrás, volta ao formulário de registo
    const hash = isRegister ? "#registar" : "";
    if (window.location.hash !== hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search + hash);
    }
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

  // Mostrar ou esconder a palavra-passe
  authForm.querySelectorAll("[data-toggle-password]").forEach((button) => {
    const input = button.parentElement.querySelector("input");
    button.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute("aria-pressed", String(show));
      button.setAttribute("aria-label", show ? "Esconder palavra-passe" : "Mostrar palavra-passe");
    });
  });

  // A validação e o envio do formulário estão só em autenticacao.js
  updateForm();
});
