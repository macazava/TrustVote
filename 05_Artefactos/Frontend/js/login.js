/* Login e registo ligados ao backend */
document.addEventListener("DOMContentLoaded", () => {
  const { api, session, ui } = window.TrustVote;
  const form = document.querySelector("#auth-form");
  if (!form) return;

  const message = form.querySelector(".form-message");
  const nameField = document.querySelector("#name-field");
  const totpField = document.querySelector("#totp-field");
  const registerLink = form.querySelector(".register-link");
  const loginLink = form.querySelector("[data-login-link]");
  const serverStatus = document.querySelector("[data-server-status]");
  const params = new URLSearchParams(window.location.search);

  const role = () => (document.querySelector(".role-switch .active") || {}).dataset?.role || "eleitor";
  const isRegister = () => !nameField.hidden;

  // ===== Links entre "iniciar sessão" e "criar conta" =====
  function sync() {
    const team = role() === "equipa";
    registerLink.hidden = isRegister() || team;
    loginLink.hidden = !isRegister();
    if (isRegister()) showTotp(false);
  }

  function showTotp(show) {
    totpField.hidden = !show;
    form.elements.totp.required = show;
    if (!show) form.elements.totp.value = "";
  }

  document.querySelectorAll("[data-role], [data-mode]").forEach((button) => button.addEventListener("click", sync));
  loginLink.addEventListener("click", () => {
    document.querySelector('.mode-switch [data-mode="login"]').click();
    sync();
  });

  document.querySelector('[data-action="recover"]')?.addEventListener("click", () => {
    ui.message(message, "Para recuperar o acesso contacte a equipa: apoio@trustvote.pt · 800 200 300.");
  });

  if (params.get("motivo") === "expirada") ui.message(message, "A sessão terminou. Inicie sessão novamente.");

  // ===== Estado do servidor =====
  api
    .health()
    .then((res) => {
      serverStatus.classList.add(res.ok ? "is-ok" : "is-down");
      serverStatus.textContent = res.ok ? `● Servidor disponível (${res.latency} ms)` : "● Servidor com problemas";
    })
    .catch(() => {
      serverStatus.classList.add("is-down");
      serverStatus.textContent = "● Servidor indisponível";
    });

  // ===== Sessão já iniciada =====
  const claims = session.claims();
  if (claims) {
    const panel = claims.perfil === "administrador" ? "equipa.html" : "eleitor.html";
    ui.message(message, "");
    message.innerHTML = `Já tem sessão iniciada. <a href="${panel}">Continuar para a sua área →</a>`;
  }

  // ===== Login desativado: o botão entra diretamente na área escolhida =====
  if (window.TrustVote.LOGIN_DESATIVADO) {
    form.noValidate = true;
    ui.message(message, "Login desativado temporariamente: clique em Entrar para aceder sem credenciais.");
  }

  // ===== Envio do formulário =====
  // Fase de captura: corre antes do código de demonstração do main.js
  document.addEventListener(
    "submit",
    async (event) => {
      if (event.target !== form) return;
      event.preventDefault();
      event.stopPropagation();
      if (window.TrustVote.LOGIN_DESATIVADO) {
        window.location.href = role() === "equipa" ? "equipa.html" : "eleitor.html";
        return;
      }
      ui.message(message, "");
      if (!form.reportValidity()) return;

      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      const remember = form.elements.remember.checked;
      const submit = form.querySelector('[type="submit"]');

      if (isRegister()) {
        if (role() === "equipa") return ui.message(message, "As contas da equipa são criadas por um administrador.");
        if (password !== form.elements.confirm.value) return ui.message(message, "As palavras-passe não coincidem.");
        if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
          return ui.message(message, "A palavra-passe tem de ter pelo menos 8 caracteres, com letras e números.");
        }
        if (!form.elements.terms.checked) return ui.message(message, "É necessário aceitar os termos de utilização.");
      }

      try {
        await ui.busy(submit, isRegister() ? "A criar conta…" : "A entrar…", async () => {
          if (isRegister()) {
            await api.auth.registo({ nome: form.elements.name.value.trim(), email, password });
          }
          const dados = { email, password };
          if (!totpField.hidden) dados.codigo_totp = form.elements.totp.value.trim();
          session.save(await api.auth.login(dados), remember);
        });
      } catch (error) {
        if (/TOTP necess/i.test(error.message)) {
          showTotp(true);
          form.elements.totp.focus();
          return ui.message(message, "Introduza o código da sua aplicação autenticadora.");
        }
        return ui.message(message, error.message);
      }

      try {
        const user = await session.refresh();
        if (role() === "equipa" && !session.isAdmin(user)) {
          session.clear();
          return ui.message(message, "Esta conta não tem acesso à área da equipa.");
        }
        window.location.href = session.isAdmin(user) ? "equipa.html" : "eleitor.html";
      } catch (error) {
        ui.message(message, error.message);
      }
    },
    true
  );

  sync();
});
