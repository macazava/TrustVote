/* Model · ligação ao servidor: endereço da API, pedidos HTTP e mensagens de erro */
(function () {
  "use strict";

  const TV = (window.TrustVote = window.TrustVote || {});

  // Live Server (portas 55xx): usa a API do Docker. Atrás do nginx: mesma origem, em /api.
  const emDesenvolvimento = window.location.protocol === "file:" || /^55\d\d$/.test(window.location.port);
  const DEFAULT_BASE = emDesenvolvimento ? "http://127.0.0.1:8080/api" : `${window.location.origin}/api`;
  const BASE_KEY = "trustvote:api";
  const TIMEOUT = 12000;

  // Pôr a true para trabalhar sem backend: os pedidos são respondidos pelos dados de exemplo (models/demo)
  const MODO_ESTATICO = false;
  // Pôr a true para entrar nas áreas sem credenciais (só faz sentido com MODO_ESTATICO)
  const LOGIN_DESATIVADO = false;

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

  function setBase(url) {
    base = clean(url);
    try {
      localStorage.setItem(BASE_KEY, base);
    } catch { }
  }

  // As páginas estão em pages/ (o index.html na raiz só reencaminha para pages/inicio.html)
  const inPages = window.location.pathname.includes("/pages/");
  const pageUrl = (file) =>
    file.startsWith("index.html") ? (inPages ? `../${file}` : file) : inPages ? file : `pages/${file}`;

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
    const token = auth ? TV.session.token() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    const started = performance.now();
    let response;
    try {
      const init = { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal };
      response = MODO_ESTATICO && TV.servidorSimulado ? await TV.servidorSimulado(method, url, init.body) : await fetch(url, init);
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
      if (response.status === 401 && token) TV.session.expire();
      throw new ApiError(messageFrom(response.status, data), response.status);
    }
    return data;
  }

  Object.defineProperty(TV, "base", { get: () => base, enumerable: true });
  Object.assign(TV, { DEFAULT_BASE, LOGIN_DESATIVADO, MODO_ESTATICO, setBase, pageUrl, ApiError, request });
})();
