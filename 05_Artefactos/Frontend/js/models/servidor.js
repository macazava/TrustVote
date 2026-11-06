/* Model · ligação ao servidor: endereço da API, pedidos HTTP e mensagens de erro */
(function () {
  "use strict";

  const TV = (window.TrustVote = window.TrustVote || {});

  // O site é aberto pela entrada (8080), que já passa sozinha para o servidor que estiver
  // de pé. Começa sempre pela origem da página; se ela não responder (ex.: página aberta
  // diretamente no Nginx 1 ou 2 e esse servidor caiu), tenta a entrada e os outros nginx.
  const anfitriao = window.location.hostname || "127.0.0.1";
  const bases = [
    ...new Set([window.location.port || "8080", "8080", "8081", "8082"].map((p) => `http://${anfitriao}:${p}/api`)),
  ];
  const TIMEOUT = 12000;
  const CHAVE_BASE = "trustvote.api";

  let atual = 0;
  try {
    atual = Math.max(0, bases.indexOf(sessionStorage.getItem(CHAVE_BASE)));
  } catch {
    // sem sessionStorage: começa pelo Servidor 1
  }
  function usar(indice) {
    atual = indice;
    try {
      sessionStorage.setItem(CHAVE_BASE, bases[indice]);
    } catch {
      // sem sessionStorage: só fica para esta página
    }
  }

  // Endereço de uma página do site (estão todas em /pages/, servidas pelo nginx)
  const pageUrl = (file) => `/pages/${file}`;

  // ===== Erros =====
  class ApiError extends Error {
    constructor(message, status = 0) {
      super(message);
      this.status = status;
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
    const { body, query, auth = true, raw = false } = options;
    const urlEm = (indice) => {
      const url = new URL(bases[indice] + path);
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
      });
      return url;
    };

    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const token = auth ? TV.session.token() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    const started = performance.now();
    // cache "no-store": vai sempre ao servidor, nunca usa respostas (nem redirecionamentos)
    // guardadas pelo browser, por exemplo de quando a porta 8080 redirecionava para HTTPS
    const init = {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    };
    let response;
    try {
      // Só muda de nginx quando a ligação falha (servidor em baixo): um pedido que chegou
      // a ter resposta, mesmo de erro, nunca é repetido no outro.
      for (let tentativa = 0; !response; tentativa++) {
        const indice = (atual + tentativa) % bases.length;
        try {
          response = await fetch(urlEm(indice), init);
          if (indice !== atual) usar(indice);
        } catch (error) {
          if (error.name === "AbortError") throw error;
          if (tentativa === bases.length - 1) throw error;
        }
      }
    } catch (error) {
      throw new ApiError(
        error.name === "AbortError"
          ? `O servidor (${bases[atual]}) não respondeu a tempo.`
          : `Não foi possível contactar o servidor (${bases.join(" nem ")}). Confirme que a stack está a correr ` +
            "(Infraestrutura: .\\stack.cmd up)."
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
      if (response.status === 401 && token) TV.session.expire();
      throw new ApiError(messageFrom(response.status, data), response.status);
    }
    return data;
  }

  Object.assign(TV, { pageUrl, ApiError, request });
  // Endereço em uso neste momento (muda se um nginx falhar)
  Object.defineProperty(TV, "base", { get: () => bases[atual], enumerable: true });
})();
