/* Model · todos os pedidos ao backend, agrupados por assunto (TrustVote.api) */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { request } = TV;

  const get = (path, options) => request("GET", path, options);
  const post = (path, body, options) => request("POST", path, { ...options, body });
  const patch = (path, body, options) => request("PATCH", path, { ...options, body });
  const del = (path, options) => request("DELETE", path, options);

  // Rotas que o backend ainda não tem: 404 quer dizer "por implementar"
  const pend = { pending: true };

  TV.api = {
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
    },

    sondagem: {
      obter: (id) => get(`/eleicoes/${id}/sondagem`, pend),
      responder: (id, candidatoId) => post(`/eleicoes/${id}/sondagem/respostas`, { candidato_id: candidatoId }, pend),
    },

    publico: {
      resumo: () => get("/publico/resumo", { ...pend, auth: false }),
    },
  };
})();
