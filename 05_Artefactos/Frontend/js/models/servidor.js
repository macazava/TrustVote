/* Model · ligação ao servidor: endereço da API, pedidos HTTP e mensagens de erro */
(function () {
  "use strict";

  const TV = (window.TrustVote = window.TrustVote || {});

  // Único endereço da API: o nginx do Docker, que reparte os pedidos pelos dois servidores
  const base = "http://127.0.0.1:8080/api";
  const TIMEOUT = 12000;

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
      response = await fetch(url, init);
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

  Object.assign(TV, { base, pageUrl, ApiError, request });
})();
