/* Model · sessão do utilizador (token, quem está ligado, proteção das áreas) e recibos guardados no dispositivo */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, pageUrl } = TV;

  const SESSION_KEY = "trustvote:sessao";

  // Utilizadores usados enquanto o login está desativado (ver models/servidor.js)
  const demoUsers = {
    eleitor: { id: 2, nome: "Estudante Demonstração", email: "estudante@trustvote.pt", perfil: "eleitor", ativo: true, totp_ativo: false, data_registo: null },
    equipa: { id: 1, nome: "Equipa Demonstração", email: "equipa@trustvote.pt", perfil: "administrador", ativo: true, totp_ativo: false, data_registo: null },
  };

  function readSession() {
    try {
      const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || "null");
      if (!value || !value.token) return null;
      if (value.expiresAt && Date.parse(value.expiresAt) <= Date.now()) {
        session.clear();
        return null;
      }
      return value;
    } catch {
      return null;
    }
  }

  let currentUser = null;

  const session = {
    token: () => (readSession() || {}).token || null,

    save(resposta, remember) {
      session.clear();
      const value = {
        token: resposta.access_token,
        expiresAt: resposta.expires_in ? new Date(Date.now() + resposta.expires_in * 1000).toISOString() : null,
      };
      try {
        (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(value));
      } catch { }
    },

    clear() {
      currentUser = null;
      try {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
      } catch { }
    },

    claims() {
      const token = session.token();
      if (!token) return null;
      try {
        const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(decodeURIComponent(escape(atob(part))));
      } catch {
        return null;
      }
    },

    get user() {
      return currentUser;
    },

    isAdmin: (user = currentUser) => !!user && user.perfil === "administrador",

    async refresh() {
      currentUser = await api.auth.eu();
      return currentUser;
    },

    // Protege as áreas reservadas: sem sessão volta ao login
    async require(area) {
      if (TV.LOGIN_DESATIVADO) {
        currentUser = demoUsers[area];
        return currentUser;
      }
      if (!session.token()) {
        window.location.href = pageUrl(`login.html?area=${area}`);
        return new Promise(() => { });
      }
      const user = await session.refresh();
      if (area === "equipa" && !session.isAdmin(user)) {
        window.location.href = pageUrl("eleitor.html");
        return new Promise(() => { });
      }
      if (area === "eleitor" && session.isAdmin(user)) {
        window.location.href = pageUrl("equipa.html");
        return new Promise(() => { });
      }
      const expiresAt = (readSession() || {}).expiresAt;
      if (expiresAt) {
        const left = Date.parse(expiresAt) - Date.now();
        if (left > 0 && left < 2 ** 31) setTimeout(session.expire, left);
      }
      return user;
    },

    expire() {
      const area = document.body.dataset.page === "admin" ? "equipa" : "eleitor";
      session.clear();
      if (document.body.dataset.page === "login") return;
      window.location.href = pageUrl(`login.html?area=${area}&motivo=expirada`);
    },

    logout() {
      session.clear();
      window.location.href = pageUrl("inicio.html");
    },
  };

  // ===== Recibos guardados no dispositivo (cópia de segurança) =====
  const receiptsKey = () => `trustvote:recibos:${(currentUser && currentUser.id) || "anon"}`;
  const localReceipts = {
    all() {
      try {
        return JSON.parse(localStorage.getItem(receiptsKey()) || "[]");
      } catch {
        return [];
      }
    },
    save(recibo) {
      const list = localReceipts.all().filter((r) => r.recibo !== recibo.recibo);
      list.unshift(recibo);
      try {
        localStorage.setItem(receiptsKey(), JSON.stringify(list));
      } catch { }
    },
  };

  TV.session = session;
  TV.localReceipts = localReceipts;
})();
