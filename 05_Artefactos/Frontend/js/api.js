/* Ligação ao backend: endereço, pedidos, sessão e funções comuns */
(function () {
  "use strict";

  const DEFAULT_BASE = "http://127.0.0.1:8080";
  const BASE_KEY = "trustvote:api";
  const SESSION_KEY = "trustvote:sessao";
  const TIMEOUT = 12000;

  function readBase() {
    const fromQuery = new URLSearchParams(window.location.search).get("api");
    try {
      if (fromQuery) localStorage.setItem(BASE_KEY, fromQuery);
      return localStorage.getItem(BASE_KEY) || DEFAULT_BASE;
    } catch {
      return fromQuery || DEFAULT_BASE;
    }
  }

  const clean = (url) => String(url || DEFAULT_BASE).trim().replace(/\/+$/, "");
  let base = clean(readBase());

  // As páginas estão em pages/ e o index.html na raiz
  const inPages = window.location.pathname.includes("/pages/");
  const pageUrl = (file) =>
    file.startsWith("index.html") ? (inPages ? `../${file}` : file) : inPages ? file : `pages/${file}`;

  function setBase(url) {
    base = clean(url);
    try {
      localStorage.setItem(BASE_KEY, base);
    } catch {}
  }

  // ===== Erros =====
  class ApiError extends Error {
    constructor(message, status = 0, pending = false) {
      super(message);
      this.status = status;
      this.pending = pending;
    }
  }

  const statusMessages = {
    401: "A sessão terminou. Inicie sessão novamente.",
    403: "Não tem permissão para esta operação.",
    404: "O recurso pedido não existe.",
    409: "A operação não é compatível com o estado atual.",
    422: "Dados inválidos.",
    500: "Erro interno do servidor.",
    502: "O servidor não respondeu.",
    503: "Serviço temporariamente indisponível.",
  };

  function messageFrom(status, body) {
    const detail = body && body.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length) {
      return detail
        .map((item) => {
          const field = Array.isArray(item.loc) ? item.loc.filter((part) => part !== "body").join(".") : "";
          const msg = String(item.msg || "").replace(/^Value error, /, "");
          return field ? `${field}: ${msg}` : msg;
        })
        .join(" · ");
    }
    return statusMessages[status] || `Erro ${status}.`;
  }

  // ===== Pedidos =====
  async function request(method, path, options = {}) {
    const { body, query, auth = true, pending = false, raw = false } = options;
    const url = new URL(base + path);
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    });

    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const token = auth ? session.token() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    const started = performance.now();
    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      throw new ApiError(
        error.name === "AbortError"
          ? `O servidor (${base}) não respondeu a tempo.`
          : `Não foi possível contactar o servidor (${base}). Confirme que o backend está a correr e que permite pedidos deste endereço (CORS).`
      );
    } finally {
      clearTimeout(timer);
    }
    const latency = Math.round(performance.now() - started);

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (raw) return { ok: response.ok, status: response.status, data, latency };

    if (!response.ok) {
      if (pending && [404, 405, 501].includes(response.status)) {
        throw new ApiError("Esta funcionalidade ainda não está disponível no backend.", response.status, true);
      }
      if (response.status === 401 && token) session.expire();
      throw new ApiError(messageFrom(response.status, data), response.status);
    }
    return data;
  }

  const get = (path, options) => request("GET", path, options);
  const post = (path, body, options) => request("POST", path, { ...options, body });
  const patch = (path, body, options) => request("PATCH", path, { ...options, body });
  const del = (path, options) => request("DELETE", path, options);

  // Rotas que o backend ainda não tem: 404 quer dizer "por implementar"
  const pend = { pending: true };

  const api = {
    health: () => request("GET", "/health", { auth: false, raw: true }),

    auth: {
      registo: (dados) => post("/auth/registo", dados, { auth: false }),
      login: (dados) => post("/auth/login", dados, { auth: false }),
      eu: () => get("/auth/eu"),
      totpConfigurar: () => post("/auth/totp/configurar"),
      totpAtivar: (codigo) => post("/auth/totp/ativar", { codigo }),
      totpDesativar: (codigo) => post("/auth/totp/desativar", { codigo }),
    },

    utilizadores: {
      listar: (perfil) => get("/utilizadores", { query: { perfil } }),
      atualizar: (id, dados) => patch(`/utilizadores/${id}`, dados),
    },

    eleicoes: {
      listar: (estado) => get("/eleicoes", { query: { estado } }),
      detalhe: (id) => get(`/eleicoes/${id}`),
      criar: (dados) => post("/eleicoes", dados),
      atualizar: (id, dados) => patch(`/eleicoes/${id}`, dados),
      apagar: (id) => del(`/eleicoes/${id}`),
      acao: (id, acao) => post(`/eleicoes/${id}/${acao}`),
      criarRonda: (id, dados) => post(`/eleicoes/${id}/rondas`, dados),
      atualizarRonda: (id, n, dados) => patch(`/eleicoes/${id}/rondas/${n}`, dados),
      acaoRonda: (id, n, acao) => post(`/eleicoes/${id}/rondas/${n}/${acao}`),
      criarCandidato: (id, dados) => post(`/eleicoes/${id}/candidatos`, dados),
      atualizarCandidato: (id, cid, dados) => patch(`/eleicoes/${id}/candidatos/${cid}`, dados),
      apagarCandidato: (id, cid) => del(`/eleicoes/${id}/candidatos/${cid}`),
      habilitados: (id) => get(`/eleicoes/${id}/habilitados`),
      habilitar: (id, ids) => post(`/eleicoes/${id}/habilitados`, { utilizador_ids: ids }),
      desabilitar: (id, uid) => del(`/eleicoes/${id}/habilitados/${uid}`),
    },

    votacao: {
      votar: (id, n, candidatoId) => post(`/eleicoes/${id}/rondas/${n}/votos`, { candidato_id: candidatoId }, pend),
      participacao: (id) => get(`/eleicoes/${id}/participacao`, pend),
      recibos: () => get("/recibos", pend),
      verificarRecibo: (codigo) => get(`/recibos/${encodeURIComponent(codigo)}/verificar`, pend),
      resultados: (id) => get(`/eleicoes/${id}/resultados`, pend),
      estatisticas: (id) => get(`/eleicoes/${id}/estatisticas`, pend),
    },

    auditoria: {
      listar: (limite = 200) => get("/auditoria", { ...pend, query: { limite } }),
      verificar: () => get("/auditoria/verificar", pend),
    },

    sondagem: {
      obter: (id) => get(`/eleicoes/${id}/sondagem`, pend),
      responder: (id, candidatoId) => post(`/eleicoes/${id}/sondagem/respostas`, { candidato_id: candidatoId }, pend),
    },

    publico: {
      resumo: () => get("/publico/resumo", { ...pend, auth: false }),
    },
  };

  // ===== Sessão =====
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
      } catch {}
    },

    clear() {
      currentUser = null;
      try {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
      } catch {}
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
      if (!session.token()) {
        window.location.href = pageUrl(`login.html?area=${area}`);
        return new Promise(() => {});
      }
      const user = await session.refresh();
      if (area === "equipa" && !session.isAdmin(user)) {
        window.location.href = pageUrl("eleitor.html");
        return new Promise(() => {});
      }
      if (area === "eleitor" && session.isAdmin(user)) {
        window.location.href = pageUrl("equipa.html");
        return new Promise(() => {});
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
      window.location.href = pageUrl("index.html");
    },
  };

  // ===== Funções comuns =====
  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const number = (value) => (value === null || value === undefined ? "—" : new Intl.NumberFormat("pt-PT").format(value));

  const percent = (value) =>
    value === null || value === undefined
      ? "—"
      : `${new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;

  const dateTime = (iso) =>
    iso ? new Date(iso).toLocaleString("pt-PT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

  const date = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" }) : "—");

  const time = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) : "—");

  const period = (start, end) => (start && end ? `${dateTime(start)} — ${dateTime(end)}` : "Datas por definir");

  function initials(name = "") {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }

  function voterNumber(user) {
    const year = user && user.data_registo ? new Date(user.data_registo).getFullYear() : new Date().getFullYear();
    return `TV-${year}-${String((user && user.id) || 0).padStart(3, "0")}`;
  }

  function countdown(iso) {
    const left = Math.max(0, Date.parse(iso) - Date.now());
    const d = Math.floor(left / 864e5);
    const h = Math.floor((left % 864e5) / 36e5);
    const m = Math.floor((left % 36e5) / 6e4);
    return `${String(d).padStart(2, "0")}d : ${String(h).padStart(2, "0")}h : ${String(m).padStart(2, "0")}m`;
  }

  // ===== Eleições =====
  const statusLabels = {
    rascunho: "RASCUNHO",
    agendada: "AGENDADA",
    em_curso: "VOTAÇÃO ABERTA",
    encerrada: "ENCERRADA",
  };

  function currentRound(eleicao) {
    const rondas = [...((eleicao && eleicao.rondas) || [])].sort((a, b) => a.numero - b.numero);
    return (
      rondas.find((r) => r.estado === "aberta") ||
      rondas.find((r) => r.estado === "agendada") ||
      rondas[rondas.length - 1] ||
      null
    );
  }

  function electionView(eleicao) {
    const ronda = currentRound(eleicao);
    const inicio = ronda ? ronda.data_inicio : null;
    const fim = ronda ? ronda.data_fim : null;
    const now = Date.now();
    const aberta =
      eleicao.estado === "em_curso" &&
      !!ronda &&
      ronda.estado === "aberta" &&
      (!inicio || Date.parse(inicio) <= now) &&
      (!fim || Date.parse(fim) > now);
    const candidatos = ronda && ronda.candidatos && ronda.candidatos.length
      ? ronda.candidatos
      : (eleicao.candidatos || []).filter((c) => c.ativo);

    return {
      ...eleicao,
      ronda,
      inicio,
      fim,
      aberta,
      ano: new Date(inicio || eleicao.data_criacao || Date.now()).getFullYear(),
      estadoLabel: statusLabels[eleicao.estado] || String(eleicao.estado).toUpperCase(),
      periodo: period(inicio, fim),
      voltaLabel: ronda ? `${ronda.numero === 2 ? "2.ª" : "1.ª"} volta · ${ronda.estado}` : "Sem ronda definida",
      candidatosRonda: candidatos,
    };
  }

  async function featuredElection() {
    const todas = await api.eleicoes.listar();
    const escolhida =
      todas.find((e) => e.estado === "em_curso") || todas.find((e) => e.estado === "agendada") || null;
    return escolhida ? electionView(await api.eleicoes.detalhe(escolhida.id)) : null;
  }

  // Converte datetime-local para ISO com fuso horário (exigido pelo backend)
  function fromLocalInput(value) {
    if (!value) return null;
    const d = new Date(value);
    const offset = -d.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
    return `${value.length === 16 ? `${value}:00` : value}${sign}${pad(offset / 60)}:${pad(offset % 60)}`;
  }

  function toLocalInput(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

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
      } catch {}
    },
  };

  // ===== Estados visuais =====
  const ui = {
    loading: (label = "A carregar…") => `<div class="state-box"><span class="spinner"></span><p>${escapeHtml(label)}</p></div>`,

    error: (error, retry = true) => `
      <div class="state-box">
        <span class="large-icon">${error && error.pending ? "…" : "!"}</span>
        <h3>${error && error.pending ? "Funcionalidade por disponibilizar" : "Não foi possível carregar"}</h3>
        <p>${escapeHtml((error && error.message) || error)}</p>
        ${retry ? '<button class="button button-outline" type="button" data-retry>Tentar novamente</button>' : ""}
      </div>`,

    empty: (title, text = "") => `
      <div class="state-box">
        <span class="large-icon">▤</span>
        <h3>${escapeHtml(title)}</h3>
        ${text ? `<p>${escapeHtml(text)}</p>` : ""}
      </div>`,

    message(el, text, ok = false) {
      if (!el) return;
      el.textContent = text || "";
      el.classList.toggle("is-ok", !!ok);
    },

    toast(text, error = false) {
      let host = document.querySelector(".toast-host");
      if (!host) {
        host = document.createElement("div");
        host.className = "toast-host";
        host.setAttribute("aria-live", "polite");
        document.body.appendChild(host);
      }
      const item = document.createElement("p");
      item.className = `toast${error ? " toast-error" : ""}`;
      item.textContent = text;
      host.appendChild(item);
      setTimeout(() => item.remove(), 4200);
    },

    // Bloqueia o botão enquanto o pedido corre
    async busy(button, label, fn) {
      const original = button ? button.innerHTML : "";
      if (button) {
        button.disabled = true;
        button.textContent = label;
      }
      try {
        return await fn();
      } finally {
        if (button) {
          button.disabled = false;
          button.innerHTML = original;
        }
      }
    },

    // Mostra "a carregar", depois o conteúdo ou o erro com botão de repetir
    async mount(el, load) {
      el.innerHTML = ui.loading();
      try {
        await load();
      } catch (error) {
        el.innerHTML = ui.error(error);
        el.querySelector("[data-retry]")?.addEventListener("click", () => ui.mount(el, load));
      }
    },
  };

  window.TrustVote = {
    get base() {
      return base;
    },
    DEFAULT_BASE,
    setBase,
    pageUrl,
    ApiError,
    request,
    api,
    session,
    format: { escapeHtml, number, percent, dateTime, date, time, period, initials, voterNumber, countdown },
    elections: { statusLabels, currentRound, view: electionView, featured: featuredElection, fromLocalInput, toLocalInput },
    localReceipts,
    ui,
  };
})();
